# Quick Start

## Installation

```bash
npm install @johannes.latzel/llm-chat-memory
```

## Basic Usage

This wires memory into a chat service so the LLM can save and recall facts, and relevant memories are injected automatically.

```typescript
import { MemoryService, MemoryToolPackage, MemoryConfiguration, HuggingFaceEmbeddingProvider } from '@johannes.latzel/llm-chat-memory';
import { OpenAIChatService } from '@johannes.latzel/llm-chat';

const config = new MemoryConfiguration();
const embedder = new HuggingFaceEmbeddingProvider();
const memoryService = new MemoryService(config, embedder);
await memoryService.init();

const chatService = new OpenAIChatService(/* ... */);
chatService.tools().add(new MemoryToolPackage(memoryService));

// Auto-inject relevant memories via semantic similarity
memoryService.hookInto(chatService);

// After bulk imports, pre-compute embeddings so recall is ready:
await memoryService.memories().ensureEmbeddings();

// The LLM now has access to add_memory, update_memory,
// delete_memory, get_memory, recall_memories, link_memories,
// and unlink_memories tools.
// Relevant memories auto-inject as synthetic tool calls
// (id + summary). The LLM can retrieve full content on demand.
```
