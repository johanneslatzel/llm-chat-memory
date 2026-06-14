import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';
import { AddMemoryTool } from '../../src/tools/add-memory.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

function createTool(dir: string): AddMemoryTool {
    const config = testConfig(dir);
    const service = new MemoryService(config, new MockEmbedder());
    return new AddMemoryTool(service);
}

describe('AddMemoryTool', () => {
    it('adds a memory with id and content', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({ id: 'test-label', content: 'Test memory', summary: 'Test memory summary', tags: ['test-label'] });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('test-label');
        });
    });

    it('rejects missing id', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({ content: 'test', summary: 'sum' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('id');
        });
    });

    it('rejects missing content', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({ id: 'x', summary: 'sum' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('content');
        });
    });

    it('rejects empty content', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({ id: 'x', content: '   ', summary: 'sum' });
            expect(result[0]!.status).toBe('error');
        });
    });

    it('accepts tags as array', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({
                id: 'x',
                content: 'Tagged memory',
                summary: 'Tagged memory summary',
                tags: ['tag1', 'tag2']
            });
            expect(result[0]!.status).toBe('success');
        });
    });

    it('rejects invalid tags JSON', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({
                id: 'x',
                content: 'Bad tags',
                summary: 'sum',
                tags: 'not-json'
            });
            expect(result[0]!.status).toBe('error');
        });
    });

    it('rejects missing summary', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({
                id: 'x',
                content: 'No summary'
            });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('summary');
        });
    });

    it('rejects invalid tags JSON', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({
                id: 'x',
                content: 'Bad tags',
                summary: 'sum',
                tags: 'not-json'
            });
            expect(result[0]!.status).toBe('error');
        });
    });

    it('rejects id with no alphanumeric characters', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            const result = await tool.execute({ id: '!!!', content: 'test', summary: 'sum' });
            expect(result[0]!.status).toBe('error');
            expect(result[0]!.result).toContain('alphanumeric');
        });
    });

    it('rejects duplicate id', async () => {
        await withTempDir(async (dir) => {
            const tool = createTool(dir);
            await tool.execute({ id: 'dup-label', content: 'First', summary: 'First summary' });
            const result = await tool.execute({ id: 'dup-label', content: 'Second', summary: 'Second summary' });
            expect(result[0]!.status).toBe('error');
        });
    });

    it('handles error during create', async () => {
        await withTempDir(async (dir) => {
            const memDir = path.join(dir, 'block');
            await fsp.writeFile(memDir, '');
            const config = testConfig(memDir);
            const service = new MemoryService(config, new MockEmbedder());
            const tool = new AddMemoryTool(service);
            const result = await tool.execute({ id: 'x', content: 'test', tags: ['test'] });
            expect(result[0]!.status).toBe('error');
        });
    });
});
