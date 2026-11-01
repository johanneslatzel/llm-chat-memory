# add_memory

Store a new memory that can be recalled later by semantic similarity.

| Parameter | Required | Description |
|---|---|---|
| `id` | yes | Unique label for the memory. Sanitised to lowercase-hyphenated form. |
| `content` | yes | The text to remember |
| `summary` | yes | Short summary (at least 50 characters; at most `max(600, 20% of content length)`) |
| `tags` | no | Array of categorization tags, e.g. `["work","project-x"]`. The hidden alias `tag` is accepted for `tags`. |

Returns a confirmation message with the new memory's id.
