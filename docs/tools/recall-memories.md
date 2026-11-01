# recall_memories

Manually trigger recall against a message. Returns matched memories in priority
order (determined by the configured selection strategy), each as an
`id: summary` line, and updates their `recalledAt` timestamps.

| Parameter | Required | Description |
|---|---|---|
| `message` | yes | Text to match against memory content via embedding similarity. |
| `max_results` | no | Maximum results to return. Overrides the configured `maxInjectPerMessage` default; it is not clamped to it. |
