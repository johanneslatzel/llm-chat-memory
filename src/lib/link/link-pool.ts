import { Mutex } from 'async-mutex';
import { type HasHooks, type Hook } from '@johannes.latzel/llm-chat';
import { MemoryLink, ConstantMemoryLink, SemanticMemoryLink } from './link.js';
import type { MemoryPool } from '../memory/memory-pool.js';
import { EventHookBuilder, HookEmitter } from '../hooks.js';

/** Public interface for managing constant links between memories. */
export interface LinkPoolInterface {
    /** Creates a constant link between two memories. When `undirected` is true, creates the link in both directions. */
    link(from: string, to: string, undirected?: boolean): Promise<void>;
    /** Batch: creates constant links from `from` to each target. Returns the targets that were linked. */
    link(from: string, targets: string[], undirected?: boolean): Promise<string[]>;
    /** Removes a link between two memories. When `undirected` is true, removes the link in both directions. */
    unlink(from: string, to: string, undirected?: boolean): Promise<void>;
    /** Batch: removes links from `from` to each target. */
    unlink(from: string, targets: string[], undirected?: boolean): Promise<void>;
    /** Removes every link involving the given memory ID (source or target). */
    isolate(id: string): Promise<void>;
}

/** Event data emitted when a constant link is created. */
export type LinkCreateEvent = {
    /** The source memory id. */
    from: string;
    /** The target memory id. */
    to: string;
};

/** Event data emitted when a constant link is removed. */
export type LinkRemoveEvent = {
    /** The source memory id. */
    from: string;
    /** The target memory id. */
    to: string;
};

type LinkHookRegistrations = {
    onLink: (fn: (event: LinkCreateEvent) => void) => Hook;
    onUnlink: (fn: (event: LinkRemoveEvent) => void) => Hook;
};

/** Fluent entry point for registering {@link LinkPool} lifecycle hooks. */
export class LinkHookBuilder {
    constructor(private readonly registrations: LinkHookRegistrations) {}

    /** Register a callback for when a constant link is created. */
    onLink(): EventHookBuilder<LinkCreateEvent> {
        return new EventHookBuilder(this.registrations.onLink);
    }

    /** Register a callback for when a constant link is removed. */
    onUnlink(): EventHookBuilder<LinkRemoveEvent> {
        return new EventHookBuilder(this.registrations.onUnlink);
    }
}

/**
 * Manages the collection of directional links between memories.
 *
 * The in-memory graph is a nested map keyed by source then target
 * (`from -> to -> MemoryLink`), giving O(1) membership checks for link/unlink
 * deduplication and O(outgoing) retrieval of a single source's links. Links
 * are persisted on their source memory (each `MemoryJSON` carries its own
 * outgoing `links` field) via the injected {@link MemoryPool}.
 */
export class LinkPool implements LinkPoolInterface, HasHooks<LinkHookBuilder> {
    private links = new Map<string, Map<string, MemoryLink>>();
    private semanticKeys = new Set<string>();
    private pool: MemoryPool;
    private readonly mutex = new Mutex();
    private readonly onLinkEmitter = new HookEmitter<(event: LinkCreateEvent) => void>();
    private readonly onUnlinkEmitter = new HookEmitter<(event: LinkRemoveEvent) => void>();

    constructor(pool: MemoryPool) {
        this.pool = pool;
    }

    /**
     * Access the hook builder for this pool.
     * @example
     * ```ts
     * const hook = pool.hook().onLink().do((event) => console.log(event));
     * // later: hook.dispose();
     * ```
     */
    hook(): LinkHookBuilder {
        return new LinkHookBuilder({
            onLink: (fn) => this.onLinkEmitter.add(fn),
            onUnlink: (fn) => this.onUnlinkEmitter.add(fn)
        });
    }

    private key(from: string, to: string): string {
        return `${from}::${to}`;
    }

    private getLink(from: string, to: string): MemoryLink | undefined {
        return this.links.get(from)?.get(to);
    }

