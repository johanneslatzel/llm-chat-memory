import { describe, it, expect, vi } from 'vitest';
import { MemoryPool } from '../../src/lib/memory/memory-pool.js';
import { testConfig } from '../helper/config.js';
import { withTempDir } from '../helper/temp-fs.js';
import { MockEmbedder } from '../helper/mock-embedder.js';

describe('MemoryPool hooks', () => {
    it('emits onCreate with the created id', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            const onCreate = vi.fn();
            pool.hook().onCreate().do(onCreate);
            await pool.create('x', { content: 'C', summary: 'My summary' });
            expect(onCreate).toHaveBeenCalledWith({ id: 'x' });
        });
    });

    it('emits onUpdate with the updated id', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            await pool.create('x', { content: 'C', summary: 'My summary' });
            const onUpdate = vi.fn();
            pool.hook().onUpdate().do(onUpdate);
            await pool.update('x', { content: 'Changed' });
            expect(onUpdate).toHaveBeenCalledWith({ id: 'x' });
        });
    });

    it('emits onDelete with the deleted id', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            await pool.create('x', { content: 'C', summary: 'My summary' });
            const onDelete = vi.fn();
            pool.hook().onDelete().do(onDelete);
            await pool.delete('x');
            expect(onDelete).toHaveBeenCalledWith({ id: 'x' });
        });
    });

    it('emits onRecall when a memory is marked as recalled', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            await pool.create('x', { content: 'C', summary: 'My summary' });
            const onRecall = vi.fn();
            pool.hook().onRecall().do(onRecall);
            await pool.markRecalled('x');
            expect(onRecall).toHaveBeenCalledWith({ id: 'x' });
        });
    });

    it('does not emit onRecall for a missing memory', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            const onRecall = vi.fn();
            pool.hook().onRecall().do(onRecall);
            await pool.markRecalled('nonexistent');
            expect(onRecall).not.toHaveBeenCalled();
        });
    });

    it('dispose stops future events', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            const onCreate = vi.fn();
            const hook = pool.hook().onCreate().do(onCreate);
            await pool.create('a', { content: 'A', summary: 'My summary' });
            hook.dispose();
            await pool.create('b', { content: 'B', summary: 'My summary' });
            expect(onCreate).toHaveBeenCalledTimes(1);
        });
    });

    it('swallows throwing callbacks without breaking the operation', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            const onCreate = vi.fn(() => {
                throw new Error('boom');
            });
            pool.hook().onCreate().do(onCreate);
            await expect(
                pool.create('x', { content: 'C', summary: 'My summary' })
            ).resolves.toBeDefined();
        });
    });

    it('swallows rejected promises from async callbacks', async () => {
        await withTempDir(async (dir) => {
            const pool = new MemoryPool(testConfig(dir), new MockEmbedder());
            const onCreate = vi.fn(async () => {
                throw new Error('boom');
            });
            pool.hook().onCreate().do(onCreate);
            await expect(
                pool.create('x', { content: 'C', summary: 'My summary' })
            ).resolves.toBeDefined();
        });
    });
});
