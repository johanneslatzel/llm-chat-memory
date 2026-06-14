/** Directory where memory JSON files are persisted. */
export const DEFAULT_MEMORY_DIR = './memories';
/** Max memories injected per message during recall. */
export const DEFAULT_MAX_INJECT_PER_MESSAGE = 2;
/** Max injection rounds per send loop. */
export const DEFAULT_MAX_INJECT_PER_SEND_LOOP = 5;
/** Max characters of content injected per memory. */
export const DEFAULT_MAX_INJECTION_CONTENT_LENGTH = 500;
/** Cosine similarity threshold (0–1) for considering a memory relevant. */
export const DEFAULT_SIMILARITY_GATE = 0.4;
/** HuggingFace model ID used for embedding. */
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

/** Minimum characters in a memory for summarization. */
export const DEFAULT_MIN_SUMMARY_LENGTH = 50;
/** Maximum characters in a memory summary. */
export const DEFAULT_MAX_SUMMARY_LENGTH = 600;
/** Ratio of summary to content length. */
export const DEFAULT_SUMMARY_CONTENT_RATIO = 0.2;

/** Half-life in seconds for the recency score decay curve. */
export const DEFAULT_RECENCY_HALF_LIFE = 3600;
/** Weight for embedding similarity in composite scoring. */
export const DEFAULT_SIMILARITY_WEIGHT = 0.5;
/** Weight for PageRank in composite scoring. */
export const DEFAULT_PAGERANK_WEIGHT = 0.3;
/** Weight for recency in composite scoring. */
export const DEFAULT_RECENCY_WEIGHT = 0.2;
/** MMR relevance–diversity trade-off (1.0 = pure relevance, 0.0 = pure diversity). */
export const DEFAULT_MMR_DIVERSITY_TRADEOFF = 0.7;

/** Weight multiplier for constant (non-decaying) links. */
export const CONSTANT_LINK_WEIGHT = 10;
