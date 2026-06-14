import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { MemoryFormatter } from '../lib/memory/memory-formatter.js';
import { MemoryService } from '../lib/memory-service.js';
import { requireString } from '../lib/tool-utils.js';

/** LLM-callable tool that manually recalls memories matching a message. */
export class RecallMemoriesTool extends Tool {
    private readonly service: MemoryService;
    private readonly formatter: MemoryFormatter;

    /** @param service  The MemoryService to recall memories from. */
    constructor(service: MemoryService) {
        super(
            'recall_memories',
            'Manually recall memories that match a given message. Returns ranked memories and updates their recall timestamps.',
            new ToolParameters(
                {
                    message: ToolParameterProperty.string(
                        'The message text to match against memory content via embedding similarity.'
                    ),
                    max_results: ToolParameterProperty.number(
                        'Optional maximum number of results (capped by configuration).'
                    )
                },
                ['message']
            )
        );
        this.service = service;
        this.formatter = new MemoryFormatter(service.config);
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const msgCheck = requireString(args.message, 'message');
        if (!msgCheck.ok) return msgCheck.error;

        let maxResults: number | undefined;
        if (args.max_results !== undefined) {
            if (typeof args.max_results !== 'number') {
                return {
                    result: "'max_results' must be a number",
                    status: ResultStatus.Error
                };
            }
            maxResults = args.max_results;
        }

        try {
            const results = await this.service.recall(msgCheck.value, maxResults);

            if (results.length === 0) {
                return {
                    result: 'No matching memories found.',
                    status: ResultStatus.Success
                };
            }

            return {
                result: results.map((m) => this.formatter.format(m, true)).join('\n'),
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
