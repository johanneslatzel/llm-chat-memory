import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { MemoryFormatter } from '../lib/memory/memory-formatter.js';
import { MemoryService } from '../lib/memory-service.js';
import type { MemoryPoolInterface } from '../lib/memory/memory-pool.js';
import { parseJsonStringArray } from '../lib/tool-utils.js';

/** LLM-callable tool that retrieves one or more memories by ID. */
export class GetMemoryTool extends Tool {
    private readonly pool: MemoryPoolInterface;
    private readonly formatter: MemoryFormatter;

    /** @param service  The MemoryService to retrieve memories from. */
    constructor(service: MemoryService) {
        super(
            'get_memory',
            "Retrieve one or more memories by ID. Returns the full memory details by default, or just the summaries when 'summary' is true.",
            new ToolParameters(
                {
                    ids: ToolParameterProperty.array(
                        'Array of memory IDs to retrieve.',
                        ToolParameterProperty.string('memory ID')
                    ),
                    summary: ToolParameterProperty.boolean(
                        'If true, returns only the summary field for each memory instead of the full content. Default false.'
                    ),
                    truncate: ToolParameterProperty.boolean(
                        'If true, limit content to the configured maximum length. Truncated content gets a "[truncated]" suffix. Default true.'
                    )
                },
                ['ids']
            )
        );
        this.pool = service.memories();
        this.formatter = new MemoryFormatter(service.config);
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const idsParsed = parseJsonStringArray(args.ids, 'ids');
        if (!idsParsed.ok) return idsParsed.error;

        const onlySummary = args.summary === true;
        const truncate = args.truncate !== false;

        const results: string[] = [];
        for (const id of idsParsed.value) {
            const memory = await this.pool.get(id.trim());
            if (!memory) {
                results.push(`Memory '${id}' not found.`);
            } else {
                results.push(this.formatter.format(memory, onlySummary, truncate));
            }
        }

        return {
            result: results.join('\n\n'),
            status: ResultStatus.Success
        };
    }
}
