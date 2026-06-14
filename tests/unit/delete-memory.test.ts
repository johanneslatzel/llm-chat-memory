import { describe, it, expect } from 'vitest';
import * as fsp from 'node:fs/promises';
import { DeleteMemoryTool } from '../../src/tools/delete-memory.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('DeleteMemoryTool', () => {
    it('deletes an existing memory', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new DeleteMemoryTool(service);
            await pool.create('del-test', { content: 'To delete', summary: 'To delete', tags: ['del-test'] });

            const result = await tool.execute({ id: 'del-test' });
            expect(result[0]!.status).toBe('success');
            expect(await pool.get('del-test')).toBeUndefined();
        });
    });

    it('rejects missing id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new DeleteMemoryTool(service);
            const result = await tool.execute({});
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('id');
        });
    });

    it('rejects unknown id', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new DeleteMemoryTool(service);
            const result = await tool.execute({ id: 'nonexistent' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('not found');
        });
    });

    it('handles error during delete', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new DeleteMemoryTool(service);
            await pool.create('del-fail', { content: 'To delete', summary: 'To delete', tags: ['del-fail'] });
            await fsp.chmod(dir, 0o444);
            try {
                const result = await tool.execute({ id: 'del-fail' });
                expect(result[0]!.status).toBe('error');
            } finally {
                await fsp.chmod(dir, 0o755);
            }
        });
    });
});
