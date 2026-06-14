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

/** LLM-callable tool that removes explicit links between memories. */
export class UnlinkMemoriesTool extends Tool {
    private readonly pool: MemoryPoolInterface;
    private readonly linkPool: LinkPoolInterface;

    /** @param service  The MemoryService containing the memories. */
    constructor(service: MemoryService) {
        super(
            'unlink_memories',
            'Remove explicit references from one memory to one or more other memories. Targets are given as a JSON array of memory IDs.',
            new ToolParameters(
                {
                    id: ToolParameterProperty.string('The source memory ID.'),
                    targets: ToolParameterProperty.array(
                        'Array of target memory IDs to unlink.',
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

        if (targets.length === 0) {
            return {
                result: 'No targets provided.',
                status: ResultStatus.Error
            };
        }

        await this.linkPool.unlink(idCheck.value, targets);

        return {
            result: `Unlinked from: ${targets.join(', ')}.`,
            status: ResultStatus.Success
        };
    }
}
