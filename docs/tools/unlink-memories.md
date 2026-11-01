# unlink_memories

Remove links from one memory to one or more other memories. Removes any existing
link (constant or semantic) in that direction.

| Parameter | Required | Description |
|---|---|---|
| `id` | yes | Source memory ID |
| `targets` | yes | Array of target memory IDs to unlink. The hidden alias `target` is accepted for `targets`. |
