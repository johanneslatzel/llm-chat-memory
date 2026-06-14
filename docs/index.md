# Overview

LLM conversations have a finite context window. Facts, preferences, and decisions made early in a conversation get pushed out when the window fills up, gets compacted, or a sliding window moves.

This package gives LLM agents persistent memory. It stores text chunks (facts, preferences, decisions, notes) and automatically injects the relevant ones back into conversations using semantic similarity.

**What you can do:**
- LLMs can save and recall memories via chat tools (`add_memory`, `recall_memories`, etc.)
- Memories auto-inject as synthetic tool calls when semantically related to conversation context
- Each memory has content, tags, summary, importance score, and a cached embedding vector
- Everything persists as JSON files on disk

---

- [Quick start](quickstart.md) — get up and running in 30 seconds
- [How it works](architecture.md) — semantic recall, PageRank, auto-injection explained
- [API reference](api-reference.md) — configuration, pool, memory fields
- [Tool reference](tools/index.md) — tool parameters in detail
- [Hook-based tool injection](hooks.md) — synthetic tool calls from hooks
- [Environment variables](env.md) — configuration reference
