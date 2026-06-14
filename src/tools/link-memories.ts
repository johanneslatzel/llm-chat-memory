import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { MemoryService } from '../lib/memory-service.js';
import type { MemoryPoolInterface } from '../lib/memory/memory-pool.js';
import type { LinkPoolInterface } from '../lib/link/link-pool.js';
import { parseJsonStringArray, requireString } from '../lib/tool-utils.js';

/** LLM-callable tool that creates explicit links between memories. */
export class LinkMemoriesTool extends Tool {
    private readonly pool: MemoryPoolInterface;
    private readonly linkPool: LinkPoolInterface;

    /** @param service  The MemoryService containing the memories. */
    constructor(service: MemoryService) {
        super(
            'link_memories',
            'Create explicit references from one memory to one or more other memories. Targets are given as a JSON array of memory IDs.',
            new ToolParameters(
                {
                    id: ToolParameterProperty.string('The source memory ID.'),
                    targets: ToolParameterProperty.array(
                        'Array of target memory IDs to link to.',
                        ToolParameterProperty.string('target memory ID')
                    )
                },
                ['id', 'targets']
            )
        );
        this.pool = service.memories();
        this.linkPool = service.links();
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const idCheck = requireString(args.id, 'id');
        if (!idCheck.ok) return idCheck.error;

        const parsed = parseJsonStringArray(args.targets, 'targets');
        if (!parsed.ok) return parsed.error;
        const targets = parsed.value;

        if (!this.pool.has(idCheck.value)) {
            return { result: `Memory '${idCheck.value}' not found`, status: ResultStatus.Error };
        }

        const invalid = targets.filter((t: string) => t !== idCheck.value && !this.pool.has(t));
        const valid = targets.filter((t: string) => t !== idCheck.value && this.pool.has(t));
        const linked = await this.linkPool.link(idCheck.value, valid);

        const parts: string[] = [];
        if (linked.length > 0) parts.push(`Linked to: ${linked.join(', ')}`);
        if (invalid.length > 0) parts.push(`Not found (skipped): ${invalid.join(', ')}`);
        if (parts.length === 0) {
            return {
                result: 'No valid targets provided (cannot link to self).',
                status: ResultStatus.Error
            };
        }

        return { result: parts.join('. ') + '.', status: ResultStatus.Success };
    }
}
