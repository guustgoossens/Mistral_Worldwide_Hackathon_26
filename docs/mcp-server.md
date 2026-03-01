# KuzuDB MCP Server

Model Context Protocol server that exposes the HackStral codebase graph to AI tools (Claude Code, Cursor, etc.).

## Overview

The MCP server runs as a separate process that loads the same graph data (graph.json + git-data.json) into a native KuzuDB instance and exposes it via 7 tools over stdio transport.

This is a **developer tool** — it lets Claude Code or Cursor query the codebase graph directly. For the web demo, the browser's WASM KuzuDB handles graph queries instead.

## Quick Start

```bash
# Run the MCP server
bun run mcp -- public/data/hackstral

# Or with a different repo
bun run mcp -- public/data/mistral-python-client
```

## Claude Code Configuration

Add to `.claude/settings.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "hackstral-graph": {
      "command": "npx",
      "args": ["tsx", "server/mcp/index.ts", "--", "public/data/hackstral"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `get_schema` | Returns full graph schema DDL, ID conventions, and example Cypher patterns |
| `query_graph` | Execute raw Cypher queries, returns JSON rows |
| `search_nodes` | Search nodes by name (substring match), optionally filter by type |
| `get_node_context` | Rich context: callers, callees, contributors, knowledge for any node |
| `get_graph_stats` | Quick counts of all node and edge types |
| `reason_about` | Multi-step Cypher reasoning with progressive disclosure (L0→L1→L2) |
| `enrich_repo` | Generate L0 node summaries and L1 relationship summaries via Mistral |

## Architecture

```
Claude Code / Cursor
    │ (stdio)
    ▼
MCP Server (server/mcp/index.ts)
    │
    ├── kuzu-server.ts  ← Native KuzuDB (in-memory)
    │     └── Loads graph.json + git-data.json
    │
    ├── tools.ts        ← 7 tool definitions + handlers
    │
    ├── enricher/       ← L0/L1 metadata generation (via Mistral API)
    │
    └── reasoner/       ← Multi-step agent loop with loop detection
```

## Graph Schema

**Node tables:** File, Function, Class, Person, Discussion

**Relationship tables:** CONTAINS, CALLS, IMPORTS, INHERITS, CONTRIBUTED, UNDERSTANDS, HAS_PARTICIPANT, ABOUT

**ID conventions:**
- File: `f:<filePath>` (e.g., `f:src/App.tsx`)
- Function: `fn:<filePath>::<name>` (e.g., `fn:src/lib/kuzu.ts::initKuzu`)
- Class: `c:<filePath>::<name>`
- Person: `p:<id>_<email>`

## Progressive Disclosure (Reasoner)

The `reason_about` tool follows a tree-based exploration strategy:

1. **L0 (Structural):** Node properties + CALLS/IMPORTS/CONTAINS traversal
2. **L1 (Summaries):** CONTRIBUTED.summary_l1, UNDERSTANDS.summary_l1
3. **L2 (Details):** Full commits_json, sessions_json — only for relationships flagged as important

Three dimensions: structural, contribution, knowledge. The agent starts broad (L0), identifies interesting relationships (L1), then drills deep only where needed (L2).

## Environment Variables

- `MISTRAL_API_KEY` — Required for `reason_about` and `enrich_repo` tools
- `REASONER_MODEL` — Model for reasoning (default: `devstral-2507`)
- `ENRICHER_MODEL` — Model for enrichment (default: `devstral-small-2507`)

## vs Browser KuzuDB

| | MCP Server | Browser WASM |
|--|-----------|-------------|
| Runtime | Native Node.js (`kuzu` package) | WASM (`@kuzu/kuzu-wasm`) |
| Client | Claude Code, Cursor | Web app users |
| Data source | Filesystem (JSON files) | Fetch from public/ |
| Use case | Developer tool, CI integration | Demo, web chat |
