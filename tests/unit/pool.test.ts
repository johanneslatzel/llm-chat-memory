import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MemoryConfiguration } from '../../src/lib/config.js';
import { MemoryPool } from '../../src/lib/memory/memory-pool.js';
import { findElbow, cosineSimilarity } from '../../src/lib/util.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';
import type { TextEmbeddingProvider } from '../../src/lib/embedding/provider.js';

describe('MemoryPool', () => {
    it('starts empty', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            expect(await pool.all()).toEqual([]);
        });
    });

    it('create and get memory', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const memory = await pool.create('my-label', { content: 'Content', summary: 'My summary', tags: ['test'] });
            expect(memory.id()).toBe('my-label');
            expect(memory.content()).toBe('Content');

            const retrieved = await pool.get('my-label');
            expect(retrieved).toBeDefined();
            expect(retrieved!.id()).toBe('my-label');
            expect(retrieved!.content()).toBe('Content');

            expect(await pool.get('nonexistent')).toBeUndefined();
        });
    });

    it('create sanitises the id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const memory = await pool.create('  My Label!  ', { content: 'test', summary: 'My summary', tags: ['test'] });
            expect(memory.id()).toBe('my-label');
        });
    });

    it('create rejects label with no alphanumeric characters', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await expect(pool.create('!!!', { content: 'test', summary: 'My summary', tags: ['test'] })).rejects.toThrow(
                'must contain at least one alphanumeric character'
            );
            await expect(pool.create('---', { content: 'test', summary: 'My summary', tags: ['test'] })).rejects.toThrow(
                'must contain at least one alphanumeric character'
            );
            await expect(pool.create('   ', { content: 'test', summary: 'My summary', tags: ['test'] })).rejects.toThrow(
                'must contain at least one alphanumeric character'
            );
        });
    });

    it('create rejects duplicate id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await pool.create('my-label', { content: 'First', summary: 'My summary', tags: ['test'] });
            await expect(pool.create('my-label', { content: 'Second', summary: 'My summary', tags: ['test'] })).rejects.toThrow('already exists');
        });
    });

    it('create uses default score of 1', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const memory = await pool.create('x', { content: 'test', summary: 'My summary', tags: ['test'] });
            expect(memory.score()).toBe(1);
        });
    });

    it('delete removes memory from pool and disk', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await pool.create('del-test', { content: 'To delete', summary: 'My summary', tags: ['test'] });
            expect(await pool.get('del-test')).toBeDefined();
            await pool.delete('del-test');
            expect(await pool.get('del-test')).toBeUndefined();
        });
    });

    it('delete rejects unknown id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await expect(pool.delete('nonexistent')).rejects.toThrow('not found');
        });
    });

    it('update modifies fields', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await pool.create('x', {
                content: 'Original',
                summary: 'Original summary',
                tags: ['old']
            });

            await pool.update('x', {
                content: 'Updated',
                summary: 'Updated summary',
                tags: ['new']
            });

            const memory = (await pool.get('x'))!;
            expect(memory.content()).toBe('Updated');
            expect(memory.summary()).toBe('Updated summary');
            expect(memory.tags()).toEqual(['new']);
            expect(memory.score()).toBe(1);
        });
    });

    it('update partial fields', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await pool.create('x', {
                content: 'Original',
                summary: 'My summary',
                tags: ['tag']
            });

            await pool.update('x', { content: 'Only content' });

            const memory = (await pool.get('x'))!;
            expect(memory.content()).toBe('Only content');
            expect(memory.summary()).toBe('My summary');
            expect(memory.tags()).toEqual(['tag']);
            expect(memory.score()).toBe(1);
        });
    });

    it('update rejects unknown id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await expect(pool.update('nonexistent', { content: 'test' })).rejects.toThrow('not found');
        });
    });

    it('update changes changedAt timestamp', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const before = await pool.create('x', { content: 'Original', summary: 'My summary', tags: ['test'] });
            const beforeTime = before.changedAt().getTime();

            await new Promise((r) => setTimeout(r, 10));
            await pool.update('x', { content: 'Updated' });

            const after = (await pool.get('x'))!;
            expect(after.changedAt().getTime()).toBeGreaterThan(beforeTime);
        });
    });

    it('all returns all memories', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await pool.create('a', { content: 'A', summary: 'A sum', tags: ['test'] });
            await pool.create('b', { content: 'B', summary: 'B sum', tags: ['test'] });
            await pool.create('c', { content: 'C', summary: 'C sum', tags: ['test'] });
            expect(await pool.all()).toHaveLength(3);
        });
    });

    it('initialize loads memories from disk', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('init-1', { content: 'First', summary: 'First sum', tags: ['t1'] });
            await pool.create('init-2', { content: 'Second', summary: 'Second sum', tags: ['t2'] });

            const pool2 = new MemoryPool(config, new MockEmbedder());
            await pool2.initialize();
            expect(await pool2.all()).toHaveLength(2);
            expect((await pool2.get('init-1'))?.content()).toBe('First');
            expect((await pool2.get('init-2'))?.content()).toBe('Second');
        });
    });

    it('initialize handles missing directory gracefully', async () => {
        const config = testConfig('/nonexistent/path');
        const pool = new MemoryPool(config, new MockEmbedder());
        await pool.initialize();
        expect(await pool.all()).toHaveLength(0);
    });

    it('initialize handles corrupt JSON files', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await pool.create('valid', { content: 'good', summary: 'good sum' });

            const pool2 = new MemoryPool(config, new MockEmbedder());
            await fsp.mkdir(config.memoriesDir, { recursive: true });
            await fsp.writeFile(`${config.memoriesDir}/corrupt.json`, '{bad json}', 'utf-8');
            await pool2.initialize();
            const all = await pool2.all();
            expect(all).toHaveLength(1);
            expect(all[0]!.id()).toBe('valid');
        });
    });

    it('get returns a read-only view (no defensive copy)', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await pool.create('x', { content: 'Original', summary: 'My summary', tags: ['test'] });

            const first = (await pool.get('x'))!;
            const second = (await pool.get('x'))!;
            expect(first).toBe(second); // same reference
            expect(first.content()).toBe('Original');
        });
    });

    it('recall returns results when embedder is set', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());


            await pool.create('a', { content: 'Memory A', summary: 'A sum' });
            await pool.create('b', { content: 'Memory B', summary: 'B sum' });

            const results = await pool.recall('hello world');
            expect(results).toHaveLength(2);
            expect(results.map((r: { memory: { id(): string } }) => r.memory.id()).sort()).toEqual(['a', 'b']);
        });
    });

    it('recall does not mark memories as recalled', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('a', { content: 'A', summary: 'A sum' });

            const before = (await pool.get('a'))!;
            expect(before.recalledAt()).toBeNull();

            const results = await pool.recall('hello');
            expect(results).toHaveLength(1);
            expect(results[0]!.memory.id()).toBe('a');

            // pool's internal memory should still have null recalledAt
            const stored = (await pool.get('a'))!;
            expect(stored.recalledAt()).toBeNull();
        });
    });

    it('markRecalled updates recalledAt in-memory and persists', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('a', { content: 'A', summary: 'A sum' });

            const before = (await pool.get('a'))!;
            expect(before.recalledAt()).toBeNull();

            await pool.markRecalled('a');

            const after = (await pool.get('a'))!;
            expect(after.recalledAt()).not.toBeNull();
        });
    });

    it('markRecalled persists recalledAt to disk', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('a', { content: 'A', summary: 'A sum' });

            await pool.markRecalled('a');

            const pool2 = new MemoryPool(config, new MockEmbedder());
            await pool2.initialize();
            const loaded = (await pool2.get('a'))!;
            expect(loaded.recalledAt()).not.toBeNull();
        });
    });

    it('markRecalled is no-op for non-existent id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            await expect(pool.markRecalled('nonexistent')).resolves.toBeUndefined();
        });
    });

    it('recall handles write failure gracefully', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('a', { content: 'A', summary: 'A sum' });

            await fsp.chmod(dir, 0o444);
            try {
                const results = await pool.recall('hello');
                expect(results).toHaveLength(1);
            } finally {
                await fsp.chmod(dir, 0o755);
            }
        });
    });

    it('creates with default config when no config provided', async () => {
        const pool = new MemoryPool(new MemoryConfiguration(), new MockEmbedder());
        expect(await pool.all()).toEqual([]);
    });

    it('score computes PageRank from links', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
            await service.init();
            const pool = service.memories();
            const linkPool = service.links();
            await pool.create('a', { content: 'A', summary: 'A sum', tags: ['test'] });
            await pool.create('b', { content: 'B', summary: 'B sum', tags: ['test'] });
            await pool.create('c', { content: 'C', summary: 'C sum', tags: ['test'] });

            await linkPool.link('a', 'b');
            await linkPool.link('b', 'c');

            await service.score();

            const a = (await pool.get('a'))!;
            const b = (await pool.get('b'))!;
            const c = (await pool.get('c'))!;

            expect(c.score()).toBeGreaterThan(b.score());
            expect(b.score()).toBeGreaterThan(a.score());
        });
    });

    it('has returns true for existing and false for missing', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            await pool.create('x', { content: 'test', summary: 'My summary', tags: ['test'] });
            expect(pool.has('x')).toBe(true);
            expect(pool.has('y')).toBe(false);
        });
    });

    it('recomputeEmbedding stores and returns the embedding', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('x', { content: 'test', summary: 'My summary' });

            const emb = await pool.recomputeEmbedding('x');
            expect(emb).not.toBeNull();
            expect(emb).toHaveLength(4);

            const mem = await pool.get('x');
            expect(mem!.embedding()).toEqual(emb);
            expect(mem!.cachedAt()).not.toBeNull();
        });
    });

    it('recomputeEmbedding returns null for missing id', async () => {
        const pool = new MemoryPool(new MemoryConfiguration(), new MockEmbedder());
        const emb = await pool.recomputeEmbedding('nonexistent');
        expect(emb).toBeNull();
    });

    it('recall reuses cached embeddings on subsequent calls', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('a', { content: 'A', summary: 'A sum' });

            const first = await pool.recall('hello');
            expect(first).toHaveLength(1);

            const second = await pool.recall('hello');
            expect(second).toHaveLength(1);
        });
    });

    it('recall with tags includes tags in embedding input', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());

            await pool.create('a', { content: 'A', summary: 'A sum', tags: ['tag1', 'tag2'] });

            const results = await pool.recall('hello');
            expect(results).toHaveLength(1);
            expect(results[0]!.memory.id()).toBe('a');
        });
    });

    it('recall with null-returning embedder skips memories with null embedding', async () => {
        class NullEmbedder implements TextEmbeddingProvider {
            dimensions(): number {
                return 4;
            }
            async encode(_text: string): Promise<number[]> {
                return null as unknown as number[];
            }
        }

        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new NullEmbedder());
            await pool.create('a', { content: 'A', summary: 'A sum' });

            const results = await pool.recall('hello');
            expect(results).toHaveLength(0);
        });
    });

    it('recall with zero-vector embedder produces empty results', async () => {
        class ZeroEmbedder implements TextEmbeddingProvider {
            dimensions(): number {
                return 4;
            }
            async encode(_text: string): Promise<number[]> {
                return [0, 0, 0, 0];
            }
        }

        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new ZeroEmbedder());
            await pool.create('a', { content: 'A', summary: 'A sum' });
            await pool.create('b', { content: 'B', summary: 'B sum' });

            const results = await pool.recall('hello');
            expect(results).toHaveLength(0);
        });
    });

    it('create rejects summary shorter than minSummaryLength', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            config.minSummaryLength = 50;
            config.summaryContentRatio = 0.1;
            const pool = new MemoryPool(config, new MockEmbedder());
            await expect(
                pool.create('x', { content: 'Content text here', summary: 'Short' })
            ).rejects.toThrow('at least 50');
        });
    });

    it('create rejects summary exceeding max length based on content ratio', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            config.minSummaryLength = 50;
            config.summaryContentRatio = 0.1;
            const pool = new MemoryPool(config, new MockEmbedder());
            // content is 1000 chars, so max summary = max(50, 600, 0.1 * 1000) = 600
            await expect(
                pool.create('x', { content: 'A'.repeat(1000), summary: 'S'.repeat(650) })
            ).rejects.toThrow('at most 600');
        });
    });

    it('update rejects validation when summary changes to too short', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            config.minSummaryLength = 50;
            config.summaryContentRatio = 0.1;
            const pool = new MemoryPool(config, new MockEmbedder());
            // content must be long enough so that a valid summary fits: 600 chars allows maxLen = 60
            await pool.create('x', { content: 'X'.repeat(600), summary: 'S'.repeat(55) });
            await expect(
                pool.update('x', { summary: 'short' })
            ).rejects.toThrow('at least 50');
        });
    });

    it('config getter returns the configuration', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            expect(pool.config).toBe(config);
        });
    });
});

