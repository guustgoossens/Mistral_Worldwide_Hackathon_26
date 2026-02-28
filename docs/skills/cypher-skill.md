# Cypher Skill — Canonical Reference

Single source of truth for all agent prompts interacting with the HackStral knowledge graph.

## Schema DDL

### Node Tables

```cypher
CREATE NODE TABLE File (
  id STRING,          -- "file:src/lib/kuzu.ts"
  name STRING,        -- "kuzu.ts"
  filePath STRING,    -- "src/lib/kuzu.ts"
  summary STRING,     -- ~50 tokens, what this file does (Agent 4)
  relevance DOUBLE,   -- 0.0–1.0, structural importance (in/out degree)
  PRIMARY KEY (id)
)

CREATE NODE TABLE Function (
  id STRING,          -- "fn:src/lib/kuzu.ts:queryGraph"
  name STRING,        -- "queryGraph"
  filePath STRING,    -- "src/lib/kuzu.ts"
  startLine INT64,
  endLine INT64,
  summary STRING,     -- ~50 tokens, what this function does (Agent 4)
  relevance DOUBLE,   -- 0.0–1.0, structural importance
  PRIMARY KEY (id)
)

CREATE NODE TABLE Class (
  id STRING,          -- "class:src/types/graph.ts:VizNode"
  name STRING,        -- "VizNode"
  filePath STRING,    -- "src/types/graph.ts"
  summary STRING,
  relevance DOUBLE,
  PRIMARY KEY (id)
)

CREATE NODE TABLE Person (
  id STRING,          -- "person:alice"
  name STRING,        -- "Alice Smith"
  email STRING,
  PRIMARY KEY (id)
)

CREATE NODE TABLE Discussion (
  id STRING,          -- "disc:2026-02-28T14:30:00Z"
  timestamp STRING,
  transcript STRING,
  summary_l1 STRING,  -- brief summary of what was discussed
  quizResult STRING,  -- 'correct' | 'incorrect' if quiz-related
  confidenceBefore STRING,
  confidenceAfter STRING,
  PRIMARY KEY (id)
)
```

### Relationship Tables

```cypher
-- Code structure
CREATE REL TABLE CONTAINS (FROM File TO Function, FROM File TO Class)
CREATE REL TABLE CALLS (FROM Function TO Function)
CREATE REL TABLE IMPORTS (FROM File TO File)
CREATE REL TABLE INHERITS (FROM Class TO Class)

-- People → Code (progressive disclosure on relationships)
CREATE REL TABLE CONTRIBUTED (
  FROM Person TO File,
  commits INT64,
  lastTouch STRING,
  linesChanged INT64,
  blameLines INT64,       -- lines attributed to this person (git blame)
  ownershipPct DOUBLE,    -- % of current lines owned
  summary_l1 STRING,      -- "Alice: 14 commits, owns 73%, last Jan 2026"
  commits_json STRING     -- JSON array of per-commit details (L2)
)

CREATE REL TABLE UNDERSTANDS (
  FROM Person TO Function,
  confidence STRING,      -- 'deep' | 'surface' | 'none'
  source STRING,          -- 'quiz' | 'voice_interview' | 'git' | 'inferred'
  topics STRING[],
  lastAssessed STRING,
  needsRetest BOOLEAN,
  summary_l1 STRING,      -- "Alice: deep — edge cases, rate limiting"
  sessions_json STRING    -- JSON array of session results (L2)
)

-- Discussion relationships
CREATE REL TABLE HAS_PARTICIPANT (
  FROM Discussion TO Person,
  role STRING             -- 'interviewer' | 'interviewee'
)

CREATE REL TABLE ABOUT (
  FROM Discussion TO Function,
  FROM Discussion TO File,
  FROM Discussion TO Class,
  focus STRING            -- 'implementation' | 'architecture' | 'bug'
)
```

## ID Conventions

| Node type | Format | Example |
|-----------|--------|---------|
| File | `file:<filePath>` | `file:src/lib/kuzu.ts` |
| Function | `fn:<filePath>:<name>` | `fn:src/lib/kuzu.ts:queryGraph` |
| Class | `class:<filePath>:<name>` | `class:src/types/graph.ts:VizNode` |
| Person | `person:<slug>` | `person:alice` |
| Discussion | `disc:<ISO timestamp>` | `disc:2026-02-28T14:30:00Z` |

When speaking IDs aloud, use the **name part only** — say "queryGraph" not "fn:src/lib/kuzu.ts:queryGraph".

## Progressive Disclosure Rules

Data lives on **relationships**, not nodes. Query the right level for the right context:

| Level | What to query | When |
|-------|--------------|------|
| **L0** | Node `.name`, `.summary` | Default — quick overview |
| **L1** | Relationship `.summary_l1` | "Who worked on X?" / "Who knows X?" |
| **L2** | Relationship `.commits_json` or `.sessions_json` | "Show me the commit history" / deep dive |
| **L3** | Source code (external fetch) | "Show me the actual code" |

