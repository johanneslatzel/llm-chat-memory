# update_memory

Modify an existing memory. Only supplied fields are changed.

| Parameter | Required | Description |
|---|---|---|
| `id` | yes | ID of the memory to update |
| `content` | no | New text |
| `summary` | no | New short summary (at least 50 characters; at most `max(600, 20% of content length)`) |
| `tags` | no | Array of new tags. Changes to content or tags invalidate the cached embedding. The hidden alias `tag` is accepted for `tags`. |