describe('findElbow', () => {
    it('with equal similarities returns full length', () => {
        const items = [0.9, 0.9, 0.9];
        expect(findElbow(items)).toBe(3);
    });

    it('with varying similarities finds elbow at largest drop', () => {
        const items = [0.9, 0.8, 0.7, 0.3, 0.2];
        expect(findElbow(items)).toBe(3);
    });

    it('with single item returns 1', () => {
        const items = [0.5];
        expect(findElbow(items)).toBe(1);
    });

    it('with empty array returns 0', () => {
        const items: number[] = [];
        expect(findElbow(items)).toBe(0);
    });

    it('with decreasing similarities where first drop is largest', () => {
        const items = [0.9, 0.3, 0.28, 0.26];
        expect(findElbow(items)).toBe(1);
    });

    it('with two items returns 1', () => {
        const items = [0.9, 0.8];
        expect(findElbow(items)).toBe(1);
    });
});

describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
        expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
    });

    it('returns 0 for orthogonal vectors', () => {
        expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
    });

    it('returns 0 when one vector is zero', () => {
        expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it('returns correct value for partially similar vectors', () => {
        const result = cosineSimilarity([1, 0], [1, 1]);
        const expected = 1 / (1 * Math.SQRT2);
        expect(result).toBeCloseTo(expected);
    });
});
