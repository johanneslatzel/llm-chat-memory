import { describe, it, expect } from 'vitest';
import * as fsp from 'node:fs/promises';
import { UpdateMemoryTool } from '../../src/tools/update-memory.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import type { MemoryPoolInterface } from '../../src/lib/memory/memory-pool.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

async function createToolAndMemory(dir: string): Promise<{ tool: UpdateMemoryTool; pool: MemoryPoolInterface }> {
    const config = testConfig(dir);
    const service = new MemoryService(config, new MockEmbedder());
    const pool = service.memories();
    const tool = new UpdateMemoryTool(service);
    await pool.create('update-test', {
        content: 'Original',
        summary: 'Original summary',
        tags: ['old']
    });
    return { tool, pool };
}

describe('UpdateMemoryTool', () => {
    it('updates content', async () => {
        await withTempDir(async (dir) => {
            const { tool, pool } = await createToolAndMemory(dir);
            const result = await tool.execute({ id: 'update-test', content: 'Updated' });
            expect(result[0]!.status).toBe('success');
            expect((await pool.get('update-test'))?.content()).toBe('Updated');
        });
    });

    it('updates summary', async () => {
        await withTempDir(async (dir) => {
            const { tool, pool } = await createToolAndMemory(dir);
            const result = await tool.execute({ id: 'update-test', summary: 'New summary' });
            expect(result[0]!.status).toBe('success');
            expect((await pool.get('update-test'))?.summary()).toBe('New summary');
        });
    });

    it('rejects missing id', async () => {
        await withTempDir(async (dir) => {
            const { tool } = await createToolAndMemory(dir);
            const result = await tool.execute({ content: 'test' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('id');
        });
    });

    it('rejects unknown id', async () => {
        await withTempDir(async (dir) => {
            const { tool } = await createToolAndMemory(dir);
            const result = await tool.execute({ id: 'nonexistent', content: 'test' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('not found');
        });
    });

    it('updates tags', async () => {
        await withTempDir(async (dir) => {
            const { tool, pool } = await createToolAndMemory(dir);
            const result = await tool.execute({ id: 'update-test', tags: ['new1', 'new2'] });
            expect(result[0]!.status).toBe('success');
            expect((await pool.get('update-test'))?.tags()).toEqual(['new1', 'new2']);
        });
    });

    it('updates changedAt timestamp', async () => {
        await withTempDir(async (dir) => {
            const { tool, pool } = await createToolAndMemory(dir);
            const before = (await pool.get('update-test'))!.changedAt().getTime();
            await new Promise((r) => setTimeout(r, 10));
            await tool.execute({ id: 'update-test', content: 'New content' });
            expect((await pool.get('update-test'))!.changedAt().getTime()).toBeGreaterThan(before);
        });
    });

    it('rejects non-string content', async () => {
        await withTempDir(async (dir) => {
            const { tool } = await createToolAndMemory(dir);
            const result = await tool.execute({
                id: 'update-test',
                content: 42 as unknown as string
            });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('content');
        });
    });

    it('rejects invalid tags JSON', async () => {
        await withTempDir(async (dir) => {
            const { tool } = await createToolAndMemory(dir);
            const result = await tool.execute({
                id: 'update-test',
                tags: 'not-json'
            });
            expect(result[0]!.status).toBe('error');
        });
    });

    it('handles error during update', async () => {
        await withTempDir(async (dir) => {
            const config = testConfig(dir);
            const service = new MemoryService(config, new MockEmbedder());
            const pool = service.memories();
            const tool = new UpdateMemoryTool(service);
            await pool.create('update-fail', { content: 'Original', summary: 'Original summary', tags: ['test'] });

            await fsp.chmod(dir, 0o444);
            try {
                const result = await tool.execute({
                    id: 'update-fail',
                    content: 'Updated'
                });
                expect(result[0]!.status).toBe('error');
            } finally {
                await fsp.chmod(dir, 0o755);
            }
        });
    });

    it('rejects empty summary', async () => {
        await withTempDir(async (dir) => {
            const { tool } = await createToolAndMemory(dir);
            const result = await tool.execute({ id: 'update-test', summary: '' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('summary');
        });
    });

    it('rejects whitespace-only summary', async () => {
        await withTempDir(async (dir) => {
            const { tool } = await createToolAndMemory(dir);
            const result = await tool.execute({ id: 'update-test', summary: '   ' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('summary');
        });
    });
});
