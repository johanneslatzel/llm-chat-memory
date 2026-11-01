# API Reference

## Setup

`MemoryService` is the single entry point. It owns a `MemoryPool`, a
`LinkPool`, a `TextEmbeddingProvider`, and the selection and linking
strategies.

```typescript
import {
    MemoryConfiguration,
    MemoryService,
    HuggingFaceEmbeddingProvider
} from '@johannes.latzel/llm-chat-memory';

const config = new MemoryConfiguration();
const embedder = new HuggingFaceEmbeddingProvider({ model: config.embeddingModel });
const service = new MemoryService(config, embedder);
await service.init();

const memories = await service.recall('what do I know about the project?');
```

`MemoryConfiguration.embeddingModel` is a default value loaded from
`LLM_CHAT_MEMORY_EMBEDDING_MODEL`. It is not passed to a provider
automatically; pass it to `HuggingFaceEmbeddingProvider({ model })` or use a
custom `TextEmbeddingProvider`.

## `MemoryConfiguration`

### `new MemoryConfiguration(memoryDir?, maxInjectPerMessage?, maxInjectPerSendLoop?)`

The three arguments override the corresponding fields. Every other field is
initialized from its environment variable or default.

| Param | Type | Default | Description |
|---|---|---|---|
| `memoryDir` | `string` | `./memories` | Directory for memory JSON files |
| `maxInjectPerMessage` | `number` | `2` | Default recall cap per message |
| `maxInjectPerSendLoop` | `number` | `5` | Cumulative cap per send loop |

### Fields

| Field | Type | Default | Env | Description |
|---|---|---|---|---|
| `memoryDir` | `string` | `./memories` | `LLM_CHAT_MEMORY_DIR` | Directory for memory JSON files |
| `maxInjectPerMessage` | `number` | `2` | `LLM_CHAT_MEMORY_MAX_INJECT_PER_MESSAGE` | Default recall cap per message |
| `maxInjectPerSendLoop` | `number` | `5` | `LLM_CHAT_MEMORY_MAX_INJECT_PER_SEND_LOOP` | Cumulative cap per send loop |
| `maxInjectionContentLength` | `number` | `500` | `LLM_CHAT_MEMORY_MAX_INJECTION_CONTENT_LENGTH` | Serialized JSON limit for `get_memory` |
| `similarityGate` | `number` | `0.4` | `LLM_CHAT_MEMORY_SIMILARITY_GATE` | Minimum cosine similarity |
| `embeddingModel` | `string` | `Xenova/all-MiniLM-L6-v2` | `LLM_CHAT_MEMORY_EMBEDDING_MODEL` | Default model ID for `HuggingFaceEmbeddingProvider` |
| `minSummaryLength` | `number` | `50` | `LLM_CHAT_MEMORY_MIN_SUMMARY_LENGTH` | Minimum summary length |
| `maxSummaryLength` | `number` | `600` | `LLM_CHAT_MEMORY_MAX_SUMMARY_LENGTH` | Base maximum summary length |
| `summaryContentRatio` | `number` | `0.2` | none | Summary-to-content ratio used by the effective maximum |
| `recencyHalfLife` | `number` | `3600` | `LLM_CHAT_MEMORY_RECENCY_HALF_LIFE` | Recency decay half-life in seconds |
| `similarityWeight` | `number` | `0.5` | none | Composite score weight for similarity |
| `pageRankWeight` | `number` | `0.3` | none | Composite score weight for PageRank |
| `recencyWeight` | `number` | `0.2` | none | Composite score weight for recency |
| `mmrDiversityTradeoff` | `number` | `0.7` | none | MMR relevance/diversity trade-off |

The effective summary maximum is
`max(minSummaryLength, maxSummaryLength, round(summaryContentRatio * content.length))`.
With the defaults that is at least 50 characters and at most
`max(600, 20% of content length)`.

## `MemoryService`

### `new MemoryService(config, embedder, strategy?, store?)`

| Param | Type | Default | Description |
|---|---|---|---|
| `config` | `MemoryConfiguration` | required | Service configuration |
| `embedder` | `TextEmbeddingProvider` | required | Embedding provider |
| `strategy` | `SelectionStrategy` | `MMRSelectionStrategy` | Result selection strategy |
| `store` | `ObjectStore<MemoryJSON>` | `JsonFileStore` over `config.memoryDir` | Memory persistence backend |

### `init()`

