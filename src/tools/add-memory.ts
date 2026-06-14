import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { MemoryService } from '../lib/memory-service.js';
import type { MemoryPoolInterface } from '../lib/memory/memory-pool.js';
import { parseJsonStringArray, requireString } from '../lib/tool-utils.js';

/** LLM-callable tool that creates a new memory. */
export class AddMemoryTool extends Tool {
    private readonly pool: MemoryPoolInterface;

    /** @param service  The MemoryService to create memories in. */
    constructor(service: MemoryService) {
        super(
            'add_memory',
            "Store a new memory with a unique label, content, a short summary, and optional tags. The summary helps the LLM quickly understand the memory's core idea without reading the full content.",
            new ToolParameters(
                {
                    id: ToolParameterProperty.string(
                        'Unique label for the memory. Will be sanitised (lowercased, spaces become dashes, special chars removed). Must contain at least one alphanumeric character.'
                    ),
                    content: ToolParameterProperty.string('The memory content to store.'),
                    summary: ToolParameterProperty.string(
                        'Short summary of the memory (50-600 characters, up to 20% of content length). Helps the LLM understand the core idea at a glance.'
                    ),
                    tags: ToolParameterProperty.array(
                        'Optional array of tags for categorization.',
                        ToolParameterProperty.string('tag')
                    )
                },
                ['id', 'content', 'summary']
            )
        );
        this.pool = service.memories();
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const idCheck = requireString(args.id, 'id');
        if (!idCheck.ok) return idCheck.error;

        const contentCheck = requireString(args.content, 'content');
        if (!contentCheck.ok) return contentCheck.error;

        const summaryCheck = requireString(args.summary, 'summary');
        if (!summaryCheck.ok) return summaryCheck.error;

        let tags: string[] = [];
        if (args.tags !== undefined) {
            const parsed = parseJsonStringArray(args.tags, 'tags');
            if (!parsed.ok) return parsed.error;
            tags = parsed.value;
        }

        try {
            const memory = await this.pool.create(idCheck.value, {
                content: contentCheck.value,
                summary: summaryCheck.value,
                tags
            });
            return {
                result: `Memory '${memory.id()}' added successfully.`,
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
