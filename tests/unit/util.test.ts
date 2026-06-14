import { describe, it, expect, vi } from 'vitest';
import { expDecay, rouletteSelect, max, argmax } from '../../src/lib/util.js';

describe('expDecay', () => {
    it('returns 1 at t = 0', () => {
        expect(expDecay(0, 100)).toBeCloseTo(1, 5);
    });

    it('returns ~0.5 at t = halfLife', () => {
        expect(expDecay(100, 100)).toBeCloseTo(0.5, 1);
    });

    it('returns 0 for large t', () => {
        expect(expDecay(1e9, 100)).toBeCloseTo(0, 5);
    });

    it('returns 0 when halfLife is 0', () => {
        expect(expDecay(100, 0)).toBe(0);
    });

    it('returns 0 when halfLife is negative', () => {
        expect(expDecay(100, -10)).toBe(0);
    });
});

describe('rouletteSelect', () => {
    it('returns -1 for empty array', () => {
        expect(rouletteSelect([])).toBe(-1);
    });

    it('returns -1 when total weight is zero', () => {
        expect(rouletteSelect([0, 0, 0])).toBe(-1);
    });

    it('returns -1 when total weight is negative', () => {
        expect(rouletteSelect([-1, -2])).toBe(-1);
    });

    it('returns 0 for single element', () => {
        expect(rouletteSelect([5])).toBe(0);
    });

    it('falls through to last index with large weights and high random value', () => {
        const orig = Math.random;
        Math.random = vi.fn().mockReturnValue(0.5);
        try {
            const result = rouletteSelect([Number.MAX_VALUE, Number.MAX_VALUE]);
            expect(result).toBe(1);
        } finally {
            Math.random = orig;
        }
    });
});

describe('max', () => {
    it('returns -1 index for empty array', () => {
        expect(max([], (x: number) => x)).toEqual({ index: -1, score: 0 });
    });

    it('finds the max element and its score', () => {
        expect(max([1, 5, 3, 2], (x) => x)).toEqual({ index: 1, score: 5 });
    });

    it('returns first occurrence of tied max', () => {
        expect(max([3, 5, 5, 1], (x) => x)).toEqual({ index: 1, score: 5 });
    });
});

describe('argmax', () => {
    it('returns the highest-scoring item', () => {
        expect(argmax(['a', 'bb', 'ccc'], (s) => s.length)).toEqual({ item: 'ccc', score: 3 });
    });

    it('throws for empty array', () => {
        expect(() => argmax([], (x: string) => x.length)).toThrow('no max item found');
    });
});
