import { cosineSimilarity } from '../util.js';

/** A candidate memory with pre-computed scores for selection. */
export class ScoredMemory {
    constructor(
        readonly id: string,
        readonly similarityToQuery: number,
        readonly pageRank: number,
        readonly recencyFactor: number,
        readonly embedding: number[]
    ) {}

    similarityTo(other: ScoredMemory): number {
        return cosineSimilarity(this.embedding, other.embedding);
    }
}

/** Pluggable strategy that selects a subset of scored memories for injection. */
export interface SelectionStrategy {
    /**
     * Selects up to `maxInject` memory IDs from the candidate pool.
     *
     * @param candidates  Pre-computed scored candidates.
     * @param maxInject   Maximum number of IDs to return.
     * @returns The selected memory IDs in priority order.
     */
    select(candidates: ScoredMemory[], maxInject: number): string[];
}
