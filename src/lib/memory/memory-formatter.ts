import type { MemoryConfiguration } from '../config.js';
import type { ReadonlyMemory } from './memory.js';

const TRUNCATED_LABEL = ' [truncated]';

export class MemoryFormatter {
    constructor(private readonly config: MemoryConfiguration) {}

    format(memory: ReadonlyMemory, summarize?: boolean, truncate?: boolean): string {
        if (summarize) {
            return `${memory.id()}: ${memory.summary()}`;
        }

        let content = JSON.stringify(memory.toJSON(), null, 2);
        const limit = this.config.maxInjectionContentLength;
        if (truncate && content.length > limit) {
            content = content.slice(0, limit - TRUNCATED_LABEL.length) + TRUNCATED_LABEL;
        }
        return content;
    }
}
