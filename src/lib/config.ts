import * as path from 'node:path';
import { envFloat, envInt, envString } from '../env.js';
import {
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
    DEFAULT_SUMMARY_CONTENT_RATIO
} from './constants.js';

/** Configuration for memory pool behaviour and storage. */
export class MemoryConfiguration {
    /** Directory path where memory JSON files are persisted. */
    memoryDir: string;

    /** Convenience getter for the memories sub-directory. */
    get memoriesDir(): string {
        return path.join(this.memoryDir, 'memories');
    }

    /** Maximum number of memories to inject per individual message. */
    maxInjectPerMessage: number;

    /** Cumulative cap for the entire send-loop cycle. */
    maxInjectPerSendLoop: number;

    /** Token truncation limit per memory's injected content. */
    maxInjectionContentLength: number;

    /** Minimum cosine similarity for a memory to be considered relevant. */
    similarityGate: number;

    /** Hugging Face model ID for local embedding generation. */
    embeddingModel: string;

    /** Minimum summary length in characters. */
    minSummaryLength: number;

    /** Maximum summary length in characters. */
    maxSummaryLength: number;

    /** Maximum summary length as fraction of content length. */
    summaryContentRatio: number;

    /** Half-life for recency factor in seconds. */
    recencyHalfLife: number;

    /** Weight for embedding similarity in composite scoring. */
    similarityWeight: number;

    /** Weight for PageRank in composite scoring. */
    pageRankWeight: number;

    /** Weight for recency in composite scoring. */
    recencyWeight: number;

    /** MMR relevance–diversity trade-off (1.0 = pure relevance, 0.0 = pure diversity). */
    mmrDiversityTradeoff: number;

    constructor(memoryDir?: string, maxInjectPerMessage?: number, maxInjectPerSendLoop?: number) {
        this.memoryDir = memoryDir ?? envString('LLM_CHAT_MEMORY_DIR', DEFAULT_MEMORY_DIR);
        this.maxInjectPerMessage =
            maxInjectPerMessage ??
            envInt('LLM_CHAT_MEMORY_MAX_INJECT_PER_MESSAGE', DEFAULT_MAX_INJECT_PER_MESSAGE, 1);
        this.maxInjectPerSendLoop =
            maxInjectPerSendLoop ??
            envInt('LLM_CHAT_MEMORY_MAX_INJECT_PER_SEND_LOOP', DEFAULT_MAX_INJECT_PER_SEND_LOOP, 1);
        this.maxInjectionContentLength = envInt(
            'LLM_CHAT_MEMORY_MAX_INJECTION_CONTENT_LENGTH',
            DEFAULT_MAX_INJECTION_CONTENT_LENGTH,
            50
        );
        this.similarityGate = envFloat(
            'LLM_CHAT_MEMORY_SIMILARITY_GATE',
            DEFAULT_SIMILARITY_GATE,
            -1,
            1
        );
        this.embeddingModel = envString('LLM_CHAT_MEMORY_EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL);
        this.minSummaryLength = envInt(
            'LLM_CHAT_MEMORY_MIN_SUMMARY_LENGTH',
            DEFAULT_MIN_SUMMARY_LENGTH,
            10
        );
        this.maxSummaryLength = envInt(
            'LLM_CHAT_MEMORY_MAX_SUMMARY_LENGTH',
            DEFAULT_MAX_SUMMARY_LENGTH,
            20
        );
        this.summaryContentRatio = DEFAULT_SUMMARY_CONTENT_RATIO;
        this.recencyHalfLife = envInt(
            'LLM_CHAT_MEMORY_RECENCY_HALF_LIFE',
            DEFAULT_RECENCY_HALF_LIFE,
            60
        );
        this.similarityWeight = DEFAULT_SIMILARITY_WEIGHT;
        this.pageRankWeight = DEFAULT_PAGERANK_WEIGHT;
        this.recencyWeight = DEFAULT_RECENCY_WEIGHT;
        this.mmrDiversityTradeoff = DEFAULT_MMR_DIVERSITY_TRADEOFF;
    }
}
