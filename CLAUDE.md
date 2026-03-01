# HackStral

Voice-driven codebase intelligence platform for the Mistral Worldwide Hackathon (Feb 28 - Mar 1, 2026, Paris).

## Commands

```bash
bun run dev           # Vite dev server (localhost:5173)
bun run dev:server    # Express proxy server (localhost:3001)
bun run dev:all       # Both in parallel
bun run build         # TypeScript check + Vite production build
bun run preview       # Preview production build
bun run lint          # TypeScript + ESLint
bun run format        # Prettier
bun run parse         # Tree-sitter repo parsing → data/output/graph.json
bun run git-analyze   # Git history analysis → data/output/git-data.json
bun run mcp -- public/data/hackstral   # KuzuDB MCP Server (stdio)
bun run enrich -- public/data/hackstral # Metadata enricher (L0/L1 summaries)
```

## Architecture

### Frontend (Vite + React)
- 3D force-directed graph visualization (`react-force-graph-3d`)
- Dark theme with Tailwind CSS v4
- Voice conversation UI (ElevenLabs `useConversation`)
- KuzuDB WASM for in-browser graph queries

### Graph Database (KuzuDB WASM)
Primary data store. All agents interact via Cypher queries.

**Node tables:** File, Function, Class, Person, Discussion
**Relationship tables:** CONTAINS, CALLS, IMPORTS, INHERITS, CONTRIBUTED, UNDERSTANDS, HAS_PARTICIPANT, ABOUT

Person nodes are **invisible infrastructure** — they exist in KuzuDB for powerful relationship queries but are NOT rendered in the default 3D view. Person data surfaces through overlay modes.

### Overlay Modes
1. **Structure** (default) — code nodes only, colored by type, edges = CALLS/IMPORTS
2. **Contributors** — code nodes colored/sized by contributor activity, filter by person
3. **Knowledge** — code nodes colored by knowledge coverage (green=deep, red=gap)
4. **People** — Person nodes become visible, showing human topology around code

