/** Result of {@link argmax}: the highest-scoring item and its score. */
export interface Argmax<T> {
    /** The item with the highest score. */
    item: T;
    /** That item's score. */
    score: number;
}

/** Result of {@link max}: the index and score of the highest-scoring element. */
export interface Max {
    /** Index of the highest-scoring element, or `-1` for an empty array. */
    index: number;
    /** Score of that element, or `0` for an empty array. */
    score: number;
}

/**
 * Standard exponential half-life decay factor.
 *
 * Returns `exp(-ln(2) · t / halfLife)`.  When `halfLife ≤ 0` the factor is `0`
 * (equivalent to "fully decayed").
 */
export function expDecay(t: number, halfLife: number): number {
    if (halfLife <= 0) return 0;
    return Math.exp((-Math.LN2 * t) / halfLife);
}

/** Cosine similarity between two vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
        normA = 0,
        normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

/** Finds the elbow point (largest drop between consecutive items) in a sorted array. */
export function findElbow(items: number[]): number {
    if (items.length <= 1) return items.length;
    let maxDrop = 0;
    let dropIdx = items.length;
    for (let i = 1; i < items.length; i++) {
        const drop = items[i - 1]! - items[i]!;
        if (drop > maxDrop) {
            maxDrop = drop;
            dropIdx = i;
        }
    }
    return dropIdx;
}

/**
 * Roulette-wheel (fitness proportionate) selection.
 *
 * Returns the index of a randomly chosen element from the weights array,
 * where higher-weight indices are more likely to be chosen. Returns `-1`
 * when the array is empty or all weights are zero (or negative).
 */
export function rouletteSelect(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0 || weights.length === 0) return -1;
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i]!;
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

/**
 * Returns the index and score of the element with the highest score.
 * When the array is empty both fields are zero and the index is `-1`.
 */
export function max<T>(array: T[], score: (item: T) => number): Max {
    if (array.length === 0) return { index: -1, score: 0 };
    let maxIndex = 0;
    let maxScore = score(array[0]!);
    for (let i = 1; i < array.length; i++) {
        const currentScore = score(array[i]!);
        if (currentScore > maxScore) {
            maxScore = currentScore;
            maxIndex = i;
        }
    }
    return {
        index: maxIndex,
        score: maxScore
    };
}

/**
 * Returns the item and score of the element with the highest score.
 * @throws {Error} When the array is empty.
 */
export function argmax<T>(array: T[], score: (item: T) => number): Argmax<T> {
    const maximum = max(array, score);
    if (maximum.index < 0) throw new Error('no max item found');
    return {
        item: array[maximum.index]!,
        score: maximum.score
    };
}
