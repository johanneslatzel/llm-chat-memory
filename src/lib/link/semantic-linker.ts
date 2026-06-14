import { MemoryPool } from '../memory/memory-pool.js';
import { LinkPool } from './link-pool.js';
import { cosineSimilarity } from '../util.js';

const CONSTANT_LINK_WEIGHT = 10;

function semanticWeight(sim: number, similarityGate: number): number {
    const s = Math.max(sim, similarityGate);
    const numerator = Math.exp(s) - Math.exp(similarityGate);
    const denominator = Math.exp(1) - Math.exp(similarityGate);
    return CONSTANT_LINK_WEIGHT * (numerator / denominator);
}

/** Recomputes semantic similarity links between memories. */
export interface Linker {
    /** Full O(n²) recompute of all semantic similarity links. */
    sync(): Promise<void>;
}

/**
 * Default {@link Linker} implementation that computes all-pairs
 * embedding similarity edges and syncs them to the link pool.
 */
export class SemanticLinker implements Linker {
    private readonly pool: MemoryPool;
    private readonly linkPool: LinkPool;

    constructor(pool: MemoryPool, linkPool: LinkPool) {
        this.pool = pool;
        this.linkPool = linkPool;
    }

    /**
     * Full O(n²) recompute: compares every pair of memories and creates
     * or replaces all semantic links above the similarity gate.
     */
    async sync(): Promise<void> {
        const memories = await this.pool.all();

        const gate = this.pool.config.similarityGate;
        const edges: Array<{ from: string; to: string; weight: number }> = [];

        for (let i = 0; i < memories.length; i++) {
            const a = memories[i]!;
            const embA = a.embedding();
            if (!embA) continue;
            for (let j = i + 1; j < memories.length; j++) {
                const b = memories[j]!;
                const embB = b.embedding();
                if (!embB) continue;
                const sim = cosineSimilarity(embA, embB);
                if (sim >= gate) {
                    const w = semanticWeight(sim, gate);
                    edges.push({ from: a.id(), to: b.id(), weight: w });
                    edges.push({ from: b.id(), to: a.id(), weight: w });
                }
            }
        }

        await this.linkPool.syncSemanticLinks(edges);
    }
}
