# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│                                                     │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ React App │  │ KuzuDB   │  │ web-tree-sitter  │ │
│  │           │  │ WASM     │  │ WASM             │ │
│  │ - Graph3D │  │          │  │                  │ │
│  │ - Voice   │◄─┤ Cypher   │  │ AST parsing      │ │
│  │ - Panels  │  │ queries  │  │ (in-browser)     │ │
│  └─────┬─────┘  └──────────┘  └──────────────────┘ │
│        │                                            │
│        │ WebSocket                                  │
└────────┼────────────────────────────────────────────┘
         │
    ┌────┴─────┐        ┌─────────────────┐
    │ElevenLabs│        │  Express Proxy   │
    │  Cloud   │───────►│  (localhost:3001)│
    │          │        │                  │
    │ Voice AI │        │  /v1/chat/       │
    │ + Tools  │        │  completions     │
    └──────────┘        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Mistral API     │
                        │                  │
                        │ devstral-small   │
                        │ codestral        │
                        │ mistral-medium   │
                        └──────────────────┘
```

## Data Flow

1. **Preprocessing** (offline): Tree-sitter + simple-git analyze a target repo → JSON files
2. **Load** (app start): JSON data ingested into KuzuDB WASM (File, Function, Class, Person nodes + relationships)
3. **Visualize**: React app queries KuzuDB per overlay mode → derives `GraphData` → renders 3D force graph
4. **Voice interaction**: User speaks → ElevenLabs transcribes → LLM composes Cypher → client tool executes against KuzuDB → graph updates in real-time
5. **Knowledge tracking**: Quiz results update UNDERSTANDS relationships in KuzuDB → knowledge overlay reflects coverage

## Local STT: voxtral.c

The proxy supports an optional parallel STT stream via [voxtral.c](https://github.com/antirez/voxtral.c) — antirez's pure-C inference engine for Mistral's Voxtral Mini 4B Realtime model. It runs locally on Apple Silicon via Metal at ~2.5x real-time with no Python dependencies. Browser audio is captured via AudioWorklet, streamed as PCM16LE over WebSocket (`/voxtral/stream`), and text tokens are returned in real time. See [Voice Flow](voice-flow.md) for the full architecture.

## Detailed Docs

- [Graph Data Model](graph-data-model.md) — KuzuDB schema, Cypher examples, overlay queries
- [Voice Flow](voice-flow.md) — ElevenLabs → Proxy → Mistral → client tools, Voxtral parallel STT
- [Parsing Pipeline](parsing-pipeline.md) — Tree-sitter multi-pass extraction
