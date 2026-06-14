import { describe, it, expect } from 'vitest';
import {
    CONSTANT_LINK_WEIGHT,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_PAGERANK_WEIGHT,
    DEFAULT_RECENCY_WEIGHT,
    DEFAULT_SIMILARITY_WEIGHT,
    DEFAULT_MAX_INJECTION_CONTENT_LENGTH,
    DEFAULT_MAX_INJECT_PER_MESSAGE,
    DEFAULT_MAX_INJECT_PER_SEND_LOOP,
    DEFAULT_MAX_SUMMARY_LENGTH,
    DEFAULT_MEMORY_DIR,
    DEFAULT_MIN_SUMMARY_LENGTH,
    DEFAULT_MMR_DIVERSITY_TRADEOFF,
    DEFAULT_RECENCY_HALF_LIFE,
    DEFAULT_SIMILARITY_GATE,
    DEFAULT_SUMMARY_CONTENT_RATIO,
} from '../../src/lib/constants.js';

describe('constants', () => {
    it('has correct values', () => {
        expect(DEFAULT_MEMORY_DIR).toBe('./memories');
        expect(DEFAULT_MAX_INJECT_PER_MESSAGE).toBe(2);
        expect(DEFAULT_MAX_INJECT_PER_SEND_LOOP).toBe(5);
        expect(DEFAULT_MAX_INJECTION_CONTENT_LENGTH).toBe(500);
        expect(DEFAULT_SIMILARITY_GATE).toBe(0.4);
        expect(DEFAULT_EMBEDDING_MODEL).toBe('Xenova/all-MiniLM-L6-v2');
        expect(DEFAULT_MIN_SUMMARY_LENGTH).toBe(50);
        expect(DEFAULT_MAX_SUMMARY_LENGTH).toBe(600);
        expect(DEFAULT_SUMMARY_CONTENT_RATIO).toBe(0.2);
        expect(DEFAULT_RECENCY_HALF_LIFE).toBe(3600);
        expect(DEFAULT_SIMILARITY_WEIGHT).toBe(0.5);
        expect(DEFAULT_PAGERANK_WEIGHT).toBe(0.3);
        expect(DEFAULT_RECENCY_WEIGHT).toBe(0.2);
        expect(DEFAULT_MMR_DIVERSITY_TRADEOFF).toBe(0.7);
        expect(CONSTANT_LINK_WEIGHT).toBe(10);
    });
});
