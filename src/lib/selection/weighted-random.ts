import { ScoreComposer } from './composer.js';
import { rouletteSelect } from '../util.js';
import type { ScoredMemory, SelectionStrategy } from './types.js';

/**
 * Selects memories via roulette-wheel (weighted-random) selection.
 *
 * Each memory's weight is the ScoreComposer score. Higher-scoring memories
 * are more likely to be chosen, but low-scoring ones still have a chance.
 * The same memory cannot be selected twice.
 */
export class WeightedRandomSelectionStrategy implements SelectionStrategy {
    private readonly composer: ScoreComposer;

    /** @param composer  Composes the weight for each candidate. */
    constructor(composer: ScoreComposer) {
        this.composer = composer;
    }

    /** @inheritdoc */
    select(candidates: ScoredMemory[], maxInject: number): string[] {
        const pool = [...candidates];
        const weights = pool.map((c) => this.composer.score(c));
        const selected: string[] = [];

        for (let pick = 0; pick < maxInject && pool.length > 0; pick++) {
            const idx = rouletteSelect(weights);
            if (idx < 0) break;
            selected.push(pool.splice(idx, 1)[0]!.id);
            weights.splice(idx, 1);
        }

        return selected;
    }
}
