# link_memories

Create explicit constant links from one memory to one or more other memories.

| Parameter | Required | Description |
|---|---|---|
| `id` | yes | Source memory ID |
| `targets` | yes | Array of target memory IDs to link to. The hidden alias `target` is accepted for `targets`. |

Self targets are filtered out. Non-existent memory IDs are skipped. An empty
target list or a self-only list returns an error. Linking an already-linked
target is a no-op and is reported as already linked. Semantic similarity links
are recomputed by the semantic linker (`service.linker.sync()`), not created
by this tool.
