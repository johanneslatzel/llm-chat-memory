import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MemoryService } from '../../src/lib/memory-service.js';
import { MemoryToolPackage } from '../../src/tools/memory-tool-package.js';
import { AddMemoryTool } from '../../src/tools/add-memory.js';
import { GetMemoryTool } from '../../src/tools/get-memory.js';
import { UpdateMemoryTool } from '../../src/tools/update-memory.js';
import { DeleteMemoryTool } from '../../src/tools/delete-memory.js';
import { RecallMemoriesTool } from '../../src/tools/recall-memories.js';
import { LinkMemoriesTool } from '../../src/tools/link-memories.js';
import { UnlinkMemoriesTool } from '../../src/tools/unlink-memories.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

function setup(dir: string): {
    service: MemoryService;
    add: AddMemoryTool;
    get: GetMemoryTool;
    update: UpdateMemoryTool;
    del: DeleteMemoryTool;
    recall: RecallMemoriesTool;
    link: LinkMemoriesTool;
    unlink: UnlinkMemoriesTool;
    pkg: MemoryToolPackage;
} {
    const config = testConfig(dir);
    const service = new MemoryService(config, new MockEmbedder());
    const pkg = new MemoryToolPackage(service);
    const add = new AddMemoryTool(service);
    const get = new GetMemoryTool(service);
    const update = new UpdateMemoryTool(service);
    const del = new DeleteMemoryTool(service);
    const recall = new RecallMemoriesTool(service);
    const link = new LinkMemoriesTool(service);
    const unlink = new UnlinkMemoriesTool(service);
    return { service, add, get, update, del, recall, link, unlink, pkg };
}

describe('MemoryToolPackage integration – full tool chain', () => {
    it('chains add → get → update → recall → link → unlink → delete with correct state at each step', async () => {
        await withTempDir(async (dir) => {
            await fsp.writeFile(path.join(dir, 'links.json'), '[]', 'utf-8');
            const { service, add, get, update, del, recall, link, unlink, pkg } = setup(dir);
            await service.init();

            // verify tool package contains 7 tools
            expect(pkg.tools()).toHaveLength(7);

            // add
            const addResult = await add.execute({
                id: 'my-memory',
                content: 'Important information for the LLM',
                summary: 'Important info summary',
                tags: ['test', 'important']
            });
            expect(addResult[0]!.status).toBe('success');
            expect(addResult[0]!.result).toContain('my-memory');

            // get
            const getResult = await get.execute({ ids: ['my-memory'] });
            expect(getResult[0]!.status).toBe('success');
            expect(getResult[0]!.result).toContain('Important information');

            // get non-existent
            const getMissing = await get.execute({ ids: ['does-not-exist'] });
            expect(getMissing[0]!.status).toBe('success');
            expect(getMissing[0]!.result).toContain('not found');

            // update
            const updateResult = await update.execute({
                id: 'my-memory',
                content: 'Updated important information',
                summary: 'Updated info summary'
            });
            expect(updateResult[0]!.status).toBe('success');
            expect(updateResult[0]!.result).toContain('updated');

            // verify update persisted
            const getAfterUpdate = await get.execute({ ids: ['my-memory'] });
            expect(getAfterUpdate[0]!.result).toContain('Updated important');

            // add a second memory to have more than one for recall
            await add.execute({
                id: 'second-memory',
                content: 'Secondary information',
                summary: 'Secondary info summary'
            });

            // recall
            const recallResult = await recall.execute({ message: 'something relevant' });
            expect(recallResult[0]!.status).toBe('success');
            expect(recallResult[0]!.result).toContain('my-memory');
            expect(recallResult[0]!.result).toContain('second-memory');

            // link
            const linkResult = await link.execute({
                id: 'my-memory',
                targets: ['second-memory']
            });
            expect(linkResult[0]!.status).toBe('success');
            expect(linkResult[0]!.result).toContain('Linked to');

            // unlink
            const unlinkResult = await unlink.execute({
                id: 'my-memory',
                targets: ['second-memory']
            });
            expect(unlinkResult[0]!.status).toBe('success');
            expect(unlinkResult[0]!.result).toContain('Unlinked from');

            // delete
            const delResult = await del.execute({ id: 'my-memory' });
            expect(delResult[0]!.status).toBe('success');
            expect(delResult[0]!.result).toContain('deleted');

            // verify deletion
            const getAfterDel = await get.execute({ ids: ['my-memory'] });
            expect(getAfterDel[0]!.result).toContain('not found');
        });
    });
});
