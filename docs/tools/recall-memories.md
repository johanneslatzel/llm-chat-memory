# recall_memories

Manually trigger recall against a message. Returns results in priority order (determined by the configured selection strategy) and updates their `recalledAt` timestamps.

| Parameter | Required | Description |
|---|---|---|
| `message` | yes | Text to match against memory content via embedding similarity |
| `max_results` | no | Maximum results to return (capped by `maxInjectPerMessage` config) |
