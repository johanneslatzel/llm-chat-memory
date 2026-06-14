# update_memory

Modify an existing memory. Only supplied fields are changed.

| Parameter | Required | Description |
|---|---|---|
| `id` | yes | ID of the memory to update |
| `content` | no | New text |
| `summary` | no | New short summary (50–200 characters, up to 10% of content length) |
| `tags` | no | Array of new tags. Changes to content or tags invalidate the cached embedding. |
