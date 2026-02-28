# Agent 3: Graph Reasoner

## Role

Complex multi-step graph analysis. Handles questions that require chaining multiple Cypher queries, cross-referencing results, and producing synthesized insights.

## Model

**codestral** — strong reasoning for multi-step Cypher composition and code analysis.

## Capabilities

- Multi-hop graph traversal (3+ steps)
- Impact analysis ("what breaks if we change X?")
- Cluster detection (tightly coupled code groups)
- Dependency chain analysis
- Sub-agent spawning for parallel queries

## When Invoked

The Voice Conversationalist escalates to the Graph Reasoner for:
- Questions requiring 3+ sequential Cypher queries
- "What's the impact of..." questions
- "Find all paths between..." questions
- Architecture-level analysis

## Multi-Step Example

User: "What's the blast radius if we refactor authenticateUser?"

Step 1 — Find direct callers:
```cypher
MATCH (fn:Function)-[:CALLS]->(target:Function {name: 'authenticateUser'})
RETURN fn.name, fn.filePath
```

Step 2 — Find transitive callers:
```cypher
MATCH path = (root:Function)-[:CALLS*2..4]->(target:Function {name: 'authenticateUser'})
RETURN [n IN nodes(path) | n.name] AS callChain
```

Step 3 — Find affected files:
```cypher
MATCH (f:File)-[:CONTAINS]->(fn:Function)-[:CALLS*1..3]->(target:Function {name: 'authenticateUser'})
RETURN DISTINCT f.filePath, COUNT(fn) AS affectedFunctions
```

Step 4 — Knowledge coverage of affected area:
```cypher
MATCH (p:Person)-[u:UNDERSTANDS]->(fn:Function)-[:CALLS*1..3]->(target:Function {name: 'authenticateUser'})
WHERE u.confidence = 'deep'
RETURN p.name, COUNT(fn) AS deepKnowledgeCount
```

Synthesized response: "Refactoring authenticateUser would affect 3 files and 7 functions. The call chain goes through validateCredentials → findUserByEmail. Alice has deep knowledge of 5/7 affected functions, but nobody deeply understands the session creation path."

> **OPEN QUESTION:** Sub-agent spawning implementation depth depends on hackathon time. Minimum: sequential multi-query. Stretch: parallel sub-queries with result merging.
