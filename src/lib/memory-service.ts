import { Mutex } from 'async-mutex';
import { ChatMessageOrigin, ChatRole, ChatService, Hook } from '@johannes.latzel/llm-chat';
import { PageRank } from '@johannes.latzel/pagerank';
import { MemoryConfiguration } from './config.js';
import { MemoryPool, type MemoryPoolInterface } from './memory/memory-pool.js';
import { LinkPool, type LinkPoolInterface } from './link/link-pool.js';
import { SemanticLinker, type Linker } from './link/semantic-linker.js';
import { MMRSelectionStrategy } from './selection/mmr.js';
import { ScoreComposer } from './selection/composer.js';
import { expDecay } from './util.js';
import type { ReadonlyMemory } from './memory/memory.js';
import type { TextEmbeddingProvider } from './embedding/provider.js';
import { ScoredMemory } from './selection/types.js';
import type { SelectionStrategy } from './selection/types.js';

class MemoryHook {
    private lastProcessedCount = 0;
    private readonly mutex = new Mutex();
    private beforeHook: Hook | null = null;
    private afterHook: Hook | null = null;
    private disposed = false;
    private remainingPerSendLoop: number;
    private remainingPerMessage: number;
    private readonly injectedIds: Set<string> = new Set();

    constructor(
        private readonly service: ChatService,
        private readonly memoryService: MemoryService,
        private readonly config: MemoryConfiguration
    ) {
        this.remainingPerSendLoop = config.maxInjectPerSendLoop;
        this.remainingPerMessage = config.maxInjectPerMessage;
    }

    setHooks(before: Hook, after: Hook): void {
        if (this.beforeHook !== null) throw new Error('setHooks already called');
        this.beforeHook = before;
        this.afterHook = after;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.beforeHook?.dispose();
        this.afterHook?.dispose();
    }

    async onBeforeSendLoop(): Promise<void> {
        await this.mutex.runExclusive(async () => {
            this.remainingPerSendLoop = this.config.maxInjectPerSendLoop;
            this.remainingPerMessage = this.config.maxInjectPerMessage;

            const messages = this.service.chat().messages();

            for (let i = this.lastProcessedCount; i < messages.length; i++) {
                const message = messages[i]!;
                if (message.role !== ChatRole.User) continue;

                if (this.remainingPerSendLoop <= 0) break;
                this.remainingPerMessage = this.config.maxInjectPerMessage;

                const recalled = await this.memoryService.recall(
                    message.content,
                    this.remainingPerMessage
                );
                if (recalled.length === 0) continue;

                const toInject: ReadonlyMemory[] = [];
                for (const mem of recalled) {
                    if (this.injectedIds.has(mem.id())) continue;
                    toInject.push(mem);
                    if (toInject.length >= this.remainingPerSendLoop) break;
                }
                if (toInject.length === 0) continue;

                await this.inject(toInject);
                for (const mem of toInject) this.injectedIds.add(mem.id());
                this.remainingPerSendLoop -= toInject.length;
                this.remainingPerMessage -= toInject.length;
            }

            this.lastProcessedCount = messages.length;
        });
    }

    async onAfterSend(): Promise<void> {
        await this.mutex.runExclusive(async () => {
            const messages = this.service.chat().messages();

            let triggered = false;
            for (let i = this.lastProcessedCount; i < messages.length; i++) {
                const message = messages[i]!;
                if (
                    message.role !== ChatRole.Reasoning ||
                    message.origin !== ChatMessageOrigin.Model
                )
                    continue;

                if (this.remainingPerSendLoop <= 0) break;
                this.remainingPerMessage = this.config.maxInjectPerMessage;

                const recalled = await this.memoryService.recall(
                    message.content,
                    this.remainingPerMessage
                );
                if (recalled.length === 0) continue;

                const toInject: ReadonlyMemory[] = [];
                for (const mem of recalled) {
                    if (this.injectedIds.has(mem.id())) continue;
                    toInject.push(mem);
                    if (toInject.length >= this.remainingPerSendLoop) break;
                }
                if (toInject.length === 0) continue;

                await this.inject(toInject);
                for (const mem of toInject) this.injectedIds.add(mem.id());
                this.remainingPerSendLoop -= toInject.length;
                this.remainingPerMessage -= toInject.length;
                triggered = true;
            }

            this.lastProcessedCount = messages.length;

            if (triggered) this.service.setNeedsResend();
        });
    }

    private async inject(results: ReadonlyMemory[]): Promise<void> {
        const ids = results.map((m) => m.id());
        await this.service.injectToolCall('get_memory', { ids, summary: true });
    }
}

