import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { Mutex } from 'async-mutex';
import { MemoryLink, ConstantMemoryLink, SemanticMemoryLink, LinkType } from './link.js';
import type { MemoryConfiguration } from '../config.js';

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

/** Manages the collection of directional links between memories. */
export class LinkPool implements LinkPoolInterface {
    private links = new Map<string, MemoryLink>();
    private semanticKeys = new Set<string>();
    private config: MemoryConfiguration;
    private readonly mutex = new Mutex();

    constructor(config: MemoryConfiguration) {
        this.config = config;
    }

    private key(from: string, to: string): string {
        return `${from}::${to}`;
    }

    /**
     * Creates a constant link from `from` to `to`.
     * If a constant link already exists this is a no-op.
     */
    async add(from: string, to: string): Promise<void> {
        return this.mutex.runExclusive(() => {
            const k = this.key(from, to);
            const existing = this.links.get(k);
            if (existing instanceof ConstantMemoryLink) return;
            this.links.set(k, new ConstantMemoryLink(from, to));
            this.semanticKeys.delete(k);
        });
    }

    /** Removes the link from `from` to `to`, if it exists. */
    async remove(from: string, to: string): Promise<void> {
        return this.mutex.runExclusive(() => {
            const k = this.key(from, to);
            this.links.delete(k);
            this.semanticKeys.delete(k);
        });
    }

    /** Removes every link that involves the given memory ID (source or target). */
    async isolate(id: string): Promise<void> {
        return this.mutex.runExclusive(() => {
            for (const [k, link] of this.links) {
                if (link.from === id || link.to === id) {
                    this.links.delete(k);
                    this.semanticKeys.delete(k);
                }
            }
        });
    }

    /**
     * Atomically replaces all semantic links while preserving explicit (constant) links.
     */
    async syncSemanticLinks(
        edges: Array<{ from: string; to: string; weight: number }>
    ): Promise<void> {
        return this.mutex.runExclusive(() => {
            for (const k of this.semanticKeys) {
                this.links.delete(k);
            }
            this.semanticKeys.clear();
            for (const edge of edges) {
                const k = this.key(edge.from, edge.to);
                const existing = this.links.get(k);
                if (existing instanceof ConstantMemoryLink) continue;
                this.links.set(k, new SemanticMemoryLink(edge.from, edge.to, edge.weight));
                this.semanticKeys.add(k);
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
            return this.mutex.runExclusive(() => {
                const linked: string[] = [];
                for (const target of toOrTargets) {
                    if (target === from) continue;
                    const k = this.key(from, target);
                    const existing = this.links.get(k);
                    if (existing instanceof ConstantMemoryLink) continue;
                    this.links.set(k, new ConstantMemoryLink(from, target));
                    this.semanticKeys.delete(k);
                    linked.push(target);
                    if (undirected) {
                        const rk = this.key(target, from);
                        const rexisting = this.links.get(rk);
                        if (!(rexisting instanceof ConstantMemoryLink)) {
                            this.links.set(rk, new ConstantMemoryLink(target, from));
                            this.semanticKeys.delete(rk);
                        }
                    }
                }
                return linked;
            });
        }
        return this.mutex.runExclusive(() => {
            const k = this.key(from, toOrTargets);
            const existing = this.links.get(k);
            if (existing instanceof ConstantMemoryLink) return;
            this.links.set(k, new ConstantMemoryLink(from, toOrTargets));
            this.semanticKeys.delete(k);
            if (undirected) {
                const rk = this.key(toOrTargets, from);
                const rexisting = this.links.get(rk);
                if (!(rexisting instanceof ConstantMemoryLink)) {
                    this.links.set(rk, new ConstantMemoryLink(toOrTargets, from));
                    this.semanticKeys.delete(rk);
                }
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
        return this.mutex.runExclusive(() => {
            this.links.delete(this.key(from, toOrTargets));
            if (undirected) {
                this.links.delete(this.key(toOrTargets, from));
            }
        });
    }

    /** Returns all edges with their current weights for PageRank computation. */
    async getEdges(): Promise<Array<{ from: string; to: string; weight: number }>> {
        return this.mutex.runExclusive(() => {
            const edges: Array<{ from: string; to: string; weight: number }> = [];
            for (const link of this.links.values()) {
                edges.push({ from: link.from, to: link.to, weight: link.weight() });
            }
            return edges;
        });
    }

    /** Loads links from `links.json` in the configured memory directory. */
    async load(): Promise<void> {
        return this.mutex.runExclusive(async () => {
            const filePath = path.join(this.config.memoryDir, 'links.json');
            let content: string;
            try {
                content = await fsp.readFile(filePath, 'utf-8');
            } catch {
                return;
            }
            const data = JSON.parse(content) as Array<{
                type: string;
                from: string;
                to: string;
                weight?: number;
                cachedAt?: number;
            }>;
            this.links.clear();
            this.semanticKeys.clear();
            for (const item of data) {
                const k = this.key(item.from, item.to);
                switch (item.type as LinkType) {
                    case LinkType.Constant:
                        this.links.set(k, new ConstantMemoryLink(item.from, item.to));
                        break;
                    case LinkType.Semantic:
                        this.links.set(
                            k,
                            new SemanticMemoryLink(item.from, item.to, item.weight!, item.cachedAt)
                        );
                        this.semanticKeys.add(k);
                        break;
                    default:
                        break;
                }
            }
        });
    }

    /** Persists all links to `links.json` in the configured memory directory. */
    async save(): Promise<void> {
        return this.mutex.runExclusive(async () => {
            if (this.links.size === 0) return;
            const filePath = path.join(this.config.memoryDir, 'links.json');
            const data = Array.from(this.links.values()).map((link) => link.toJSON());
            await fsp.mkdir(path.dirname(filePath), { recursive: true });
            await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        });
    }
}
