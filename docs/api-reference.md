# API Reference

## Setting up MemoryService

`MemoryService` is the single entry point. It owns both a `MemoryPool` and a `LinkPool`.
Pass an optional `MemoryConfiguration` to customize storage and behaviour.

```typescript
import { MemoryConfiguration, MemoryService, HuggingFaceEmbeddingProvider } from '@johannes.latzel/llm-chat-memory';

const config = new MemoryConfiguration('./data', 2, 5);
const embedder = new HuggingFaceEmbeddingProvider();
const service = new MemoryService(config, embedder);
await service.init();
```

**Service methods:**

| Method | What it does |
|---|---|
| `init()` | Load memories and links from disk, then recalculate PageRank scores |
| `memories()` | → `MemoryPool` — direct access to the underlying CRUD pool (for tools) |
| `links()` | → `LinkPool` — direct access to the underlying link graph (for tools) |
| `recall(message, maxResults?)` | Semantic recall via embedding similarity — see [How it works](architecture.md#shared-semantic-recall-via-embedding-similarity) |
| `score()` | Re-run PageRank over the link graph and persist updated scores |
| `hookInto(chatService)` | Register lifecycle hooks (`beforeSendLoop` and `afterSend`) on a `ChatService` for passive recall. Uses caps from `MemoryConfiguration`. |

## MemoryPool methods (accessed via `service.memories()`)

| Method | What it does |
|---|---|
| `initialize()` | Load all `.json` files from `memories/` subdirectory |
| `create(label, input)` | Create a new memory. Requires `content` and `summary` (50–200 chars, ≤10% of content length). |
| `get(id)` | → `Promise<ReadonlyMemory \| undefined>` |
| `all()` | → `Promise<ReadonlyMemory[]>` |
| `has(id)` | → `boolean` — check if a memory ID exists |
| `update(id, input)` | Update an existing memory's fields. Changes to content or tags invalidate the cached embedding. |
 | `delete(id)` | Delete a memory and remove its file from disk (does **not** clean up links — call `service.links().isolate(id)` separately) |
| `ensureEmbeddings()` | Recompute stale or missing embeddings for all memories. Called automatically by `recall`, but useful to invoke manually after bulk imports/updates. |
| `recall(message)` | Semantic recall **without** auto-linking. Prefer `service.recall()` for auto-linking. |

## LinkPool methods (accessed via `service.links()`)

| Method | What it does |
|---|---|
| `load()` | Load the link graph from `links.json` |
| `save()` | Persist the link graph to `links.json` |
| `link(from, targets)` | Create explicit constant links from one memory to targets |
| `unlink(from, targets)` | Remove explicit links from one memory to targets |
 | `isolate(id)` | Remove all links involving the given memory ID |
| `outgoing(id)` | → `string[]` — target IDs linked from the given memory |
| `getEdges()` | → all edges with current weights for PageRank computation |

## Memory fields

A `Memory` exposes these fields directly. They're readable and writable.

`id`, `content`, `summary`, `tags`, `score`, `embedding` (cached vector), `createdAt`, `changedAt`, `recalledAt`

Triggers (word/regex/tag) are removed. Semantic similarity handles recall fully.
