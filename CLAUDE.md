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
- `POST /v1/chat/completions` → forwards to Mistral API (streaming or non-streaming)
- `POST /briefing` → stores pre-computed interview briefing as system message
- `GET /briefing` → checks if a briefing is loaded
- `GET /v1/models` → returns available model list
- `GET /health` → health check
- `WS /voxtral/stream` → Voxtral STT WebSocket (PCM in, text out; requires `vendor/voxtral.c/voxtral`)
- Default model: DevStral Small 2 (fast, for voice)
- No tools injected for voice requests — avoids ElevenLabs Custom LLM round-trip failure
- Supports `response_format` and `stream: false` passthrough for JSON mode
- Port 3001

### Scripts
- `scripts/parse-repo.ts` — Tree-sitter AST → graph.json
- `scripts/git-analyze.ts` — Git history → git-data.json

## Agent Roles

| Agent | Model | Purpose |
|-------|-------|---------|
| Interview Agent | DevStral Small 2 (24B) | Pre-computed briefing → voice interview (no tool calls during voice) |
| Quiz System | DevStral Small 2 (24B) | Independent `useKnowledge` hook — question generation + answer evaluation via Mistral |
| Graph Reasoner | DevStral 2 (123B) | *Not implemented — stretch goal for post-hackathon* |
| Background Enricher | DevStral 2 (123B) | *Not implemented — stretch goal for post-hackathon* |

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
server/proxy.ts           # Mistral API proxy + briefing storage
scripts/                  # Repo analysis scripts
docs/                     # Full documentation
```

## Environment Variables

- `VITE_ELEVENLABS_AGENT_ID` — ElevenLabs agent
- `MISTRAL_API_KEY` — Mistral API key
- `VITE_PROXY_URL` — Proxy URL (default: http://localhost:3001)
- `NGROK_URL` — Public URL for webhooks

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
