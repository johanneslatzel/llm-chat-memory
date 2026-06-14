import { describe, it, expect } from 'vitest';
import { LinkMemoriesTool } from '../../src/tools/link-memories.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';
import { LinkPool } from '../../src/lib/link/link-pool.js';

describe('LinkMemoriesTool', () => {
    it('links two existing memories', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const linkPool = service.links();
            const tool = new LinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });
            await pool.create('b', { content: 'B', summary: 'B', tags: ['b'] });

            const result = await tool.execute({
                id: 'a',
                targets: ['b']
            });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('b');
            expect((await (linkPool as LinkPool).getEdges()).filter(e => e.from === 'a').map(e => e.to)).toEqual(['b']);
        });
    });

    it('links multiple targets', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const linkPool = service.links();
            const tool = new LinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });
            await pool.create('b', { content: 'B', summary: 'B', tags: ['b'] });
            await pool.create('c', { content: 'C', summary: 'C', tags: ['c'] });

            const result = await tool.execute({
                id: 'a',
                targets: ['b', 'c']
            });
            expect(result[0]!.status).toBe('success');
            expect((await (linkPool as LinkPool).getEdges()).filter(e => e.from === 'a').map(e => e.to).sort()).toEqual(['b', 'c']);
        });
    });

    it('rejects non-existent source id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new LinkMemoriesTool(service);
            await pool.create('b', { content: 'B', summary: 'B', tags: ['b'] });

            const result = await tool.execute({
                id: 'nonexistent',
                targets: '["b"]'
            });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('not found');
        });
    });

    it('reports non-existent targets as skipped', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new LinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });

            const result = await tool.execute({
                id: 'a',
                targets: ['nonexistent']
            });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('skipped');
        });
    });

    it('skips linking to self', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new LinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });

            const result = await tool.execute({
                id: 'a',
                targets: ['a']
            });
            expect(result[0]!.status).toBe('error');
        });
    });

    it('rejects missing id parameter', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new LinkMemoriesTool(service);
            const result = await tool.execute({ targets: ['b'] });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('id');
        });
    });

    it('rejects invalid targets JSON', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new LinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });

            const result = await tool.execute({
                id: 'a',
                targets: 'not-json'
            });
            expect(result[0]!.status).toBe('error');
        });
    });
});
