# Agent 4: Background Enricher

## Role

Batch processing agent that runs after initial graph loading to enrich nodes with AI-generated content. Not user-facing — runs autonomously.

## Model

**codestral** — code understanding for summary generation and analysis.

## Capabilities

- Generate multi-level summaries (summary_l1, l2, l3) for all Function nodes
- Calculate structuralImportance scores
- Build quiz question bank
- Detect code clusters (tightly coupled groups)
- Identify knowledge risks (high importance + low coverage)

## Enrichment Pipeline

### 1. Summary Generation

For each Function node without summaries:
```
Input: function source code + file context + caller/callee names
Prompt: "Generate three summaries at different detail levels:
  L1: One sentence (what does this do?)
  L2: One paragraph (how does it work?)
  L3: Detailed (implementation details, edge cases, dependencies)"
```

Update KuzuDB:
```cypher
MATCH (fn:Function {id: $id})
SET fn.summary_l1 = $l1, fn.summary_l2 = $l2, fn.summary_l3 = $l3
```

### 2. Structural Importance

Calculate based on graph topology:
- Fan-in (incoming CALLS edges)
- Fan-out (outgoing CALLS edges)
- File centrality (IMPORTS edges to containing file)
- Transitive importance (PageRank-like propagation)

```cypher
MATCH (caller:Function)-[:CALLS]->(fn:Function {id: $id})
WITH fn, COUNT(caller) AS fanIn
MATCH (fn)-[:CALLS]->(callee:Function)
WITH fn, fanIn, COUNT(callee) AS fanOut
SET fn.structuralImportance = (fanIn * 0.6 + fanOut * 0.2 + ...) / normalizationFactor
```

### 3. Quiz Bank Generation

Pre-generate questions for high-importance functions:
```
Input: function summary + graph context
Output: 3-5 questions per function, stored for Quiz Master
```

### 4. Cluster Analysis

Identify tightly coupled code groups using community detection:
- Functions that call each other frequently
- Files with high mutual import density
- Contributor overlap (same people work on these files)

### 5. Risk Detection

Flag knowledge risks:
```cypher
MATCH (fn:Function)
WHERE fn.structuralImportance > 0.7
AND NOT EXISTS {
  MATCH (:Person)-[u:UNDERSTANDS]->(fn)
  WHERE u.confidence = 'deep'
}
RETURN fn.name AS riskFunction, fn.structuralImportance
```

## Scheduling

- Runs once after initial graph load
- Can be re-triggered by voice command ("enrich the graph")
- Processes in batches to avoid blocking the UI
- Progress reported via AgentStatus component
