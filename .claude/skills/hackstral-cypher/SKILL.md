---
name: hackstral-cypher
description: KuzuDB graph schema and Cypher query patterns for HackStral codebase intelligence
globs: ["src/lib/kuzu.ts", "src/lib/agent-tools.ts", "src/hooks/useKuzu.ts", "src/types/graph.ts"]
---

# HackStral Cypher Skill

Query the codebase knowledge graph stored in KuzuDB WASM via Cypher.

## Schema (compact)

**Nodes:** File(id, name, filePath, summary, relevance), Function(id, name, filePath, startLine, endLine, summary, relevance), Class(id, name, filePath, summary, relevance), Person(id, name, email), Discussion(id, timestamp, transcript, summary_l1)

**Edges:** CONTAINS(File->Function|Class), CALLS(Function->Function), IMPORTS(File->File), INHERITS(Class->Class), CONTRIBUTED(Person->File: commits, ownershipPct, summary_l1, commits_json), UNDERSTANDS(Person->Function: confidence, topics, summary_l1, sessions_json), HAS_PARTICIPANT(Discussion->Person), ABOUT(Discussion->Function|File|Class)

**IDs:** file:path, fn:path:name, class:path:name, person:slug

## Key Patterns

```cypher
-- Functions in a file
MATCH (f:File)-[:CONTAINS]->(fn:Function)
WHERE f.filePath CONTAINS 'auth'
RETURN fn.name, fn.summary

-- Who contributed to a file
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)
WHERE f.filePath CONTAINS 'kuzu'
RETURN p.name, c.commits, c.summary_l1

-- Knowledge gaps (high-relevance, nobody deeply understands)
MATCH (fn:Function) WHERE fn.relevance > 0.7
AND NOT EXISTS { MATCH (:Person)-[u:UNDERSTANDS]->(fn) WHERE u.confidence = 'deep' }
RETURN fn.name, fn.relevance ORDER BY fn.relevance DESC

-- Call graph from a function
MATCH (fn:Function {name: 'queryGraph'})-[:CALLS]->(callee:Function)
RETURN callee.name, callee.filePath

-- Bus factor (files with one contributor)
MATCH (p:Person)-[:CONTRIBUTED]->(f:File)
WITH f, COUNT(p) AS n WHERE n = 1
MATCH (solo:Person)-[:CONTRIBUTED]->(f)
RETURN f.name, solo.name
```

## Query Execution

Use `queryGraph(conn, cypher)` from `src/lib/kuzu.ts`. Results are JSON arrays. Truncated to 2000 chars in the voice agent client tool.

## Full Reference

See [docs/skills/cypher-skill.md](../../docs/skills/cypher-skill.md) for complete schema DDL, 20+ query patterns, KuzuDB WASM dialect notes, and tool composition patterns.
