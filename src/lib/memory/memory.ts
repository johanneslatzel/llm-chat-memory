import type { MemoryLinkJSON } from '../link/link.js';

/** Read-only view of a memory. */
export interface ReadonlyMemory {
    /** Unique identifier. */
    id(): string;
    /** The stored memory content. */
    get content(): string;
    /** Short summary of the memory. */
    get summary(): string;
    /** Tags used for categorisation and ranking. */
    get tags(): string[];
    /** Importance score (higher = more important). */
    get score(): number;
    /** Cached embedding vector, or `null` if not yet computed. */
    get embedding(): number[] | null;
    /** Timestamp when the embedding was last cached, or `null` if never cached. */
    get cachedAt(): Date | null;
    /** Timestamp when the memory was first created. */
    createdAt(): Date;
    /** Timestamp of the last modification. */
    get changedAt(): Date;
    /** Timestamp of the last recall, or `null` if never recalled. */
    get recalledAt(): Date | null;
    /** Outgoing directed links owned by this memory. */
    get links(): MemoryLinkJSON[];
    /** Text input used for embedding (content + tags). */
    embeddingInput(): string;
    /** Serialise to a plain JSON-compatible object. */
    toJSON(): MemoryJSON;
}

/** Plain JSON representation of a memory, as stored on disk. */
export interface MemoryJSON {
    id: string;
    content: string;
    summary: string;
    tags: string[];
    score: number;
    embedding: number[] | null;
    cachedAt: number | null;
    createdAt: number;
    changedAt: number;
    recalledAt: number | null;
    links: MemoryLinkJSON[];
}

/** A single persisted memory entry. */
export class Memory implements ReadonlyMemory {
    private _id: string;
    private _content: string;
    private _summary: string;
    private _tags: string[];
    private _score: number;
    private _embedding: number[] | null;
    private _cachedAt: number | null;
    private _createdAt: number;
    private _changedAt: number;
    private _recalledAt: number | null;
    private _links: MemoryLinkJSON[];

    /**
     * @param data  Raw memory data, typically deserialised from a stored JSON file.
     */
    constructor(data: {
        id: string;
        content: string;
        summary: string;
        tags: string[];
        score: number;
        embedding?: number[] | null;
        cachedAt?: number | null;
        createdAt: number;
        changedAt: number;
        recalledAt: number | null;
        links?: MemoryLinkJSON[];
    }) {
        this._id = data.id;
        this._content = data.content;
        this._summary = data.summary;
        this._tags = [...data.tags];
        this._score = data.score;
        this._embedding =
            data.embedding !== undefined ? (data.embedding ? [...data.embedding] : null) : null;
        this._cachedAt = data.cachedAt !== undefined ? (data.cachedAt ?? null) : null;
        this._createdAt = data.createdAt;
        this._changedAt = data.changedAt;
        this._recalledAt = data.recalledAt;
        this._links = data.links !== undefined ? data.links.map((l) => ({ ...l })) : [];
    }

    id(): string {
        return this._id;
    }

    get content(): string {
        return this._content;
    }

    set content(value: string) {
        this._content = value;
    }

    get summary(): string {
        return this._summary;
    }

    set summary(value: string) {
        this._summary = value;
    }

    get tags(): string[] {
        return this._tags;
    }

    set tags(value: string[]) {
        this._tags = value;
    }

    get score(): number {
        return this._score;
    }

    set score(value: number) {
        this._score = value;
    }

    get embedding(): number[] | null {
        return this._embedding ? [...this._embedding] : null;
    }

    set embedding(value: number[] | null) {
        this._embedding = value ? [...value] : null;
    }

    get cachedAt(): Date | null {
        return this._cachedAt ? new Date(this._cachedAt) : null;
    }

    set cachedAt(value: Date | null) {
        this._cachedAt = value?.getTime() ?? null;
    }

    createdAt(): Date {
        return new Date(this._createdAt);
    }

    get changedAt(): Date {
        return new Date(this._changedAt);
    }

    set changedAt(value: Date) {
        this._changedAt = value.getTime();
    }

    get recalledAt(): Date | null {
        return this._recalledAt ? new Date(this._recalledAt) : null;
    }

    set recalledAt(value: Date | null) {
        this._recalledAt = value?.getTime() ?? null;
    }

    get links(): MemoryLinkJSON[] {
        return this._links.map((l) => ({ ...l }));
    }

    set links(value: MemoryLinkJSON[]) {
        this._links = value.map((l) => ({ ...l }));
    }

    /**
     * Returns the text input used for embedding — the content combined with
     * space-separated tags.
     */
    embeddingInput(): string {
        const tags = this._tags.length > 0 ? ' ' + this._tags.join(' ') : '';
        return this._content + tags;
    }

    /**
     * Serialise this memory to a plain JSON-compatible object.
     * @returns A plain object suitable for `JSON.stringify`.
     */
    toJSON(): MemoryJSON {
        return {
            id: this._id,
            content: this._content,
            summary: this._summary,
            tags: [...this._tags],
            score: this._score,
            embedding: this._embedding ? [...this._embedding] : null,
            cachedAt: this._cachedAt,
            createdAt: this._createdAt,
            changedAt: this._changedAt,
            recalledAt: this._recalledAt,
            links: this._links.map((l) => ({ ...l }))
        };
    }
}
