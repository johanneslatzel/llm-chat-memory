# add_memory

Store a new memory that can be recalled later by semantic similarity.

| Parameter | Required | Description |
|---|---|---|
| `id` | yes | Unique label for the memory. Sanitised to lowercase-hyphenated form. |
| `content` | yes | The text to remember |
| `summary` | yes | Short summary (50–200 characters, up to 10% of content length) |
| `tags` | no | Array of categorization tags, e.g. `["work","project-x"]` |

Returns the new memory's ID.
