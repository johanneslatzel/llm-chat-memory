import { argmax, max } from '../util.js';
import { ScoreComposer } from './composer.js';
import type { ScoredMemory, SelectionStrategy } from './types.js';

/**
 * Selects memories using maximal marginal relevance (MMR).
 *
 * Balances relevance to the query (via ScoreComposer) against
 * diversity (embedding similarity to already-selected memories).
 */
export class MMRSelectionStrategy implements SelectionStrategy {
    private readonly diversityTradeoff: number;
    private readonly composer: ScoreComposer;

    /**
     * @param diversityTradeoff    MMR diversity trade-off (0 = pure diversity, 1 = pure relevance).
     * @param composer  Composes the relevance score for each candidate.
     */
    constructor(diversityTradeoff: number, composer: ScoreComposer) {
        this.diversityTradeoff = diversityTradeoff;
        this.composer = composer;
    }

    /** @inheritdoc */
    select(candidates: ScoredMemory[], maxInject: number): string[] {
        const pool = [...candidates];
        const selected: ScoredMemory[] = [];

        for (let pick = 0; pick < maxInject && pool.length > 0; pick++) {
            const idx = this._bestIndex(pool, selected);
            selected.push(pool.splice(idx, 1)[0]!);
        }

        return selected.map((s) => s.id);
    }

    private _bestIndex(pool: ScoredMemory[], selected: ScoredMemory[]): number {
        return max(pool, (mem) => {
            const relevance = this.composer.score(mem);
            const diversityPenalty =
                selected.length > 0 ? argmax(selected, (item) => mem.similarityTo(item)).score : 0;
            return this._mmr(relevance, diversityPenalty);
        }).index;
    }

    private _mmr(relevance: number, diversityPenalty: number): number {
        return this.diversityTradeoff * relevance - (1 - this.diversityTradeoff) * diversityPenalty;
    }
}