    private setLink(link: MemoryLink): void {
        let source = this.links.get(link.from);
        if (!source) {
            source = new Map();
            this.links.set(link.from, source);
        }
        source.set(link.to, link);
    }

    private deleteLink(from: string, to: string): boolean {
        const source = this.links.get(from);
        if (!source) return false;
        const removed = source.delete(to);
        if (source.size === 0) this.links.delete(from);
        return removed;
    }

    private outgoing(from: string): MemoryLink[] {
        return Array.from(this.links.get(from)?.values() ?? []);
    }

    /**
     * Persists a source memory's outgoing links by rewriting its `links` field
     * through the pool. Only the source's own outgoing links are collected.
     */
    private async _persistSource(from: string): Promise<void> {
        const outgoingLinks = this.outgoing(from).map((l) => l.toMemoryLinkJSON());
        await this.pool.updateLinks(from, outgoingLinks);
    }

    /**
     * Creates a constant link from `from` to `to`.
     * If a constant link already exists this is a no-op.
     */
    async add(from: string, to: string): Promise<void> {
        return this.mutex.runExclusive(async () => {
            const existing = this.getLink(from, to);
            if (existing instanceof ConstantMemoryLink) return;
            this.setLink(new ConstantMemoryLink(from, to));
            this.semanticKeys.delete(this.key(from, to));
            await this._persistSource(from);
        });
    }

    /** Removes the link from `from` to `to`, if it exists. */
    async remove(from: string, to: string): Promise<void> {
        return this.mutex.runExclusive(async () => {
            const removed = this.deleteLink(from, to);
            this.semanticKeys.delete(this.key(from, to));
            if (removed) await this._persistSource(from);
        });
    }

    /** Removes every link that involves the given memory ID (source or target). */
    async isolate(id: string): Promise<void> {
        return this.mutex.runExclusive(async () => {
            const toDelete: MemoryLink[] = [];
            for (const source of this.links.values()) {
                for (const link of source.values()) {
                    if (link.from === id || link.to === id) {
                        toDelete.push(link);
                    }
                }
            }
            const affectedSources = new Set<string>();
            for (const link of toDelete) {
                this.deleteLink(link.from, link.to);
                this.semanticKeys.delete(this.key(link.from, link.to));
                this.onUnlinkEmitter.emit({ from: link.from, to: link.to });
                affectedSources.add(link.from);
            }
            for (const source of affectedSources) {
                await this._persistSource(source);
            }
        });
    }

    /**
     * Atomically replaces all semantic links while preserving explicit (constant) links.
     */
    async syncSemanticLinks(
        edges: Array<{ from: string; to: string; weight: number }>
    ): Promise<void> {
        return this.mutex.runExclusive(async () => {
            // remember sources that currently have semantic links so stale
            // semantic entries are cleared even when the new pass leaves them empty
            const staleSemanticSources = new Set<string>();
            for (const k of this.semanticKeys) {
                staleSemanticSources.add(k.slice(0, k.indexOf('::')));
            }

            for (const k of this.semanticKeys) {
                const sep = k.indexOf('::');
                this.deleteLink(k.slice(0, sep), k.slice(sep + 2));
            }
            this.semanticKeys.clear();
            for (const edge of edges) {
                const existing = this.getLink(edge.from, edge.to);
                if (existing instanceof ConstantMemoryLink) continue;
                this.setLink(new SemanticMemoryLink(edge.from, edge.to, edge.weight));
                this.semanticKeys.add(this.key(edge.from, edge.to));
            }

            const touched = new Set(staleSemanticSources);
            for (const edge of edges) touched.add(edge.from);
            for (const source of touched) {
                await this._persistSource(source);
            }
        });
    }

