# get_memory

Retrieve one or more memories by ID.

| Parameter | Required | Description |
|---|---|---|
| `ids` | yes | Array of memory IDs to retrieve. The hidden alias `id` is accepted for a single ID. |
| `summary` | no | If `true`, returns one `id: summary` line per memory (default `false`). |
| `truncate` | no | If `true`, keeps the serialized memory JSON at or below `maxInjectionContentLength` characters and appends `[truncated]` when it cuts (default `true`). |

By default each memory is returned as pretty-printed JSON of the memory object,
truncated to `maxInjectionContentLength` characters (500 by default) unless
`truncate: false`. With `summary: true`, each result is a single
`id: summary` line. Missing IDs are reported per ID. Truncation applies to the
serialized JSON output, not only the `content` field.