**Rule:** Start at L0. Only fetch L1+ when the user asks for detail. Never dump raw JSON — summarize it.

## Cypher Patterns by Intent

### Navigation — Finding Code

```cypher
-- All files
MATCH (f:File) RETURN f.id, f.name, f.filePath

-- Functions in a specific file
MATCH (f:File)-[:CONTAINS]->(fn:Function)
WHERE f.filePath CONTAINS 'auth'
RETURN fn.id, fn.name, fn.summary

-- Classes in a file
MATCH (f:File)-[:CONTAINS]->(c:Class)
WHERE f.filePath CONTAINS 'types'
RETURN c.id, c.name, c.summary

-- Find by name (case-insensitive)
MATCH (fn:Function)
WHERE fn.name =~ '(?i).*query.*'
RETURN fn.id, fn.name, fn.filePath
```

### Navigation — Following Relationships

```cypher
-- What does a function call?
MATCH (fn:Function {name: 'queryGraph'})-[:CALLS]->(callee:Function)
RETURN callee.name, callee.filePath

-- What calls a function? (reverse)
MATCH (caller:Function)-[:CALLS]->(fn:Function {name: 'queryGraph'})
RETURN caller.name, caller.filePath

-- Import chain
MATCH (a:File)-[:IMPORTS]->(b:File)
WHERE a.filePath CONTAINS 'App'
RETURN a.name, b.name

-- Class hierarchy
MATCH (child:Class)-[:INHERITS]->(parent:Class)
RETURN child.name, parent.name
```

### People — Contributions

```cypher
-- Who contributed to a file?
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)
WHERE f.filePath CONTAINS 'kuzu'
RETURN p.name, c.commits, c.linesChanged, c.ownershipPct
ORDER BY c.commits DESC

-- What files did a person work on?
MATCH (p:Person {name: 'Alice'})-[c:CONTRIBUTED]->(f:File)
RETURN f.name, f.filePath, c.commits, c.ownershipPct
ORDER BY c.commits DESC

-- Top contributors (all files)
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)
RETURN p.name, SUM(c.commits) AS totalCommits, COUNT(f) AS fileCount
ORDER BY totalCommits DESC

-- L1 summary for a contributor
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)
WHERE f.filePath CONTAINS 'kuzu'
RETURN p.name, c.summary_l1
```

### People — Knowledge

```cypher
-- Who understands a function?
MATCH (p:Person)-[u:UNDERSTANDS]->(fn:Function {name: 'queryGraph'})
RETURN p.name, u.confidence, u.topics, u.summary_l1

-- What does a person understand?
MATCH (p:Person {name: 'Alice'})-[u:UNDERSTANDS]->(fn:Function)
RETURN fn.name, u.confidence, u.topics
ORDER BY u.confidence DESC

-- Knowledge gaps: high-relevance functions nobody deeply understands
MATCH (fn:Function)
WHERE fn.relevance > 0.7
AND NOT EXISTS {
  MATCH (p:Person)-[u:UNDERSTANDS]->(fn)
  WHERE u.confidence = 'deep'
}
RETURN fn.name, fn.filePath, fn.relevance
ORDER BY fn.relevance DESC

-- Functions needing reassessment
MATCH (p:Person)-[u:UNDERSTANDS]->(fn:Function)
WHERE u.needsRetest = true
RETURN p.name, fn.name, u.lastAssessed
```

### Analysis — Graph Structure

```cypher
-- Most connected functions (high in/out degree)
MATCH (fn:Function)
OPTIONAL MATCH (fn)-[:CALLS]->(out:Function)
OPTIONAL MATCH (in:Function)-[:CALLS]->(fn)
RETURN fn.name, fn.filePath,
       COUNT(DISTINCT out) AS outDegree,
       COUNT(DISTINCT in) AS inDegree
ORDER BY outDegree + inDegree DESC
LIMIT 10

-- Isolated files (no imports)
MATCH (f:File)
WHERE NOT EXISTS { MATCH (f)-[:IMPORTS]->() }
AND NOT EXISTS { MATCH ()-[:IMPORTS]->(f) }
RETURN f.name, f.filePath

-- File complexity (by function count)
MATCH (f:File)-[:CONTAINS]->(fn:Function)
RETURN f.name, f.filePath, COUNT(fn) AS functionCount
ORDER BY functionCount DESC
```

### Analysis — Cross-Cutting

