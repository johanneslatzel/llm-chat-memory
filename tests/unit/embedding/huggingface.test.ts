import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPipeline } = vi.hoisted(() => {
    return { mockPipeline: vi.fn() };
});

vi.mock('@huggingface/transformers', () => ({
    pipeline: mockPipeline
}));

import { HuggingFaceEmbeddingProvider, HuggingFaceDevice } from '../../../src/lib/embedding/huggingface.js';

describe('HuggingFaceEmbeddingProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates with default model', () => {
        const provider = new HuggingFaceEmbeddingProvider();
        expect(provider.dimensions()).toBe(384);
    });

    it('creates with custom options', () => {
        const provider = new HuggingFaceEmbeddingProvider({
            model: 'Xenova/all-MiniLM-L6-v2',
            dtype: 'fp32',
            device: HuggingFaceDevice.CPU
        });
        expect(provider.dimensions()).toBe(384);
    });

    it('creates with a different model', () => {
        const provider = new HuggingFaceEmbeddingProvider({
            model: 'Xenova/other-model'
        });
        expect(provider.dimensions()).toBe(384);
    });

    it('encode returns embedding vector', async () => {
        const mockPipe = vi.fn().mockResolvedValue({ data: new Float32Array([1, 2, 3]) });
        mockPipeline.mockResolvedValue(mockPipe);

        const provider = new HuggingFaceEmbeddingProvider();
        const result = await provider.encode('test text');
        expect(result).toEqual([1, 2, 3]);
        expect(mockPipeline).toHaveBeenCalledWith(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            { dtype: 'q8', device: HuggingFaceDevice.CPU }
        );
        expect(mockPipe).toHaveBeenCalledWith('test text', { pooling: 'mean', normalize: true });
    });

    it('reuses pipeline on subsequent calls', async () => {
        const mockPipe = vi.fn().mockResolvedValue({ data: new Float32Array([4, 5, 6]) });
        mockPipeline.mockResolvedValue(mockPipe);

        const provider = new HuggingFaceEmbeddingProvider();
        await provider.encode('first');
        await provider.encode('second');

        expect(mockPipeline).toHaveBeenCalledTimes(1);
        expect(mockPipe).toHaveBeenCalledTimes(2);
    });
});
