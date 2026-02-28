# HackStral

Voice-driven codebase intelligence — parse, visualize, and understand any codebase through conversation.

## What it does

- **Parse** any codebase into a knowledge graph using Tree-sitter AST analysis
- **Enrich** with AI-generated summaries, structural importance scores, and contributor data
- **Visualize** code structure as an interactive 3D force-directed graph
- **Talk** to your codebase through a voice AI agent (ElevenLabs + Mistral)
- **Quiz** team members to map knowledge coverage across the codebase
- **Track** who knows what — identify knowledge gaps and bus-factor risks

## Quick start

```bash
bun install
cp .env.local.example .env.local  # fill in API keys
bun run dev:all                   # starts Vite + proxy server
```

## Repo preprocessing

```bash
bun run parse -- /path/to/repo       # tree-sitter analysis → graph.json
bun run git-analyze -- /path/to/repo  # git history → git-data.json
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_ELEVENLABS_AGENT_ID` | ElevenLabs conversational agent ID |
| `MISTRAL_API_KEY` | Mistral API key for LLM proxy |
| `VITE_PROXY_URL` | Proxy server URL (default: `http://localhost:3001`) |
| `NGROK_URL` | Public URL for ElevenLabs webhook (optional) |

## Tech stack

| Technology | Purpose |
|------------|---------|
| React + Vite | Frontend framework |
| Tailwind CSS v4 | Styling |
| react-force-graph-3d | 3D graph visualization |
| KuzuDB WASM | In-browser graph database (Cypher queries) |
| web-tree-sitter | Code parsing (AST extraction) |
| ElevenLabs | Voice AI conversation |
| Mistral AI | LLM (devstral-small-2507 for voice, codestral for analysis) |
| Express | Proxy server (ElevenLabs → Mistral) |
| simple-git | Git history analysis |

## Docs

See [docs/README.md](docs/README.md) for full documentation.

## Built for

Mistral Worldwide Hackathon — Feb 28 - Mar 1, 2026, Paris
