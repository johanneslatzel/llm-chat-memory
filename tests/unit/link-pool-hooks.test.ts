import { describe, it, expect, vi } from 'vitest';
import { LinkPool } from '../../src/lib/link/link-pool.js';
import { MemoryConfiguration } from '../../src/lib/config.js';

function makePool(): LinkPool {
    return new LinkPool(new MemoryConfiguration());
}

describe('LinkPool hooks', () => {
    it('emits onLink when a constant link is created (single)', async () => {
        const pool = makePool();
        const onLink = vi.fn();
        pool.hook().onLink().do(onLink);
        await pool.link('a', 'b');
        expect(onLink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
    });

    it('emits onLink for each target in a batch', async () => {
        const pool = makePool();
        const onLink = vi.fn();
        pool.hook().onLink().do(onLink);
        await pool.link('a', ['b', 'c']);
        expect(onLink).toHaveBeenNthCalledWith(1, { from: 'a', to: 'b' });
        expect(onLink).toHaveBeenNthCalledWith(2, { from: 'a', to: 'c' });
    });

    it('emits onLink for the reverse direction when undirected', async () => {
        const pool = makePool();
        const onLink = vi.fn();
        pool.hook().onLink().do(onLink);
        await pool.link('a', 'b', true);
        expect(onLink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
        expect(onLink).toHaveBeenCalledWith({ from: 'b', to: 'a' });
    });

    it('does not emit onLink for self-references or duplicate constant links', async () => {
        const pool = makePool();
        await pool.add('a', 'b');
        const onLink = vi.fn();
        pool.hook().onLink().do(onLink);
        await pool.link('a', ['a', 'b']);
        expect(onLink).not.toHaveBeenCalled();
    });

    it('does not emit onLink for the reverse when a constant link already exists', async () => {
        const pool = makePool();
        await pool.add('b', 'a');
        const onLink = vi.fn();
        pool.hook().onLink().do(onLink);
        await pool.link('a', 'b', true);
        expect(onLink).toHaveBeenCalledTimes(1);
        expect(onLink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
    });

    it('emits onUnlink when a constant link is removed (single)', async () => {
        const pool = makePool();
        await pool.add('a', 'b');
        const onUnlink = vi.fn();
        pool.hook().onUnlink().do(onUnlink);
        await pool.unlink('a', 'b');
        expect(onUnlink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
    });

    it('emits onUnlink for each removed direction when undirected', async () => {
        const pool = makePool();
        await pool.link('a', 'b', true);
        const onUnlink = vi.fn();
        pool.hook().onUnlink().do(onUnlink);
        await pool.unlink('a', 'b', true);
        expect(onUnlink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
        expect(onUnlink).toHaveBeenCalledWith({ from: 'b', to: 'a' });
    });

    it('does not emit onUnlink for non-existent links', async () => {
        const pool = makePool();
        const onUnlink = vi.fn();
        pool.hook().onUnlink().do(onUnlink);
        await pool.unlink('a', 'b');
        expect(onUnlink).not.toHaveBeenCalled();
    });

    it('does not emit onUnlink for the missing reverse direction', async () => {
        const pool = makePool();
        await pool.add('a', 'b');
        const onUnlink = vi.fn();
        pool.hook().onUnlink().do(onUnlink);
        await pool.unlink('a', 'b', true);
        expect(onUnlink).toHaveBeenCalledTimes(1);
        expect(onUnlink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
    });

    it('emits onUnlink for every link removed by isolate', async () => {
        const pool = makePool();
        await pool.link('a', 'b');
        await pool.link('a', 'c');
        await pool.link('d', 'a');
        await pool.add('x', 'y');
        const onUnlink = vi.fn();
        pool.hook().onUnlink().do(onUnlink);
        await pool.isolate('a');
        expect(onUnlink).toHaveBeenCalledTimes(3);
        expect(onUnlink).toHaveBeenCalledWith({ from: 'a', to: 'b' });
        expect(onUnlink).toHaveBeenCalledWith({ from: 'a', to: 'c' });
        expect(onUnlink).toHaveBeenCalledWith({ from: 'd', to: 'a' });
    });

    it('dispose stops future events', async () => {
        const pool = makePool();
        const onLink = vi.fn();
        const hook = pool.hook().onLink().do(onLink);
        await pool.link('a', 'b');
        hook.dispose();
        await pool.link('a', 'c');
        expect(onLink).toHaveBeenCalledTimes(1);
    });

    it('swallows throwing callbacks without breaking the operation', async () => {
        const pool = makePool();
        const onLink = vi.fn(() => {
            throw new Error('boom');
        });
        pool.hook().onLink().do(onLink);
        await expect(pool.link('a', 'b')).resolves.toBeUndefined();
    });

    it('swallows rejected promises from async callbacks', async () => {
        const pool = makePool();
        const onLink = vi.fn(async () => {
            throw new Error('boom');
        });
        pool.hook().onLink().do(onLink);
        await expect(pool.link('a', 'b')).resolves.toBeUndefined();
    });
});
