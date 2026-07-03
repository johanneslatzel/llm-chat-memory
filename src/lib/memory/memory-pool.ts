import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { Mutex } from 'async-mutex';
import { Memory } from './memory.js';
import type { ReadonlyMemory } from './memory.js';
import { MemoryConfiguration } from '../config.js';
import { sanitiseId } from '../tool-utils.js';
import { cosineSimilarity, findElbow } from '../util.js';
import type { TextEmbeddingProvider } from '../embedding/provider.js';

/** Public CRUD interface for the memory pool. */
export interface MemoryPoolInterface {
    /** Returns read-only views of all memories in the pool. */
    all(): Promise<ReadonlyMemory[]>;
    /** Returns a read-only view of a single memory, or `undefined` if not found. */
    get(id: string): Promise<ReadonlyMemory | undefined>;
    /** Checks whether a memory with the given ID exists in the pool. */
    has(id: string): boolean;
    /** Creates a new memory, persists it to disk, and adds it to the pool. */
    create(label: string, input: CreateMemoryInput): Promise<Memory>;
    /** Updates an existing memory's content, tags, and/or summary. */
    update(id: string, input: UpdateMemoryInput): Promise<Memory>;
    /** Permanently removes a memory by ID and deletes its JSON file. */
    delete(id: string): Promise<void>;
    /** Recompute stale or missing embeddings for all memories. */
    ensureEmbeddings(): Promise<void>;
}

/** Input for creating a new memory. */
export interface CreateMemoryInput {
    /** The memory content text. */
    content: string;
    /** Short summary of the memory. */
    summary: string;
    /** Optional tags for categorisation. */
    tags?: string[];
}

/** Input for updating an existing memory. All fields are optional. */
export interface UpdateMemoryInput {
    /** New content text. */
    content?: string;
    /** New summary text. */
    summary?: string;
    /** Replacement tags. */
    tags?: string[];
}

/**
 * Thread-safe in-memory pool of {@link Memory} objects, backed by a JSON
 * directory. All mutations are serialised through an internal mutex.
 */
export class MemoryPool implements MemoryPoolInterface {
    private readonly _config: MemoryConfiguration;
    private readonly _data: Map<string, Memory> = new Map();
    private readonly _mutex = new Mutex();
    private readonly _embedder: TextEmbeddingProvider;

    /** The configuration used by this pool. */
    get config(): MemoryConfiguration {
        return this._config;
    }

    /**
     * @param config  Configuration for storage directory and limits. Defaults to a fresh {@link MemoryConfiguration}.
     * @param embedder  The embedding provider used for semantic recall.
     */
    constructor(config: MemoryConfiguration, embedder: TextEmbeddingProvider) {
        this._config = config;
        this._embedder = embedder;
    }

    private async _save(memory: Memory): Promise<void> {
        const memoriesDir = this._config.memoriesDir;
        await fsp.writeFile(
            path.join(memoriesDir, `${memory.id()}.json`),
            JSON.stringify(memory.toJSON(), null, 2),
            'utf-8'
        );
    }

    private async _load(id: string): Promise<Memory | null> {
        const memoriesDir = this._config.memoriesDir;
        try {
            const content = await fsp.readFile(path.join(memoriesDir, `${id}.json`), 'utf-8');
            return new Memory(JSON.parse(content));
        } catch {
            return null;
        }
    }

    /**
     * Loads all memory files from disk into memory.
     * Must be called once before using other methods after construction.
     */
    async initialize(): Promise<void> {
        return this._mutex.runExclusive(async () => {
            this._data.clear();
            const memoriesDir = this._config.memoriesDir;
            let entries: string[];
            try {
                entries = await fsp.readdir(memoriesDir);
            } catch {
                return;
            }
            await Promise.all(
                entries
                    .filter((name) => name.endsWith('.json'))
                    .map(async (name) => {
                        const id = name.replace('.json', '');
                        const mem = await this._load(id);
                        if (mem) this._data.set(mem.id(), mem);
                    })
            );
        });
    }

    /** Checks whether a memory with the given ID exists in the pool. */
    has(id: string): boolean {
        return this._data.has(id);
    }

    /**
     * Creates a new memory, persists it to disk, and adds it to the pool.
     * Requires content and summary. The embedding is computed lazily on first recall.
     */
    async create(label: string, input: CreateMemoryInput): Promise<Memory> {
        return this._mutex.runExclusive(async () => {
            const id = sanitiseId(label);
            if (this._data.has(id)) {
                throw new Error(`Memory '${id}' already exists`);
            }

            const tags = input.tags ?? [];
            const now = Date.now();

            const mem = new Memory({
                id,
                content: input.content,
                summary: input.summary,
                tags,
                score: 1,
                embedding: null,
                cachedAt: null,
                createdAt: now,
                changedAt: now,
                recalledAt: null
            });

            this._validateSummaryLength(input.summary, input.content);

            const memoriesDir = this._config.memoriesDir;
            await fsp.mkdir(memoriesDir, { recursive: true });
            await this._save(mem);
            this._data.set(id, mem);
            return mem;
        });
    }

