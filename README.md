# LLM Chat Memory

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NPM](https://nodei.co/npm/@johannes.latzel/llm-chat-memory.svg?style=shields&data=n,v,u,d,s)](https://www.npmjs.com/package/@johannes.latzel/llm-chat-memory)
[![version](https://img.shields.io/github/package-json/v/johanneslatzel/llm-chat-memory)](https://github.com/johanneslatzel/llm-chat-memory/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/johanneslatzel/llm-chat-memory/pulls)
[![Feedback Welcome](https://img.shields.io/badge/feedback-welcome-brightgreen)](https://github.com/johanneslatzel/llm-chat-memory/discussions)
[![codecov](https://codecov.io/gh/johanneslatzel/llm-chat-memory/graph/badge.svg)](https://codecov.io/gh/johanneslatzel/llm-chat-memory)
[![CI](https://github.com/johanneslatzel/llm-chat-memory/actions/workflows/ci.yml/badge.svg)](https://github.com/johanneslatzel/llm-chat-memory/actions/workflows/ci.yml)
[![Socket Badge](https://badge.socket.dev/npm/package/@johannes.latzel/llm-chat-memory/latest)](https://badge.socket.dev/npm/package/@johannes.latzel/llm-chat-memory/latest)
[![AI Assisted Yes](https://img.shields.io/badge/AI%20Assisted-Yes-green)](https://github.com/mefengl/made-by-ai)

Persistent memory for LLM agents by active (tool call) and passive (inject) recall. Plugs into the [llm-chat](https://github.com/johanneslatzel/llm-chat) ecosystem.

## Features

- tagged, linked, and scored memories with embedding support
- active recall via dedicated tool calls
- passive recall via automatic chat lifecycle hooks automatically injecting memories
- embedding-based semantic similarity search
- manual (constant) and automatic (semantic similarity) memory linking
- PageRank-based importance scoring over the link graph
- pluggable selection strategies: MMR (default) and weighted random
- JSON file persistence for memories and links
- configurable via `MemoryConfiguration` objects and environment variables

## Prerequisites

- Node.js >= 18

## Installation

```bash
npm install @johannes.latzel/llm-chat-memory
```

## Documentation

Full documentation at **[johanneslatzel.github.io/llm-chat-memory/](https://johanneslatzel.github.io/llm-chat-memory/)**

## License

MIT — see [`LICENSE`](LICENSE).

## Contributing

Issues and PRs welcome at [github.com/johanneslatzel/llm-chat-memory](https://github.com/johanneslatzel/llm-chat-memory).
