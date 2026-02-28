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
bun run parse         # Tree-sitter repo parsing (stub)
bun run git-analyze   # Git history analysis (stub)
```

## Architecture

### Frontend (Vite + React)
- 3D force-directed graph visualization (`react-force-graph-3d`)
- Dark theme with Tailwind CSS v4
- Voice conversation UI (ElevenLabs `useConversation`)
- KuzuDB WASM for in-browser graph queries

### Graph Database (KuzuDB WASM)
Primary data store. All agents interact via Cypher queries.

**Node tables:** File, Function, Class, Person
**Relationship tables:** CONTAINS, CALLS, IMPORTS, INHERITS, CONTRIBUTED, UNDERSTANDS, DISCUSSED

Person nodes are **invisible infrastructure** — they exist in KuzuDB for powerful relationship queries but are NOT rendered in the default 3D view. Person data surfaces through overlay modes.

### Overlay Modes
1. **Structure** (default) — code nodes only, colored by type, edges = CALLS/IMPORTS
2. **Contributors** — code nodes colored/sized by contributor activity, filter by person
3. **Knowledge** — code nodes colored by knowledge coverage (green=deep, red=gap)
4. **People** — Person nodes become visible, showing human topology around code

### Proxy Server (Express)
- POST `/v1/chat/completions` → forwards to Mistral API with streaming
- Default model: `devstral-small-2507` (fast, for voice)
- Port 3001

### Scripts
- `scripts/parse-repo.ts` — Tree-sitter AST → graph.json
- `scripts/git-analyze.ts` — Git history → git-data.json

## Agent Roles

| Agent | Model | Purpose |
|-------|-------|---------|
| Voice Conversationalist | devstral-small-2507 | Real-time voice, Cypher composition |
| Quiz Master | mistral-medium | Knowledge assessment, spaced repetition |
| Graph Reasoner | codestral | Multi-step Cypher, sub-agent spawning |
| Background Enricher | codestral | Batch summaries, cluster analysis |

## Directory Layout

```
src/
├── types/graph.ts        # KuzuDB schema + visualization types
├── lib/
│   ├── utils.ts          # cn() helper
│   ├── kuzu.ts           # KuzuDB WASM init + schema + query helpers
│   ├── graph-builder.ts  # Tree-sitter AST → KuzuDB (stub)
│   ├── git-data.ts       # Git data → KuzuDB (stub)
│   └── agent-tools.ts    # ElevenLabs client tools (stub)
├── hooks/
│   ├── useGraph.ts       # Graph state + overlay mode
│   ├── useKuzu.ts        # KuzuDB lifecycle
│   ├── useVoiceAgent.ts  # ElevenLabs voice (stub)
│   ├── useTreeSitter.ts  # WASM parsing (stub)
│   └── useKnowledge.ts   # Quiz + knowledge scores (stub)
├── components/
│   ├── Layout.tsx        # App shell + overlay toggles
│   ├── Graph3D.tsx       # 3D force graph wrapper
│   ├── VoiceControls.tsx # Mic button + transcript
│   ├── NodeDetail.tsx    # Selected node panel
│   ├── QuizPanel.tsx     # Quiz UI
│   └── AgentStatus.tsx   # Status indicators
├── data/sample-graph.ts  # Dev sample data
├── App.tsx               # Root component
├── main.tsx              # Entry point
└── index.css             # Tailwind + dark theme
server/proxy.ts           # Mistral API proxy
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
- All stubs are typed and export real interfaces

## Docs

See [docs/README.md](docs/README.md) for architecture, agent design, and product docs.
