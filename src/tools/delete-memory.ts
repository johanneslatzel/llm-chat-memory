import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { MemoryService } from '../lib/memory-service.js';

/** LLM-callable tool that deletes a memory by ID and cleans up its links. */
export class DeleteMemoryTool extends Tool {
    private readonly service: MemoryService;

    /** @param service  The MemoryService containing the memory. */
    constructor(service: MemoryService) {
        super(
            'delete_memory',
            'Delete a memory by its ID.',
            new ToolParameters(
                {
                    id: ToolParameterProperty.string('The ID of the memory to delete.')
                },
                ['id']
            )
        );
        this.service = service;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const id = args.id;

        if (typeof id !== 'string' || !id.trim()) {
            return {
                result: "Required parameter 'id' is missing or not a string",
                status: ResultStatus.Error
            };
        }

        try {
            await this.service.memories().delete(id.trim());
            await this.service.links().isolate(id.trim());
            return {
                result: `Memory '${id}' deleted successfully.`,
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
