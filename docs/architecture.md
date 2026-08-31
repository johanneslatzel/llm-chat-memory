# Architecture

## Why persistent memory?

LLM conversations have a finite context window. Old messages, including facts the agent learned earlier, get pushed out when the window fills up, gets compacted, or a sliding window moves. A fact mentioned 50 messages ago is gone.

This package solves that by giving agents a **persistent memory store**: a place to write facts, notes, and decisions that survive across turns, conversations, and restarts.

## Shared: semantic recall via embedding similarity

Memories are matched to conversation context using **embedding-based cosine similarity**, not keyword triggers. Every memory's content is encoded into a vector embedding (cached alongside the JSON file, invalidated when content changes). On recall, the incoming message is encoded once and compared against all cached embeddings. The most semantically similar memories, above a configurable similarity floor, qualify as candidates.

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
| `summary` | Short summary (50–600 chars, up to 20% of content length). Shown during injection; full content fetched on demand. |
| `tags` | Categories used to augment the embedding input |
| `score` | PageRank importance: higher score = more linked-to |
| `createdAt` / `changedAt` / `recalledAt` | Track when it was made, edited, last surfaced |
| `embedding` | Cached vector + `cachedAt` timestamp for invalidation |
| `links` | This memory's **outgoing** directed links (explicit + semantic), persisted inside its own file |

Triggers (word/regex/tag) are removed. Semantic similarity handles recall fully.

## The service

`MemoryService` is the central entry point. It owns both a `MemoryPool` (pure CRUD + recall) and a `LinkPool` (link graph). Semantic similarity links are recomputed by running the semantic linker (`service.linker.sync()`).

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

Each memory is an individual JSON file in the `memories/` subdirectory, named
after its slug id. Content, tags, summary, its cached embedding vector, and
its outgoing links are stored in the file:

```text
./memories/
  project-context.json
  installation-notes.json
  user-preferences.json
```

The directed link graph is stored **inside each memory file** via the `links`
field: every memory carries its own outgoing links (explicit constant links
plus semantic-similarity links). Links are flushed eagerly whenever the graph
changes (link/unlink/isolate/sync), so there is no separate `links.json`. On
startup, `service.init()` loads the individual memory files, rebuilds the
in-memory link graph from each file's `links` field, then recalculates
PageRank scores.

This makes it easy to inspect, backup, or edit memories directly. No database needed.


### Directory store integration (json-file-store)

Every `MemoryPool` is always backed by an `ObjectStore<MemoryJSON>` from the
`@johannes.latzel/json-file-store` package. All save/load/delete operations
route through `store.set`/`store.get`/`store.delete`; `initialize()` only
lists the memories directory and loads each file through the store.

By default the `MemoryPool` uses an in-memory `MemoryStore`. For durable file
storage, `MemoryService` constructs a `JsonFileStore` over
`config.memoryDir` when no store is supplied, so a default service persists
memories to disk. A caller-supplied store always takes precedence.

Memory ids are file-safe lowercase slugs, so they double as the JSON filenames
used by `JsonFileStore` without any id mapping or migration. Corrupt entries
are skipped individually during `initialize()`.
