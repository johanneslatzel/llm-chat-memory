import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MemoryService } from '../../src/lib/memory-service.js';
import type { MemoryPool } from '../../src/lib/memory/memory-pool.js';
import type { LinkPool } from '../../src/lib/link/link-pool.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('Link lifecycle integration', () => {
    it('semantic linker creates auto-links for similar memories', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');

            const service = new MemoryService(config, new MockEmbedder());
            await service.init();
            const pool = service.memories() as unknown as MemoryPool;
            const linkPool = service.links() as unknown as LinkPool;
            const linker = service.linker;

            // MockEmbedder returns [1,0,0,0] for everything,
            // so cosine similarity is 1.0 for all pairs → all should be linked
            await pool.create('a', { content: 'Alpha content', summary: 'Alpha summary' });
            await pool.create('b', { content: 'Beta content', summary: 'Beta summary' });
            await pool.create('c', { content: 'Gamma content', summary: 'Gamma summary' });

            // ensure embeddings are computed
            await pool.ensureEmbeddings();

            // run semantic linker
            await linker.sync();

            const edges = await linkPool.getEdges();
            // With 3 memories, each pair gets bidirectional links → 6 edges
            expect(edges).toHaveLength(6);

            // each edge weight should be > 0
            for (const edge of edges) {
                expect(edge.weight).toBeGreaterThan(0);
            }
        });
    });

    it('constant links survive semantic linker sync', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');

            const service = new MemoryService(config, new MockEmbedder());
            await service.init();
            const pool = service.memories() as unknown as MemoryPool;
            const linkPool = service.links() as unknown as LinkPool;
            const linker = service.linker;

            await pool.create('a', { content: 'A', summary: 'A summary' });
            await pool.create('b', { content: 'B', summary: 'B summary' });
            await pool.create('c', { content: 'C', summary: 'C summary' });

            // add a constant link
            await linkPool.link('a', 'b');
            await pool.ensureEmbeddings();

            // sync – should keep the constant link and add semantic ones
            await linker.sync();

            const edges = await linkPool.getEdges();
            // get the weight of a→b
            const ab = edges.find((e) => e.from === 'a' && e.to === 'b')!;
            expect(ab.weight).toBe(10); // CONSTANT_LINK_WEIGHT
        });
    });

    it('delete memory isolates all incident edges', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');

            const service = new MemoryService(config, new MockEmbedder());
            await service.init();
            const pool = service.memories() as unknown as MemoryPool;
            const linkPool = service.links() as unknown as LinkPool;

            await pool.create('a', { content: 'A', summary: 'A summary' });
            await pool.create('b', { content: 'B', summary: 'B summary' });
            await pool.create('c', { content: 'C', summary: 'C summary' });

            await linkPool.link('a', 'b');
            await linkPool.link('b', 'c');
            await linkPool.link('a', 'c');

            // isolate b – should remove a→b, b→c but keep a→c
            await linkPool.isolate('b');

            const edges = await linkPool.getEdges();
            expect(edges).toHaveLength(1);
            expect(edges[0]!.from).toBe('a');
            expect(edges[0]!.to).toBe('c');
        });
    });
});
