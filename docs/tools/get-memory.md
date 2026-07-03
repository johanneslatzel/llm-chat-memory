# get_memory

Retrieve the full details of one or more memories by ID. Returns all fields as JSON.

| Parameter | Required | Description |
|---|---|---|
| `ids` | yes | Array of memory IDs to retrieve |
| `summary` | no | If `true`, returns only `id` + `summary` for each memory (default `false`) |
| `truncate` | no | If `true`, truncates `content` to the configured max injection length (default `true`) |
