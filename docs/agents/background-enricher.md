# Agent 4: Background Enricher

## Role

Batch processing agent that runs after initial graph loading to enrich nodes with AI-generated content. Not user-facing — runs autonomously.

## Model

**DevStral 2** (123B, 76 t/s) as orchestrator. Spawns **DevStral Small 2** (24B) sub-agents for parallelizable batch processing (summaries, quiz bank generation).

## Capabilities

- Compute `relevance` scores (0.0–1.0) from graph structure (in/out degree)
- Generate `summary` (~50 tokens) for all code nodes (File, Function, Class)
- Generate `summary_l1` for CONTRIBUTED edges (per contributor per node)
- Build quiz question bank for high-relevance nodes
- Detect code clusters (tightly coupled groups)
- Identify knowledge risks (high relevance + low coverage)

## Enrichment Pipeline

### 1. Relevance Scoring + Node Summaries

DevStral 2 orchestrates, spawning Small 2 sub-agents for batch processing:

```
Phase 1: Compute relevance per node from graph structure
  relevance = normalize(in_degree + out_degree)
  → written to node.relevance (0.0–1.0)

Phase 2: Order nodes by relevance DESC (most critical get summarized first)
  Group into clusters of 10-15
  For each cluster, spawn Small 2 sub-agent:
    → Generate node.summary (~50 tokens): what this code does
  Write summaries to KuzuDB
```

Update KuzuDB:
```cypher
MATCH (fn:Function {id: $id})
SET fn.summary = $summary, fn.relevance = $relevance
```

### 2. Contributor L1 Summaries

For each CONTRIBUTED edge (Person → File):
```
Small 2 sub-agent reads commits + ownershipPct
→ generates summary_l1 for that edge:
  "Alice: 14 commits, owns 73% of current lines, last Jan 2026"
→ written to CONTRIBUTED.summary_l1 in KuzuDB
```

Total: #contributors x #files they contributed to

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
WHERE fn.relevance > 0.7
AND NOT EXISTS {
  MATCH (:Person)-[u:UNDERSTANDS]->(fn)
  WHERE u.confidence = 'deep'
}
RETURN fn.name AS riskFunction, fn.relevance
```

## Scheduling

- Runs once after initial graph load
- Can be re-triggered by voice command ("enrich the graph")
- Processes in batches to avoid blocking the UI
- Progress reported via AgentStatus component
