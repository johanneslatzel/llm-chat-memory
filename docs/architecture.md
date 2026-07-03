# How it works

## Why persistent memory?

LLM conversations have a finite context window. Old messages — including facts the agent learned earlier — get pushed out when the window fills up, gets compacted, or a sliding window moves. If you told the agent your coffee preference 50 messages ago, it's gone.

This package solves that by giving agents a **persistent memory store** — a place to write facts, notes, and decisions that survive across turns, conversations, and restarts.

## Shared: semantic recall via embedding similarity

Memories are matched to conversation context using **embedding-based cosine similarity**, not keyword triggers. Every memory's content is encoded into a vector embedding (cached alongside the JSON file, invalidated when content changes). On recall, the incoming message is encoded once and compared against all cached embeddings. The most semantically similar memories — above a configurable similarity floor — qualify as candidates.

This means paraphrase, synonymy, and indirect references all work naturally: "my dog is sick" matches a memory about "the veterinarian visit" even though they share no keywords.

Tags are concatenated to the content during embedding, acting as a semantic anchor for internal jargon.

Both recall modes use the same algorithm:

```text
1. Encode   →  embed the input message into a query vector
2. Score    →  cosine similarity between query vector and all cached memory embeddings
3. Filter   →  absolute floor (default ~0.4) + elbow-based relative cutoff
4. Select   →  MMR or weighted random sampling (configurable) 
               using composite score = α·sim + β·pageRank + γ·recency
5. Cap      →  per-message and per-send-loop limits
6. Resume   →  skip memories already injected in this session
7. Inject   →  batch tool-call with ids + summaries (see hooks.md)
```

## Memory anatomy

Every stored memory is:

| Field | Why it exists |
|---|---|---|
| `id` | Uniquely identifies the memory (sanitised from the label, also the filename) |
| `content` | The text to remember |
| `summary` | Short summary (50–200 chars, ≤10% of content length). Shown during injection; full content fetched on demand. |
| `tags` | Categories used to augment the embedding input |
| `score` | PageRank importance — higher score = more linked-to |
| `createdAt` / `changedAt` / `recalledAt` | Track when it was made, edited, last surfaced |
| `embedding` | Cached vector + `cachedAt` timestamp for invalidation |

Triggers (word/regex/tag) are removed. Semantic similarity handles recall fully.

## The service

`MemoryService` is the central entry point. It owns both a `MemoryPool` (pure CRUD + recall) and a `LinkPool` (link graph), and provides the convenient `recall()` that auto-links consecutive results.

```typescript
const service = new MemoryService(config, embedder);
await service.init();  // pool.initialize() + linkPool.load() + score()
service.recall(message);  // pool.recall() + select via strategy + mark recalled
```

### Passive recall (hookInto)

Call `service.hookInto(chatService)` to wire passive recall into the
ChatService's lifecycle hooks:

```typescript
service.hookInto(chatService);
```

`MemoryService.hookInto` creates a per-call `MemoryHook` session and
registers it into the ChatService's `beforeSendLoop` and `afterSend`
lifecycle hooks (see the llm-chat package docs for hook semantics). It
returns the `MemoryHook` so callers can call `.dispose()` to
unregister the hooks later.

Memory injection is tracked **per `MemoryHook` instance** via a local `Set<memoryId>`, so a memory is only injected once per session regardless of send-loop boundaries. Each call to `hookInto()` creates a fresh hook with its own tracking set, so different `ChatService` instances (different sessions) have independent tracking.

The two callbacks process different message roles (`onBeforeSendLoop`
handles User messages; `onAfterSend` handles model-origin Reasoning
messages). Both use the same semantic recall algorithm. Injection uses
a batch tool-call pattern: a single synthetic `get_memory` call with
`ids` and `summary: true` returns all new memories at once, keeping
scaffolding overhead to exactly 2 messages.

Injection is capped by two limits:
- `maxInjectPerMessage` (max memories per individual message)
- `maxInjectPerSendLoop` (cumulative cap for the entire send cycle)

`MemoryPool` and `LinkPool` each carry their own `Mutex` to serialise internal
state access, so they remain safe even when accessed from independent callers
(e.g. tools and hook callbacks).

See [hooks.md](hooks.md) for a detailed walkthrough of the injection
mechanism.

### Active recall (recall_memories tool)

The LLM calls `recall_memories` with a message text. It runs the same algorithm but returns results as a tool response instead of injecting them into conversation.

This is **non-invasive**: the agent controls when and what to look up. Useful for explicit lookups: "check what I know about topic X".

## File storage

Each memory is an individual JSON file in the `memories/` subdirectory, containing content, tags, summary, and its cached embedding vector:

```text
./memories/
  memories/
    a1b2c3d4-... .json
    e5f6g7h8-... .json
  links.json
```

The full directed link graph (explicit links + semantic similarity links) is persisted in `links.json` at the top level, flushed on demand via `service.save()`. On startup, `service.init()` loads both the individual memory files and the link graph, then recalculates PageRank scores.

This makes it easy to inspect, backup, or edit memories directly. No database needed.
