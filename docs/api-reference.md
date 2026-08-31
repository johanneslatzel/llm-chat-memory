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
| `init()` | Load memories from disk, rebuild the link graph from each file's `links` field, then recalculate PageRank scores |
| `memories()` | → `MemoryPoolInterface`: direct access to the underlying CRUD pool (for tools) |
| `links()` | → `LinkPoolInterface`: direct access to the underlying link graph (for tools) |
| `recall(message, maxInject?)` | Semantic recall via embedding similarity: see [How it works](architecture.md#shared-semantic-recall-via-embedding-similarity) |
| `score()` | Re-run PageRank over the link graph and persist updated scores |
| `hookInto(chatService)` | Register lifecycle hooks (`beforeSendLoop` and `afterSend`) on a `ChatService` for passive recall. Uses caps from `MemoryConfiguration`. |

## MemoryPoolInterface methods (accessed via `service.memories()`)

| Method | What it does |
|---|---|
| `create(label, input)` | Create a new memory. Requires `content` and `summary` (50–600 chars, ≤20% of content length). |
| `get(id)` | → `Promise<ReadonlyMemory \| undefined>` |
| `all()` | → `Promise<ReadonlyMemory[]>` |
| `has(id)` | → `boolean`: check if a memory ID exists |
| `delete(id)` | Delete a memory and remove its file from disk (does **not** clean up links: call `service.links().isolate(id)` separately) |
| `ensureEmbeddings()` | Recompute stale or missing embeddings for all memories. Called automatically by `recall`, but useful to invoke manually after bulk imports/updates. |

## LinkPoolInterface methods (accessed via `service.links()`)

| Method | What it does |
|---|---|
| `link(from, targets)` | Create explicit constant links from one memory to targets |
| `unlink(from, targets)` | Remove explicit links from one memory to targets |
| `isolate(id)` | Remove all links involving the given memory ID |

## Memory fields

A `Memory` exposes its fields via native get/set accessors (`mem.content`, `mem.score`, etc.). Fields with a setter are writable; `id` and `createdAt` are read-only and remain plain methods.

| Field | Accessor | Writable |
|---|---|---|
| `id` | `mem.id()` | No |
| `content` | `mem.content` (get/set) | Yes |
| `summary` | `mem.summary` (get/set) | Yes |
| `tags` | `mem.tags` (get/set) | Yes |
| `score` | `mem.score` (get/set) | Yes |
| `embedding` (cached vector) | `mem.embedding` (get/set) | Yes |
| `links` | `mem.links` (get/set) | Yes |
| `createdAt` | `mem.createdAt()` | No |
| `changedAt` | `mem.changedAt` (get/set) | Yes |
| `recalledAt` | `mem.recalledAt` (get/set) | Yes |
| `cachedAt` | `mem.cachedAt` (get/set) | Yes |


Triggers (word/regex/tag) are removed. Semantic similarity handles recall fully.
