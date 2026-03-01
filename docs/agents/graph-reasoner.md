> **Not implemented — stretch goal for post-hackathon.** The design below is the planned architecture but was not built during the hackathon. The interview flow (pre-computed briefing) replaced the need for real-time multi-step Cypher during voice.

# Agent 3: Graph Reasoner

## Role

Complex multi-step graph analysis. Handles questions that require chaining multiple Cypher queries, cross-referencing results, and producing synthesized insights.

## Model

**DevStral 2** (123B, 76 t/s) — strong reasoning for multi-step Cypher composition and code analysis. Can spawn DevStral Small 2 sub-agents for parallel node exploration.

## Capabilities

- Multi-hop graph traversal (3+ steps)
- Impact analysis ("what breaks if we change X?")
- Cluster detection (tightly coupled code groups)
- Dependency chain analysis
- Sub-agent spawning for parallel queries

## When Invoked

The Voice Conversationalist escalates to the Graph Reasoner for:
- Questions requiring 3+ sequential Cypher queries
- "What's the impact of..." / "what if..." questions
- "Who should..." / "compare..." / "prioritize..." questions
- Cross-referencing contributor + knowledge dimensions
- Architecture-level analysis

Agent 1 speaks buffer words ("Let me analyze that...") at ~1.5s, then waits for Agent 3's response (5-15s total).

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

## Sub-Agent Spawning

When Agent 3 needs to assess multiple nodes (e.g., "What does Jeff need to catch up on?" returns 12 candidates), it spawns DevStral Small 2 sub-agents to explore each in parallel:

```
Agent 3 (DevStral 2) — ORCHESTRATOR
  │
  │  Step 1: Cypher → finds candidate nodes
  │  Step 2: Spawn sub-agents (5-10 concurrent)
  │
  ├──→ Sub-agent A (Small 2): read node L1, check recent changes, assess urgency
  ├──→ Sub-agent B (Small 2): same for next node
  └──→ ... (up to 10 concurrent)

  Step 3: Collect results → rank by priority → synthesize narrative
```

Each sub-agent is a single Mistral API call with a focused prompt returning structured JSON. This pattern enables the agent to go from L1 summaries (broad context) to L2/L3 detail (deep dive) only for nodes that matter.

Hackathon minimum: sequential multi-query. Stretch: parallel sub-agents with result merging.
