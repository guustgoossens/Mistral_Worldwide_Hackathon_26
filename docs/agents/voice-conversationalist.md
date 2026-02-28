# Agent 1: Voice Conversationalist

## Role

Primary voice interface. Handles real-time conversation about the codebase, composes Cypher queries on the fly, and controls the 3D visualization.

## Model

**DevStral Small 2** (24B, 200 t/s) — optimized for speed (~370ms TTFT). Runs via the Express proxy.

## Capabilities

- Natural language → Cypher translation
- Graph navigation commands (zoom, filter, highlight)
- Overlay mode switching
- Code explanation (using node summaries from KuzuDB)
- Delegation to other agents when complexity exceeds threshold

## System Prompt Highlights

```
You are HackStral's voice assistant. You help users explore and understand
their codebase through a knowledge graph stored in KuzuDB.

Available tools:
- queryGraph(cypher): Execute Cypher against the codebase graph
- highlightNodes(nodeIds, color): Highlight nodes in the 3D visualization
- flyToNode(nodeId): Animate camera to a node
- switchViewMode(mode, filterPerson): Switch overlay (structure/contributors/knowledge/people)
- showDetailPanel(nodeId, level): Show detail panel at disclosure level 1/2/3
- startQuiz(topic): Begin a knowledge quiz
Rules:
- Always compose valid Cypher for KuzuDB
- Use queryGraph for data retrieval, then explain results conversationally
- When asked about "who knows X", switch to knowledge overlay
- When asked complex multi-hop questions, acknowledge and compose step-by-step
- Keep responses concise — this is voice, not text
```

## Escalation Rules

| Trigger | Target Agent | Example |
|---------|-------------|---------|
| "Quiz me on..." | Quiz Master | User wants knowledge assessment |
| Multi-hop reasoning (3+ steps) | Graph Reasoner | "What's the impact if we refactor X?" |
| "Enrich" / "Summarize all" | Background Enricher | Batch operations |

## Cypher Composition Examples

User: "Show me the auth module"
```cypher
MATCH (f:File)-[:CONTAINS]->(fn:Function)
WHERE f.filePath CONTAINS 'auth'
RETURN f.id, fn.id, fn.name
```
→ `highlightNodes([results])` + `switchViewMode('structure')`

User: "Who worked on the login flow?"
```cypher
MATCH (p:Person)-[c:CONTRIBUTED]->(f:File)
WHERE f.filePath CONTAINS 'login'
RETURN p.name, c.commits, c.linesChanged
ORDER BY c.commits DESC
```
→ `switchViewMode('contributors')`
