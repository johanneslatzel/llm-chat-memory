import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MemoryService } from '../../src/lib/memory-service.js';
import type { LinkPool } from '../../src/lib/link/link-pool.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('MemoryService integration – full lifecycle', () => {
    it('init, create memories, link, score, recall, save, re-init, verify persistence', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const linksPath = path.join(dir, 'links.json');
            await fsp.writeFile(linksPath, '[]', 'utf-8');

            const service = new MemoryService(config, new MockEmbedder());
            await service.init();

            const pool = service.memories();
            const linkPool = service.links();

            // create three memories
            await pool.create('alpha', { content: 'Alpha content', summary: 'Alpha summary' });
            await pool.create('beta', { content: 'Beta content', summary: 'Beta summary' });
            await pool.create('gamma', { content: 'Gamma content', summary: 'Gamma summary' });

            expect(await pool.all()).toHaveLength(3);

            // link: alpha → beta, beta → gamma
            await linkPool.link('alpha', 'beta');
            await linkPool.link('beta', 'gamma');

            // score (PageRank)
            await service.score();

            const a = (await pool.get('alpha'))!;
            const b = (await pool.get('beta'))!;
            const c = (await pool.get('gamma'))!;

            // gamma is downstream of both, so it should have the highest PageRank
            expect(c.score()).toBeGreaterThan(b.score());
            expect(b.score()).toBeGreaterThan(a.score());

            // recall with MockEmbedder: all memories match, sorted by score
            const results = await service.recall('some message', 5);
            expect(results).toHaveLength(3);
            // first result should be the highest-scored memory
            expect(results[0]!.id()).toBe('gamma');

            // persist and re-init
            await service.save();
            const rawLinks = await fsp.readFile(linksPath, 'utf-8');
            const parsedLinks = JSON.parse(rawLinks);
            expect(parsedLinks).toHaveLength(2);

            const service2 = new MemoryService(config, new MockEmbedder());
            await service2.init();

            const pool2 = service2.memories();
            expect(await pool2.all()).toHaveLength(3);
            expect((await pool2.get('alpha'))!.content()).toBe('Alpha content');
        });
    });

    it('delete memory isolates links', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');

            const service = new MemoryService(config, new MockEmbedder());
            await service.init();
            const pool = service.memories();
            const linkPool = service.links();

            await pool.create('a', { content: 'A', summary: 'A summary' });
            await pool.create('b', { content: 'B', summary: 'B summary' });
            await pool.create('c', { content: 'C', summary: 'C summary' });

            await linkPool.link('a', 'b');
            await linkPool.link('b', 'c');

            // delete 'b' – this should also remove its links
            await pool.delete('b');
            await linkPool.isolate('b');

            const edges = await (linkPool as unknown as LinkPool).getEdges();
            expect(edges).toHaveLength(0);
            expect(await pool.all()).toHaveLength(2);
        });
    });

    it('recall with no memory returns empty list', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');

            const service = new MemoryService(config, new MockEmbedder());
            await service.init();

            const results = await service.recall('anything', 5);
            expect(results).toEqual([]);
        });
    });
});
