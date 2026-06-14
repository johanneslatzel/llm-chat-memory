/** Discriminator for the different kinds of {@link MemoryLink}. */
export enum LinkType {
    Constant = 'constant',
    Semantic = 'semantic'
}

/**
 * Serialised form of a {@link MemoryLink}, used for JSON persistence.
 */
export type LinkJSON =
    | {
          type: LinkType.Constant;
          from: string;
          to: string;
      }
    | {
          type: LinkType.Semantic;
          from: string;
          to: string;
          weight: number;
          cachedAt: number;
      };

/**
 * A directional reference from one memory to another.
 *
 * Subclasses determine how the link weight is computed (constant vs. semantic).
 */
export abstract class MemoryLink {
    /** Source memory ID. */
    readonly from: string;
    /** Target memory ID. */
    readonly to: string;

    constructor(from: string, to: string) {
        this.from = from;
        this.to = to;
    }

    /** Returns the current weight of this link for PageRank scoring. */
    abstract weight(): number;
    /** Serialises this link to a plain JSON-compatible object. */
    abstract toJSON(): LinkJSON;

    /** Deserialises a link from stored JSON data. */
    static fromJSON(data: LinkJSON): MemoryLink {
        switch (data.type) {
            case LinkType.Constant:
                return new ConstantMemoryLink(data.from, data.to);
            case LinkType.Semantic:
                return new SemanticMemoryLink(data.from, data.to, data.weight, data.cachedAt);
        }
    }
}

/** A link with a fixed weight that never decays. */
export class ConstantMemoryLink extends MemoryLink {
    weight(): number {
        return 10;
    }

    toJSON(): LinkJSON {
        return { type: LinkType.Constant, from: this.from, to: this.to };
    }
}

/** A link derived from embedding similarity (non-decaying, persisted weight). */
export class SemanticMemoryLink extends MemoryLink {
    private _weight: number;
    readonly cachedAt: number;

    constructor(from: string, to: string, weight: number, cachedAt?: number) {
        super(from, to);
        this._weight = weight;
        this.cachedAt = cachedAt ?? Date.now();
    }

    weight(): number {
        return this._weight;
    }

    toJSON(): LinkJSON {
        return {
            type: LinkType.Semantic,
            from: this.from,
            to: this.to,
            weight: this._weight,
            cachedAt: this.cachedAt
        };
    }
}