### Voxtral STT (Local Speech-to-Text)
- [voxtral.c](https://github.com/antirez/voxtral.c) — antirez's pure-C inference engine for Voxtral Mini 4B Realtime
- Runs locally on Apple Silicon via Metal (MPS), ~2.5x real-time, zero Python dependencies
- Parallel STT alongside ElevenLabs during voice sessions
- AudioWorklet captures mic → PCM16LE → WebSocket → voxtral.c → text tokens back to browser
- `VoiceProvider` interface (`src/lib/voice-provider.ts`) enables future swap to full custom pipeline

### Proxy Server (Express)
- `POST /v1/chat/completions` → forwards to Mistral API or Bedrock (streaming or non-streaming)
- `POST /briefing` → stores pre-computed interview briefing as system message
- `GET /briefing` → checks if a briefing is loaded
- `GET /v1/models` → returns available model list
- `GET /health` → health check
- `WS /voxtral/stream` → Voxtral STT WebSocket (PCM in, text out; requires `vendor/voxtral.c/voxtral`)
- Default model: DevStral Small 2 (fast, for voice)
- Dual-mode: `INFERENCE_PROVIDER=mistral` (default) or `INFERENCE_PROVIDER=bedrock`
- Bedrock uses AWS SDK ConverseCommand with `AWS_BEARER_TOKEN_BEDROCK`
- No tools injected for voice requests — avoids ElevenLabs Custom LLM round-trip failure
- Supports `response_format` and `stream: false` passthrough for JSON mode
- Port 3001

### KuzuDB MCP Server
- Separate process from proxy, uses native `kuzu` package (not WASM)
- Stdio transport for Claude Code/Cursor integration
- Loads graph.json + git-data.json from filesystem
- 7 tools: `get_schema`, `query_graph`, `search_nodes`, `get_node_context`, `get_graph_stats`, `reason_about`, `enrich_repo`
- `reason_about` uses multi-step Cypher reasoning with progressive disclosure (L0→L1→L2)
- `enrich_repo` generates L0 node summaries + L1 relationship summaries via Mistral

### Metadata Enricher
- Generates L0 summaries (50 tokens) + relevance scores for all nodes
- Generates L1 contribution summaries for CONTRIBUTED edges
- Batched processing with Mistral API
- Can run standalone CLI or as MCP tool

### Graph Reasoner
- Multi-step agent loop following L0→L1→L2 progressive disclosure
- Three dimensions: structural (CALLS/IMPORTS), contribution (CONTRIBUTED), knowledge (UNDERSTANDS)
- Loop detection prevents repeated queries
- Max 8 reasoning steps, forced conclusion on loop detection

### Scripts
- `scripts/parse-repo.ts` — Tree-sitter AST → graph.json
- `scripts/git-analyze.ts` — Git history → git-data.json

## Agent Roles

| Agent | Model | Purpose |
|-------|-------|---------|
| Interview Agent | DevStral Small 2 (24B) | Pre-computed briefing → voice interview (no tool calls during voice) |
| Quiz System | DevStral Small 2 (24B) | Independent `useKnowledge` hook — question generation + answer evaluation via Mistral |
| Graph Reasoner | DevStral 2 (123B) | Multi-step Cypher reasoning with L0→L1→L2 progressive disclosure (`server/reasoner/`) |
| Metadata Enricher | DevStral Small 2 (24B) | L0 node summaries + L1 relationship summaries (`server/enricher/`) |

## Directory Layout

```
src/
├── types/graph.ts        # KuzuDB schema + visualization types
├── lib/
│   ├── utils.ts          # cn() helper
│   ├── kuzu.ts           # KuzuDB WASM init + schema + query helpers
│   ├── briefing.ts       # Pre-computed interview briefing pipeline
│   ├── graph-builder.ts  # Tree-sitter AST → KuzuDB
│   ├── git-data.ts       # Git data → KuzuDB
│   └── agent-tools.ts    # ElevenLabs client tools (visualization only)
├── hooks/
│   ├── useGraph.ts       # Graph state + overlay mode
│   ├── useKuzu.ts        # KuzuDB lifecycle
│   ├── useInterview.ts   # Interview lifecycle (idle → preparing → ready → interviewing → complete)
│   ├── useVoiceAgent.ts  # ElevenLabs voice connection
│   ├── useTreeSitter.ts  # WASM parsing
│   └── useKnowledge.ts   # Quiz system + knowledge scores
├── components/
│   ├── Layout.tsx        # App shell + overlay toggles
│   ├── Graph3D.tsx       # 3D force graph wrapper
│   ├── VoiceControls.tsx # Mic button + transcript + interview controls
│   ├── NodeDetail.tsx    # Selected node panel
│   ├── QuizPanel.tsx     # Quiz UI
│   └── AgentStatus.tsx   # Status indicators
├── data/sample-graph.ts  # Dev sample data
├── App.tsx               # Root component
├── main.tsx              # Entry point
└── index.css             # Tailwind + dark theme
server/
├── proxy.ts              # Mistral/Bedrock API proxy + briefing storage
├── mcp/
│   ├── index.ts          # MCP server entry point (stdio transport)
│   ├── kuzu-server.ts    # KuzuDB native init + schema + data loading
│   └── tools.ts          # 7 MCP tool definitions + handlers
├── enricher/
│   ├── index.ts          # Enricher entry point + CLI
│   ├── node-summaries.ts # L0: generate summaries + relevance
│   ├── relationship-l1.ts # L1: CONTRIBUTED.summary_l1
│   └── prompts.ts        # System prompts for metadata generation
├── reasoner/
│   ├── index.ts          # Reasoner entry point
│   ├── agent-loop.ts     # Multi-step L0→L1→L2 reasoning loop
│   ├── loop-detector.ts  # Prevents semantic query repetition
│   └── prompts.ts        # System prompts with progressive disclosure
scripts/                  # Repo analysis scripts
docs/                     # Full documentation
```

## Environment Variables

- `VITE_ELEVENLABS_AGENT_ID` — ElevenLabs agent
- `MISTRAL_API_KEY` — Mistral API key
- `VITE_PROXY_URL` — Proxy URL (default: http://localhost:3001)
- `NGROK_URL` — Public URL for webhooks
- `INFERENCE_PROVIDER` — `mistral` (default) or `bedrock`
- `AWS_BEARER_TOKEN_BEDROCK` — AWS Bearer token for Bedrock access
- `AWS_BEDROCK_REGION` — AWS region (default: us-east-1)
- `REASONER_MODEL` — Model for Graph Reasoner (default: devstral-2507)
- `ENRICHER_MODEL` — Model for Enricher (default: devstral-small-2507)

## Key Patterns

- COEP/COOP headers required for KuzuDB WASM (SharedArrayBuffer)
- `@/` path alias maps to `src/`
- Cypher queries via `queryGraph(conn, cypher)` in `src/lib/kuzu.ts`
- Overlay mode drives which Cypher queries produce visualization data
- Pre-computed briefing flow: KuzuDB queries → Mistral generates questions → proxy stores briefing → voice agent reads briefing as system message
- No tool calls during voice — avoids ElevenLabs Custom LLM round-trip failure
- Interview lifecycle: idle → preparing → ready → interviewing → complete → (optional) quizzing

## Docs

See [docs/README.md](docs/README.md) for architecture, agent design, and product docs.
