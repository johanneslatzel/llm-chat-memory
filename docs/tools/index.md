# LLM tools

Seven tools give the LLM read/write access to memories. Register them on a
`ChatService`, constructing each tool from a `MemoryService`:

```typescript
import {
    MemoryService,
    AddMemoryTool,
    UpdateMemoryTool,
    DeleteMemoryTool,
    GetMemoryTool,
    RecallMemoriesTool,
    LinkMemoriesTool,
    UnlinkMemoriesTool
} from '@johannes.latzel/llm-chat-memory';
import { OpenAIChatService } from '@johannes.latzel/llm-chat';

const memoryService = new MemoryService(config, embedder);
await memoryService.init();
const chatService = new OpenAIChatService(/* ... */);

chatService.tools().add(new AddMemoryTool(memoryService));
chatService.tools().add(new UpdateMemoryTool(memoryService));
chatService.tools().add(new DeleteMemoryTool(memoryService));
chatService.tools().add(new GetMemoryTool(memoryService));
chatService.tools().add(new RecallMemoriesTool(memoryService));
chatService.tools().add(new LinkMemoriesTool(memoryService));
chatService.tools().add(new UnlinkMemoriesTool(memoryService));
```

Or bundle all seven with `MemoryToolPackage`:

```typescript
import { MemoryService, MemoryToolPackage } from '@johannes.latzel/llm-chat-memory';
import { OpenAIChatService } from '@johannes.latzel/llm-chat';

const memoryService = new MemoryService(config, embedder);
await memoryService.init();
const chatService = new OpenAIChatService(/* ... */);
chatService.tools().add(new MemoryToolPackage(memoryService));
```

| Tool | What it does |
|---|---|
| [add_memory](add-memory.md) | Store a new memory |
| [update_memory](update-memory.md) | Modify an existing memory |
| [delete_memory](delete-memory.md) | Remove a memory |
| [get_memory](get-memory.md) | View memory details |
| [recall_memories](recall-memories.md) | Manually trigger recall |
| [link_memories](link-memories.md) | Create explicit links between memories |
| [unlink_memories](unlink-memories.md) | Remove links between memories |

Parameters are strings, numbers, or booleans; `tags`, `ids`, and `targets` are arrays of strings.

The array parameters also accept hidden singular aliases: `id` for `ids` in
`get_memory`, `tag` for `tags` in `add_memory` and `update_memory`, and
`target` for `targets` in `link_memories` and `unlink_memories`. Aliases are
normalized before execution and never appear in the tool schemas.