    async link(from: string, to: string, undirected?: boolean): Promise<void>;
    async link(from: string, targets: string[], undirected?: boolean): Promise<string[]>;
    async link(
        from: string,
        toOrTargets: string | string[],
        undirected?: boolean
    ): Promise<void | string[]> {
        if (Array.isArray(toOrTargets)) {
            return this.mutex.runExclusive(async () => {
                const linked: string[] = [];
                const reverseSources = new Set<string>();
                for (const target of toOrTargets) {
                    if (target === from) continue;
                    const existing = this.getLink(from, target);
                    if (existing instanceof ConstantMemoryLink) continue;
                    this.setLink(new ConstantMemoryLink(from, target));
                    this.semanticKeys.delete(this.key(from, target));
                    linked.push(target);
                    this.onLinkEmitter.emit({ from, to: target });
                    if (undirected) {
                        const rexisting = this.getLink(target, from);
                        if (!(rexisting instanceof ConstantMemoryLink)) {
                            this.setLink(new ConstantMemoryLink(target, from));
                            this.semanticKeys.delete(this.key(target, from));
                            this.onLinkEmitter.emit({ from: target, to: from });
                            reverseSources.add(target);
                        }
                    }
                }
                if (linked.length > 0 || reverseSources.size > 0) {
                    await this._persistSource(from);
                    for (const target of reverseSources) {
                        await this._persistSource(target);
                    }
                }
                return linked;
            });
        }
        return this.mutex.runExclusive(async () => {
            const existing = this.getLink(from, toOrTargets);
            if (existing instanceof ConstantMemoryLink) return;
            this.setLink(new ConstantMemoryLink(from, toOrTargets));
            this.semanticKeys.delete(this.key(from, toOrTargets));
            this.onLinkEmitter.emit({ from, to: toOrTargets });
            let reverseSource: string | null = null;
            if (undirected) {
                const rexisting = this.getLink(toOrTargets, from);
                if (!(rexisting instanceof ConstantMemoryLink)) {
                    this.setLink(new ConstantMemoryLink(toOrTargets, from));
                    this.semanticKeys.delete(this.key(toOrTargets, from));
                    this.onLinkEmitter.emit({ from: toOrTargets, to: from });
                    reverseSource = toOrTargets;
                }
            }
            await this._persistSource(from);
            if (reverseSource !== null) {
                await this._persistSource(reverseSource);
            }
        });
    }

    async unlink(from: string, to: string, undirected?: boolean): Promise<void>;
    async unlink(from: string, targets: string[], undirected?: boolean): Promise<void>;
    async unlink(
        from: string,
        toOrTargets: string | string[],
        undirected?: boolean
    ): Promise<void> {
        if (Array.isArray(toOrTargets)) {
            for (const target of toOrTargets) {
                await this.unlink(from, target, undirected);
            }
            return;
        }
        return this.mutex.runExclusive(async () => {
            const removed = this.deleteLink(from, toOrTargets);
            let removedReverse = false;
            if (undirected) {
                removedReverse = this.deleteLink(toOrTargets, from);
            }
            if (removed) {
                this.onUnlinkEmitter.emit({ from, to: toOrTargets });
                await this._persistSource(from);
            }
            if (removedReverse) {
                this.onUnlinkEmitter.emit({ from: toOrTargets, to: from });
                await this._persistSource(toOrTargets);
            }
        });
    }

    /** Returns all edges with their current weights for PageRank computation. */
    async getEdges(): Promise<Array<{ from: string; to: string; weight: number }>> {
        return this.mutex.runExclusive(() => {
            const edges: Array<{ from: string; to: string; weight: number }> = [];
            for (const source of this.links.values()) {
                for (const link of source.values()) {
                    edges.push({ from: link.from, to: link.to, weight: link.weight() });
                }
            }
            return edges;
        });
    }

    /** Rebuilds the working graph from the outgoing links stored on each memory. */
    async load(): Promise<void> {
        return this.mutex.runExclusive(async () => {
            this.links.clear();
            this.semanticKeys.clear();
            const memories = await this.pool.all();
            for (const mem of memories) {
                const owner = mem.id();
                for (const entry of mem.toJSON().links) {
                    const link = MemoryLink.fromMemoryLinkJSON(owner, entry);
                    this.setLink(link);
                    if (link instanceof SemanticMemoryLink) {
                        this.semanticKeys.add(this.key(owner, link.to));
                    }
                }
            }
        });
    }
}
