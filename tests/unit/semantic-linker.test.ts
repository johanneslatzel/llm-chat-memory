import { describe, it, expect } from 'vitest';
import { SemanticLinker } from '../../src/lib/link/semantic-linker.js';
import { MemoryPool } from '../../src/lib/memory/memory-pool.js';
import { LinkPool } from '../../src/lib/link/link-pool.js';
import { withTempDir } from '../helper/temp-fs.js';
import { testConfig } from '../helper/config.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('SemanticLinker', () => {
    it('sync creates semantic links between memories with embeddings', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const linkPool = new LinkPool(config);

            const linker = new SemanticLinker(pool, linkPool);

            await pool.create('a', { content: 'A', summary: 'A sum' });
            await pool.create('b', { content: 'B', summary: 'B sum' });

            await pool.ensureEmbeddings();
            await linker.sync();

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(2);
            expect(edges.map(e => e.weight)).toEqual([10, 10]);
        });
    });

    it('sync skips memories without embeddings', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const linkPool = new LinkPool(config);

            const linker = new SemanticLinker(pool, linkPool);

            await pool.create('a', { content: 'A', summary: 'A sum' });

            await linker.sync();

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(0);
        });
    });

    it('sync creates no links when only one memory has embedding', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const linkPool = new LinkPool(config);

            const linker = new SemanticLinker(pool, linkPool);

            await pool.create('a', { content: 'A', summary: 'A sum' });
            await pool.create('b', { content: 'B', summary: 'B sum' });

            await pool.recomputeEmbedding('a');
            await linker.sync();

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(0);
        });
    });

    it('sync with single memory creates no links', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const pool = new MemoryPool(config, new MockEmbedder());
            const linkPool = new LinkPool(config);

            const linker = new SemanticLinker(pool, linkPool);

            await pool.create('a', { content: 'A', summary: 'A sum' });
            await pool.ensureEmbeddings();
            await linker.sync();

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(0);
        });
    });

    it('sync does not create links when gate exceeds similarity', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            config.similarityGate = 1.01;
            const pool = new MemoryPool(config, new MockEmbedder());
            const linkPool = new LinkPool(config);

            const linker = new SemanticLinker(pool, linkPool);

            await pool.create('a', { content: 'A', summary: 'A sum' });
            await pool.create('b', { content: 'B', summary: 'B sum' });

            await pool.ensureEmbeddings();
            await linker.sync();

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(0);
        });
    });
});
