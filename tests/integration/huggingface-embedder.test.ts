import { describe, it, expect } from 'vitest';
import { HuggingFaceEmbeddingProvider, HuggingFaceDevice } from '../../src/lib/embedding/huggingface.js';

const describeIntegration = process.env.LLM_CHAT_MEMORY_RUN_INTEGRATION_TESTS
    ? describe
    : describe.skip;

describeIntegration('HuggingFaceEmbeddingProvider (real model)', () => {
    it('encodes text and returns a 384-dimensional unit vector', async () => {
        const provider = new HuggingFaceEmbeddingProvider({
            dtype: 'q8',
            device: HuggingFaceDevice.CPU
        });

        expect(provider.dimensions()).toBe(384);

        const vec = await provider.encode('Hello, world!');
        expect(vec).toHaveLength(384);

        // verify it's a unit vector (L2 norm ≈ 1)
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        expect(norm).toBeCloseTo(1, 1);
    });

    it('returns consistent embeddings for the same input', async () => {
        const provider = new HuggingFaceEmbeddingProvider({
            dtype: 'q8',
            device: HuggingFaceDevice.CPU
        });

        const a = await provider.encode('The quick brown fox');
        const b = await provider.encode('The quick brown fox');

        expect(a).toEqual(b);
    });

    it('returns different embeddings for different inputs', async () => {
        const provider = new HuggingFaceEmbeddingProvider({
            dtype: 'q8',
            device: HuggingFaceDevice.CPU
        });

        const a = await provider.encode('cats are fluffy');
        const b = await provider.encode('quantum physics');

        const areEqual = a.every((v, i) => v === b[i]);
        expect(areEqual).toBe(false);
    });

    it('encodes longer text without error', async () => {
        const provider = new HuggingFaceEmbeddingProvider({
            dtype: 'q8',
            device: HuggingFaceDevice.CPU
        });

        const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);
        const vec = await provider.encode(longText);
        expect(vec).toHaveLength(384);
    });
});
