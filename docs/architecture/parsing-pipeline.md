# Parsing Pipeline

## Overview

The parsing pipeline converts a source code repository into structured graph data in KuzuDB. It runs in two phases: offline preprocessing (scripts) and runtime loading.

## Phase 1: Offline Preprocessing

### Tree-sitter Analysis (`bun run parse`)

Multi-pass parsing using web-tree-sitter:

**Pass 1 — File Discovery**
- Walk the repository, filter by supported languages (.ts, .tsx, .js, .jsx, .py)
- Create File nodes with id, name, filePath

**Pass 2 — AST Extraction**
- Load appropriate grammar (tree-sitter-typescript, tree-sitter-javascript, tree-sitter-python)
- Parse each file into AST
- Extract:
  - Function declarations → Function nodes
  - Class declarations → Class nodes
  - Method definitions → Method nodes (treated as Function with class context)
- Create CONTAINS edges (File → Function, File → Class)

**Pass 3 — Call Resolution**
- Analyze function bodies for call expressions
- Match called identifiers to known Function nodes
- Create CALLS edges (Function → Function)

**Pass 4 — Import Resolution**
- Extract import/require statements
- Resolve to File nodes
- Create IMPORTS edges (File → File)

**Output:** `data/output/graph.json`
```json
{
  "nodes": [
    { "type": "file", "id": "f:src/auth/login.ts", "name": "login.ts", "filePath": "src/auth/login.ts" },
    { "type": "function", "id": "fn:authenticateUser", "name": "authenticateUser", "filePath": "src/auth/login.ts", "startLine": 10, "endLine": 45 }
  ],
  "edges": [
    { "type": "contains", "source": "f:src/auth/login.ts", "target": "fn:authenticateUser" },
    { "type": "calls", "source": "fn:authenticateUser", "target": "fn:validateCredentials" }
  ]
}
```

### Git Analysis (`bun run git-analyze`)

Uses simple-git to extract contributor data:

1. Read full commit log
2. For each commit: extract author (name, email), files changed, lines added/removed
3. Aggregate per file: total commits, lines changed, last touch date per contributor
4. Build contributor map

**Output:** `data/output/git-data.json`
```json
{
  "contributors": {
    "alice@example.com": {
      "name": "Alice",
      "files": {
        "src/auth/login.ts": { "commits": 15, "linesChanged": 342, "lastTouch": "2024-01-15" }
      }
    }
  }
}
```

## Phase 2: Runtime Loading

On app start:
1. Load `graph.json` → insert File, Function, Class nodes + CONTAINS, CALLS, IMPORTS edges into KuzuDB
2. Load `git-data.json` → insert Person nodes + CONTRIBUTED edges into KuzuDB
3. Compute structural importance scores from graph topology (fan-in, fan-out, file centrality)

## Structural Importance Scoring

Functions are scored 0.0–1.0 based on:
- **Fan-in**: how many functions call this one (high = important)
- **Fan-out**: how many functions this calls (high = orchestrator)
- **File centrality**: how many imports flow through the containing file
- **Size**: lines of code (proxy for complexity)

> **Resolved:** Importance scoring runs in the preprocessing scripts (offline), not as a background agent task. This was the pragmatic choice for the hackathon.
