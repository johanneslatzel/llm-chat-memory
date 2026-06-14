import { describe, it, expect } from 'vitest';
import {
    ConstantMemoryLink,
    SemanticMemoryLink,
    MemoryLink,
} from '../../src/lib/link/link.js';

describe('ConstantMemoryLink', () => {
    it('weight is always 10', () => {
        const link = new ConstantMemoryLink('a', 'b');
        expect(link.weight()).toBe(10);
        expect(link.weight()).toBe(10); // stable
    });

    it('stores from and to', () => {
        const link = new ConstantMemoryLink('x', 'y');
        expect(link.from).toBe('x');
        expect(link.to).toBe('y');
    });

    it('round-trips through JSON', () => {
        const link = new ConstantMemoryLink('a', 'b');
        const json = link.toJSON();
        expect(json).toEqual({ type: 'constant', from: 'a', to: 'b' });

        const restored = MemoryLink.fromJSON(json);
        expect(restored).toBeInstanceOf(ConstantMemoryLink);
        expect(restored.from).toBe('a');
        expect(restored.to).toBe('b');
        expect(restored.weight()).toBe(10);
    });
});

describe('SemanticMemoryLink', () => {
    it('stores from, to, and weight', () => {
        const link = new SemanticMemoryLink('a', 'b', 0.75);
        expect(link.from).toBe('a');
        expect(link.to).toBe('b');
        expect(link.weight()).toBe(0.75);
    });

    it('round-trips through JSON', () => {
        const link = new SemanticMemoryLink('a', 'b', 0.75);
        const json = link.toJSON();
        expect(json).toEqual({
            type: 'semantic',
            from: 'a',
            to: 'b',
            weight: 0.75,
            cachedAt: expect.any(Number),
        });

        const restored = MemoryLink.fromJSON(json);
        expect(restored).toBeInstanceOf(SemanticMemoryLink);
        expect(restored.from).toBe('a');
        expect(restored.to).toBe('b');
        expect(restored.weight()).toBe(0.75);
    });
});