```cypher
-- Bus factor: files with only one contributor
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)
WITH f, COUNT(p) AS contributorCount
WHERE contributorCount = 1
MATCH (solo:Person)-[:CONTRIBUTED]->(f)
RETURN f.name, f.filePath, solo.name AS onlyContributor

-- Knowledge coverage per file
MATCH (f:File)-[:CONTAINS]->(fn:Function)
OPTIONAL MATCH (p:Person)-[u:UNDERSTANDS]->(fn)
WHERE u.confidence = 'deep'
RETURN f.name,
       COUNT(fn) AS totalFunctions,
       COUNT(DISTINCT CASE WHEN u IS NOT NULL THEN fn END) AS understoodFunctions

-- Discussion history for a function
MATCH (d:Discussion)-[:ABOUT]->(fn:Function {name: 'handleAuth'})
MATCH (d)-[:HAS_PARTICIPANT]->(p:Person)
RETURN p.name, d.timestamp, d.summary_l1, d.quizResult
ORDER BY d.timestamp DESC
```

### Overlay Mode Queries

```cypher
-- Structure: all code nodes + structural edges
MATCH (f:File) RETURN f.id, f.name, f.filePath
MATCH (fn:Function) RETURN fn.id, fn.name, fn.filePath
MATCH (c:Class) RETURN c.id, c.name, c.filePath
MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id
MATCH (a:Function)-[:CALLS]->(b:Function) RETURN a.id, b.id
MATCH (a:File)-[:IMPORTS]->(b:File) RETURN a.id, b.id

-- Contributors: code nodes + contributor stats
MATCH (p:Person)-[r:CONTRIBUTED]->(f:File)
RETURN f.id, p.name, r.commits, r.linesChanged

-- Knowledge: functions colored by understanding
MATCH (fn:Function)
OPTIONAL MATCH (p:Person)-[u:UNDERSTANDS]->(fn)
RETURN fn.id, fn.name,
       COUNT(CASE WHEN u.confidence = 'deep' THEN 1 END) AS deepCount,
       COUNT(CASE WHEN u.confidence = 'surface' THEN 1 END) AS surfaceCount

-- People: person nodes + relationship edges
MATCH (p:Person) RETURN p.id, p.name
MATCH (p:Person)-[:CONTRIBUTED]->(f:File) RETURN p.id, f.id
MATCH (p:Person)-[:UNDERSTANDS]->(fn:Function) RETURN p.id, fn.id
```

## KuzuDB WASM Dialect Notes

- **Multi-FROM rel tables:** `CONTAINS`, `ABOUT` have multiple FROM types. Query normally — KuzuDB resolves the correct source type.
- **IF NOT EXISTS:** Supported in DDL but some WASM versions silently ignore. Schema creation handles this with try/catch.
- **Result format:** `conn.execute(cypher)` returns `{ table }`. Call `table.toString()` → parse as JSON array.
- **String matching:** Use `CONTAINS` for substring match, `=~` for regex. KuzuDB supports `(?i)` flag for case-insensitive regex.
- **No MERGE:** KuzuDB WASM does not support `MERGE`. Use `CREATE` with manual existence checks, or delete + recreate.
- **Array properties:** `STRING[]` type is supported (e.g., `topics` on UNDERSTANDS). Access with list functions.
- **Query result truncation:** The `queryGraph` client tool truncates results to 2000 chars. For large result sets, use `LIMIT` or project only needed columns.

## Available Client Tools

These are the 6 tools registered with the ElevenLabs voice agent. They execute in the browser.

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `queryGraph` | `cypher: string` | Execute Cypher against KuzuDB, returns JSON (truncated to 2000 chars) |
| `highlightNodes` | `nodeIds: string[]` | Highlight specific nodes in the 3D visualization |
| `switchViewMode` | `mode: string` | Switch overlay: "structure", "contributors", "knowledge", "people" |
| `flyToNode` | `nodeId: string` | Animate 3D camera to focus on a node |
| `showDetailPanel` | `nodeId: string` | Open the detail panel for a node |
| `startQuiz` | `topic?: string` | Start a knowledge quiz on a topic |

### Tool Composition Patterns

1. **Query + Highlight:** Always `queryGraph` first, then `highlightNodes` with the returned IDs.
2. **Query + Fly:** For "show me X" requests, query → fly to the first result → show detail panel.
3. **Mode + Query:** Switch overlay first, then query for the relevant data in that mode.
4. **Quiz flow:** `startQuiz` → agent asks questions → evaluate answers → `queryGraph` to update UNDERSTANDS via Cypher.

### Knowledge Updates via Cypher

There is no dedicated `updateKnowledge` tool. Knowledge updates happen through `queryGraph` with Cypher:

```cypher
-- Create or update an UNDERSTANDS relationship
CREATE (p:Person)-[u:UNDERSTANDS {
  confidence: 'deep',
  source: 'quiz',
  topics: ['error handling', 'rate limiting'],
  lastAssessed: '2026-02-28',
  needsRetest: false,
  summary_l1: 'Alice: deep — error handling, rate limiting'
}]->(fn:Function)
WHERE p.name = 'Alice' AND fn.name = 'queryGraph'
```