Load memory files, rebuild the link graph, and run PageRank scoring. Idempotent.

Returns `Promise<void>`.

### `memories()`

Returns `MemoryPoolInterface`: the CRUD and embedding interface for the pool.
Recall is on `MemoryService.recall()`.

### `links()`

Returns `LinkPoolInterface`: the link graph interface.

### `recall(message, maxInject?)`

| Param | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | required | Natural-language query |
| `maxInject` | `number` | `config.maxInjectPerMessage` | Result cap; overrides the configured default |

Runs pool recall, selects memories, and marks the selected memories as
recalled. Returns `Promise<ReadonlyMemory[]>`.

### `score()`

Recompute PageRank over the link graph and persist updated scores. Returns
`Promise<void>`.

### `hookInto(chatService)`

| Param | Type | Default | Description |
|---|---|---|---|
| `chatService` | `ChatService` | required | Chat service to attach passive recall to |

Registers callbacks on `beforeSendLoop` and `afterSend`. Returns a
`MemoryHook` with `dispose()` to unregister them.

### `hook()`

Returns `MemoryServiceHookBuilder` for memory and link pool events. See
[Hooks](#hooks).

### `getEmbedder()`

Returns the `TextEmbeddingProvider` used by the service.

### `get config`

Returns the `MemoryConfiguration` used by the service.

### `get linker`

Returns the semantic `Linker`. Call `sync()` to recompute semantic links.

## `MemoryPoolInterface`

### `all()`

Returns `Promise<ReadonlyMemory[]>`.

### `get(id)`

| Param | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Memory ID |

Returns `Promise<ReadonlyMemory | undefined>`.

### `has(id)`

| Param | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Memory ID |

Returns `boolean`.

### `create(label, input)`

| Param | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | Label used to derive the ID |
| `input` | `CreateMemoryInput` | required | `{ content, summary, tags? }` |

Returns `Promise<Memory>`.

### `update(id, input)`

| Param | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Memory ID |
| `input` | `UpdateMemoryInput` | required | `{ content?, summary?, tags? }` |

Changes to content or tags invalidate the cached embedding. Returns
`Promise<Memory>`.

### `delete(id)`

| Param | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Memory ID |

Deletes the memory and its file. It does not remove links; call
`service.links().isolate(id)` separately. Returns `Promise<void>`.

### `ensureEmbeddings()`

Recompute stale or missing embeddings. Returns `Promise<void>`.

## `LinkPoolInterface`

### `link(from, to, undirected?)`

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | required | Source memory ID |
| `to` | `string` | required | Target memory ID |
| `undirected` | `boolean` | `false` | Create the link in both directions |

Returns `Promise<void>`.

### `link(from, targets, undirected?)`

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | required | Source memory ID |
| `targets` | `string[]` | required | Target memory IDs |
| `undirected` | `boolean` | `false` | Create the links in both directions |

Returns `Promise<string[]>` with the targets that were linked.

### `unlink(from, to, undirected?)`

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | required | Source memory ID |
| `to` | `string` | required | Target memory ID |
| `undirected` | `boolean` | `false` | Remove the link in both directions |

Removes constant and semantic links. Returns `Promise<void>`.

### `unlink(from, targets, undirected?)`

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | required | Source memory ID |
| `targets` | `string[]` | required | Target memory IDs |
| `undirected` | `boolean` | `false` | Remove the links in both directions |

Returns `Promise<void>`.

### `isolate(id)`

| Param | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Memory ID |

Removes every link involving the memory. Returns `Promise<void>`.

## Hooks

```typescript
const handle = service.hook().memories().onCreate().do(({ id }) => {
    // handle the event
});
handle.dispose();

service.hook().links().onLink().do(({ from, to }) => {
    // handle the event
});
```

| Builder | Events |
|---|---|
| `service.hook().memories()` | `onCreate`, `onUpdate`, `onDelete`, `onRecall` |
| `service.hook().links()` | `onLink`, `onUnlink` |

Each `do(callback)` returns a `Hook` with `dispose()`.

## `Memory` fields

A `Memory` exposes its fields via native get/set accessors
(`mem.content`, `mem.score`, etc.). Fields with a setter are writable;
`id` and `createdAt` are read-only and remain plain methods.

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

See [Architecture](architecture.md#shared-semantic-recall-via-embedding-similarity)
for the recall pipeline and [Hooks](hooks.md) for passive injection.
