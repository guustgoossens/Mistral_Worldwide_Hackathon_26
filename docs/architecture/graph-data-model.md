# Graph Data Model

## KuzuDB Schema

KuzuDB is the primary graph store. All data lives in-browser via WASM. Agents interact through Cypher queries.

### Node Tables

```cypher
CREATE NODE TABLE File (
  id STRING, name STRING, filePath STRING,
  PRIMARY KEY (id)
)

CREATE NODE TABLE Function (
  id STRING, name STRING, filePath STRING,
  startLine INT64, endLine INT64,
  summary_l1 STRING,    -- one-liner
  summary_l2 STRING,    -- paragraph
  summary_l3 STRING,    -- detailed
  structuralImportance DOUBLE,
  PRIMARY KEY (id)
)

CREATE NODE TABLE Class (
  id STRING, name STRING, filePath STRING,
  PRIMARY KEY (id)
)

CREATE NODE TABLE Person (
  id STRING, name STRING, email STRING,
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

-- People → Code
CREATE REL TABLE CONTRIBUTED (
  FROM Person TO File,
  commits INT64, lastTouch STRING, linesChanged INT64
)

CREATE REL TABLE UNDERSTANDS (
  FROM Person TO Function,
  confidence STRING,   -- 'deep' | 'surface' | 'none'
  source STRING,       -- 'quiz' | 'voice_interview' | 'git' | 'inferred'
  topics STRING[],
  lastAssessed STRING
)

CREATE REL TABLE DISCUSSED (
  FROM Person TO Function,
  timestamp STRING, transcript STRING, quizResult STRING,
  confidenceBefore STRING, confidenceAfter STRING
)
```

## Person Nodes: Invisible Infrastructure

Person nodes exist in KuzuDB for powerful relationship queries but are **not rendered** in the default 3D visualization. This is a deliberate design choice:

- **Default view** (structure overlay): code-only graph, clean and focused
- **Contributor overlay**: code nodes colored/sized by contributor activity — Person data surfaces as metadata
- **Knowledge overlay**: code nodes colored by knowledge coverage — Person data drives the scoring
- **People overlay**: Person nodes become visible, showing human topology around code clusters

This means the graph is always code-first. Person data enriches the code view rather than cluttering it.

## Example Cypher Queries

### Structure overlay — all code nodes and relationships
```cypher
MATCH (f:File)-[:CONTAINS]->(fn:Function) RETURN f, fn
MATCH (f1:File)-[:IMPORTS]->(f2:File) RETURN f1, f2
MATCH (fn1:Function)-[:CALLS]->(fn2:Function) RETURN fn1, fn2
```

### Contributor overlay — code nodes with contributor stats
```cypher
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)
RETURN f.id, f.name, p.name, c.commits, c.linesChanged
ORDER BY c.commits DESC
```

### Knowledge overlay — functions by knowledge coverage
```cypher
MATCH (fn:Function)
OPTIONAL MATCH (p:Person)-[u:UNDERSTANDS]->(fn)
RETURN fn.id, fn.name,
       COUNT(CASE WHEN u.confidence = 'deep' THEN 1 END) AS deepCount,
       COUNT(CASE WHEN u.confidence = 'surface' THEN 1 END) AS surfaceCount
```

### People overlay — person topology
```cypher
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)-[:CONTAINS]->(fn:Function)
RETURN p, f, fn, c.commits
```

### Knowledge gap detection
```cypher
MATCH (fn:Function)
WHERE fn.structuralImportance > 0.7
AND NOT EXISTS {
  MATCH (p:Person)-[u:UNDERSTANDS]->(fn)
  WHERE u.confidence = 'deep'
}
RETURN fn.name, fn.filePath, fn.structuralImportance
ORDER BY fn.structuralImportance DESC
```

## Extensible Schema

The schema is designed for future expansion. Potential additions:
- `Bug` node table with REPORTED_IN, FIXED_BY relationships
- `PR` node table with MODIFIES, REVIEWED_BY relationships
- `Documentation` node table with DOCUMENTS relationship
- `Test` node table with TESTS relationship

For hackathon scope: code nodes (File, Function, Class) + Person nodes only.

> **OPEN QUESTION:** Exact KuzuDB WASM initialization pattern needs testing. The 2-hour rule applies — if WASM setup proves problematic, fall back to in-memory JSON with the same query interface.
