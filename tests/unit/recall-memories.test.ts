import { describe, it, expect, vi } from 'vitest';
import { RecallMemoriesTool } from '../../src/tools/recall-memories.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('RecallMemoriesTool', () => {
    it('recalls matching memories as summaries', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new RecallMemoriesTool(service);
            await pool.create('a', { content: 'Memory A', summary: 'A' });
            await pool.create('b', { content: 'Memory B', summary: 'B' });

            const result = await tool.execute({ message: 'hello world' });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('a: A');
            expect(result[0]!.result).toContain('b: B');
        });
    });

    it('returns no matches message when none found', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new RecallMemoriesTool(service);

            const result = await tool.execute({ message: 'goodbye' });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('No matching');
        });
    });

    it('rejects missing message', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new RecallMemoriesTool(service);
            const result = await tool.execute({});
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('message');
        });
    });

    it('accepts optional max_results parameter', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new RecallMemoriesTool(service);
            await pool.create('a', { content: 'A', summary: 'A' });
            await pool.create('b', { content: 'B', summary: 'B' });

            const result = await tool.execute({ message: 'hello', max_results: 1 });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result!.split('\n')).toHaveLength(1);
        });
    });

    it('handles error during recall', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new RecallMemoriesTool(service);

            vi.spyOn(service, 'recall').mockRejectedValue(new Error('recall failed'));

            const result = await tool.execute({ message: 'hello' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toBe('recall failed');
        });
    });

    it('rejects non-numeric max_results', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new RecallMemoriesTool(service);

            const result = await tool.execute({
                message: 'hello',
                max_results: 'three' as unknown as number
            });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('max_results');
        });
    });

    it('returns summary for single result', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new RecallMemoriesTool(service);
            await pool.create('a', { content: 'Memory A', summary: 'A' });

            const result = await tool.execute({ message: 'hello' });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toBe('a: A');
        });
    });
});
