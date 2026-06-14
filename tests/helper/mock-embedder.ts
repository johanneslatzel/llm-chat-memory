import type { TextEmbeddingProvider } from '../../src/lib/embedding/provider.js';

/**
 * A deterministic mock embedder for testing.
 *
 * Returns a fixed 4-dimensional unit vector. Enables recall tests to
 * function without a real embedding model: every text encodes to the
 * same vector, so all cached memories pass the similarity gate.
 */
export class MockEmbedder implements TextEmbeddingProvider {
    dimensions(): number {
        return 4;
    }

    async encode(_text: string): Promise<number[]> {
        return [1, 0, 0, 0];
    }
}
