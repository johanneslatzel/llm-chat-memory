import { describe, it, expect, vi } from 'vitest';
import { MemoryService } from '../../src/lib/memory-service.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('MemoryService hook facade', () => {
    it('routes memories() and links() hook events', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            const onMemory = vi.fn();
            const onLink = vi.fn();
            const builder = service.hook();
            builder.memories().onCreate().do(onMemory);
            builder.links().onLink().do(onLink);

            await service.memories().create('a', { content: 'A', summary: 'My summary' });
            await service.memories().create('b', { content: 'B', summary: 'My summary' });
            await service.links().link('a', 'b');

            expect(onMemory).toHaveBeenCalledTimes(2);
            expect(onMemory).toHaveBeenCalledWith({ id: 'a' });
            expect(onMemory).toHaveBeenCalledWith({ id: 'b' });
            expect(onLink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
        });
    });

    it('disposing a service hook stops future events', async () => {
        await withTempDir(async (dir) => {
            const service = new MemoryService(testConfig(dir), new MockEmbedder());
            const onCreate = vi.fn();
            const hook = service.hook().memories().onCreate().do(onCreate);

            await service.memories().create('a', { content: 'A', summary: 'My summary' });
            hook.dispose();
            await service.memories().create('b', { content: 'B', summary: 'My summary' });

            expect(onCreate).toHaveBeenCalledTimes(1);
        });
    });
});
