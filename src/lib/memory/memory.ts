/** Read-only view of a memory. All accessors are methods (not property getters). */
export interface ReadonlyMemory {
    /** Unique identifier. */
    id(): string;
    /** The stored memory content. */
    content(): string;
    /** Short summary of the memory. */
    summary(): string;
    /** Tags used for categorisation and ranking. */
    tags(): string[];
    /** Importance score (higher = more important). */
    score(): number;
    /** Cached embedding vector, or `null` if not yet computed. */
    embedding(): number[] | null;
    /** Timestamp when the embedding was last cached, or `null` if never cached. */
    cachedAt(): Date | null;
    /** Timestamp when the memory was first created. */
    createdAt(): Date;
    /** Timestamp of the last modification. */
    changedAt(): Date;
    /** Timestamp of the last recall, or `null` if never recalled. */
    recalledAt(): Date | null;
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
    }

    id(): string {
        return this._id;
    }

    content(): string;
    content(value: string): void;
    content(value?: string): string | void {
        if (arguments.length === 0) return this._content;
        this._content = value!;
    }

    summary(): string;
    summary(value: string): void;
    summary(value?: string): string | void {
        if (arguments.length === 0) return this._summary;
        this._summary = value!;
    }

    tags(): string[];
    tags(value: string[]): void;
    tags(value?: string[]): string[] | void {
        if (arguments.length === 0) return this._tags;
        this._tags = value!;
    }

    score(): number;
    score(value: number): void;
    score(value?: number): number | void {
        if (arguments.length === 0) return this._score;
        this._score = value!;
    }

    embedding(): number[] | null;
    embedding(value: number[] | null): void;
    embedding(value?: number[] | null): number[] | null | void {
        if (arguments.length === 0) return this._embedding ? [...this._embedding] : null;
        this._embedding = value ? [...value] : null;
    }

    cachedAt(): Date | null;
    cachedAt(value: Date | null): void;
    cachedAt(value?: Date | null): Date | null | void {
        if (arguments.length === 0) return this._cachedAt ? new Date(this._cachedAt) : null;
        this._cachedAt = value?.getTime() ?? null;
    }

    createdAt(): Date {
        return new Date(this._createdAt);
    }

    changedAt(): Date;
    changedAt(value: Date): void;
    changedAt(value?: Date): Date | void {
        if (arguments.length === 0) return new Date(this._changedAt);
        this._changedAt = value!.getTime();
    }

    recalledAt(): Date | null;
    recalledAt(value: Date | null): void;
    recalledAt(value?: Date | null): Date | null | void {
        if (arguments.length === 0) return this._recalledAt ? new Date(this._recalledAt) : null;
        this._recalledAt = value?.getTime() ?? null;
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
            recalledAt: this._recalledAt
        };
    }
}
