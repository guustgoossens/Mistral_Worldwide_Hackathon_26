# Agent Infrastructure — Complete Architecture Reference

**Project:** Voice-Driven Codebase Intelligence Platform  
**Hackathon:** Mistral Worldwide Hackathon, Paris, Feb 28 – Mar 1, 2026

---

## Table of Contents

1. [Agent Overview](#1-agent-overview)
2. [Model Selection Map](#2-model-selection-map)
3. [Agent 1: Voice Conversationalist](#3-agent-1-voice-conversationalist)
4. [Agent 2: Interviewer / Quiz Master](#4-agent-2-interviewer--quiz-master)
5. [Agent 3: Graph Reasoner (Orchestrator)](#5-agent-3-graph-reasoner-orchestrator)
6. [Agent 4: Background Enricher](#6-agent-4-background-enricher)
7. [Interaction Patterns](#7-interaction-patterns)
8. [The Parallel Truth-Finding Pattern](#8-the-parallel-truth-finding-pattern)
9. [Sub-Agent Spawning Architecture](#9-sub-agent-spawning-architecture)
10. [KuzuDB Tool Surface](#10-kuzudb-tool-surface)
11. [ElevenLabs Integration Layer](#11-elevenlabs-integration-layer)
12. [Question Types the System Can Answer](#12-question-types-the-system-can-answer)
13. [Schema Extensibility](#13-schema-extensibility)
14. [Hackathon Scoping — What to Build When](#14-hackathon-scoping--what-to-build-when)

---

## 1. Agent Overview

Four distinct agent roles sharing the same KuzuDB graph. They differ in purpose, model, latency budget, and when they run.

```
┌─────────────────────────────────────────────────────────────────┐
│                        KuzuDB (WASM)                            │
│              Source of truth for all agents                      │
│   Code nodes (File, Function, Class) with summary + relevance   │
│   + Person nodes (query infrastructure, invisible by default)   │
│   + CONTRIBUTED edges (git log + git blame, L1 per contributor) │
│   + UNDERSTANDS edges (voice interviews, L1 per understander,   │
│     needsRetest flag) + DISCUSSED audit log                     │
└──────────┬──────────────┬──────────────┬──────────────┬─────────┘
           │              │              │              │
     ┌─────▼─────┐  ┌────▼─────┐  ┌────▼──────┐  ┌───▼──────┐
     │  Agent 1   │  │ Agent 2  │  │  Agent 3   │  │ Agent 4  │
     │  Voice     │  │ Quiz     │  │  Graph     │  │ Background│
     │  Converse  │  │ Master   │  │  Reasoner  │  │ Enricher │
     │            │  │          │  │            │  │          │
     │ Small 2    │  │ Small 2  │  │ DevStral 2 │  │ DevStral 2│
     │ 200 t/s    │  │ 200 t/s  │  │ 76 t/s     │  │ 76 t/s   │
     │ Real-time  │  │ Real-time│  │ On-demand  │  │ Async    │
     │ <2s        │  │ <2s      │  │ 5-15s      │  │ Unlimited│
     └────────────┘  └──────────┘  └────────────┘  └──────────┘
           │              │              │
           └──────────────┴──────┬───────┘
                                 │
                    ┌────────────▼────────────┐
                    │   ElevenLabs Platform   │
                    │   Conversational AI     │
                    │   (STT + TTS +          │
                    │    turn-taking +        │
                    │    client tools)        │
                    └────────────────────────┘
```

Key principle: **the fast model talks, the big model thinks.** The user only ever waits for DevStral Small 2. DevStral 2 runs either in the background or behind buffer words.

---

## 2. Model Selection Map

### Available Mistral Models

| Model | Params | Speed | TTFT | Context | Best For |
|---|---|---|---|---|---|
| DevStral 2 | 123B | 76 t/s | 0.39s | 256K | Deep code understanding, multi-step reasoning, synthesis |
| DevStral Small 2 | 24B | 200 t/s | 0.37s | 256K | Voice responses, quiz generation, evaluation, fast tool calling |
| Voxtral Mini 4B Realtime | 4B | Real-time | <500ms | N/A | Speech-to-text (streaming transcription) |

Both DevStral models are currently **free** on Mistral's API. Use them aggressively.

### Model Assignment Per Task

| Task | Model | Rationale |
|---|---|---|
| Voice conversation responses | Small 2 | Must be <2s total latency |
| Quiz question generation | Small 2 | Simple pattern, speed matters |
| Quiz answer evaluation | Small 2 | But evaluates AGAINST DevStral 2's pre-fetched truth |
| Speaking feedback to user | Small 2 | Narrates content the big model pre-generated |
| Complex multi-step graph reasoning | DevStral 2 | Needs deep understanding for "who should fix this?" type questions |
| Code summarization (Level 2-3) | DevStral 2 | Quality matters more than speed |
| Quiz bank pre-generation | DevStral 2 | Background, no latency constraint |
| Batch node summaries | Small 2 sub-agents | Parallelizable, good enough quality |
| Ground truth packet building | DevStral 2 | Runs in parallel while user speaks |
| Speech-to-text input | Voxtral Mini 4B | Streaming, <500ms, 13 languages |
| Tool call decisions | Small 2 | Good at function calling, fast |
| Architectural pattern detection | DevStral 2 | Background enrichment |

### The Critical Rule

> **Never route voice through DevStral 2 directly.** The extra 2-3 seconds would break the conversational feel. DevStral 2 only runs behind buffer words ("Let me analyze that...") or fully in the background.

---

## 3. Agent 1: Voice Conversationalist

**Model:** DevStral Small 2 (24B, 200 t/s)  
**When:** Real-time, during all voice interactions  
**Latency budget:** <2 seconds end-to-end  
**Lives inside:** ElevenLabs Conversational AI pipeline as the custom LLM

### What It Does

This is the agent the user talks to. It handles straightforward questions by writing Cypher queries against KuzuDB and narrating the results.

### Example Interactions

| User Says | Agent Does |
|---|---|
| "What does this function do?" | Queries node's Level 1 summary, speaks it |
| "Who built this?" | Queries contributor metadata, speaks answer |
| "Show me the blast radius of changing UserService" | Multi-hop Cypher query → returns node IDs to client tool → 3D graph highlights → narrates findings |
| "How many functions are in the auth module?" | Simple aggregation query, speaks result |
| "Show me Alice's contributions" | Calls `switch_view_mode('contributor', 'alice')` → graph recolors to show Alice's footprint |
| "Show me the team" | Calls `show_people_view()` → Person nodes appear, connected to their code |
| "Where are the knowledge gaps?" | Calls `switch_view_mode('knowledge')` → red nodes = gaps, narrates biggest risks |

### Tools Available

```typescript
// Client tools (run in browser, update visualization)
clientTools: {
  queryGraph: async ({ cypher }) => { /* run Cypher, return results */ },
  highlightNodes: async ({ nodeIds, color }) => { /* update 3D graph */ },
  flyToNode: async ({ nodeId }) => { /* camera animation */ },
  showDetailPanel: async ({ nodeId, level }) => { /* show text panel */ },
  switchViewMode: async ({ mode, filterPerson }) => { /* switch overlay */ },
  showPeopleView: async () => { /* Person nodes become visible */ },
}
```

### Handoff to Agent 3

When the question requires multi-step reasoning (cross-referencing dimensions, aggregating across people, comparative analysis), Agent 1 recognizes this and:

1. Speaks buffer words: "Let me analyze that for you..."
2. Forwards the question to Agent 3 (DevStral 2) via direct API call
3. Waits for Agent 3's response
4. Speaks a concise summary of the findings
5. Full analysis appears in a text panel on screen

### System Prompt Guidance

Agent 1's system prompt includes rules for when to handle directly vs. when to escalate:

- **Handle directly:** Single-node queries, simple filters, "what is X", "who wrote X", "show me X", view mode switches ("show me contributions", "show me the team", "show me knowledge gaps")
- **Escalate to Agent 3:** Questions involving "should", "compare", "what if", "who is best for", aggregations across multiple people, time-based analysis, prioritization

---

## 4. Agent 2: Interviewer / Quiz Master

**Model:** DevStral Small 2 (24B, 200 t/s)  
**When:** Real-time, during quiz/interview mode  
**Latency budget:** <2 seconds per interaction turn  
**Implementation:** A mode of Agent 1 (same voice pipeline, different system prompt + state)

### When It Activates

- User says "quiz me" or "test my knowledge"
- User taps the "I'm waiting" button (V1 — signals inference idle time manually)
- V2: silence detected on mic for ~5 seconds (stretch goal)
- V3: system proactively initiates — the end goal (post-hackathon)
- User is walking and wants hands-free learning
- Spaced repetition trigger: a previously-assessed node has `needsRetest = true` (new commits since last interview)

### The Full Quiz Loop (with Parallel Truth-Finding)

```
┌─ STEP 1: Select node ─────────────────────────────────┐
│  Cypher: MATCH (f:Function)                            │
│  WHERE NOT EXISTS {                                    │
│    MATCH (p:Person {name: $user})-[:UNDERSTANDS]->(f)  │
│  }                                                     │
│  OR (p)-[k:UNDERSTANDS]->(f) WHERE k.confidence='none' │
│  RETURN f ORDER BY f.structuralImportance DESC LIMIT 5 │
│  → Picks node with lowest knowledge + highest importance│
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 2: Generate question (Small 2, ~300ms) ─────────┐
│  Uses node's Level 1 summary + name + context          │
│  "What happens in handleAuth when the token expires?"  │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 3: Speak question (ElevenLabs TTS, ~400ms) ─────┐
│  Question is spoken to the user                        │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 4: PARALLEL EXECUTION ──────────────────────────┐
│                                                        │
│  ┌─ 4a: Listen to user ──────────┐                    │
│  │  User thinks and speaks       │                    │
│  │  (5-15 seconds)               │                    │
│  └───────────────────────────────┘                    │
│                                                        │
│  ┌─ 4b: Launch DevStral 2 ──────┐  (SIMULTANEOUSLY)  │
│  │  Build GroundTruth packet     │                    │
│  │  (~3-5 seconds)               │                    │
│  │                               │                    │
│  │  Fetches:                     │                    │
│  │  • Level 2 + Level 3 detail   │                    │
│  │  • Recent commits/changes     │                    │
│  │  • Past team interview notes  │                    │
│  │  • Common wrong answers       │                    │
│  │  • Related concepts           │                    │
│  │                               │                    │
│  │  Result cached, waiting       │                    │
│  └───────────────────────────────┘                    │
│                                                        │
│  DevStral 2 finishes well before user stops talking    │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 5: Evaluate answer (Small 2, ~500ms) ───────────┐
│  Compares user's answer AGAINST the GroundTruth packet │
│  Much richer evaluation than Level 1 alone             │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 6: Speak feedback (ElevenLabs TTS) ─────────────┐
│  Rich, contextual, teaching-moment feedback:           │
│                                                        │
│  Correct: "That's right, and here's a nuance —        │
│   Alice refactored the token refresh last month to     │
│   handle concurrent sessions. Good to know."           │
│                                                        │
│  Wrong: "Not quite — handleAuth actually delegates     │
│   to a separate middleware now. Carol mentioned in      │
│   her interview that the new version..."               │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 7: Update KuzuDB ──────────────────────────────┐
│                                                        │
│  Knowledge update:                                     │
│  MERGE (p:Person {name: $user})                        │
│    -[k:UNDERSTANDS]->(f:Function {id: $nodeId})        │
│  SET k.confidence = $newConfidence,                    │
│      k.lastAssessed = $now,                            │
│      k.topics = k.topics + $newTopics                  │
│                                                        │
│  Transcript log:                                       │
│  CREATE (:Discussion {                                 │
│    person: $user, nodeId: $nodeId,                     │
│    timestamp: $now, transcript: $userAnswer,           │
│    quizResult: 'correct'/'incorrect',                  │
│    confidenceBefore: $before,                          │
│    confidenceAfter: $after                             │
│  })                                                    │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 8: Update 3D graph visualization ───────────────┐
│  Client tool call:                                     │
│  • Node color changes (red → yellow → green)           │
│  • Knowledge score overlay updates                     │
│  • Optional: camera flies to the node                  │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌─ STEP 9: Select next node ────────────────────────────┐
│  Informed by what the user just got wrong:             │
│  • If wrong on auth → pick another auth-related node   │
│  • If right → move to a different cluster              │
│  • Spaced repetition: revisit weak nodes after delay   │
│                                                        │
│  → Loop back to Step 1                                 │
└────────────────────────────────────────────────────────┘
```

### The GroundTruth Packet (Built by DevStral 2 During Step 4b)

```typescript
interface GroundTruth {
  // What the function actually does (Level 2-3 detail from KuzuDB)
  technicalTruth: string;
  
  // Recent changes the user might not know about
  recentChanges: {
    author: string;
    date: string;
    description: string;
  }[];
  
  // What other team members said in past voice interviews
  teamContext: {
    person: string;
    insight: string;
    date: string;
  }[];
  
  // Common wrong answers from past quizzes on this node
  commonMistakes: string[];
  
  // Related nodes the user should also understand
  relatedConcepts: {
    nodeId: string;
    name: string;
    why: string;
  }[];
  
  // Key technical nuances that distinguish deep vs surface understanding
  nuances: string[];
}
```

### Why Parallel Truth-Finding Matters

Without it, you have two bad options:

| Approach | Pros | Cons |
|---|---|---|
| Evaluate against Level 1 only (Small 2) | Instant feedback | Generic, shallow — "correct" or "incorrect" with no nuance |
| Call DevStral 2 AFTER user finishes | Rich, contextual feedback | 5-8 seconds of awkward silence before any response |

With parallel truth-finding: DevStral 2 quality feedback delivered at Small 2 speed. The latency is hidden behind the user's own thinking/speaking time. The user never knows the big model was working — they just experience surprisingly insightful feedback with zero wait.

---

## 5. Agent 3: Graph Reasoner (Orchestrator)

**Model:** DevStral 2 (123B, 76 t/s)  
**When:** On-demand, when Agent 1 escalates complex questions  
**Latency budget:** 5-15 seconds (user hears buffer words at ~1.5s)  
**Can spawn:** DevStral Small 2 sub-agents for parallel node exploration

### What It Handles

Questions that require multi-step reasoning, cross-referencing metadata dimensions, aggregating across people, or making recommendations.

### Example Questions and Reasoning Chains

**"What is Jeff currently doing?"**
```
Step 1: Query recent DISCUSSED relationships for Jeff
  → Cypher: MATCH (p:Person {name:'jeff'})-[d:DISCUSSED]->(f)
            ORDER BY d.timestamp DESC LIMIT 10
            RETURN f.name, d.timestamp, d.transcript

Step 2: Query recent commits by Jeff
  → Cypher: MATCH (p:Person {name:'jeff'})-[c:CONTRIBUTED]->(f)
            WHERE c.lastTouch > $thirtyDaysAgo
            RETURN f.name, c.lastTouch, c.linesChanged

Step 3: Synthesize into narrative
  → "Jeff has been focusing on the payment gateway integration.
     His last 3 quiz sessions covered the stripe webhook handler
     and the retry logic. He committed changes to 4 files in the
     payments module this week."
```

**"What does Jeff need to catch up on?"**
```
Step 1: Find all nodes Jeff hasn't been assessed on
  → Cypher: MATCH (f:Function)
            WHERE NOT EXISTS {
              MATCH (:Person {name:'jeff'})-[:UNDERSTANDS]->(f)
            }
            RETURN f

Step 2: Filter to structurally important ones
  → Cypher: ... WHERE size((f)<-[:CALLS]-()) > 3
            RETURN f ORDER BY size((f)<-[:CALLS]-()) DESC

Step 3: Spawn sub-agents (Small 2) for top 10 nodes
  → Each sub-agent: read Level 2, check recent changes,
    assess urgency relative to Jeff's work area
  → Return: { nodeId, priority, reason }

Step 4: Collect and rank by priority

Step 5: Synthesize
  → "Jeff needs to catch up on 5 critical areas:
     1. Auth refactor Alice did last month (high — he maintains downstream)
     2. New payment retry logic (medium — touches his API layer)
     3. Rate limiting middleware (medium — he got this wrong in last quiz)
     ..."
```

**"Who should fix this bug in the payment module?"**
```
Step 1: Get blast radius of the bug location
  → Cypher: MATCH (f:Function {name: $bugLocation})-[:CALLS*1..3]->(dep)
            RETURN collect(dep.id) as affectedNodes

Step 2: Find contributors to affected nodes
  → Cypher: MATCH (p:Person)-[c:CONTRIBUTED]->(f)
            WHERE f.id IN $affectedNodes
            RETURN p.name, sum(c.commits), max(c.lastTouch)

Step 3: Cross-reference with knowledge scores
  → Cypher: MATCH (p:Person)-[k:UNDERSTANDS]->(f)
            WHERE f.id IN $affectedNodes
            RETURN p.name, avg(CASE k.confidence
              WHEN 'deep' THEN 1.0
              WHEN 'surface' THEN 0.5
              ELSE 0.0 END) as avgKnowledge

Step 4: Rank by (contributor_score * 0.4 + knowledge_score * 0.4 + recency * 0.2)

Step 5: Recommend
  → "Alice is your best bet — she contributed 60% of the payment module
     and has deep knowledge from 3 quiz sessions. Bob has more recent
     commits but only surface understanding."
```

**"If Alice leaves, what knowledge do we lose?"**
```
Step 1: Find nodes where Alice is the ONLY person with deep understanding
  → Cypher: MATCH (alice:Person {name:'alice'})-[k:UNDERSTANDS]->(f)
            WHERE k.confidence = 'deep'
            AND NOT EXISTS {
              MATCH (other:Person)-[k2:UNDERSTANDS]->(f)
              WHERE other.name <> 'alice' AND k2.confidence = 'deep'
            }
            RETURN f ORDER BY f.structuralImportance DESC

Step 2: Assess structural impact of each orphaned node

Step 3: Generate risk report
  → "Critical risk: Alice is the sole deep expert on 12 functions,
     including the entire auth middleware chain. If she leaves,
     the auth module becomes a black box. Recommend: quiz Bob and
     Carol on these 12 functions immediately."
```

### Escalation Detection (Agent 1's System Prompt Rules)

Agent 1 decides when to escalate based on keyword/pattern matching:

| Trigger Pattern | Escalate? |
|---|---|
| "what is X", "show me X", "who wrote X" | No — handle directly |
| "who should...", "who is best for..." | Yes — needs cross-referencing |
| "compare...", "how does X differ from Y" | Yes — needs aggregation |
| "what if...", "if we change..." | Yes — needs blast radius + reasoning |
| "what does [person] need to...", "where are our gaps" | Yes — needs multi-step |
| "prioritize...", "rank...", "what's most important" | Yes — needs judgment |

---

## 6. Agent 4: Background Enricher

**Model:** DevStral 2 (123B, 76 t/s) as orchestrator  
**Sub-agents:** DevStral Small 2 (24B, 200 t/s) for batch processing  
**When:** Asynchronous, at repo load time and periodically  
**Latency budget:** Unlimited — runs in background

### What It Pre-Computes

Everything the other agents need to be fast.

```
REPO LOADED → Tree-sitter parses → graph structure in KuzuDB
  │
  ▼
┌─ PHASE 1: Node Summaries + Relevance ─────────────────┐
│                                                        │
│  Orchestrator (DevStral 2):                            │
│    1. Compute relevance per node from graph structure: │
│       relevance = normalize(in_degree + out_degree)    │
│       → written to node.relevance (0.0–1.0)            │
│    2. Order nodes by relevance DESC (most critical     │
│       get summarized first)                            │
│    3. Group into clusters of 10-15                     │
│    4. For each cluster, spawn Small 2 sub-agent:       │
│       → Generate node.summary (~50 tokens): what the   │
│         function does (node-level, static, one-time)   │
│    5. Write summaries + relevance to KuzuDB            │
│                                                        │
│  Note: per-person L1 summaries (contributor L1,        │
│  understander L1) are generated separately:            │
│    • Contributor L1s → generated here from git data    │
│      (one per CONTRIBUTED edge, from commits + blame)  │
│    • Understander L1s → generated after each interview │
│      (one per UNDERSTANDS edge, from session results)  │
│                                                        │
│  User sees: nodes gaining color as summaries complete  │
└────────────────────────────────────────────────────────┘
  │
  ▼
┌─ PHASE 2: Contributor L1 Summaries ───────────────────┐
│                                                        │
│  For each CONTRIBUTED edge (Person → Node):            │
│    Small 2 sub-agent reads commits_json + ownershipPct │
│    → generates summary_l1 for that edge:               │
│    "Alice: 14 commits, owns 73% of current lines,      │
│     last Jan 2026, mostly rate limiting + edge cases"  │
│    → written to CONTRIBUTED.summary_l1 in KuzuDB       │
│                                                        │
│  Total: #contributors × #nodes they contributed to     │
└────────────────────────────────────────────────────────┘
  │
  ▼
┌─ PHASE 3: Quiz Bank Generation ───────────────────────┐
│                                                        │
│  For each summarized node (ordered by relevance):      │
│    DevStral 2 generates 3-5 quiz questions             │
│    with expected answers and difficulty levels          │
│    Stored as node properties in KuzuDB                 │
│                                                        │
│  Quiz agent uses pre-generated questions for fast      │
│  startup. Can also generate dynamically if node        │
│  has no pre-computed questions yet (fallback).         │
└────────────────────────────────────────────────────────┘
  │
  ▼
┌─ PHASE 4: Cluster Analysis ───────────────────────────┐
│                                                        │
│  DevStral 2 identifies functional clusters:            │
│    "The auth module consists of these 8 functions..."  │
│    "The payment system has 3 entry points..."          │
│                                                        │
│  Stored as cluster-level summaries in KuzuDB           │
└────────────────────────────────────────────────────────┘
  │
  ▼
┌─ PHASE 5: Risk Analysis ──────────────────────────────┐
│                                                        │
│  Cross-reference contributor data with structural      │
│  importance:                                           │
│    • Bus factor risks (single contributor on critical  │
│      nodes)                                            │
│    • Knowledge orphans (no one assessed on critical    │
│      code)                                             │
│    • Stale areas (no commits in 6+ months on active    │
│      code)                                             │
│                                                        │
│  Pre-computed so Agent 3 can answer risk questions     │
│  instantly                                             │
└────────────────────────────────────────────────────────┘
```

### Enrichment Timeline (Estimated)

| Repo Size | P1: Summaries + Relevance | P2: Contributor L1s | P3: Quiz Bank | P4: Clusters | P5: Risk | Total |
|---|---|---|---|---|---|---|
| Small (50 functions) | ~15s | ~10s | ~20s | ~10s | ~5s | ~60s |
| Medium (200 functions) | ~45s | ~30s | ~60s | ~20s | ~10s | ~3 min |
| Large (500+ functions) | ~2 min | ~1 min | ~3 min | ~30s | ~15s | ~7 min |

User sees progress: a loading bar or nodes gaining color/detail as enrichment completes. The 3D graph is interactive from the moment Tree-sitter finishes parsing — enrichment adds depth progressively.

---

## 7. Interaction Patterns

### Pattern 1: Simple Voice Query (no sub-agents)

```
User speaks
  → ElevenLabs STT (~300-500ms)
  → Agent 1 / Small 2 (~370ms TTFT + ~250ms generation)
  → Writes Cypher → KuzuDB returns data (~5ms)
  → Client tool highlights nodes in 3D graph (~10ms)
  → ElevenLabs TTS (~200-400ms)
  → User hears answer

TOTAL: ~1.2-1.6 seconds
```

### Pattern 2: Voice Query with Tool Call

```
User speaks
  → ElevenLabs STT
  → Agent 1 decides to call a tool
  → Tool call parsing (~10ms)
  → Client tool executes in browser (graph query + viz update) (~15ms)
  → Result returns to Agent 1 via ElevenLabs
  → Agent 1 generates response with tool result
  → ElevenLabs TTS

TOTAL: ~1.8-2.5 seconds
```

### Pattern 3: Quiz Cycle (with parallel truth-finding)

```
Agent 2 selects node → generates question → TTS speaks it
  │
  ├── User thinks + speaks (5-15 seconds)
  │
  └── DevStral 2 builds GroundTruth packet (3-5 seconds, parallel)
  
  → User finishes → evaluate against GroundTruth (Small 2, ~500ms)
  → Speak rich feedback (instant — truth already cached)
  → Update KuzuDB + 3D graph
  → Select next node

EACH CYCLE: ~15-25 seconds (mostly user thinking/speaking time)
SYSTEM LATENCY PER CYCLE: ~2-3 seconds (hidden behind user time)
```

### Pattern 4: Complex Question (orchestrator + sub-agents)

```
User speaks
  → Agent 1 recognizes complex question
  → Speaks: "Let me analyze that..." (buffer words, ~1.5s)
  → Forwards to Agent 3 (DevStral 2)
  → Agent 3 writes Cypher query #1 → gets candidate nodes
  → Agent 3 writes Cypher query #2 → refines
  → (Optional) Spawns 5-10 Small 2 sub-agents in parallel
  → Sub-agents return assessments (~2-3 seconds)
  → Agent 3 synthesizes findings (~3-5 seconds)
  → Returns to Agent 1
  → Agent 1 speaks concise summary
  → Full analysis in text panel on screen

TOTAL: ~8-15 seconds
USER EXPERIENCE: hears buffer words at 1.5s, then answer at 8-15s
```

### Pattern 5: Background Enrichment (no user interaction)

```
Repo loaded → Tree-sitter parses → graph exists
  → Agent 4 plans enrichment
  → Spawns Small 2 sub-agents for batch summaries (parallel)
  → Collects results → writes to KuzuDB
  → Repeat for clusters, quiz banks, risk analysis

TOTAL: 30-120 seconds depending on repo size
USER SEES: progress indicator, nodes gaining color/detail progressively
```

---

## 8. The Parallel Truth-Finding Pattern

This is the most architecturally novel pattern in the system. It exploits the fact that **human speaking time is free compute time.**

### The Insight

When the quiz agent asks a question, there's 5-15 seconds of dead system time while the user thinks and speaks. DevStral 2 needs only 3-5 seconds to build a comprehensive ground truth packet. So you launch it the moment the question is asked, and it finishes well before the user stops talking.

### Timing Diagram

```
Time:  0s    1s    2s    3s    4s    5s    6s    7s    8s    9s   10s
       │     │     │     │     │     │     │     │     │     │     │
Agent: [ask question]                                              
       [──TTS──]                                                   
                                                                   
User:        [──────── thinking and speaking ──────────────────]   
                                                                   
DevStral 2:  [── building GroundTruth ──]                          
                                   ▲                               
                                   │                               
                              DONE (3-5s)                          
                              cached, waiting                      
                                                                   
                                                            [eval]  
                                                            [speak] 
                                                              ▲     
                                                              │     
                                                    Instant, rich   
                                                    feedback using  
                                                    cached truth    
```

### What Gets Pre-Fetched

The GroundTruth packet includes six dimensions of context, far richer than what Small 2 could generate alone:

1. **Technical truth** — Level 2-3 detail from KuzuDB about what the code actually does
2. **Recent changes** — commits in the last 30-90 days that might surprise the user
3. **Team context** — what other team members said about this node in past interviews (from DISCUSSED relationships)
4. **Common mistakes** — patterns from past wrong answers on this node (from quiz history)
5. **Related concepts** — adjacent nodes the user should also understand (from CALLS/IMPORTS edges)
6. **Nuances** — key technical details that separate deep from surface understanding

### Why This Is a Great Pitch Moment

> "The system is so efficient that while you're answering a question, it's already researching the complete truth about that code — pulling recent changes, checking what your teammates said about it, and identifying the exact nuances that matter. So feedback is both instant and deeply informed."

This demonstrates architectural sophistication (parallel execution, two-speed models, latency hiding) in a way anyone can understand.

---

## 9. Sub-Agent Spawning Architecture

### When Sub-Agents Are Used

Sub-agents appear in two contexts:

**Context A: Agent 3 (Graph Reasoner) exploring multiple nodes**

When Agent 3 needs to assess multiple nodes (e.g., "What does Jeff need to catch up on?" returns 12 candidate nodes), it spawns Small 2 sub-agents to explore each one in parallel.

```
Agent 3 (DevStral 2) — ORCHESTRATOR
  │
  │  Query: "What does Jeff need to learn?"
  │  Step 1: Cypher → finds 12 unassessed critical nodes
  │  Step 2: Spawn sub-agents
  │
  ├──→ Sub-agent A (Small 2): explore node "handleAuth"
  │    → read Level 2, check recent changes, assess urgency
  │    → return { priority: "high", reason: "Jeff maintains downstream" }
  │
  ├──→ Sub-agent B (Small 2): explore node "processPayment"
  │    → read Level 2, check recent changes, assess urgency
  │    → return { priority: "medium", reason: "touches his API layer" }
  │
  ├──→ Sub-agent C (Small 2): explore node "validateToken"
  │    ...
  │
  └──→ ... (up to 10 concurrent)
  
  Step 3: Collect all results
  Step 4: Rank by priority
  Step 5: Synthesize narrative response
```

**Context B: Agent 4 (Background Enricher) batch processing**

When enriching a large repo, Agent 4 spawns Small 2 sub-agents for Level 1 summaries and quiz generation across clusters.

```
Agent 4 (DevStral 2) — ORCHESTRATOR
  │
  │  Repo has 200 functions in 8 clusters
  │
  ├──→ Sub-agent 1 (Small 2): summarize cluster "auth" (25 nodes)
  ├──→ Sub-agent 2 (Small 2): summarize cluster "payments" (30 nodes)
  ├──→ Sub-agent 3 (Small 2): summarize cluster "api" (35 nodes)
  └──→ ... (all 8 clusters in parallel)
  
  → Collect results
  → DevStral 2 generates cluster-level summaries from the node summaries
  → Write everything to KuzuDB
```

### Sub-Agent Implementation Pattern

Each sub-agent is a single Mistral API call with a focused prompt:

```typescript
async function spawnSubAgent(task: {
  nodeId: string;
  context: string;    // Level 2 summary + recent changes
  question: string;   // "Assess urgency for Jeff"
}): Promise<SubAgentResult> {
  const response = await mistral.chat({
    model: 'devstral-small-2505',
    messages: [{
      role: 'system',
      content: `You are a focused analysis agent. Given a code node's context,
                assess it and return a structured JSON response.`
    }, {
      role: 'user',
      content: `Node: ${task.nodeId}\nContext: ${task.context}\nTask: ${task.question}`
    }],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

// Parallel execution
const results = await Promise.all(
  candidateNodes.map(node => spawnSubAgent({
    nodeId: node.id,
    context: node.summary_l2 + node.recentChanges,
    question: `How urgent is it for Jeff to learn about this?
               Consider: his work area, recent changes, structural importance.
               Return: { priority: "high"|"medium"|"low", reason: string }`
  }))
);
```

### Concurrency Limits

- **Agent 3 sub-agents:** 5-10 concurrent (on-demand, user is waiting)
- **Agent 4 sub-agents:** 5-10 concurrent (background, no rush)
- **Mistral API rate limits:** Both models are free — monitor for throttling, back off if needed
- **Total parallel calls:** Cap at ~15 concurrent to avoid rate limiting

---

## 10. KuzuDB Tool Surface

> **Note:** This section contains early design notes. See [`docs/skills/cypher-skill.md`](../skills/cypher-skill.md) for the canonical, implementation-accurate schema and tool surface.

### Graph Schema

KuzuDB stores both code nodes AND Person nodes. Person nodes are **query infrastructure** — they exist so agents can write clean Cypher relationship traversals, but they're invisible in the default 3D visualization. The visualization is modal (see View Modes below).

```cypher
-- Code nodes (visible in all view modes)
CREATE NODE TABLE File(id STRING, name STRING, filePath STRING, PRIMARY KEY(id))
CREATE NODE TABLE Function(id STRING, name STRING, filePath STRING,
                           summary_l1 STRING, summary_l2 STRING, summary_l3 STRING,
                           structuralImportance FLOAT, PRIMARY KEY(id))
CREATE NODE TABLE Class(id STRING, name STRING, filePath STRING, PRIMARY KEY(id))

-- Person nodes (query infrastructure, visible only in People overlay)
CREATE NODE TABLE Person(id STRING, name STRING, email STRING, PRIMARY KEY(id))

-- Structural edges (from Tree-sitter)
CREATE REL TABLE CONTAINS(FROM File TO Function)
CREATE REL TABLE CALLS(FROM Function TO Function)
CREATE REL TABLE IMPORTS(FROM File TO File)

-- Contributor edges (from git log)
CREATE REL TABLE CONTRIBUTED(FROM Person TO Function,
                             commits INT64, lastTouch STRING, linesChanged INT64)

-- Knowledge edges (from voice interviews/quizzes)
CREATE REL TABLE UNDERSTANDS(FROM Person TO Function,
                             confidence STRING, source STRING, topics STRING[],
                             lastAssessed STRING)

-- Voice interaction log
CREATE REL TABLE DISCUSSED(FROM Person TO Function,
                           timestamp STRING, transcript STRING,
                           quizResult STRING, confidenceBefore STRING,
                           confidenceAfter STRING)
```

### Visualization View Modes

The 3D graph display is **modal**. Same KuzuDB data underneath, different rendering based on current mode.

| Mode | Shows | Edges | Coloring | Purpose |
|---|---|---|---|---|
| **Code Structure** (default) | File, Function, Class nodes only | CALLS, IMPORTS, CONTAINS | By node type (function=blue, file=gray, class=purple) | Understand the architecture |
| **Contributor Overlay** | Same code nodes, no Person nodes | Same structural edges | Brightness/size by commit activity. Filter by person to see their footprint. | See who built what, find stale code |
| **Knowledge Overlay** | Same code nodes, no Person nodes | Same structural edges | Green=deep understanding, Yellow=surface, Red=gap. Filter by person for individual map. | Find knowledge gaps, prioritize learning |
| **People Overlay** | Code nodes AND Person nodes | All edges including CONTRIBUTED + UNDERSTANDS | People cluster around their code areas | See team topology, silos, overlap |

**Key Cypher queries per mode:**
```cypher
-- Code Structure (default): only code nodes
MATCH (n) WHERE labels(n) <> 'Person' RETURN n

-- Contributor Overlay (filter by person)
MATCH (p:Person {name: $person})-[c:CONTRIBUTED]->(f)
RETURN f.id, c.commits, c.lastTouch, c.linesChanged

-- Knowledge Overlay (filter by person)
MATCH (p:Person {name: $person})-[k:UNDERSTANDS]->(f)
RETURN f.id, k.confidence, k.topics

-- People Overlay (everything visible)
MATCH (n) RETURN n.id, labels(n), n.name
-- + all relationship types
```

The voice agent can switch modes via client tools (e.g., "Show me Alice's contributions" triggers `switch_view_mode('contributor', 'alice')`).

### Agent Tool Definitions

With KuzuDB, the agent tool surface is powerful but simple — fewer tools, more flexibility.

| Tool | Description | Used By |
|---|---|---|
| `query_graph(cypher)` | Run any Cypher query — agent composes what it needs | Agent 1, 2, 3 |
| `update_knowledge(person, nodeId, confidence, topics)` | Update UNDERSTANDS relationship after quiz | Agent 2 |
| `log_discussion(person, nodeId, transcript, quizResult)` | Store voice interaction in DISCUSSED relationship | Agent 2 |
| `get_node_detail(nodeId, level, dimension)` | Progressive disclosure — fetch L1/L2/L3 of a dimension | Agent 1, 2, 3 |
| `switch_view_mode(mode, filterPerson?)` | Switch 3D visualization overlay mode | Agent 1, 2 |
| `highlight_nodes(nodeIds, color)` | Highlight specific nodes in current view | Agent 1, 3 |
| `write_enrichment(nodeId, summaries, quizBank)` | Store Agent 4's pre-computed data | Agent 4 |
| `get_enrichment_status()` | Check what's been enriched vs. pending | Agent 4 |

### The Key Advantage Over JSON

With JSON, you'd need 10-15 specialized functions to cover the same query space. With `query_graph(cypher)`, the agent writes what it needs:

```cypher
-- "Who contributed to functions that call the payment service
--  but hasn't been quizzed on them?"
MATCH (f:Function)-[:CALLS*1..3]->(p:Function {name: 'paymentService'})
MATCH (person:Person)-[:CONTRIBUTED]->(f)
WHERE NOT EXISTS {
  MATCH (person)-[:UNDERSTANDS]->(f)
}
RETURN DISTINCT person.name, collect(f.name)
```

One tool call. Dynamic composition. No pre-defined function needed.

---

## 11. ElevenLabs Integration Layer

> **Note:** This section contains early design notes. See [`docs/skills/cypher-skill.md`](../skills/cypher-skill.md) for the canonical, implementation-accurate schema and tool surface.

### How Agents Connect to Voice

```
┌─────────────────────────────────────────┐
│          ElevenLabs Cloud               │
│                                         │
│  ┌──────────┐  ┌──────┐  ┌──────────┐ │
│  │   STT    │→ │ LLM  │→ │   TTS    │ │
│  │(or Voxtral│  │proxy │  │          │ │
│  │ via API)  │  │      │  │          │ │
│  └──────────┘  └──┬───┘  └──────────┘ │
│                    │                    │
└────────────────────┼────────────────────┘
                     │
          Custom LLM endpoint
          (OpenAI-compatible)
                     │
          ┌──────────▼──────────┐
          │   Express Proxy     │
          │   (localhost:3001)  │
          │   exposed via ngrok │
          │                     │
          │   Routes to:        │
          │   • Small 2 (voice) │
          │   • DevStral 2      │
          │     (when Agent 1   │
          │      escalates)     │
          └─────────────────────┘
```

### Client Tools (Browser-Side)

These are JavaScript functions the voice agent can invoke in the browser. They're the bridge between voice and visualization.

```typescript
const conversation = await Conversation.startSession({
  agentId: ELEVENLABS_AGENT_ID,
  clientTools: {
    // Graph queries
    query_dependencies: async ({ functionName }) => {
      const result = await kuzuConn.execute(
        `MATCH (f:Function {name: $fn})-[:CALLS]->(dep)
         RETURN dep.name, dep.id`, { fn: functionName }
      );
      highlightNodes(result.map(r => r.id), 'blue');
      return JSON.stringify(result);
    },
    
    find_contributors: async ({ nodeId }) => {
      const result = await kuzuConn.execute(
        `MATCH (p:Person)-[c:CONTRIBUTED]->(f:Function {id: $id})
         RETURN p.name, c.commits, c.lastTouch`, { id: nodeId }
      );
      return JSON.stringify(result);
    },
    
    get_blast_radius: async ({ functionName }) => {
      const result = await kuzuConn.execute(
        `MATCH (f:Function {name: $fn})-[:CALLS*1..3]->(dep)
         RETURN collect(DISTINCT dep.id) as affected`, { fn: functionName }
      );
      highlightNodes(result[0].affected, 'red');
      flyToCluster(result[0].affected);
      return JSON.stringify(result);
    },
    
    // Overlay / view mode controls
    switch_view_mode: async ({ mode, filterPerson }) => {
      // mode: "code_structure" | "contributor" | "knowledge" | "people"
      setViewMode(mode, filterPerson);
      return `Switched to ${mode} view${filterPerson ? ` filtered by ${filterPerson}` : ''}`;
    },
    
    show_knowledge_overlay: async ({ person }) => {
      const result = await kuzuConn.execute(
        `MATCH (p:Person {name: $name})-[k:UNDERSTANDS]->(f)
         RETURN f.id, k.confidence`, { name: person }
      );
      setViewMode('knowledge', person);
      applyKnowledgeOverlay(result);
      return JSON.stringify({ nodesWithKnowledge: result.length });
    },
    
    show_contributor_overlay: async ({ person }) => {
      const result = await kuzuConn.execute(
        `MATCH (p:Person {name: $name})-[c:CONTRIBUTED]->(f)
         RETURN f.id, c.commits, c.linesChanged`, { name: person }
      );
      setViewMode('contributor', person);
      applyContributorOverlay(result);
      return JSON.stringify({ nodesContributed: result.length });
    },
    
    show_people_view: async () => {
      // Person nodes become visible, connected to code via CONTRIBUTED + UNDERSTANDS
      setViewMode('people');
      return "People overlay active — showing team topology";
    },
    
    start_quiz: async ({ topic }) => {
      switchToQuizMode(topic);
      return "Quiz mode activated";
    },
  }
});
```

### Context Updates (Silent Background Info)

```typescript
// When user clicks a node in the 3D graph
onNodeClick(node => {
  conversation.sendContextualUpdate(
    `User just clicked on node "${node.name}" (${node.type}) in ${node.filePath}. 
     Current view mode: ${currentViewMode}. Adjust your conversation accordingly.`
  );
});

// When user manually switches view mode via UI
onViewModeChange((mode, filterPerson) => {
  conversation.sendContextualUpdate(
    `User switched to ${mode} view${filterPerson ? ` filtered by ${filterPerson}` : ''}. 
     ${mode === 'contributor' ? 'They can see who built what.' : ''}
     ${mode === 'knowledge' ? 'They can see knowledge coverage. Red = gaps.' : ''}
     ${mode === 'people' ? 'They can see Person nodes and team topology.' : ''}
     Adjust your responses to reference what they can see.`
  );
});

// When switching to quiz mode
function switchToQuizMode(topic?: string) {
  conversation.sendContextualUpdate(
    `User has entered quiz mode${topic ? ` focused on ${topic}` : ''}. 
     Switch to the interviewer persona. Select nodes with low knowledge 
     scores and begin quizzing.`
  );
}

// When companion mode detects idle time
function onInferenceDetected() {
  conversation.sendContextualUpdate(
    `The user's coding agent is currently running inference (idle time detected).
     This is a good moment to start a quiz. Keep it conversational and brief.`
  );
}
```

---

## 12. Question Types the System Can Answer

### Structural Queries (Agent 1 handles directly)

- "What does [function] do?"
- "What depends on [module]?"
- "Show me the blast radius of changing [function]"
- "How many functions are in [directory]?"
- "What imports does [file] have?"
- "Trace the call chain from [A] to [B]"

### People Queries (Agent 1 handles directly)

- "Who wrote [function]?"
- "Show me Alice's contributions" → switches to Contributor overlay filtered by Alice
- "Who has touched [module] recently?"
- "Show me the team" → switches to People overlay

### Knowledge Queries (Agent 1 or 3 depending on complexity)

- "What does Jeff know about [module]?" (Agent 1)
- "Show me Jeff's knowledge coverage" (Agent 1 → switches to Knowledge overlay filtered by Jeff)
- "What does Jeff need to catch up on?" (Agent 3 — multi-step)
- "How confident is the team on [module]?" (Agent 3 — aggregation)
- "Where are our biggest knowledge gaps?" (Agent 3 — cross-reference)

### Visualization Queries (Agent 1 — triggers view mode switches)

- "Show me the code structure" → Code Structure mode
- "Show me who built what" → Contributor overlay
- "Show me knowledge gaps" → Knowledge overlay (no person filter, red = gaps)
- "Show me Alice's footprint" → Contributor overlay filtered by Alice
- "Show me the team topology" → People overlay
- "Compare Alice and Bob's contributions" → Contributor overlay, toggle between filters

### Decision Queries (Agent 3 always)

- "Who should fix this bug in [module]?"
- "If Alice leaves, what knowledge do we lose?"
- "Who is the best person to review changes to [function]?"
- "What's the riskiest part of this codebase?"
- "Prioritize what I should learn next"

### Comparative Queries (Agent 3 always)

- "Compare Alice and Bob's knowledge of [module]"
- "What changed since I last looked at this codebase?"
- "How has Jeff's understanding evolved over the last month?"

### Meta Queries (Agent 1)

- "Quiz me on [topic]"
- "How well do I know the auth module?"
- "What did we discuss last time about [function]?"
- "Give me a handoff briefing for [module]"

---

## 13. Schema Extensibility

KuzuDB node tables are just schema definitions. The architecture naturally supports new entity types beyond code and people:

```cypher
-- Future: Bug tracking integration
CREATE NODE TABLE Bug(id STRING, title STRING, severity STRING, PRIMARY KEY(id))
CREATE REL TABLE AFFECTS(FROM Bug TO Function)
CREATE REL TABLE ASSIGNED_TO(FROM Bug TO Person)

-- Future: PR / code review integration
CREATE NODE TABLE PullRequest(id STRING, title STRING, status STRING, PRIMARY KEY(id))
CREATE REL TABLE MODIFIES(FROM PullRequest TO Function)
CREATE REL TABLE REVIEWED_BY(FROM Person TO PullRequest)

-- Future: Documentation mapping
CREATE NODE TABLE Doc(id STRING, title STRING, url STRING, PRIMARY KEY(id))
CREATE REL TABLE DOCUMENTS(FROM Doc TO Function)
```

Each new entity type gets its own overlay mode in the visualization. The rendering layer needs one mapping per type: node type → visual treatment (shape, color, size, which overlay modes it appears in).

**For the hackathon:** only build code nodes + Person nodes + the 4 overlay modes. Mention extensibility in the pitch: "Today it maps code and people. Tomorrow it maps bugs, PRs, documentation, and onboarding paths — all in the same graph."

---

## 14. Hackathon Scoping — What to Build When

### Must Have (Hours 0-20)

- **Agent 1:** Voice Conversationalist with basic Cypher queries and client tools
- **Agent 2:** Quiz mode with question generation and evaluation
- **Agent 4:** Basic background enrichment (Level 1 summaries for top 20 nodes)
- **ElevenLabs integration:** Custom LLM proxy, client tools, useConversation hook
- **View modes:** Code Structure (default) + Contributor overlay with person filter

### Should Have (Hours 20-28)

- **Parallel truth-finding** in Agent 2 (the DevStral 2 launch during user speaking time)
- **Agent 3:** Simple multi-step queries (sequential Cypher, no sub-agents) — handles "who should fix this?" type questions
- **Knowledge overlay** — filter graph by person, show knowledge vs. contribution, red/green coloring
- **People overlay** — Person nodes visible, team topology view (the "wow" demo moment)
- **Voice-triggered view switching** — "Show me Alice's contributions" triggers overlay change

### Nice to Have (Hours 28-32)

- **Recursive sub-agent spawning** in Agent 3 — parallel node exploration
- **Agent 4 full pipeline** — quiz bank pre-generation, cluster analysis, risk detection
- **Voxtral Mini 4B** integration for STT input (if GPU available)

### Mention in Pitch but Don't Build

- Full ERLA-style recursive exploration ("the system can recursively explore large codebases using sub-agents")
- Schema extensibility ("today code and people, tomorrow bugs, PRs, docs, onboarding paths")
- MCP server exposure for AI editors
- Self-improving quiz quality via W&B logging
- Knowledge trend analysis over time

### The Decision Framework During the Hackathon

At any point, ask: **"Does this make the 2-minute demo video better?"**

If yes → build it.  
If no → skip it, mention it in the pitch as future work.

---

*This document is the complete agent infrastructure reference. Print it out or keep it open during the hackathon.*
