# Hook-based tool injection

Hooks can inject synthetic tool-call cycles via `ChatService.injectToolCall()`.
Instead of injecting plain assistant text ("i remember: ..."), the LLM sees
a standard tool-call → tool-result → assistant-response cycle.

## Batch injection via summary

Injection uses a single synthetic `get_memory` call with `ids: string[]` and
`summary: true`, rather than N separate per-memory calls. The tool response
returns all memories as `[{ id, summary }, ...]` in one message. This keeps
scaffolding overhead to exactly 2 messages, regardless of how many memories
are injected.

The model receives only `id + summary` for each memory. If it decides a
memory is relevant, it can issue a real `get_memory(id)` call to fetch the
full content.

## injectToolCall

`ChatService.injectToolCall(toolName, args)` executes the tool silently,
queues an assistant message with the tool call, and queues the tool response.
It does **not** call `interrupt()` or `send()` — the caller is responsible
for flushing.

If you are inside a **beforeSendLoop** or **afterSend** hook callback, use
`setNeedsResend()` to trigger a resend:

```typescript
await service.injectToolCall('get_memory', { ids: [id1, id2], summary: true });
service.setNeedsResend();
```

Outside hooks, call `interrupt(true)` and `send()`:

```typescript
await service.injectToolCall('get_memory', { ids: [id1, id2], summary: true });
service.interrupt(true);
await service.send();
```

## How MemoryService.hookInto uses injectToolCall

`MemoryService.hookInto(chatService)` creates a per-call `MemoryHook`
session and registers two lifecycle callbacks on the ChatService. It returns
the `MemoryHook` so callers can call `.dispose()` to unregister the hooks.

Tracking is **per `MemoryHook` instance** (via a local `Set<string>`),
not per send-loop cycle. Each call to `hookInto()` creates a fresh hook with
its own tracking set, so different sessions have independent tracking.
A memory is injected at most once per hook.

### MemoryHook callbacks

- **`onBeforeSendLoop`** — scans **User** messages only, recalls matching
  memories via semantic similarity, and calls
  `injectToolCall('get_memory', { ids, summary: true })` with the new IDs.
  Does not call `setNeedsResend`.
- **`onAfterSend`** — scans **model-origin Reasoning** messages only, recalls
  matching memories, filters out any whose ID is already in the session's
  injected set, and calls `injectToolCall('get_memory', { ids, summary: true })`
  for the new ones. Calls `setNeedsResend()` if any were injected.

### Session-level tracking

Both callbacks share a single `Set<memoryId>` on the `MemoryHook`.
Since the two hooks process different roles (User vs.
model-origin Reasoning), they can both find new matches from the same
range of messages without duplicating work.

**Example flow:**

1. **User sends a message** → `beforeSendLoop` fires.
   Session's injected set is empty. Scans User messages, recalls matching
   memories via semantic similarity, adds IDs to session set, calls
   `injectToolCall` with all IDs as a batch. No `setNeedsResend`.

2. **Model responds** → `afterSend` fires with the new assistant+reasoning
   messages. Scans model-origin Reasoning messages, recalls memories, filters
   against the session set — finds only **new** IDs. Calls batch
   `injectToolCall` and `setNeedsResend()`.

3. **Resend loop** → `beforeSendLoop` fires again. Sees no new User messages.
   The same memories are already in the session's injected set. `afterSend`
   fires again — IDs are in the session set, so they are skipped. No new
   tool calls pile up.

4. **User sends another message** → `beforeSendLoop` fires (the send-retry
   loop has exited and a new one begins). The session set already contains
   the previously injected IDs, so they won't be re-injected. New memories
   matching the new message can still be added.

## Mutex guard

A `Mutex` (from `async-mutex`) wraps both callbacks, ensuring they never run
concurrently if they fire at the same time. This prevents race conditions on
the session's injected set.

## API reference

### ChatService methods consumed by hooks

| Method | Purpose |
|---|---|
| `injectToolCall(toolName, args)` | Execute a tool silently and queue assistant + tool-response messages |
| `setNeedsResend()` | Flag that the send loop should re-run (use inside hook callbacks) |
| `interrupt(clearQueue)` | Interrupt the current send loop iteration |
| `send()` | Flush queued messages to the model |

The `injectToolCall` method is provided by `@johannes.latzel/llm-chat` and is
available on any `ChatService` instance.
