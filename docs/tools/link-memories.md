# link_memories

Create explicit references from one memory to one or more other memories.

| Parameter | Required | Description |
|---|---|---|
| `id` | yes | Source memory ID |
| `targets` | yes | Array of target memory IDs to link to |

Links to self are silently ignored. Non-existent memory IDs are skipped. Semantic similarity links are recomputed by the semantic linker (`service.linker.sync()`), not created by this tool.
