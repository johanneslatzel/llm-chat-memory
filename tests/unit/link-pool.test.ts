import { describe, it, expect } from 'vitest';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { LinkPool } from '../../src/lib/link/link-pool.js';
import { MemoryConfiguration } from '../../src/lib/config.js';
import { withTempDir } from '../helper/temp-fs.js';

function makeConfig(dir?: string): MemoryConfiguration {
    return new MemoryConfiguration(dir, 5, 5);
}

async function outgoingEdges(pool: LinkPool, from: string): Promise<string[]> {
    return (await pool.getEdges()).filter(e => e.from === from).map(e => e.to);
}

describe('LinkPool', () => {
    it('starts empty', async () => {
        const pool = new LinkPool(makeConfig());
        expect(await pool.getEdges()).toEqual([]);
    });

    it('add creates constant link', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(1);
        expect(edges[0]!.weight).toBe(10);
        expect(edges[0]!.from).toBe('a');
        expect(edges[0]!.to).toBe('b');
    });

    it('add overwrites semantic with constant', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.syncSemanticLinks([{ from: 'a', to: 'b', weight: 0.5 }]);
        expect((await pool.getEdges())[0]!.weight).toBe(0.5);

        await pool.add('a', 'b');
        expect((await pool.getEdges())[0]!.weight).toBe(10);
    });

    it('add no-ops if constant already exists', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        await pool.add('a', 'b');
        expect(await pool.getEdges()).toHaveLength(1);
    });

    it('remove deletes a link', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        await pool.remove('a', 'b');
        expect(await pool.getEdges()).toHaveLength(0);
    });

    it('remove no-ops on non-existent link', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.remove('a', 'b');
        expect(await pool.getEdges()).toHaveLength(0);
    });

    it('isolate deletes all links involving id', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        await pool.add('a', 'c');
        await pool.add('d', 'a');
        await pool.add('x', 'y');
        await pool.isolate('a');
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(1);
        expect(edges[0]!.from).toBe('x');
    });

    it('outgoing returns targets from given id', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        await pool.add('a', 'c');
        await pool.add('b', 'c');
        expect(await outgoingEdges(pool, 'a')).toEqual(['b', 'c']);
        expect(await outgoingEdges(pool, 'b')).toEqual(['c']);
        expect(await outgoingEdges(pool, 'c')).toEqual([]);
    });

    it('getEdges includes constant and semantic links', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        await pool.syncSemanticLinks([{ from: 'c', to: 'd', weight: 0.7 }]);
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find((e) => e.from === 'a')?.weight).toBe(10);
    });

    it('link creates constant links for each target', async () => {
        const pool = new LinkPool(makeConfig());
        const linked = await pool.link('a', ['b', 'c']);
        expect(linked).toEqual(['b', 'c']);
        expect(await outgoingEdges(pool, 'a')).toEqual(['b', 'c']);
    });

    it('link skips self-references', async () => {
        const pool = new LinkPool(makeConfig());
        const linked = await pool.link('a', ['a', 'b']);
        expect(linked).toEqual(['b']);
        expect(await outgoingEdges(pool, 'a')).toEqual(['b']);
    });

    it('link returns empty array when all targets are self', async () => {
        const pool = new LinkPool(makeConfig());
        const linked = await pool.link('a', ['a']);
        expect(linked).toEqual([]);
        expect(await outgoingEdges(pool, 'a')).toEqual([]);
    });

    it('link does not validate target existence', async () => {
        const pool = new LinkPool(makeConfig());
        const linked = await pool.link('a', ['nonexistent']);
        expect(linked).toEqual(['nonexistent']);
    });

    it('link skips targets that already have a constant link', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        const linked = await pool.link('a', ['b', 'c']);
        expect(linked).toEqual(['c']);
        expect(await outgoingEdges(pool, 'a')).toEqual(['b', 'c']);
    });

    it('unlink removes links for each target', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.link('a', ['b', 'c']);
        await pool.unlink('a', ['b']);
        expect(await outgoingEdges(pool, 'a')).toEqual(['c']);
    });

    it('unlink no-ops on non-existent links', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.link('a', ['b']);
        await pool.unlink('a', ['nonexistent']);
        expect(await outgoingEdges(pool, 'a')).toEqual(['b']);
    });

    it('load and save round-trip', async () => {
        await withTempDir(async (dir) => {
            const pool = new LinkPool(makeConfig(dir));
            await pool.add('a', 'b');
            await pool.add('x', 'y');

            await pool.save();

            const pool2 = new LinkPool(makeConfig(dir));
            await pool2.load();
            const edges = await pool2.getEdges();
            expect(edges).toHaveLength(2);
            expect(edges.find((e) => e.from === 'a' && e.to === 'b')?.weight).toBe(10);
            expect(edges.find((e) => e.from === 'x' && e.to === 'y')?.weight).toBe(10);
        });
    });

    it('load handles missing file gracefully', async () => {
        await withTempDir(async (dir) => {
            const pool = new LinkPool(makeConfig(dir));
            await expect(pool.load()).rejects.toThrow();
        });
    });

    it('save does not write file when empty', async () => {
        await withTempDir(async (dir) => {
            const pool = new LinkPool(makeConfig(dir));
            await pool.save();
            const files = await fsp.readdir(dir);
            expect(files).toHaveLength(0);
        });
    });

    it('load reads semantic links', async () => {
        await withTempDir(async (dir) => {
            const pool = new LinkPool(makeConfig(dir));
            await pool.syncSemanticLinks([{ from: 'a', to: 'b', weight: 0.7 }]);
            await pool.save();

            const pool2 = new LinkPool(makeConfig(dir));
            await pool2.load();
            const edges = await pool2.getEdges();
            expect(edges).toHaveLength(1);
            expect(edges[0]!.from).toBe('a');
            expect(edges[0]!.to).toBe('b');
            expect(edges[0]!.weight).toBe(0.7);
        });
    });

    it('syncSemanticLinks replaces semantic links but preserves constant links', async () => {
        await withTempDir(async (dir) => {
            const pool = new LinkPool(makeConfig(dir));
            await pool.add('constant-a', 'b');
            await pool.syncSemanticLinks([{ from: 'old-semantic', to: 'x', weight: 0.5 }]);

            await pool.syncSemanticLinks([
                { from: 'new-semantic', to: 'y', weight: 0.9 }
            ]);

            const edges = await pool.getEdges();
            expect(edges).toHaveLength(2);
            expect(edges.find((e) => e.from === 'constant-a')?.weight).toBe(10);
            expect(edges.find((e) => e.from === 'new-semantic')?.weight).toBe(0.9);
            expect(edges.find((e) => e.from === 'old-semantic')).toBeUndefined();
        });
    });

    it('syncSemanticLinks with empty edges removes all semantic links', async () => {
        await withTempDir(async (dir) => {
            const pool = new LinkPool(makeConfig(dir));
            await pool.add('const', 'x');
            await pool.syncSemanticLinks([{ from: 'sem', to: 'x', weight: 0.5 }]);

            await pool.syncSemanticLinks([]);

            const edges = await pool.getEdges();
            expect(edges).toHaveLength(1);
            expect(edges[0]!.from).toBe('const');
        });
    });

    it('link with undirected creates reverse link (single)', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.link('a', 'b', true);
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
    });

    it('link with undirected creates reverse links (batch)', async () => {
        const pool = new LinkPool(makeConfig());
        const linked = await pool.link('a', ['b', 'c'], true);
        expect(linked).toEqual(['b', 'c']);
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(4);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
        expect(edges.find(e => e.from === 'a' && e.to === 'c')).toBeDefined();
        expect(edges.find(e => e.from === 'c' && e.to === 'a')).toBeDefined();
    });

    it('unlink with undirected removes both directions', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.link('a', 'b', true);
        await pool.unlink('a', 'b', true);
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(0);
    });

    it('syncSemanticLinks skips edges that already have a constant link', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('a', 'b');
        await pool.syncSemanticLinks([{ from: 'a', to: 'b', weight: 0.5 }]);
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(1);
        expect(edges[0]!.weight).toBe(10);
    });

    it('link with undirected skips reverse when constant already exists (batch)', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('b', 'a');
        const linked = await pool.link('a', ['b'], true);
        expect(linked).toEqual(['b']);
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
    });

    it('link with undirected skips reverse when constant already exists (single)', async () => {
        const pool = new LinkPool(makeConfig());
        await pool.add('b', 'a');
        await pool.link('a', 'b', true);
        const edges = await pool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
    });

    it('load handles unknown link type', async () => {
        await withTempDir(async (dir) => {
            await fsp.writeFile(
                path.join(dir, 'links.json'),
                JSON.stringify([
                    { type: 'unknown', from: 'a', to: 'b' },
                    { type: 'constant', from: 'c', to: 'd' },
                ]),
                'utf-8'
            );
            const pool = new LinkPool(makeConfig(dir));
            await pool.load();
            const edges = await pool.getEdges();
            expect(edges).toHaveLength(1);
            expect(edges[0]!.from).toBe('c');
        });
    });
});
