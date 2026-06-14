import { ToolPackage } from '@johannes.latzel/llm-chat';

import { MemoryService } from '../lib/memory-service.js';
import { AddMemoryTool } from './add-memory.js';
import { UpdateMemoryTool } from './update-memory.js';
import { DeleteMemoryTool } from './delete-memory.js';
import { GetMemoryTool } from './get-memory.js';
import { RecallMemoriesTool } from './recall-memories.js';
import { LinkMemoriesTool } from './link-memories.js';
import { UnlinkMemoriesTool } from './unlink-memories.js';

const MEMORY_GUIDE = `Memory system stores knowledge as memories with content, tags, summary, and auto-calculated PageRank score (from link graph). All memories require a summary (50-600 chars, at most 20% of content length). Link related memories via link_memories. Semantic similarity links are computed automatically.`;

/**
 * A {@link ToolPackage} that bundles all memory-management tools.
 *
 * Use with `ToolSuite.add(new MemoryToolPackage(service))` to register
 * all tools at once.
 *
 * The package also provides a built-in tutorial that explains how to
 * use the memory system via the {@link tutorial} method.
 */
export class MemoryToolPackage extends ToolPackage {
    /**
     * @param service  The MemoryService that all registered tools will operate on.
     */
    constructor(service: MemoryService) {
        super();
        this.add(new AddMemoryTool(service));
        this.add(new UpdateMemoryTool(service));
        this.add(new DeleteMemoryTool(service));
        this.add(new GetMemoryTool(service));
        this.add(new RecallMemoriesTool(service));
        this.add(new LinkMemoriesTool(service));
        this.add(new UnlinkMemoriesTool(service));
    }

    /** Returns the memory-guide content as a tutorial string for LLM consumption. */
    tutorial(): string | null {
        return MEMORY_GUIDE;
    }
}