/**
 * Single entry point that owns a {@link MemoryPool}, a {@link LinkPool},
 * a {@link TextEmbeddingProvider}, a {@link SelectionStrategy}, and optional
 * ChatService lifecycle hooks for automatic memory recall.
 *
 * - `init()` loads memories and links from disk, runs PageRank, and syncs semantic links.
 * - `recall()` runs pool recall, then selects via the strategy, then marks recalled on disk.
 * - `score()` runs PageRank over the link graph and updates scores.
 * - `memories()` / `links()` expose narrow interfaces for CRUD and link management.
 * - `save()` persists links to disk — call before shutdown.
 * - Deleting a memory: call `memories().delete(id)` and `links().isolate(id)`.
 * - `hookInto()` creates a {@link MemoryHook} and registers lifecycle hooks
 *   for passive recall on a ChatService. Returns the {@link MemoryHook} so callers
 *   can {@link MemoryHook.dispose dispose} the hooks later.
 */
export class MemoryService {
    private readonly _config: MemoryConfiguration;
    private readonly pool: MemoryPool;
    private readonly linkPool: LinkPool;
    private readonly embedder: TextEmbeddingProvider;
    private readonly strategy: SelectionStrategy;
    private readonly semanticLinker: Linker;
    private initialized = false;

    /** The configuration used by this service. */
    get config(): MemoryConfiguration {
        return this._config;
    }

    constructor(
        config: MemoryConfiguration,
        embedder: TextEmbeddingProvider,
        strategy?: SelectionStrategy
    ) {
        this._config = config;
        this.pool = new MemoryPool(config, embedder);
        this.linkPool = new LinkPool(config);
        this.embedder = embedder;
        const composer = new ScoreComposer(
            config.similarityWeight,
            config.pageRankWeight,
            config.recencyWeight
        );
        this.strategy = strategy ?? new MMRSelectionStrategy(config.mmrDiversityTradeoff, composer);
        this.semanticLinker = new SemanticLinker(this.pool, this.linkPool);
    }

    /** Returns the embedding provider used by this service. */
    getEmbedder(): TextEmbeddingProvider {
        return this.embedder;
    }

    /**
     * Loads persisted memories and links from disk, then runs PageRank scoring.
     * Idempotent — subsequent calls are no-ops.
     */
    async init(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
        await this.pool.initialize();
        await this.linkPool.load();
        await this.score();
    }

    /** Returns a CRUD interface to the memory pool. */
    memories(): MemoryPoolInterface {
        return this.pool;
    }

    /** Returns an interface for managing constant links between memories. */
    links(): LinkPoolInterface {
        return this.linkPool;
    }

    /**
     * Recalls memories relevant to the given message.
     *
     * Runs pool recall, then selects via the configured strategy,
     * then marks the selected memories as recalled on disk.
     *
     * @param message   Natural-language query to match against memories.
     * @param maxInject Maximum number of memories to return (defaults to config).
     */
    async recall(message: string, maxInject?: number): Promise<ReadonlyMemory[]> {
        const candidates = await this.pool.recall(message);
        if (candidates.length === 0) return [];

        const cap = maxInject ?? this._config.maxInjectPerMessage;
        const scored: ScoredMemory[] = candidates
            .filter((c) => c.memory.embedding() != null)
            .map(
                (c) =>
                    new ScoredMemory(
                        c.memory.id(),
                        c.similarity,
                        c.memory.score(),
                        this._recencyFactor(c.memory.recalledAt()),
                        c.memory.embedding()!
                    )
            );

        const selectedIds = this.strategy.select(scored, cap);

        const selected: ReadonlyMemory[] = [];
        for (const id of selectedIds) {
            const mem = await this.pool.get(id);
            if (mem) {
                await this.pool.markRecalled(id);
                selected.push(mem);
            }
        }

        return selected;
    }

    /** Persists all links to disk. Call before shutdown to persist link state. */
    async save(): Promise<void> {
        await this.linkPool.save();
    }

    /** Runs PageRank over the current link graph and updates scores on every memory. */
    async score(): Promise<void> {
        const edges = await this.linkPool.getEdges();
        const pg = new PageRank();
        for (const edge of edges) {
            pg.add(edge.from, edge.to, edge.weight);
        }
        const ranks = pg.rank();
        for (const [id, rank] of ranks) {
            await this.pool.updateScore(id, rank);
        }
    }

    /** Returns the semantic linker used for auto-linking memories by embedding similarity. */
    get linker(): Linker {
        return this.semanticLinker;
    }

    /**
     * Registers memory-recall hooks on a ChatService for passive recall.
     *
     * @returns A {@link MemoryHook} that can be used to {@link MemoryHook.dispose dispose} the hooks later.
     */
    hookInto(chatService: ChatService): MemoryHook {
        const memoryHook = new MemoryHook(chatService, this, this._config);
        const before = chatService
            .hook()
            .beforeSendLoop()
            .do(() => memoryHook.onBeforeSendLoop());
        const after = chatService
            .hook()
            .afterSend()
            .do(() => memoryHook.onAfterSend());
        memoryHook.setHooks(before, after);
        return memoryHook;
    }

    private _recencyFactor(recalledAt: Date | null): number {
        if (!recalledAt) return 1;
        const elapsed = (Date.now() - recalledAt.getTime()) / 1000;
        return 1 - expDecay(elapsed, this._config.recencyHalfLife);
    }
}
