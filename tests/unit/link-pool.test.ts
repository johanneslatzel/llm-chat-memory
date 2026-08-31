import { describe, it, expect } from 'vitest';
import { JsonFileStore, MemoryStore } from '@johannes.latzel/json-file-store';
import { LinkPool } from '../../src/lib/link/link-pool.js';
import { MemoryConfiguration } from '../../src/lib/config.js';
import { MemoryPool } from '../../src/lib/memory/memory-pool.js';
import type { MemoryJSON } from '../../src/lib/memory/memory.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

function makeConfig(dir?: string): MemoryConfiguration {
    return new MemoryConfiguration(dir, 5, 5);
}

function makePool(config: MemoryConfiguration): {
    pool: MemoryPool;
    linkPool: LinkPool;
} {
    const store = config.memoryDir
        ? new JsonFileStore<MemoryJSON>({ dir: config.memoryDir })
        : new MemoryStore<MemoryJSON>();
    const pool = new MemoryPool(config, new MockEmbedder(), store);
    return { pool, linkPool: new LinkPool(pool) };
}

async function outgoingEdges(pool: LinkPool, from: string): Promise<string[]> {
    return (await pool.getEdges()).filter(e => e.from === from).map(e => e.to);
}

describe('LinkPool', () => {
    it('starts empty', async () => {
        const { linkPool } = makePool(makeConfig());
        expect(await linkPool.getEdges()).toEqual([]);
    });

    it('add creates constant link', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(1);
        expect(edges[0]!.weight).toBe(10);
        expect(edges[0]!.from).toBe('a');
        expect(edges[0]!.to).toBe('b');
    });

    it('add overwrites semantic with constant', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.syncSemanticLinks([{ from: 'a', to: 'b', weight: 0.5 }]);
        expect((await linkPool.getEdges())[0]!.weight).toBe(0.5);

        await linkPool.add('a', 'b');
        expect((await linkPool.getEdges())[0]!.weight).toBe(10);
    });

    it('add no-ops if constant already exists', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        await linkPool.add('a', 'b');
        expect(await linkPool.getEdges()).toHaveLength(1);
    });

    it('remove deletes a link', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        await linkPool.remove('a', 'b');
        expect(await linkPool.getEdges()).toHaveLength(0);
    });

    it('remove no-ops on non-existent link', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.remove('a', 'b');
        expect(await linkPool.getEdges()).toHaveLength(0);
    });

    it('isolate deletes all links involving id', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        await linkPool.add('a', 'c');
        await linkPool.add('d', 'a');
        await linkPool.add('x', 'y');
        await linkPool.isolate('a');
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(1);
        expect(edges[0]!.from).toBe('x');
    });

    it('outgoing returns targets from given id', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        await linkPool.add('a', 'c');
        await linkPool.add('b', 'c');
        expect(await outgoingEdges(linkPool, 'a')).toEqual(['b', 'c']);
        expect(await outgoingEdges(linkPool, 'b')).toEqual(['c']);
        expect(await outgoingEdges(linkPool, 'c')).toEqual([]);
    });

    it('getEdges includes constant and semantic links', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        await linkPool.syncSemanticLinks([{ from: 'c', to: 'd', weight: 0.7 }]);
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find((e) => e.from === 'a')?.weight).toBe(10);
    });

    it('link creates constant links for each target', async () => {
        const { linkPool } = makePool(makeConfig());
        const linked = await linkPool.link('a', ['b', 'c']);
        expect(linked).toEqual(['b', 'c']);
        expect(await outgoingEdges(linkPool, 'a')).toEqual(['b', 'c']);
    });

    it('link skips self-references', async () => {
        const { linkPool } = makePool(makeConfig());
        const linked = await linkPool.link('a', ['a', 'b']);
        expect(linked).toEqual(['b']);
        expect(await outgoingEdges(linkPool, 'a')).toEqual(['b']);
    });

    it('link returns empty array when all targets are self', async () => {
        const { linkPool } = makePool(makeConfig());
        const linked = await linkPool.link('a', ['a']);
        expect(linked).toEqual([]);
        expect(await outgoingEdges(linkPool, 'a')).toEqual([]);
    });

    it('link does not validate target existence', async () => {
        const { linkPool } = makePool(makeConfig());
        const linked = await linkPool.link('a', ['nonexistent']);
        expect(linked).toEqual(['nonexistent']);
    });

    it('link skips targets that already have a constant link', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        const linked = await linkPool.link('a', ['b', 'c']);
        expect(linked).toEqual(['c']);
        expect(await outgoingEdges(linkPool, 'a')).toEqual(['b', 'c']);
    });

    it('unlink removes links for each target', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.link('a', ['b', 'c']);
        await linkPool.unlink('a', ['b']);
        expect(await outgoingEdges(linkPool, 'a')).toEqual(['c']);
    });

    it('unlink no-ops on non-existent links', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.link('a', ['b']);
        await linkPool.unlink('a', ['nonexistent']);
        expect(await outgoingEdges(linkPool, 'a')).toEqual(['b']);
    });

    it('link with undirected creates reverse link (single)', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.link('a', 'b', true);
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
    });

    it('link with undirected creates reverse links (batch)', async () => {
        const { linkPool } = makePool(makeConfig());
        const linked = await linkPool.link('a', ['b', 'c'], true);
        expect(linked).toEqual(['b', 'c']);
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(4);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
        expect(edges.find(e => e.from === 'a' && e.to === 'c')).toBeDefined();
        expect(edges.find(e => e.from === 'c' && e.to === 'a')).toBeDefined();
    });

    it('unlink with undirected removes both directions', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.link('a', 'b', true);
        await linkPool.unlink('a', 'b', true);
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(0);
    });

    it('syncSemanticLinks replaces semantic links but preserves constant links', async () => {
        await withTempDir(async (dir) => {
            const config = makeConfig(dir);
            const { pool, linkPool } = makePool(config);
            await pool.create('constant-a', {
                content: 'c',
                summary: 'This is a sufficiently long summary for constant a'
            });
            await pool.create('old-semantic', {
                content: 'o',
                summary: 'This is a sufficiently long summary for old semantic'
            });
            await pool.create('new-semantic', {
                content: 'n',
                summary: 'This is a sufficiently long summary for new semantic'
            });
            await linkPool.add('constant-a', 'b');
            await linkPool.syncSemanticLinks([{ from: 'old-semantic', to: 'x', weight: 0.5 }]);

            await linkPool.syncSemanticLinks([
                { from: 'new-semantic', to: 'y', weight: 0.9 }
            ]);

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(2);
            expect(edges.find((e) => e.from === 'constant-a')?.weight).toBe(10);
            expect(edges.find((e) => e.from === 'new-semantic')?.weight).toBe(0.9);
            expect(edges.find((e) => e.from === 'old-semantic')).toBeUndefined();
        });
    });

    it('syncSemanticLinks with empty edges removes all semantic links', async () => {
        await withTempDir(async (dir) => {
            const config = makeConfig(dir);
            const { pool, linkPool } = makePool(config);
            await pool.create('const', {
                content: 'c',
                summary: 'This is a sufficiently long summary for the constant memory'
            });
            await pool.create('sem', {
                content: 's',
                summary: 'This is a sufficiently long summary for the semantic memory'
            });
            await linkPool.add('const', 'x');
            await linkPool.syncSemanticLinks([{ from: 'sem', to: 'x', weight: 0.5 }]);

            await linkPool.syncSemanticLinks([]);

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(1);
            expect(edges[0]!.from).toBe('const');
            expect(edges[0]!.to).toBe('x');

            // the emptied source's links field must be persisted on disk and
            // the graph rebuild correctly from the memory files alone
            const { pool: pool2, linkPool: linkPool2 } = makePool(config);
            await pool2.initialize();
            await linkPool2.load();
            const rebuilt = await linkPool2.getEdges();
            expect(rebuilt).toHaveLength(1);
            expect(rebuilt[0]!.from).toBe('const');
            expect(rebuilt[0]!.to).toBe('x');
        });
    });

    it('syncSemanticLinks skips edges that already have a constant link', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('a', 'b');
        await linkPool.syncSemanticLinks([{ from: 'a', to: 'b', weight: 0.5 }]);
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(1);
        expect(edges[0]!.weight).toBe(10);
    });

    it('link with undirected skips reverse when constant already exists (batch)', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('b', 'a');
        const linked = await linkPool.link('a', ['b'], true);
        expect(linked).toEqual(['b']);
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
    });

    it('link with undirected skips reverse when constant already exists (single)', async () => {
        const { linkPool } = makePool(makeConfig());
        await linkPool.add('b', 'a');
        await linkPool.link('a', 'b', true);
        const edges = await linkPool.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.find(e => e.from === 'a' && e.to === 'b')).toBeDefined();
        expect(edges.find(e => e.from === 'b' && e.to === 'a')).toBeDefined();
    });

    it('persists constant links on the source memory and reloads on load', async () => {
        await withTempDir(async (dir) => {
            const config = makeConfig(dir);
            const { pool, linkPool } = makePool(config);
            await pool.create('a', {
                content: 'A',
                summary: 'This is a sufficiently long summary for memory a that exceeds fifty total characters'
            });
            await pool.create('b', {
                content: 'B',
                summary: 'This is a sufficiently long summary for memory b that exceeds fifty total characters'
            });
            await linkPool.add('a', 'b');

            const { pool: pool2, linkPool: linkPool2 } = makePool(config);
            await pool2.initialize();
            await linkPool2.load();
            const edges = await linkPool2.getEdges();
            expect(edges).toHaveLength(1);
            expect(edges[0]!.from).toBe('a');
            expect(edges[0]!.to).toBe('b');
            expect(edges[0]!.weight).toBe(10);
        });
    });

    it('persists semantic links on the source memory and reloads on load', async () => {
        await withTempDir(async (dir) => {
            const config = makeConfig(dir);
            const { pool, linkPool } = makePool(config);
            await pool.create('a', {
                content: 'A',
                summary: 'This is a sufficiently long summary for memory a that exceeds fifty total characters'
            });
            await pool.create('b', {
                content: 'B',
                summary: 'This is a sufficiently long summary for memory b that exceeds fifty total characters'
            });
            await linkPool.syncSemanticLinks([{ from: 'a', to: 'b', weight: 0.7 }]);

            const { pool: pool2, linkPool: linkPool2 } = makePool(config);
            await pool2.initialize();
            await linkPool2.load();
            const edges = await linkPool2.getEdges();
            expect(edges).toHaveLength(1);
            expect(edges[0]!.from).toBe('a');
            expect(edges[0]!.to).toBe('b');
            expect(edges[0]!.weight).toBe(0.7);
        });
    });

    it('load handles no memories gracefully', async () => {
        await withTempDir(async (dir) => {
            const config = makeConfig(dir);
            const { linkPool } = makePool(config);
            await expect(linkPool.load()).resolves.toBeUndefined();
        });
    });
});
