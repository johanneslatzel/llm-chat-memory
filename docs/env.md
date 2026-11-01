# Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_CHAT_MEMORY_DIR` | no | `./memories` | Directory containing memory JSON files |
| `LLM_CHAT_MEMORY_MAX_INJECT_PER_MESSAGE` | no | `2` | Maximum number of memories injected per individual message |
| `LLM_CHAT_MEMORY_MAX_INJECT_PER_SEND_LOOP` | no | `5` | Cumulative cap for the entire send-loop cycle |
| `LLM_CHAT_MEMORY_MAX_INJECTION_CONTENT_LENGTH` | no | `500` | Character limit for the serialized JSON returned by `get_memory`; not used for summary injection |
| `LLM_CHAT_MEMORY_SIMILARITY_GATE` | no | `0.4` | Minimum cosine similarity for a memory to be considered relevant |
| `LLM_CHAT_MEMORY_EMBEDDING_MODEL` | no | `Xenova/all-MiniLM-L6-v2` | Default model ID populated into `MemoryConfiguration.embeddingModel`; pass it to `HuggingFaceEmbeddingProvider({ model })` |
| `LLM_CHAT_MEMORY_RECENCY_HALF_LIFE` | no | `3600` | Half-life in seconds for the recency score decay curve |
| `LLM_CHAT_MEMORY_MIN_SUMMARY_LENGTH` | no | `50` | Minimum summary length in characters |
| `LLM_CHAT_MEMORY_MAX_SUMMARY_LENGTH` | no | `600` | Base maximum summary length; the effective maximum is `max(this value, 20% of content length)` |

All environment variables are optional. The three `MemoryConfiguration` constructor arguments take precedence over their corresponding environment variables; the remaining fields can be set directly after construction.
