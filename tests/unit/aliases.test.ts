import { describe, it, expect } from 'vitest';
import { AddMemoryTool } from '../../src/tools/add-memory.js';
import { GetMemoryTool } from '../../src/tools/get-memory.js';
import { LinkMemoriesTool } from '../../src/tools/link-memories.js';
import { UnlinkMemoriesTool } from '../../src/tools/unlink-memories.js';
import { UpdateMemoryTool } from '../../src/tools/update-memory.js';
import { MemoryService } from '../../src/lib/memory-service.js';
import { LinkPool } from '../../src/lib/link/link-pool.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('hidden singular aliases', () => {
    it('does not expose the aliases in the schemas', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            const cases: Array<{
                tool: { toOpenAI(): { function: { parameters?: unknown } } };
                canonical: string;
                alias: string;
            }> = [
                { tool: new GetMemoryTool(service), canonical: 'ids', alias: 'id' },
                { tool: new AddMemoryTool(service), canonical: 'tags', alias: 'tag' },
                { tool: new UpdateMemoryTool(service), canonical: 'tags', alias: 'tag' },
                { tool: new LinkMemoriesTool(service), canonical: 'targets', alias: 'target' },
                { tool: new UnlinkMemoriesTool(service), canonical: 'targets', alias: 'target' }
            ];

            for (const { tool, canonical, alias } of cases) {
                const parameters = tool.toOpenAI().function.parameters as {
                    properties: Record<string, unknown>;
                };
                expect(parameters.properties[canonical]).toBeDefined();
                expect(parameters.properties[alias]).toBeUndefined();
            }
        });
    });

    it('gets memories by the id alias', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            await service.memories().create('alpha', {
                content: 'Alpha content',
                summary: 'Alpha summary',
                tags: []
            });
            const result = await new GetMemoryTool(service).execute({ id: 'alpha' });
            expect(result[0]!.status).toBe('success');
            expect(result[0]!.result).toContain('Alpha content');
        });
    });

    it('adds tags through the tag alias', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            const result = await new AddMemoryTool(service).execute({
                id: 'tagged',
                content: 'Tagged content',
                summary: 'Tagged summary',
                tag: 'blue'
            });
            expect(result[0]!.status).toBe('success');
            const memory = await service.memories().get('tagged');
            expect(memory?.tags).toEqual(['blue']);
        });
    });

    it('updates tags through the tag alias', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            await service.memories().create('tagged', {
                content: 'Tagged content',
                summary: 'Tagged summary',
                tags: ['old']
            });
            const result = await new UpdateMemoryTool(service).execute({
                id: 'tagged',
                tag: 'green'
            });
            expect(result[0]!.status).toBe('success');
            const memory = await service.memories().get('tagged');
            expect(memory?.tags).toEqual(['green']);
        });
    });

    it('links through the target alias', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            await service.memories().create('a', { content: 'A', summary: 'A', tags: [] });
            await service.memories().create('b', { content: 'B', summary: 'B', tags: [] });
            const result = await new LinkMemoriesTool(service).execute({
                id: 'a',
                target: 'b'
            });
            expect(result[0]!.status).toBe('success');
            const edges = await (service.links() as LinkPool).getEdges();
            expect(edges.filter((edge) => edge.from === 'a').map((edge) => edge.to)).toEqual(['b']);
        });
    });

    it('unlinks through the target alias', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            await service.memories().create('a', { content: 'A', summary: 'A', tags: [] });
            await service.memories().create('b', { content: 'B', summary: 'B', tags: [] });
            await service.links().link('a', ['b']);
            const result = await new UnlinkMemoriesTool(service).execute({
                id: 'a',
                target: 'b'
            });
            expect(result[0]!.status).toBe('success');
            const edges = await (service.links() as LinkPool).getEdges();
            expect(edges.filter((edge) => edge.from === 'a')).toEqual([]);
        });
    });
});
