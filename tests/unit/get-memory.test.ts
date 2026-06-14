import { describe, it, expect } from 'vitest';
import { GetMemoryTool } from '../../src/tools/get-memory.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';
import { DEFAULT_MAX_INJECTION_CONTENT_LENGTH } from '../../src/lib/constants.js';

describe('GetMemoryTool', () => {
    it('returns memory details as JSON', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new GetMemoryTool(service);
            await pool.create('get-test', { content: 'Memory content', summary: 'My summary', tags: ['tag1'] });

            const result = await tool.execute({ ids: ['get-test'] });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('get-test');
            expect(result[0]!.result).toContain('Memory content');
        });
    });

    it('returns only summary when summary param is true', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new GetMemoryTool(service);
            await pool.create('get-test', { content: 'Memory content', summary: 'My summary', tags: ['tag1'] });

            const result = await tool.execute({ ids: ['get-test'], summary: true });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('get-test: My summary');
            expect(result[0]!.result).not.toContain('Memory content');
        });
    });

    it('rejects missing ids', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new GetMemoryTool(service);
            const result = await tool.execute({});
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('ids');
        });
    });

    it('reports unknown ids', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new GetMemoryTool(service);
            const result = await tool.execute({ ids: ['nonexistent'] });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('not found');
        });
    });

    it('truncates content when truncate is true (default)', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new GetMemoryTool(service);
            const longContent = 'x'.repeat(DEFAULT_MAX_INJECTION_CONTENT_LENGTH + 100);
            await pool.create('trunc-test', { content: longContent, summary: 'summary' });

            const result = await tool.execute({ ids: ['trunc-test'] });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toHaveLength(DEFAULT_MAX_INJECTION_CONTENT_LENGTH);
            expect(result[0]!.result).toMatch(/\[truncated\]$/);
        });
    });

    it('returns full content when truncate is false', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new GetMemoryTool(service);
            const longContent = 'y'.repeat(DEFAULT_MAX_INJECTION_CONTENT_LENGTH + 100);
            await pool.create('full-test', { content: longContent, summary: 'summary' });

            const result = await tool.execute({ ids: ['full-test'], truncate: false });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).not.toMatch(/\[truncated\]$/);
            expect(result[0]!.result).toContain(longContent);
        });
    });
});
