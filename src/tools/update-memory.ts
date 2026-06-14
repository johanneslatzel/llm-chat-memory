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
import { requireString, parseJsonStringArray } from '../lib/tool-utils.js';

/** LLM-callable tool that updates an existing memory. */
export class UpdateMemoryTool extends Tool {
    private readonly pool: MemoryPoolInterface;
    private readonly linkPool: LinkPoolInterface;

    /** @param service  The MemoryService containing the memory to update. */
    constructor(service: MemoryService) {
        super(
            'update_memory',
            "Update an existing memory's content, summary, or tags.",
            new ToolParameters(
                {
                    id: ToolParameterProperty.string('The ID of the memory to update.'),
                    content: ToolParameterProperty.string('The new memory content.'),
                    summary: ToolParameterProperty.string(
                        'Short summary of the memory (50-600 characters, up to 20% of content length).'
                    ),
                    tags: ToolParameterProperty.array(
                        'Optional array of tags.',
                        ToolParameterProperty.string('tag')
                    )
                },
                ['id']
            )
        );
        this.pool = service.memories();
        this.linkPool = service.links();
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const idCheck = requireString(args.id, 'id');
        if (!idCheck.ok) return idCheck.error;

        const input: { content?: string; summary?: string; tags?: string[] } = {};

        if (args.content !== undefined) {
            if (typeof args.content !== 'string' || !(args.content as string).trim()) {
                return {
                    result: "'content' must be a non-empty string",
                    status: ResultStatus.Error
                };
            }
            input.content = (args.content as string).trim();
        }

        if (args.summary !== undefined) {
            if (typeof args.summary !== 'string' || !(args.summary as string).trim()) {
                return {
                    result: "'summary' must be a non-empty string",
                    status: ResultStatus.Error
                };
            }
            input.summary = (args.summary as string).trim();
        }

        if (args.tags !== undefined) {
            const parsed = parseJsonStringArray(args.tags, 'tags');
            if (!parsed.ok) return parsed.error;
            input.tags = parsed.value;
        }

        try {
            await this.pool.update(idCheck.value, input);
            return {
                result: `Memory '${idCheck.value}' updated successfully.`,
                status: ResultStatus.Success
            };
        } catch (e) {
            return {
                result: (e as Error).message,
                status: ResultStatus.Error
            };
        }
    }
}
