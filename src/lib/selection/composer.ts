import type { ScoredMemory } from './types.js';

/**
 * Composes a weighted relevance score from similarity, PageRank, and recency.
 * Weights are configured once at construction.
 */
export class ScoreComposer {
    constructor(
        private readonly similarityWeight: number,
        private readonly pageRankWeight: number,
        private readonly recencyWeight: number
    ) {}

    /** Weighted sum of the candidate's three scores. */
    score(candidate: ScoredMemory): number {
        return (
            this.similarityWeight * candidate.similarityToQuery +
            this.pageRankWeight * candidate.pageRank +
            this.recencyWeight * candidate.recencyFactor
        );
    }
}
