# Mistral Worldwide Hackathon — Project Summary & Battle Plan

**Author:** GG (Guust Goossens)
**Event:** Mistral Worldwide Hackathon — Paris Edition  
**Dates:** February 28 – March 1, 2026 (34 hours, 9 AM – 7 PM next day)  
**Format:** Solo build, 100 selected participants (from 7,000+ applicants globally, ~100 per city)  
**Venue:** Near the Eiffel Tower, Paris

---

## Table of Contents

1. [The Idea — What We're Building](#1-the-idea--what-were-building)
2. [The Mission & Pitch](#2-the-mission--pitch)
3. [Architecture & Technical Stack](#3-architecture--technical-stack)
4. [How the Conversation Evolved](#4-how-the-conversation-evolved)
5. [Key Technical Concepts Explained](#5-key-technical-concepts-explained)
6. [What We Borrow vs. What's Original](#6-what-we-borrow-vs-whats-original)
7. [The Two-Speed Agent Architecture](#7-the-two-speed-agent-architecture)
8. [The Metadata-Centric Graph Model](#8-the-metadata-centric-graph-model)
9. [Progressive Disclosure on Knowledge Graphs](#9-progressive-disclosure-on-knowledge-graphs)
10. [Sponsor Strategy & Prize Targets](#10-sponsor-strategy--prize-targets)
11. [Hackathon Rules & What's Allowed](#11-hackathon-rules--whats-allowed)
12. [Build Sequence (34 Hours)](#12-build-sequence-34-hours)
13. [The Demo Script](#13-the-demo-script)
14. [Pre-Hackathon Checklist](#14-pre-hackathon-checklist)
15. [Key Libraries & Their APIs](#15-key-libraries--their-apis)
16. [Open Questions & Decisions Still Needed](#16-open-questions--decisions-still-needed)
17. [Research & Data Points for the Pitch](#17-research--data-points-for-the-pitch)

---

## 1. The Idea — What We're Building

A **voice-driven codebase intelligence platform** that turns any repository into an interactive, explorable 3D knowledge graph — and then uses that graph to **quiz developers by voice while their AI coding agents run inference**.

The core loop:

1. **Drop in a repo** → Tree-sitter parses code into an AST → builds a graph in KuzuDB (embedded WASM graph database) of files, functions, classes, imports, and call chains → renders as a 3D force-directed graph
2. **Enrich with git data** → Overlays contributor metadata (who committed what, when, how much) onto the same graph nodes
3. **Talk to it** → ElevenLabs Conversational AI + Mistral DevStral as the brain → voice-ask questions about the codebase, get spoken answers, watch the 3D graph highlight in real-time
4. **Get quizzed** → During idle time (while an AI coding agent runs inference), the voice agent quizzes you on parts of the codebase you haven't interacted with → tracks your knowledge per node → builds a knowledge layer via voice interviews
5. **See the knowledge map** → Filter the graph by person to see who understands what, who contributed what, and where knowledge gaps exist → the graph lights up in different colors per person and per metadata dimension

The killer differentiator: **you don't need to be at a desk.** Plug in AirPods, go for a walk, and your knowledge grows while your AI agent writes code. The demo involves literally walking to the Eiffel Tower while being quizzed about a codebase.

---

## 2. The Mission & Pitch

### The Problem (Three-Part Framing)

1. **Your brain goes idle while AI codes.** The METR study (July 2025) proved developers using AI tools are 19% slower — yet they *believe* they're 24% faster. Perception gap = cognitive offloading. Every time you sit idle waiting for Cursor/Claude Code to think, your brain disengages.
2. **You don't understand the code you ship.** 41% of all code is now AI-generated. There's a growing divergence between who wrote the code and who understands the code. This creates team-level knowledge debt.
3. **You're chained to a desk.** Software engineering shouldn't mean being screen-locked 12 hours a day. This tool liberates developers — plug in AirPods, go for a walk, learn about your codebase while AI writes code.

### The One-Liner

> "AI coding tools help machines understand your code. We help *you* understand your code — by voice, while you walk, while your AI agent does the typing."

### The 60-Second Pitch

> "41% of code is now AI-generated. The METR study proved developers think AI makes them faster — but they're actually 19% slower. Why? Their brains go idle while AI thinks.
>
> [Project Name] is a codebase intelligence platform that turns dead inference time into active learning. It builds a 3D knowledge graph of your codebase, tracks what every developer understands, and — powered by Mistral and ElevenLabs — quizzes you by voice while your AI agent works.
>
> [show graph building on screen, voice interaction]
>
> But here's the thing — you don't need a screen for this. [show walking footage] This is me walking to the Eiffel Tower while my coding agent refactors an auth module. I'm wearing AirPods. The AI quizzes me on the exact code being changed. By the time I'm back, the agent is done, and I actually understand what it built.
>
> We're not just another dev tool. We're making software engineering sustainable. Get developers off their chairs, into the real world, and keep their brains engaged. Because the future of coding shouldn't mean the death of thinking."

### Why This Wins (Strategic Alignment)

- **Joffrey (Mistral DevRel, personally added GG to the event) said:** "Simple ideas that generate wins. Something you'd see on social media and think 'damn that's cool.'" A developer walking through Paris with AirPods talking to a 3D knowledge graph IS that moment.
- **Mistral France is critical of vibe coding** — this project makes AI-assisted coding more mature, net-positive, and sustainable.
- It's technically impressive underneath (AST parsing, multi-agent orchestration, custom LLM voice agent) but immediately understandable at a glance.
- It's wholesome, healthy, and aligned with current discourse about AI's impact on cognition and work-life balance.

---

## 3. Architecture & Technical Stack

### What We ARE Using

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React + Vite + Tailwind | Fast scaffolding, hot reload, standard |
| **3D Visualization** | `react-force-graph-3d` (built on Three.js) | GG has used this before (HackEurope26), renders force-directed graphs in 3D out of the box |
| **Code Parsing** | `web-tree-sitter` (WASM) | Language-agnostic AST parsing in the browser, supports TS/JS/Python/Java/Go/Rust/C/C++ |
| **Graph Storage** | **KuzuDB WASM** (`@kuzu/kuzu-wasm`) | Embedded graph database running in the browser via WebAssembly. Supports Cypher queries for dynamic, compositional graph traversal. Agents can write Cypher directly instead of needing pre-defined query functions. Fallback: in-memory JSON if WASM setup fails. |
| **Voice Input (STT)** | Voxtral Mini 4B Realtime (Mistral's new model) | <500ms latency, 13 languages (including Dutch/French), brand new — judges will love seeing it |
| **Voice Agent Platform** | ElevenLabs Conversational AI SDK (`@11labs/react`) | Full voice agent pipeline: STT → LLM → TTS → turn-taking. Supports custom LLM and client tools |
| **Voice Output (TTS)** | ElevenLabs (via Conversational AI) | 5K+ voices, 70+ languages, low-latency streaming |
| **Agent Brain (fast, voice)** | Mistral DevStral Small 2 (24B) | 200 tokens/sec, 0.37s TTFT, currently free |
| **Agent Brain (deep, background)** | Mistral DevStral 2 (123B) | 76 tokens/sec, 0.39s TTFT, currently free, 72.2% SWE-bench |
| **Git Analysis** | `simple-git` (Node.js) | Preprocesses git log to extract contributor data per file |
| **ElevenLabs ↔ Mistral Bridge** | Thin Express proxy server (~50 lines) | OpenAI-compatible endpoint that forwards to Mistral API |
| **Tunneling** | ngrok | Gives local proxy a public URL for ElevenLabs to reach |

### What We Are NOT Using

| ~~Technology~~ | Why Not |
|---|---|
| ~~Convex~~ | No backend needed. Fully local is cleaner, faster, and a stronger privacy pitch. |
| ~~Neo4j (cloud/server)~~ | KuzuDB WASM gives us Cypher queries without any server. Neo4j would require a separate database process. |
| ~~Vector embeddings / semantic search~~ | Structural graph edges (imports, calls, defines) are more precise than embeddings for code intelligence. Unnecessary for hackathon scope. |
| ~~LangChain~~ | Direct Mistral API calls with function calling are simpler and more transparent. |
| ~~Rust~~ | Everything needed has JS/WASM bindings already. Would only add complexity. |
| ~~Finetuning~~ | Time black hole. Interesting for a stretch goal or W&B prize but should not distract from the core demo. |
| ~~In-memory JSON (as primary store)~~ | Was the original plan, but KuzuDB gives agents dynamic Cypher query composition instead of needing pre-defined JS functions for every query pattern. JSON remains the fallback if KuzuDB WASM setup fails. |

### Architecture Diagram (Conceptual)

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER (React + Vite)                │
│                                                              │
│  ┌──────────────┐    ┌───────────────────┐    ┌───────────┐ │
│  │  Tree-sitter  │    │  KuzuDB WASM      │    │  3D Force │ │
│  │  WASM Parser  │───▶│  (Cypher-queryable│───▶│  Graph    │ │
│  │              │    │   embedded graph)  │    │  (Three.js)│ │
│  └──────────────┘    └───────────────────┘    └───────────┘ │
│         ▲                      ▲  │                  ▲       │
│         │                      │  │                  │       │
│   [repo files via              │  │    [highlight nodes,     │
│    File System API]            │  │     camera fly-to]       │
│                                │  │                  │       │
│  ┌─────────────────────────────┼──┼──────────────────┤       │
│  │   ElevenLabs useConversation() hook               │       │
│  │   ┌──────────────────────────────────────┐        │       │
│  │   │  Client Tools:                       │        │       │
│  │   │   • query_graph(cypher) → KuzuDB     │────────┘       │
│  │   │   • highlight_nodes(ids) → 3D graph  │                │
│  │   │   • update_knowledge(...) → KuzuDB   │                │
│  │   │   • start_quiz(topic) → quiz mode    │                │
│  │   └──────────────────────────────────────┘                │
│  └─────────────────────────────────────────────────────────┘ │
│                           │  ▲                               │
└───────────────────────────┼──┼───────────────────────────────┘
                            │  │
                     WebSocket/WebRTC
                            │  │
                  ┌─────────▼──┴─────────┐
                  │   ElevenLabs Cloud    │
                  │   (STT + TTS +       │
                  │    turn-taking)       │
                  └─────────┬────────────┘
                            │
                   Custom LLM endpoint
                            │
                  ┌─────────▼────────────┐
                  │  Express Proxy (local)│
                  │  (via ngrok tunnel)   │
                  └─────────┬────────────┘
                            │
                  ┌─────────▼────────────┐
                  │   Mistral API        │
                  │   DevStral Small 2   │
                  │   (voice, real-time) │
                  │   DevStral 2         │
                  │   (background,deep)  │
                  └──────────────────────┘
```

---

## 4. How the Conversation Evolved

### Phase 1: The 2 AM Idea (Feb 25, late night)

GG's initial concept was about **making coding more active during inference time** — getting asked questions while AI runs, building a knowledge graph of your understanding. He referenced two inspirations:

- **GitNexus** (abhigyanpatwari/GitNexus): An open-source code intelligence engine that parses repos into knowledge graphs using Tree-sitter + KuzuDB + Cypher queries
- **ZProger's workflow** (YouTube): Using NotebookLM + Obsidian to create a "redundancy filter" for learning — comparing new knowledge against existing knowledge to find gaps

GG's additions on top: voice interaction via ElevenLabs, team/contributor mapping, quiz system, recursive agent exploration with Mistral.

### Phase 2: Architecture Design

We explored the full GitNexus architecture in depth (AST pipeline, KuzuDB, MCP integration, Web Workers) and identified what could be borrowed vs. built from scratch.

**Key early decisions:**
- Use TypeScript/JavaScript throughout (all critical libraries have JS/WASM bindings)
- Go fully local (no Convex, no server dependency)
- Skip Rust (cool but unnecessary when WASM bindings exist)
- Initially planned in-memory JSON, later upgraded to KuzuDB WASM for dynamic Cypher queries

### Phase 3: Feasibility Check

Reviewed GG's two previous hackathon repos:
- **HackEurope26** (78 commits): Already uses react-force-graph + Convex + TypeScript
- **ERLA** (50 commits): Recursive multi-agent orchestration with real-time visualization

Conclusion: GG has literally built the two halves of this project separately before. 34 hours is more than enough.

### Phase 4: Bottleneck Identification

Ranked by risk:
1. **Tree-sitter WASM setup** (2-4 hrs) — loading grammar files is fiddly. Fallback: regex-based parser for 80% coverage.
2. **ElevenLabs voice integration** (2-3 hrs) — newer API, but SDK handles most complexity.
3. **Git history parsing** (1-2 hrs) — preprocessing step, straightforward.
4. **Mistral agent layer** (2-3 hrs) — GG's comfort zone from ERLA.
5. **NOT a bottleneck:** 3D visualization, quiz system, knowledge tracking — all familiar patterns.

### Phase 5: The Pitch & Mission Discovery

The pitch evolved from "cool tech demo" to a **mission**: making software engineering sustainable in the age of AI. Backed by the METR study (19% slower), cognitive offloading research, and the flow-state disruption angle. This reframing transforms the project from a hackathon toy into something with a reason to exist.

### Phase 6: The "Walk to the Eiffel Tower" Demo Concept

GG's creative breakthrough: demo the tool by walking to the Eiffel Tower with AirPods while the AI codes. Split-screen showing terminal running on laptop + POV walking through Paris + voice interaction + 3D graph on phone. This is the viral moment.

The venue is near the Eiffel Tower. The app works in a mobile browser (Vite app is responsive, Three.js works on mobile, ElevenLabs SDK works in mobile Chrome/Safari). No native app needed.

### Phase 7: ElevenLabs Deep-Dive

Discovered ElevenLabs Conversational AI supports:
- **Custom LLM** — point to your own OpenAI-compatible endpoint (= Mistral proxy)
- **Client tools** — JavaScript functions in the browser that the voice agent can trigger (= graph queries + visualization updates)
- **Buffer words** — "Let me check... " keeps voice flowing while Mistral thinks
- **React SDK** — `useConversation()` hook handles everything

This means the voice pipeline is way simpler than expected. No WebAudio wrangling. ~4-5 hours total, not more.

### Phase 8: Sponsor Feature Integration

- **Voxtral Mini 4B Realtime** — Mistral's brand new STT model, <500ms, runs on a single GPU. Perfect for the voice input side and showing Mistral's latest.
- **NVIDIA NeMo Agent Toolkit** — has agent observability/profiling and MCP support. Potential demo repo to index live.
- **AWS Strands Agents SDK** — another demo repo to index. MCP client support.
- **HuggingFace upskill** — framework for generating and evaluating agent skills. Potential extension: auto-generate SKILL.md from the knowledge graph.

### Phase 9: The Architecture Correction (Critical)

GG corrected a fundamental misunderstanding: the graph's primary visual layer should be code-only. The evolution:

- **Initial (wrong):** Separate Person nodes and Knowledge nodes as first-class visual elements alongside code
- **Correction:** People, knowledge, and contributions are metadata dimensions on code nodes, not separate visual entities
- **Final decision:** Person nodes DO exist in KuzuDB as query infrastructure (enables clean Cypher traversals), but they're **invisible by default** in the 3D visualization. The default view shows only code. Person nodes only appear when the user switches to the "People overlay" mode.

This gives the best of both worlds: clean Cypher queries with relationship traversals AND a code-first visual experience with modal overlays (Code Structure, Contributor, Knowledge, People).

### Phase 10: Skills & Progressive Disclosure

Connection to Anthropic's Agent Skills specification: each node's metadata dimensions function like skill trees with progressive disclosure:
- **Level 1**: Surface summary (~50 tokens) — always in context
- **Level 2**: Detailed breakdown — loaded on query
- **Level 3**: Full data (commit history, interview transcripts, source code) — loaded on deep dive

The graph IS the skill tree. SKILL.md files could be exported as a portable artifact, but the interactive graph is the primary product.

### Phase 11: KuzuDB Decision (Reversing the Earlier Call)

After deeper analysis of agent requirements, the decision flipped from "skip KuzuDB" to "use KuzuDB WASM." The reasoning:

- **Agents need dynamic query composition.** With in-memory JSON, you pre-define fixed tool functions. With KuzuDB, you give the agent one tool (`query_graph(cypher)`) and the agent writes whatever query it needs. When someone asks a question that doesn't map to an existing function, the agent just writes new Cypher.
- **Multi-dimensional metadata is relational.** Contributor dimensions, knowledge dimensions, discussion logs — these are naturally modeled as relationship tables (CONTRIBUTED, UNDERSTANDS, DISCUSSED) with properties. KuzuDB handles this natively.
- **Voice transcripts need to be linked.** Each voice interaction creates a DISCUSSED relationship between a Person and a Function node with timestamp, transcript, quiz result, and confidence changes. In JSON, this requires manual cross-referencing. In KuzuDB, it's a `MERGE` statement.
- **Real-time updates during calls are atomic.** When a quiz answer updates a knowledge score, KuzuDB handles the mutation cleanly.

The visualization layer doesn't change — react-force-graph still consumes `{ nodes, links }`, which gets derived from KuzuDB via a rendering cache query. In-memory JSON remains the fallback if KuzuDB WASM setup fails during the hackathon (2-hour rule: if it fights you, drop to JSON).

### Phase 12: Agent Architecture Crystallization

The agent system solidified into four distinct roles:

1. **Agent 1 (Voice Conversationalist)** — DevStral Small 2, real-time, handles straightforward voice queries by writing Cypher
2. **Agent 2 (Interviewer/Quiz Master)** — DevStral Small 2, a mode of Agent 1, runs the quiz loop with spaced repetition
3. **Agent 3 (Graph Reasoner)** — DevStral 2, on-demand for complex multi-step questions ("who should fix this bug?"), can spawn Small 2 sub-agents for parallel node exploration
4. **Agent 4 (Background Enricher)** — DevStral 2, runs asynchronously at repo load to pre-compute summaries, quiz banks, and risk analysis

Key architectural innovation: **Parallel Truth-Finding.** When Agent 2 asks a quiz question, it simultaneously launches DevStral 2 to build a deep "ground truth packet" about that node. This runs during the 5-15 seconds while the user thinks and speaks. By the time the user finishes, the evaluation has DevStral 2-quality context but delivers at Small 2 speed. The latency is completely hidden behind human thinking time.

See the **Agent Infrastructure** document for the complete specification.

---

## 5. Key Technical Concepts Explained

### AST (Abstract Syntax Tree)
A tree representation of source code that drops irrelevant syntax (semicolons, whitespace) and keeps structure. `const x = add(a, b)` becomes: variable_declaration → name "x" → value: function_call → name "add" → args "a", "b". Tree-sitter generates these for any supported language.

### Graph (Data Structure)
Nodes (things) + edges (connections). Unlike trees, graphs can have cycles. A codebase is naturally a graph: files import files, functions call functions. Two types: directed (A imports B ≠ B imports A) and undirected.

### Force-Directed Graph Layout
Physics simulation: nodes repel like magnets, edges pull like springs, gravity toward center. Connected clusters naturally group. `react-force-graph-3d` does this automatically.

### Tree-sitter
C-based parser generator compiled to WASM for browsers. Language-agnostic: same API for all languages, each grammar is a separate `.wasm` file. Incremental (re-parses only changes) and error-tolerant (handles broken syntax).

### DAG (Directed Acyclic Graph)
A graph where edges have direction and there are NO cycles. The build pipeline is a DAG: parse → extract → resolve → enrich → visualize. Codebase dependency trees are *almost* DAGs — circular imports create cycles, handled with `visited` sets.

### Spaced Repetition
Learning technique: review at increasing intervals. Right answer → ask again later. Wrong answer → ask again soon. The quiz system implements a simplified version via knowledge scores per node.

### Cognitive Offloading
The psychological phenomenon where relying on external tools (AI, calculators, search) reduces brain engagement. The core problem this project solves.

### Progressive Disclosure
Revealing information in layers of increasing detail. Level 1 = overview, Level 2 = details on demand, Level 3 = full depth. Applied to the graph: each node reveals its metadata dimensions progressively.

### KuzuDB
An embedded graph database that supports Cypher queries. "Embedded" means it runs in-process (no separate database server). The WASM build (`@kuzu/kuzu-wasm`) runs entirely in the browser. You define node tables and relationship tables, insert data, and query with Cypher. It also supports HNSW vector indexing, though we're not using that.

### Cypher
A graph query language (same as Neo4j uses). Reads like ASCII art: `MATCH (a:Person)-[:UNDERSTANDS]->(f:Function) RETURN a.name, f.name` means "find all Person nodes connected to Function nodes via UNDERSTANDS relationships." Agents can write Cypher dynamically, which is why KuzuDB is more powerful than pre-defined JS query functions for agent tool use.

---

## 6. What We Borrow vs. What's Original

### From GitNexus (~20% of project)
**Borrowed:** The concept of Tree-sitter WASM → graph pipeline, multi-pass pattern (structure → parse → resolve), structural edges over embeddings. Also the choice of KuzuDB as an embedded graph database with Cypher queries — GitNexus proved this works in-browser via WASM.  
**NOT taken:** Any code, their specific schema, MCP server, web workers, their search/RAG system, their agent tools.

### From ZProger Workflow (~5%)
**Borrowed:** "Redundancy filter" concept — compare new info against existing knowledge to find gaps.  
**NOT taken:** Any code, NotebookLM integration, Obsidian, prompt patterns.

### From GG's Own ERLA (~10% conceptually)
**Borrowed:** Recursive agent pattern, parallel exploration, background processing.  
**NOT taken:** Any code (different language, domain).

### From GG's Own HackEurope26 (0% code, 100% muscle memory)
**Borrowed:** Experience with react-force-graph, TypeScript project patterns, hackathon scoping instincts.

### What's Entirely Original (~65%)
1. **Voice-driven codebase interaction** via ElevenLabs Conversational AI + Mistral as custom LLM with client tools that update 3D visualization in real-time
2. **Knowledge tracking per developer per code node** — quiz history, spaced repetition, decay over time
3. **The "inference idle time" learning concept** — using dead time while AI runs as a learning opportunity, including hands-free walking mode
4. **Team knowledge topology** — not just who wrote what (git blame) but who *understands* what, and the divergence between the two
5. **Two-speed agent architecture** — fast model talks, big model thinks, pre-computed results cached in nodes
6. **Parallel truth-finding** — launching DevStral 2 to build a deep ground truth packet the moment a quiz question is asked, hiding latency behind human thinking/speaking time
7. **The mission and pitch** — "making software engineering sustainable in the age of AI"

---

## 7. The Two-Speed Agent Architecture

### Fast Path: Voice Conversation (<2 seconds)
- **Model:** DevStral Small 2 (24B) — 200 tokens/sec
- **Used for:** Answering voice questions, quiz generation, evaluating answers, conversational responses
- **Token limit:** <80 tokens (spoken aloud)
- **Tool calls:** Simple graph lookups only (instant)

### Slow Path: Deep Analysis (5-30 seconds, background)
- **Model:** DevStral 2 (123B) — 76 tokens/sec
- **Used for:** Code summarization, generating explanations, pre-computing quiz banks, analyzing blast radius narratives
- **Runs at:** Repo load time, background enrichment

### Full Latency Stack (Voice Interaction)

```
User finishes speaking
  → ElevenLabs STT:              ~300-500ms
  → Network to proxy:            ~50ms
  → Mistral TTFT:                ~370ms (Small 2)
  → Mistral generates response:  ~250ms (50 tokens @ 200 t/s)
  → If tool call needed:         ~200ms round trip
  → ElevenLabs TTS:              ~200-400ms
  → Audio starts playing
                                  ─────────────
  TOTAL (no tool):                ~1.2-1.6 seconds
  TOTAL (with tool):              ~1.8-2.5 seconds
```

1.5-2.5 seconds is natural for voice. Buffer words ("Let me check...") cover tool-call latency.

**Critical rule:** The voice path MUST use the fast model. Never route voice through DevStral 2 — the extra 2-3 seconds would break the conversation feel.

**Exception: Parallel Truth-Finding.** During quizzes, DevStral 2 launches simultaneously when a question is asked, building a deep ground truth packet while the user thinks and speaks. This takes 3-5 seconds but is completely hidden behind human response time. See the Agent Infrastructure document for the full pattern.

---

## 8. The Metadata-Centric Graph Model

### The Architecture

KuzuDB stores both code nodes AND Person nodes. However, Person nodes are **query infrastructure, not visual elements by default**. The 3D visualization is modal — different view modes show different subsets of the graph.

**Design principle:** Person nodes exist in KuzuDB so agents can write clean Cypher relationship traversals ("find everyone who understands the auth module"). But the default visualization shows only the code graph. Person nodes only become visible when the user switches to the People overlay.

**KuzuDB Schema:**
```cypher
-- Code nodes (always visible in default view)
CREATE NODE TABLE File(id STRING, name STRING, filePath STRING, PRIMARY KEY(id))
CREATE NODE TABLE Function(id STRING, name STRING, filePath STRING,
                           summary STRING,         -- what this function does (node-level, static)
                           relevance FLOAT,        -- structural importance: 0.0–1.0, auto-computed from in/out degree
                           PRIMARY KEY(id))
CREATE NODE TABLE Class(id STRING, name STRING, filePath STRING,
                        summary STRING, relevance FLOAT, PRIMARY KEY(id))

-- Person nodes (query infrastructure, visible only in People overlay)
CREATE NODE TABLE Person(id STRING, name STRING, email STRING, PRIMARY KEY(id))

-- Structural relationships (from Tree-sitter parsing)
CREATE REL TABLE CONTAINS(FROM File TO Function)
CREATE REL TABLE CALLS(FROM Function TO Function)
CREATE REL TABLE IMPORTS(FROM File TO File)

-- Contributor relationships (from git log + git blame)
-- Progressive disclosure: summary_l1 per (node × contributor), commits_json = L2 (per-commit array)
CREATE REL TABLE CONTRIBUTED(FROM Person TO Function,
                             commits INT64, lastTouch STRING, linesChanged INT64,
                             blameLines INT64,     -- lines currently attributed to this person (git blame)
                             ownershipPct FLOAT,   -- % of current lines owned (git blame)
                             summary_l1 STRING,    -- "Alice: 14 commits, owns 73% of current lines, last Jan 2026"
                             commits_json STRING)  -- JSON array of per-commit details (L2)

-- Knowledge relationships (from voice interviews)
-- Progressive disclosure: summary_l1 per (node × understander), sessions_json = L2 (per-interview array)
CREATE REL TABLE UNDERSTANDS(FROM Person TO Function,
                             confidence STRING,    -- 'deep' | 'surface' | 'none'
                             topics STRING[],      -- concepts demonstrated in interviews
                             lastAssessed STRING,
                             needsRetest BOOLEAN,  -- true when node has new commits since last assessment
                             summary_l1 STRING,    -- "Alice: deep — edge cases, rate limiting, token refresh"
                             sessions_json STRING) -- JSON array of per-interview-session results (L2)

-- Voice interaction log (audit trail per conversation turn)
CREATE REL TABLE DISCUSSED(FROM Person TO Function,
                           timestamp STRING, transcript STRING,
                           quizResult STRING, confidenceBefore STRING,
                           confidenceAfter STRING)
```

**Conceptual model per node:** Each Function node carries multi-dimensional metadata through its relationships. People are not separate visual entities — they're metadata dimensions on code nodes.

```
Function: handleAuth
  ├── summary: "Handles user authentication and token management"  [node-level, static]
  ├── relevance: 0.92  [high — called by 8 upstream functions, auto-computed]
  │
  ├── CONTRIBUTED ← Alice  [from git log + git blame]
  │   ├── summary_l1: "14 commits, owns 73% of current lines, last Jan 2026"  (L1)
  │   └── commits_json: [{hash, date, message, linesAdded, linesRemoved}, ...]  (L2: per-commit)
  │
  ├── CONTRIBUTED ← Bob  [from git log + git blame]
  │   ├── summary_l1: "3 commits, owns 11% of current lines, last Nov 2025"  (L1)
  │   └── commits_json: [...]  (L2: per-commit)
  │
  ├── UNDERSTANDS ← Alice  [from voice interviews]
  │   ├── summary_l1: "Deep — edge cases, rate limiting, token refresh"  (L1)
  │   └── sessions_json: [{date, transcript_excerpt, score, topics_covered}, ...]  (L2: per-session)
  │
  ├── UNDERSTANDS ← Carol  [from voice interviews]
  │   ├── summary_l1: "Surface — general flow only, concurrent sessions gap"  (L1)
  │   └── sessions_json: [...]  (L2: per-session)
  │
  ├── DISCUSSED ← Alice (2026-01-15, "explained the token refresh logic...")
  ├── DISCUSSED ← Carol (2026-02-01, "got quiz wrong on concurrent sessions...")
  ├── CALLS → validateToken
  └── CALLS → refreshSession
```

**Total L1 count across the graph:** Σ(#contributors_i + #understanders_i) for all nodes i. These are generated by Agent 4 (Background Enricher) and updated whenever new interviews or commits arrive.

### Visualization View Modes

The 3D graph display is **modal**. The underlying KuzuDB data doesn't change — only what gets rendered and how nodes are colored/sized.

**Mode 1: Code Structure (default)**
- Shows: File, Function, Class nodes only
- Edges: CALLS, IMPORTS, CONTAINS
- Coloring: by node type (functions = blue, files = gray, classes = purple)
- Purpose: understand the architecture at a glance

**Mode 2: Contributor Overlay**
- Shows: same code nodes as Mode 1, no Person nodes
- Edges: same structural edges
- Coloring: code nodes colored/sized by contributor activity
  - Bright glow = heavily contributed to (many commits, recent)
  - Dim/faded = untouched or stale (no recent commits)
  - Filter by one person → their "footprint" lights up, everything else grays out
- Sizing: node size scales with total commits or lines changed
- Purpose: see who built what, find stale code, understand ownership patterns

**Mode 3: Knowledge Overlay**
- Shows: same code nodes as Mode 1, no Person nodes
- Edges: same structural edges
- Coloring: code nodes colored by knowledge coverage
  - Green = someone has deep understanding
  - Yellow = only surface understanding exists
  - Red = knowledge gap (nobody has been assessed, or everyone failed quizzes)
  - Filter by one person → their individual knowledge map
- Purpose: find knowledge gaps, prioritize what to learn, assess team readiness

**Mode 4: People Overlay**
- Shows: code nodes AND Person nodes (Person nodes become visible)
- Edges: structural edges + CONTRIBUTED + UNDERSTANDS (all visible)
- Person nodes connect to the code they contributed to or understand
- Clusters naturally form: groups of people around code clusters
- Purpose: see the human topology — who clusters around what, where knowledge silos exist, who's isolated, team overlap

**Filtering (works across all modes):**
- Filter by person → highlight their nodes, gray out the rest
- Filter by time range → only show recent activity
- Filter by knowledge confidence → show only deep/surface/gap nodes
- Combine filters → "show me what Alice contributed to but doesn't deeply understand" (contributor overlay + knowledge filter)

**Demo flow for overlays:**
1. Start in Code Structure mode — "Here's the codebase architecture"
2. Switch to Contributor overlay — "Here's who built what" (toggle Alice, toggle Bob, see different areas light up)
3. Switch to Knowledge overlay — "Here's what the team actually understands" (red gaps appear)
4. Switch to People overlay — "Here's the full picture — code and people, connected" (the wow moment)
5. Filter to one person — "And here's the gap between what Alice wrote and what she understands"

### Visualization Queries Per Mode

Each overlay mode is powered by a different Cypher query that derives the `{ nodes, links }` data for react-force-graph:

```cypher
-- Mode 1: Code Structure (default)
MATCH (n) WHERE labels(n) <> 'Person'
RETURN n.id, labels(n), n.name
-- + structural edges only

-- Mode 2: Contributor Overlay (filter by person)
MATCH (p:Person {name: 'alice'})-[c:CONTRIBUTED]->(f)
RETURN f.id, c.commits, c.lastTouch, c.linesChanged

-- Mode 3: Knowledge Overlay (filter by person)
MATCH (p:Person {name: 'alice'})-[k:UNDERSTANDS]->(f)
RETURN f.id, k.confidence, k.topics

-- Mode 4: People Overlay (everything visible)
MATCH (n) RETURN n.id, labels(n), n.name
-- + all edge types
```

Toggle between people and watch the graph change color. Toggle between modes and watch the graph transform. This is the core demo moment.

### Schema Extensibility

KuzuDB node tables are just schema definitions. The architecture naturally supports new entity types:

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

Each new entity type would get its own overlay mode in the visualization. The rendering layer just needs a mapping: node type → visual treatment (shape, color, size, which overlay modes it appears in).

**For the hackathon:** only build code nodes + Person nodes + the 4 overlay modes. But the extensible schema is worth one sentence in the pitch: "Today it maps code and people. Tomorrow it maps bugs, PRs, documentation, and onboarding paths — all in the same graph."

### Where Metadata Comes From
- **Contributor metadata** → git log/blame (free, automated, instant)
- **Knowledge metadata** → voice interviews with ElevenLabs (the quiz system, built during hackathon, accumulated over time)
- **Structural metadata** → Tree-sitter parsing (automated)
- **Summary metadata** → DevStral 2 background processing (at repo load time)

---

## 9. Progressive Disclosure on Knowledge Graphs

Inspired by Anthropic's Agent Skills spec but applied to graph nodes instead of files.

### The Key Insight: Summaries Are Per-Person, Not Per-Node

Progressive disclosure is **not** a flat per-node hierarchy. Each relationship (CONTRIBUTED, UNDERSTANDS) carries its own layered summary for that specific person. The total number of L1 summaries in the system is:

> **Total L1s = Σ(#contributors_i + #understanders_i) over all nodes i**

This scales naturally — a function with 3 contributors and 2 understanders has 5 L1 summaries, each describing a different person's relationship to that node.

### CONTRIBUTED Dimension (from git log + git blame)

- **L1** (one per contributor per node): "Alice: 14 commits, owns 73% of current lines, last touched Jan 2026, mainly edge cases + rate limiting fixes"
- **L2** (one per commit): `{ hash, date, message, linesAdded, linesRemoved, filesChanged }` — the full commit record for that person on that node
- **Source:** `git log --follow` (commit history) + `git blame` (current line ownership)

`git blame` is critical here: it shows whose code is *currently in production*, not just who committed in the past. A contributor who made many commits but whose lines have all been replaced reads very differently from one whose code is the authoritative current version.

### UNDERSTANDS Dimension (from voice interviews)

- **L1** (one per understander per node): "Alice: deep — explains edge cases, concurrent sessions, token refresh logic. Last assessed 2026-02-15."
- **L2** (one per interview session): `{ date, transcript_excerpt, score, topics_covered, questions_asked }` — what was discussed in each session
- **L3** (per question within a session): individual question/answer pairs with evaluation details
- **Source:** Voice interview sessions via ElevenLabs + Agent 2

**Spaced repetition trigger:** When a node gets new commits, `needsRetest` is set to `true` on all UNDERSTANDS edges for that node. The quiz agent prioritizes retesting affected understanders — their knowledge may be stale relative to the new code.

### Node-Level (Structural Dimension)

Separate from the per-person summaries, the node itself carries:
- **`summary`**: What this code does — generated once by Agent 4 at load time
- **`relevance`**: Auto-computed from structural in/out-degree (0.0–1.0). High `relevance` = many things depend on this node. Used to prioritize which nodes to quiz on and enrich first.
- **Structural L2**: Full call chain (CALLS/IMPORTS traversal), available via Cypher on demand
- **Structural L3**: Actual source code

### How Agents Use This

When an agent queries the graph, it gets node `summary` + relationship L1s first (lean, broad context). Then it fetches L2/L3 only for the dimensions it needs:

```
User: "Who should fix this auth bug?"
Agent:
  1. Cypher: MATCH (f:Function {name:'handleAuth'})-[:CALLS*1..3]->(dep)
     → blast radius (structural dimension)
  2. Cypher: MATCH (p:Person)-[c:CONTRIBUTED]->(f) WHERE f.id IN $affected
             RETURN p.name, c.summary_l1, c.commits, c.ownershipPct
     → contributor L1s: who owns current lines in affected nodes
  3. Cypher: MATCH (p:Person)-[k:UNDERSTANDS]->(f) WHERE f.id IN $affected
             RETURN p.name, k.summary_l1, k.confidence
     → knowledge L1s: who actually understands the affected code
  4. Cross-reference → recommend the person with highest ownership + deepest understanding
```

The ZProger "redundancy filter" pattern maps directly here: find nodes where `relevance` is high, `confidence` is low or missing, and code has changed since last assessment → those are genuine gaps, not noise.

---

## 10. Sponsor Strategy & Prize Targets

### Prize Structure (Paris)

| Prize | Amount |
|---|---|
| 🥇 1st Place Paris | $1,500 cash + $3,000 Mistral credits + 3 months ElevenLabs Pro |
| 🥈 2nd Place Paris | $1,000 cash + $2,000 Mistral credits |
| 🥉 3rd Place Paris | $500 cash + $1,000 Mistral credits |
| 🏆 Global Winner | $10,000 cash + $15,000 Mistral credits + Mistral hiring opportunities + Supercell Lab interview ($100K value) |
| 🎙️ Best Voice Use Case (ElevenLabs) | $2,000-6,000 in credits |
| 🎮 Best Video Game (Supercell) | Not targeting |
| 💡 Best use of Mistral Vibe | Branded AirPods |

### How We Hit Each Sponsor

| Sponsor | Integration | Why They'll Care |
|---|---|---|
| **Mistral** | DevStral 2 + Small 2 as agent brains, Voxtral Mini 4B Realtime for STT, function calling API | Their models power the entire intelligence layer. Voxtral is brand new — showing it off earns points. |
| **ElevenLabs** | Full Conversational AI platform: custom LLM, client tools, React SDK, voice-first UX | Most teams will just use basic TTS. We're using their agent platform with custom LLM integration and client tools — their newest features. |
| **HuggingFace** | Best use of agent skills — progressive disclosure metadata dimensions ARE skill trees | Our per-node multi-dimensional metadata with progressive disclosure is the skills architecture applied to graphs. |
| **NVIDIA** | Index their NeMo-Agent-Toolkit repo live in the demo | "Here's NVIDIA's own codebase visualized as a knowledge graph." |
| **AWS** | Index Strands Agents SDK repo live | Same strategy. |
| **Weights & Biases** | Stretch goal: self-improving workflow tracking | Only if time allows. |
| **Raise** (Paris local) | Startup/investment angle — sustainable dev tooling with enterprise potential | Check specific challenge requirements on-site. |

### Official Judging Criteria (from Hacker Guide)

| Criteria | How We Score |
|---|---|
| **Technicality** | Multi-agent architecture (4 agent roles, sub-agent spawning), KuzuDB WASM with Cypher, Tree-sitter AST parsing, ElevenLabs custom LLM integration, parallel truth-finding pattern. Goes well beyond simple prompting. |
| **Creativity** | "Quiz you by voice while AI codes, walk to the Eiffel Tower" — genuinely novel. The inference idle time concept doesn't exist as a product category. |
| **Usefulness** | Solves cognitive offloading, knowledge debt, bus factor risk. Real engineering teams would benefit immediately. Enterprise-ready team knowledge mapping. |
| **Demo** | 3D graph building live + voice interaction + walking footage + strong mission narrative. The 2-minute video constraint fits perfectly with the pitch structure. |
| **Track alignment** | Deep Mistral API usage: DevStral 2, DevStral Small 2, Voxtral Mini 4B, function calling, multi-agent orchestration, Cypher generation. |

### Submission Requirements

- Title, description, project screenshot
- Track (Mistral AI) + challenges entered (ElevenLabs, HuggingFace, Raise)
- GitHub repository URL
- **2-minute max video demo** (YouTube or Loom) — budget time to record this by hour 32

### Demo Strategy: Index Sponsor Repos Live

Pre-analyze the git history of sponsor repos (NVIDIA NeMo-Agent-Toolkit, AWS Strands SDK, HuggingFace upskill) so during the demo you can drop them in and instantly show the 3D graph with contributor data from their own teams. Judges see their own code in a way they've never seen it before.

---

## 11. Hackathon Rules & What's Allowed

### Official Rules (from Hacker Guide)
- Teams of 1-4 people (solo is allowed but they "encourage" teams)
- Must submit on hackiterate.com before the deadline (live countdown)
- Projects must be original and developed during the hackathon
- Expected deliverables: code repository, functional demonstration, pitch presentation before jury
- Finalists present in front of the crowd; final global winner selected via livestream on March 9th

### Definitely NOT Cheating ✅
- Researching ideas, planning architecture, brainstorming
- Learning technologies (Tree-sitter, ElevenLabs SDK, etc.)
- Setting up accounts, API keys, installing tools
- Reading documentation
- Having a mental build plan
- Pre-downloading WASM grammars, npm packages
- Pre-running git analysis on demo repos (save as JSON)

### Gray Area but Universally Accepted ✅
- Having boilerplate ready (Vite + React + Tailwind starter)
- Knowing which packages to use and how
- Having ElevenLabs agent pre-configured in dashboard (config, not code)

### Definitely NOT Allowed ❌
- Submitting code written before the hackathon as your project
- Copy-pasting pre-written components wholesale
- Submitting a previous project with modifications

### On Using Open-Source Libraries ✅
Using react-force-graph-3d, web-tree-sitter, @11labs/react, simple-git as npm packages is no different from using React itself. Studying GitNexus's architecture and implementing similar patterns in your own code is learning, not plagiarism. The distinction is using a library vs. cloning a project and calling it yours.

### Recommendation
Treat the scaffold as a study guide. On hackathon day, start fresh with `npm create vite@latest` and build from memory + reference. Keep the scaffold in a separate folder as docs only.

---

## 12. Build Sequence (34 Hours)

### Hours 0-4: Foundation
- Scaffold React + Vite + Tailwind project
- Get `web-tree-sitter` loading and parsing a sample TypeScript file
- Set up KuzuDB WASM: initialize database, define schema (node tables + relationship tables)
- **If Tree-sitter fights you for >2 hours, pivot to regex extraction**
- **If KuzuDB WASM fights you for >2 hours, drop to in-memory JSON as fallback**

### Hours 4-8: Core Graph Pipeline
- Multi-pass pipeline: file tree → function/class extraction → import resolution → INSERT into KuzuDB
- Derive `{ nodes, links }` from KuzuDB for react-force-graph-3d, get 3D visualization rendering
- Load pre-processed git log data, create Person nodes and CONTRIBUTED relationships
- Basic filtering UI: toggle by contributor, color-code by metadata dimension

### Hours 8-14: Voice + ElevenLabs (elevated priority — this IS the product)
- Set up Express proxy server (Mistral ↔ ElevenLabs bridge)
- Configure ElevenLabs agent (system prompt, voice, custom LLM, client tools)
- Wire up `useConversation()` React hook
- Define client tools: `queryDependencies`, `findContributors`, `getBlastRadius`, `quizMe`
- Test voice loop: speak → agent processes → graph highlights → voice responds
- Integrate Voxtral Mini 4B Realtime for STT input if possible

### Hours 14-20: Quiz System & Knowledge Tracking
- Per-node knowledge state via UNDERSTANDS relationships in KuzuDB
- Quiz generation: agent picks low-familiarity nodes via Cypher, generates questions from code context
- **Parallel truth-finding:** launch DevStral 2 when question is asked, build ground truth while user speaks
- Visual overlay: nodes glow based on knowledge level (green = know it, red = gap)
- DISCUSSED relationship logging: store transcripts + quiz results per interaction

### Hours 20-24: Companion Mode
Three-phase roadmap — only V1 needed for the demo:
- **V1 (build now):** "I'm waiting" button — user taps it to signal idle time, quiz starts immediately. Simple, honest, clear for the demo.
- **V2 (stretch, Hours 28-32):** Silence detection on the user's mic — ~5 seconds of silence triggers quiz mode automatically.
- **V3 (end goal, post-hackathon):** System proactively calls the developer when it detects inference is running. The agent finds you — you don't have to find it. This is the ultimate vision.

### Hours 24-28: Team View + Polish
- Team dashboard: contributor heatmap, knowledge overlap visualization
- Pre-index sponsor repos for demo
- Make 3D graph visually stunning (particle effects on edges, camera animations, glow effects)
- Smooth voice interactions, handle edge cases

### Hours 28-34: Demo Prep & Submission
- Build the demo script and practice the flow
- Record Eiffel Tower walking footage (15-min break, speed up to 60 seconds)
- **Record 2-minute max video demo** (upload to YouTube or Loom) — REQUIRED for submission
- Prepare live presentation for jury (if selected as finalist)
- Clean up, deploy if possible (Vercel for frontend)
- **Submit on hackiterate.com:** title, description, screenshot, GitHub URL, video URL, track + challenges
- Write README, push final code to GitHub

### The Dogfooding Angle
During the hackathon itself, use your own tool to quiz yourself about the code you're building. "I dogfooded this during the hackathon — while Claude Code built my frontend, I was getting quizzed on the parsing pipeline I'd just written." That story proves the concept.

---

## 13. The Demo Script

### Option B (Recommended): Live desk demo + recorded walking footage

1. **Drop in a repo** → watch the 3D graph build in real-time (Tree-sitter → KuzuDB → force graph). Start in Code Structure mode.
2. **Switch to Contributor overlay** → say "Show me who built this" → graph recolors by contributor activity. Filter by person: "Show me Alice's contributions" → her footprint lights up, everything else grays out. Toggle Bob → different areas light up.
3. **Voice interaction** → ask "What does the auth service do?" → ElevenLabs speaks back a contextual answer, graph highlights relevant nodes, camera flies to the cluster
4. **Switch to Knowledge overlay** → say "Show me knowledge gaps" → red nodes appear where nobody has been assessed. "That's a lot of red — let's fix that."
5. **Get quizzed** → answer a question about a function you haven't touched → answer wrong → node stays red, rich feedback from parallel truth-finding
6. **Answer correctly** → node turns green, knowledge score updates in real-time
7. **Cut to walking footage** → "And here's what it looks like when you're not at your desk" → sped-up walk to Eiffel Tower, voice quiz on AirPods, graph updating on phone
8. **Switch to People overlay** → say "Show me the team" → Person nodes appear, connected to their code. Visual clusters show who works on what. "This is your team's knowledge topology."
9. **Decision query** → "Who should fix this bug in the payment module?" → agent traverses contribution + knowledge → suggests the right person
10. **Close** → "The future of coding shouldn't mean the death of thinking."

---

## 14. Pre-Hackathon Checklist

### Do Tonight/Tomorrow (Before Friday) — NO CODE

- [ ] **Claim Mistral API coupon** on hackiterate.com → Resources tab → redeem at admin.mistral.ai/organization/billing
- [ ] **Claim ElevenLabs credits** via Discord bot (discord.com/invite/VnBvbbcdEC → #coupon-codes → Start Redemption → use registration email)
- [ ] **Join HuggingFace org:** https://huggingface.co/organizations/mistral-hackaton-2026/share/BuptMvYnpxCEnTMuOumANgOGHPDbrgMwoS
- [ ] **Join hackathon Discord:** https://discord.gg/zdSEmdfkSQ → go to Roles tab → select "Yes" on participating → join Paris channel
- [ ] **Access hackiterate.com** platform (invite link in email)
- [ ] Get ElevenLabs account + create agent in dashboard (pick voice, set to Custom LLM, enable client tools)
- [ ] Download Tree-sitter WASM grammars (TypeScript, Python, JavaScript) — verify they load
- [ ] Install ngrok
- [ ] Install Node.js, npm, Vite, etc.
- [ ] Read through scaffold files as study material (patterns in your head, not code to copy)
- [ ] Pick demo repos (GG's own repos + NVIDIA NeMo-Agent-Toolkit + Strands SDK + HF upskill)
- [ ] Pre-run git analysis on demo repos: `git log --format='%H|%aN|%aE|%aI' --name-only` → save as JSON
- [ ] Explore Voxtral Mini 4B Realtime (HuggingFace page, docs, how to use)
- [ ] Read ElevenLabs Conversational AI docs thoroughly
- [ ] Read Mistral function calling docs
- [ ] Read KuzuDB WASM docs (https://docs.kuzudb.com) and the `@kuzu/kuzu-wasm` npm page
- [ ] Charge everything, prep AirPods
- [ ] Plan the Eiffel Tower walking route

### Friday Morning at the Venue

- [ ] Claim any remaining coupons/credits immediately
- [ ] Fresh `npm create vite@latest` — start clean
- [ ] Build from memory + reference docs
- [ ] Follow the phase sequence above

---

## 15. Key Libraries & Their APIs

### react-force-graph-3d
```tsx
<ForceGraph3D
  graphData={{ nodes, links }}
  nodeColor={node => getNodeColor(node)}
  nodeVal={node => node.size || 1}
  nodeThreeObject={node => createCustomNode(node)}  // Three.js objects
  linkDirectionalParticles={2}                       // animated dots on edges
  onNodeClick={handleNodeClick}
  ref={graphRef}  // graphRef.current.cameraPosition(x, y, z, duration)
/>
```

### web-tree-sitter
```typescript
import Parser from 'web-tree-sitter';
await Parser.init();
const parser = new Parser();
const Lang = await Parser.Language.load('/tree-sitter-typescript.wasm');
parser.setLanguage(Lang);
const tree = parser.parse(sourceCode);
// Walk tree: tree.rootNode.descendantsOfType('function_declaration')
// Get name: node.childForFieldName('name').text
```

### @11labs/react
```tsx
const { status, isSpeaking, startSession, endSession, sendContextualUpdate } = useConversation();

await startSession({
  agentId: 'your-agent-id',
  clientTools: {
    query_graph: async ({ cypher }) => {
      const result = await kuzuConn.execute(cypher);
      return JSON.stringify(result);
    },
    highlight_nodes: async ({ nodeIds, color }) => {
      highlightNodesInViz(nodeIds, color);
      return `Highlighted ${nodeIds.length} nodes`;
    },
    update_knowledge: async ({ person, nodeId, confidence, topics }) => {
      await kuzuConn.execute(
        `MERGE (p:Person {name: $person})-[k:UNDERSTANDS]->(f:Function {id: $nodeId})
         SET k.confidence = $confidence, k.topics = $topics`,
        { person, nodeId, confidence, topics }
      );
      return "Knowledge updated";
    }
  }
});
```

### Mistral API (via proxy)
```typescript
// OpenAI-compatible endpoint
const response = await fetch('/v1/chat/completions', {
  method: 'POST',
  body: JSON.stringify({
    model: 'devstral-small-2505',  // Fast for voice
    messages: [...],
    tools: [{ type: 'function', function: { name: 'queryDependencies', parameters: {...} } }],
    stream: true  // Critical for voice latency
  })
});
```

### simple-git (Node.js preprocessing)
```typescript
import simpleGit from 'simple-git';
const git = simpleGit(repoPath);
const log = await git.raw(['log', '--format=%H|%aN|%aE|%aI', '--name-only']);
// Parse into { filePath → [{ author, email, date, commits }] }
```

### KuzuDB WASM
```typescript
import kuzu_wasm from '@kuzu/kuzu-wasm';
const kuzu = await kuzu_wasm();
const db = await kuzu.Database();
const conn = await kuzu.Connection(db);

// Define schema
await conn.execute(`CREATE NODE TABLE Function(id STRING, name STRING, 
                    summary_l1 STRING, PRIMARY KEY(id))`);
await conn.execute(`CREATE NODE TABLE Person(id STRING, name STRING, PRIMARY KEY(id))`);
await conn.execute(`CREATE REL TABLE UNDERSTANDS(FROM Person TO Function, 
                    confidence STRING, topics STRING[])`);

// Insert data
await conn.execute(`CREATE (f:Function {id: 'auth::handleAuth', name: 'handleAuth', 
                    summary_l1: 'Handles user authentication'})`);

// Query (this is what agents write dynamically)
const result = await conn.execute(
  `MATCH (p:Person)-[k:UNDERSTANDS]->(f:Function)
   WHERE p.name = 'alice' AND k.confidence = 'deep'
   RETURN f.name, k.topics`
);

// Derive viz data for react-force-graph
const nodes = await conn.execute(`MATCH (n) RETURN n.id, labels(n)`);
const links = await conn.execute(`MATCH (a)-[r]->(b) RETURN a.id, b.id, type(r)`);
```

---

## 16. Open Questions & Decisions Still Needed

### ~~Graph Storage~~ → RESOLVED: KuzuDB WASM
KuzuDB WASM is the primary graph store. Agents write Cypher dynamically via a `query_graph(cypher)` tool. In-memory JSON is the fallback if KuzuDB WASM setup fails (2-hour rule). The visualization layer derives `{ nodes, links }` from KuzuDB queries — react-force-graph doesn't care where the data comes from.

### Browser + Thin Backend (Hybrid) → RESOLVED
- **Frontend:** Browser-only React app with KuzuDB WASM, Tree-sitter WASM, ElevenLabs SDK, react-force-graph-3d
- **Backend:** Thin Express server (~100 lines) for the Mistral proxy (ElevenLabs custom LLM endpoint) + git preprocessing via simple-git
- Both run locally. Backend exposed via ngrok for ElevenLabs to reach.

### Voxtral Mini 4B Realtime Integration — Still Open
- Could replace ElevenLabs STT or complement it
- Runs on a single GPU with 16GB VRAM — feasible if NVIDIA provides GPU access on-site
- If no GPU access, stick with ElevenLabs' built-in STT (which already works)
- Decision: attempt if GPU available, otherwise skip

### How to Handle the Phone Experience — Decided
- The app is a Vite webapp → works in mobile Chrome/Safari
- `useConversation()` works on mobile browsers
- Three.js / react-force-graph works on mobile
- No native app needed — just open the URL on phone
- For recording: screen-record phone while walking

### Skill Generation from Graph (Stretch)
- Auto-export SKILL.md from graph cluster summaries
- Use upskill eval to show smaller models improve with the skill
- Decision: only attempt in hours 24-28 if ahead of schedule

### NVIDIA GPU for Local Inference (Stretch)
- Running Mistral locally = zero latency, fully local, NVIDIA sponsor angle
- Reality: 3-6 hour setup rabbit hole with CUDA, model downloads, vLLM
- Decision: only if everything else is done by hour 28 AND GPUs are provided

### Raise Paris Local Challenge — Check on-site
- Need to find out specific challenge requirements
- Likely aligns with our "sustainable dev tooling with enterprise potential" angle
- Decision: check during kickoff presentation

---

## 17. Research & Data Points for the Pitch

### METR Study (July 2025)
- 16 experienced developers, randomized controlled trial
- Using AI tools (Cursor Pro + Claude 3.5/3.7 Sonnet): **19% slower actual performance**
- Yet they **believed they were 24% faster**
- Developers spend more time prompting and waiting than actually coding

### Cognitive Offloading
- AI's increasing role enables cognitive offloading, allowing users to bypass deep thinking
- Risks erosion of critical thinking when overused

### Flow State Disruption
- Traditional AI tools violate requirements for optimal programming flow
- Constant context switching carries cognitive overhead that compounds throughout sessions

### Developer Trust Decline
- Only 29% of developers reported trusting AI-generated code accuracy in 2025
- Down from 40% in prior years

### The Stat
- 41% of all code is now AI-generated

---

*Last updated: February 28, 2026*  
*Status: Hackathon day. KuzuDB confirmed, 4-agent architecture finalized, parallel truth-finding designed.*  
*Companion document: Agent Infrastructure (agent-infrastructure.md)*
