import { describe, it, expect } from 'vitest';
import { ScoredMemory } from '../../src/lib/selection/types.js';
import { ScoreComposer } from '../../src/lib/selection/composer.js';
import { MMRSelectionStrategy } from '../../src/lib/selection/mmr.js';
import { WeightedRandomSelectionStrategy } from '../../src/lib/selection/weighted-random.js';

function makeCandidate(
    id: string,
    simToQuery: number,
    pageRank: number,
    recency: number,
    embedding: number[]
): ScoredMemory {
    return new ScoredMemory(id, simToQuery, pageRank, recency, embedding);
}

const composer = new ScoreComposer(1, 1, 1);

describe('MMRSelectionStrategy', () => {
    it('selects up to maxInject items', () => {
        const strategy = new MMRSelectionStrategy(0.5, composer);
        const candidates = [
            makeCandidate('a', 0.9, 10, 0.5, [1, 0, 0]),
            makeCandidate('b', 0.8, 5, 0.3, [0, 1, 0]),
            makeCandidate('c', 0.7, 3, 0.1, [0, 0, 1]),
        ];
        const result = strategy.select(candidates, 2);
        expect(result).toHaveLength(2);
    });

    it('returns all when maxInject exceeds pool size', () => {
        const strategy = new MMRSelectionStrategy(0.5, composer);
        const candidates = [
            makeCandidate('a', 0.9, 10, 0.5, [1, 0, 0]),
        ];
        const result = strategy.select(candidates, 5);
        expect(result).toEqual(['a']);
    });

    it('returns empty for empty candidates', () => {
        const strategy = new MMRSelectionStrategy(0.5, composer);
        const result = strategy.select([], 5);
        expect(result).toEqual([]);
    });

    it('returns empty for maxInject of 0', () => {
        const strategy = new MMRSelectionStrategy(0.5, composer);
        const candidates = [
            makeCandidate('a', 0.9, 10, 0.5, [1, 0, 0]),
        ];
        const result = strategy.select(candidates, 0);
        expect(result).toEqual([]);
    });

    it('selects with pure relevance (tradeoff = 1)', () => {
        const strategy = new MMRSelectionStrategy(1, composer);
        const candidates = [
            makeCandidate('a', 0.9, 5, 0.3, [1, 0, 0]),
            makeCandidate('b', 0.8, 10, 0.5, [0, 1, 0]),
        ];
        const result = strategy.select(candidates, 2);
        expect(result).toHaveLength(2);
    });

    it('selects with pure diversity (tradeoff = 0)', () => {
        const strategy = new MMRSelectionStrategy(0, composer);
        const candidates = [
            makeCandidate('a', 0.9, 5, 0.3, [1, 0, 0]),
            makeCandidate('b', 0.8, 10, 0.5, [0, 1, 0]),
        ];
        const result = strategy.select(candidates, 2);
        expect(result).toHaveLength(2);
    });
});

describe('WeightedRandomSelectionStrategy', () => {
    it('selects up to maxInject items', () => {
        const strategy = new WeightedRandomSelectionStrategy(composer);
        const candidates = [
            makeCandidate('a', 0.9, 10, 0.5, [1, 0, 0]),
            makeCandidate('b', 0.8, 5, 0.3, [0, 1, 0]),
            makeCandidate('c', 0.7, 3, 0.1, [0, 0, 1]),
        ];
        const result = strategy.select(candidates, 2);
        expect(result).toHaveLength(2);
    });

    it('returns all when maxInject exceeds pool size', () => {
        const strategy = new WeightedRandomSelectionStrategy(composer);
        const candidates = [
            makeCandidate('a', 0.9, 10, 0.5, [1, 0, 0]),
        ];
        const result = strategy.select(candidates, 5);
        expect(result).toEqual(['a']);
    });

    it('returns empty for empty candidates', () => {
        const strategy = new WeightedRandomSelectionStrategy(composer);
        const result = strategy.select([], 5);
        expect(result).toEqual([]);
    });

    it('returns empty for maxInject of 0', () => {
        const strategy = new WeightedRandomSelectionStrategy(composer);
        const candidates = [
            makeCandidate('a', 0.9, 10, 0.5, [1, 0, 0]),
        ];
        const result = strategy.select(candidates, 0);
        expect(result).toEqual([]);
    });

    it('breaks when rouletteSelect returns -1 (zero weights)', () => {
        const zeroComposer = new ScoreComposer(0, 0, 0);
        const strategy = new WeightedRandomSelectionStrategy(zeroComposer);
        const candidates = [
            makeCandidate('a', 0.9, 10, 0.5, [1, 0, 0]),
            makeCandidate('b', 0.8, 5, 0.3, [0, 1, 0]),
        ];
        const result = strategy.select(candidates, 5);
        expect(result).toEqual([]);
    });
});
