/** Discriminator for the different kinds of {@link MemoryLink}. */
export enum LinkType {
    Constant = 'constant',
    Semantic = 'semantic'
}

/**
 * Serialised form of a {@link MemoryLink} as stored on its source memory.
 *
 * `from` is implicit: the entry lives in the owning memory's JSON file, so
 * only the target and type-specific fields are stored.
 */
export type MemoryLinkJSON =
    | {
          type: LinkType.Constant;
          to: string;
      }
    | {
          type: LinkType.Semantic;
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
    /** Serialises this link to the owner-relative JSON form stored on the source memory. */
    abstract toMemoryLinkJSON(): MemoryLinkJSON;

    /** Deserialises a link from stored JSON data, owned by the given memory. */
    static fromMemoryLinkJSON(owner: string, data: MemoryLinkJSON): MemoryLink {
        switch (data.type) {
            case LinkType.Constant:
                return new ConstantMemoryLink(owner, data.to);
            case LinkType.Semantic:
                return new SemanticMemoryLink(owner, data.to, data.weight, data.cachedAt);
        }
    }
}

/** A link with a fixed weight that never decays. */
export class ConstantMemoryLink extends MemoryLink {
    weight(): number {
        return 10;
    }

    toMemoryLinkJSON(): MemoryLinkJSON {
        return { type: LinkType.Constant, to: this.to };
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

    toMemoryLinkJSON(): MemoryLinkJSON {
        return {
            type: LinkType.Semantic,
            to: this.to,
            weight: this._weight,
            cachedAt: this.cachedAt
        };
    }
}