    /**
     * Updates an existing memory's content, tags, and/or summary.
     */
    async update(id: string, input: UpdateMemoryInput): Promise<Memory> {
        return this._mutex.runExclusive(async () => {
            const mem = this._data.get(id);
            if (!mem) {
                throw new Error(`Memory '${id}' not found`);
            }
            if (input.content !== undefined) mem.content(input.content);
            if (input.tags !== undefined) mem.tags(input.tags);
            if (input.summary !== undefined) {
                this._validateSummaryLength(input.summary, mem.content());
                mem.summary(input.summary);
            } else if (input.content !== undefined) {
                // content changed but summary didn't — re-validate existing summary
                this._validateSummaryLength(mem.summary(), mem.content());
            }
            // invalidate embedding cache when content or tags change
            if (input.content !== undefined || input.tags !== undefined) {
                mem.cachedAt(null);
            }
            mem.changedAt(new Date());

            await this._save(mem);
            return mem;
        });
    }

    /**
     * Permanently removes a memory by ID and deletes its JSON file.
     * Does NOT clean up links — the caller must handle that via LinkPool.
     */
    async delete(id: string): Promise<void> {
        return this._mutex.runExclusive(async () => {
            if (!this._data.has(id)) {
                throw new Error(`Memory '${id}' not found`);
            }
            this._data.delete(id);
            const memoriesDir = this._config.memoriesDir;
            await fsp.rm(path.join(memoriesDir, `${id}.json`), { force: true });
        });
    }

    /** Returns a read-only view of a single memory, or `undefined` if not found. */
    async get(id: string): Promise<ReadonlyMemory | undefined> {
        return this._mutex.runExclusive(() => {
            return this._data.get(id);
        });
    }

    /** Returns read-only views of all memories in the pool. */
    async all(): Promise<ReadonlyMemory[]> {
        return this._mutex.runExclusive(() => {
            return Array.from(this._data.values());
        });
    }

    /**
     * Recalls memories by embedding similarity. Encodes the message once,
     * compares against all cached memory embeddings, filters by similarity gate,
     * and returns scored candidates sorted by similarity descending.
     */
    async recall(message: string): Promise<Array<{ memory: ReadonlyMemory; similarity: number }>> {
        return this._mutex.runExclusive(async () => {
            await this.ensureEmbeddings();

            if (this._data.size === 0) return [];

            const queryEmbedding = await this._embedder.encode(message);

            const scored: Array<{ mem: Memory; sim: number }> = [];

            for (const mem of this._data.values()) {
                const vec = mem.embedding();
                if (!vec) continue;
                const sim = cosineSimilarity(queryEmbedding, vec);
                if (sim >= this._config.similarityGate) {
                    scored.push({ mem, sim });
                }
            }

            scored.sort((a, b) => b.sim - a.sim);

            const elbowIdx = findElbow(scored.map((s) => s.sim));
            const candidates = elbowIdx > 0 ? scored.slice(0, elbowIdx) : scored;

            return candidates.map(({ mem, sim }) => ({
                memory: mem,
                similarity: sim
            }));
        });
    }

    /**
     * Ensures all memories have up-to-date embeddings.
     * Recomputes stale or missing embeddings. Called automatically by
     * {@link recall}, but can also be invoked manually after bulk
     * imports or updates to pre-compute embeddings ahead of queries.
     */
    async ensureEmbeddings(): Promise<void> {
        const needsRecompute: Memory[] = [];
        for (const mem of this._data.values()) {
            if (
                mem.embedding() === null ||
                !mem.cachedAt() ||
                mem.cachedAt()!.getTime() < mem.changedAt()!.getTime()
            ) {
                needsRecompute.push(mem);
            }
        }

        if (needsRecompute.length === 0) return;

        await Promise.all(
            needsRecompute.map((mem) => this._recomputeMemoryEmbedding(mem).catch(() => {}))
        );
    }

    /**
     * Computes and stores the embedding for a single memory by ID.
     * Returns the new embedding, or null if the memory doesn't exist.
     */
    async recomputeEmbedding(id: string): Promise<number[] | null> {
        return this._mutex.runExclusive(async () => {
            const mem = this._data.get(id);
            if (!mem) return null;
            await this._recomputeMemoryEmbedding(mem);
            return mem.embedding();
        });
    }

    private async _recomputeMemoryEmbedding(mem: Memory): Promise<void> {
        const vec = await this._embedder.encode(mem.embeddingInput());
        mem.embedding(vec);
        mem.cachedAt(new Date());
        await this._save(mem);
    }

    private _validateSummaryLength(summary: string, content: string): void {
        const config = this._config;
        const maxLen = Math.max(
            config.minSummaryLength,
            config.maxSummaryLength,
            Math.round(config.summaryContentRatio * content.length)
        );
        if (summary.length < config.minSummaryLength) {
            throw new Error(
                `Summary must be at least ${config.minSummaryLength} characters (got ${summary.length})`
            );
        }
        if (summary.length > maxLen) {
            throw new Error(
                `Summary must be at most ${maxLen} characters (got ${summary.length}). Content is ${content.length} chars, maximum is max(${config.maxSummaryLength}, ${config.summaryContentRatio} * content length).`
            );
        }
    }

    /**
     * Updates a single memory's score in-memory and on disk.
     * Intended for use by {@link MemoryService#score}.
     */
    async updateScore(id: string, score: number): Promise<void> {
        return this._mutex.runExclusive(async () => {
            const mem = this._data.get(id);
            if (!mem) return;
            mem.score(score);
            await this._save(mem);
        });
    }

    /** Updates recalledAt to now and persists. No-op if the memory doesn't exist. */
    async markRecalled(id: string): Promise<void> {
        return this._mutex.runExclusive(async () => {
            const mem = this._data.get(id);
            if (!mem) return;
            mem.recalledAt(new Date());
            await this._save(mem);
        });
    }
}
