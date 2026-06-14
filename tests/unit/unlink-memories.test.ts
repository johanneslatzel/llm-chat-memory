import { describe, it, expect } from 'vitest';
import { UnlinkMemoriesTool } from '../../src/tools/unlink-memories.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';
import { LinkPool } from '../../src/lib/link/link-pool.js';

describe('UnlinkMemoriesTool', () => {
    it('unlinks two linked memories', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const linkPool = service.links();
            const tool = new UnlinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });
            await pool.create('b', { content: 'B', summary: 'B', tags: ['b'] });
            await linkPool.link('a', 'b');
            expect((await (linkPool as LinkPool).getEdges()).filter(e => e.from === 'a').map(e => e.to)).toEqual(['b']);

            const result = await tool.execute({
                id: 'a',
                targets: ['b']
            });
            expect(result[0]!.status).toBe('success');
            expect((await (linkPool as LinkPool).getEdges()).filter(e => e.from === 'a').map(e => e.to)).toEqual([]);
        });
    });

    it('unlinks multiple targets', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const linkPool = service.links();
            const tool = new UnlinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });
            await pool.create('b', { content: 'B', summary: 'B', tags: ['b'] });
            await pool.create('c', { content: 'C', summary: 'C', tags: ['c'] });
            await linkPool.link('a', 'b');
            await linkPool.link('a', 'c');
            expect((await (linkPool as LinkPool).getEdges()).filter(e => e.from === 'a').map(e => e.to)).toEqual(['b', 'c']);

            const result = await tool.execute({
                id: 'a',
                targets: ['b', 'c']
            });
            expect(result[0]!.status).toBe('success');
            expect((await (linkPool as LinkPool).getEdges()).filter(e => e.from === 'a').map(e => e.to)).toEqual([]);
        });
    });

    it('skips non-existent link gracefully', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const linkPool = service.links();
            const tool = new UnlinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });
            await pool.create('b', { content: 'B', summary: 'B', tags: ['b'] });

            const result = await tool.execute({
                id: 'a',
                targets: ['b']
            });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('Unlinked');
            expect((await (linkPool as LinkPool).getEdges()).filter(e => e.from === 'a').map(e => e.to)).toEqual([]);
        });
    });

    it('rejects non-existent source id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new UnlinkMemoriesTool(service);
            await pool.create('b', { content: 'B', summary: 'B', tags: ['b'] });

            const result = await tool.execute({
                id: 'nonexistent',
                targets: ['b']
            });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('not found');
        });
    });

    it('rejects missing id parameter', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new UnlinkMemoriesTool(service);
            const result = await tool.execute({ targets: ['b'] });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('id');
        });
    });

    it('rejects empty targets array', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new UnlinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });

            const result = await tool.execute({
                id: 'a',
                targets: []
            });
            expect(result[0]!.status).toBe('error');
        });
    });

    it('rejects invalid targets JSON', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new UnlinkMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A', tags: ['a'] });

            const result = await tool.execute({
                id: 'a',
                targets: 'not-json'
            });
            expect(result[0]!.status).toBe('error');
        });
    });
});
