# LLM tools

Seven tools give the LLM read/write access to memories. Register them with the service:

```typescript
service.tools().add(new AddMemoryTool(service));
service.tools().add(new UpdateMemoryTool(service));
service.tools().add(new DeleteMemoryTool(service));
service.tools().add(new GetMemoryTool(service));
service.tools().add(new RecallMemoriesTool(service));
service.tools().add(new LinkMemoriesTool(service));
service.tools().add(new UnlinkMemoriesTool(service));
```

Or bundle all seven:

```typescript
service.tools().add(new MemoryToolPackage(service));
```

| Tool | What it does |
|---|---|
| [add_memory](add-memory.md) | Store a new memory |
| [update_memory](update-memory.md) | Modify an existing memory |
| [delete_memory](delete-memory.md) | Remove a memory |
| [get_memory](get-memory.md) | View memory details |
| [recall_memories](recall-memories.md) | Manually trigger recall |
| [link_memories](link-memories.md) | Create explicit links between memories |
| [unlink_memories](unlink-memories.md) | Remove explicit links between memories |

All parameters are strings or numbers. `tags` is an array of strings.
