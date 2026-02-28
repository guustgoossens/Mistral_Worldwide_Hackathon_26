# Parallel Agent Orchestration Plan — HackStral

> **Living document.** Agents read their section, execute, then update Status and Notes.
> Status codes: `⬜ pending` → `🔄 in_progress` → `✅ done` / `❌ blocked`

---

## File Ownership Map (prevents conflicts — no two parallel agents edit the same file)

| File | P1a | P2a | P3a | P4a |
|------|-----|-----|-----|-----|
| `src/data/sample-graph.ts` | P1-A1 | - | - | - |
| `server/proxy.ts` | P1-A2 | - | - | - |
| `src/hooks/useGraph.ts` | P1-A3 | - | - | - |
| `src/components/Graph3D.tsx` | P1-A3 | - | - | P4-A1 |
| `src/hooks/useVoiceAgent.ts` | - | P2-A1 | - | - |
| `src/lib/agent-tools.ts` | - | P2-A2 | - | - |
| `src/App.tsx` | - | P2-A3 | P3-A3 | P4-A2 |
| `src/components/VoiceControls.tsx` | - | P2-A3 | - | - |
| `src/components/AgentStatus.tsx` | - | P2-A3 | - | P4-A2 |
| `src/hooks/useKnowledge.ts` | - | - | P3-A1 | - |
| `src/components/QuizPanel.tsx` | - | - | P3-A2 | - |
| `src/components/Layout.tsx` | - | - | P3-A3 | P4-A3 |
| `src/components/NodeDetail.tsx` | - | - | - | P4-A3 |

---

## Dependency Graph

```
Phase 1a:  P1-A1 ║ P1-A2 ║ P1-A3     (parallel, ~25 min)
                 ╲    │    ╱
Phase 1b:          P1-B1              (sequential, ~20 min)
                  ╱      ╲
Phase 1c:    P1-C1 ║ P1-C2           (parallel, ~10 min)
                  ╲      ╱
               ═══ GATE 1 ═══
Phase 2a:  P2-A1 ║ P2-A2 ║ P2-A3     (parallel, ~30 min)
                 ╲    │    ╱
Phase 2b:          P2-B1              (sequential, ~25 min)
                  ╱      ╲
Phase 2c:    P2-C1 ║ P2-C2           (parallel, ~10 min)
                  ╲      ╱
               ═══ GATE 2 ═══
Phase 3a:  P3-A1 ║ P3-A2 ║ P3-A3     (parallel, ~40 min)
                 ╲    │    ╱
Phase 3b:          P3-B1              (sequential, ~20 min)
                  ╱      ╲
Phase 3c:    P3-C1 ║ P3-C2           (parallel, ~10 min)
                  ╲      ╱
               ═══ GATE 3 ═══
Phase 4a:  P4-A1 ║ P4-A2 ║ P4-A3     (parallel, ~30 min)
                 ╲    │    ╱
Phase 4b:          P4-B1              (sequential, ~15 min)
                  ╱      ╲
Phase 4c:    P4-C1 ║ P4-C2           (parallel, ~10 min)

Total wall-clock: ~4 hours
```

---

# PHASE 1: Data Validation & Foundation Hardening

**Goal:** Verify existing code works end-to-end; fix schema mismatches; harden the foundation.

## Phase 1a — Parallel Execution Agents

---

### P1-A1: Schema Alignment Auditor

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/data/sample-graph.ts`

**Reads:**
- `src/lib/kuzu.ts` (lines 44-76: schema DDL — see column names)
- `src/data/sample-graph.ts` (lines 103-114: `nodeInsertCypher` — uses `summary_l1`, `structuralImportance`)
- `src/lib/graph-builder.ts` (how real data is loaded — uses `summary`, `relevance`)

**Task:**
The `sample-graph.ts` loader uses old column names (`summary_l1`, `summary_l2`, `summary_l3`, `structuralImportance`) that don't match the current schema DDL (`summary STRING`, `relevance DOUBLE`). Fix `nodeInsertCypher` for Function nodes to use `summary` and `relevance` instead.

**Success criteria:**
1. `bun run build` passes with zero TypeScript errors
2. Sample data loads into KuzuDB with zero `Failed to insert` warnings
3. Column names in INSERT Cypher match the DDL in `setupSchema()`

---

### P1-A2: Proxy Server Enhancement

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `server/proxy.ts`, `.env.local.example`

**Reads:**
- `server/proxy.ts` (current implementation)
- `docs/architecture/voice-flow.md` (ElevenLabs → proxy flow)

**Task:**
1. Add `GET /v1/models` endpoint returning `{ data: [{ id: "devstral-small-2507", ... }] }` (ElevenLabs may query this)
2. Add request logging: log method, path, and model on each request
3. Ensure CORS `Access-Control-Allow-Origin: *` covers ElevenLabs WebSocket origin
4. Add `NGROK_URL` to `.env.local.example` with comment

**Success criteria:**
1. `bun run dev:server` starts without errors
2. `curl http://localhost:3001/health` returns `{"status":"ok"}`
3. `curl http://localhost:3001/v1/models` returns JSON with model list
4. Request logging visible in terminal

---

### P1-A3: Graph Visualization Hardening

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/hooks/useGraph.ts`, `src/components/Graph3D.tsx`

**Reads:**
- `src/hooks/useGraph.ts` (current state management)
- `src/hooks/useKuzu.ts` (data loading flow)
- `src/lib/kuzu.ts` (deriveVizData signature — accepts `_personFilter?`)
- `src/components/Graph3D.tsx` (current rendering)
- `public/data/graph.json` (actual parsed data format)

**Task:**
1. Add `personFilter` state to `useGraph` hook; pass it to `deriveVizData(conn, overlay, personFilter)`
2. Expose `setPersonFilter(name: string | undefined)` from the hook
3. Expose `flyToNode(nodeId: string)` method on `Graph3D` via `forwardRef` + `useImperativeHandle` — finds node in graphData, calls `graphRef.current.cameraPosition()` to animate
4. Add `linkDirectionalParticles` and `linkDirectionalParticleSpeed` props as prep (values can be 0 for now)

**Success criteria:**
1. All 4 overlay modes render without console errors with real data
2. `flyToNode` method is callable from parent component via ref
3. `personFilter` state exists and is passed through to `deriveVizData`
4. `setPersonFilter` is exposed from useGraph

---

## Phase 1b — Test Writing Agent

### P1-B1: Phase 1 Test Suite

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P1-A1, P1-A2, P1-A3

**Creates:** `server/proxy.test.ts` (new), `src/hooks/useGraph.test.ts` (new)
**Extends:** `src/lib/kuzu.test.ts`

**Task:**
1. Extend `kuzu.test.ts`: add test that sample data INSERT Cypher uses correct column names (`summary`, `relevance`)
2. New `proxy.test.ts`: test `/health` returns 200, `/v1/models` returns model list, CORS headers present
3. New `useGraph.test.ts`: test `personFilter` state, overlay mode switching

**Success criteria:**
1. All new tests pass with `bun test`
2. Uses existing mock patterns from `kuzu.test.ts`

---

## Phase 1c — Review + Test Runner (parallel)

### P1-C1: Code Review Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P1-B1
**Task:** Review all P1 changes for correctness, TypeScript strictness, no regressions.
**Success criteria:** Zero critical issues

### P1-C2: Test Runner Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P1-B1
**Task:** Run `bun test`, `bun run build`, `bun run lint`.
**Success criteria:** All pass with zero errors

---

### GATE 1: P1-C1 zero critical issues AND P1-C2 all green → proceed to Phase 2

---

# PHASE 2: Voice Agent Integration

**Goal:** User speaks → ElevenLabs transcribes → Mistral responds with tool calls → graph updates → voice responds.

## Phase 2a — Parallel Execution Agents

---

### P2-A1: ElevenLabs Voice Hook

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/hooks/useVoiceAgent.ts`

**Reads:**
- `src/hooks/useVoiceAgent.ts` (current stub — console.warn placeholders)
- `node_modules/@elevenlabs/react/dist/index.d.ts` (useConversation API)
- `node_modules/@elevenlabs/client/dist/BaseConversation.d.ts` (ClientToolsConfig)
- `src/lib/agent-tools.ts` (createAgentTools interface — from P2-A2, but interface is known)
- `docs/architecture/voice-flow.md`

**Task:**
Implement the full voice hook using ElevenLabs `useConversation()`:

```typescript
export function useVoiceAgent(deps: {
  executeQuery: (cypher: string) => Promise<unknown[]>;
  highlightNodes: (ids: string[]) => void;
  setOverlay: (mode: OverlayMode) => void;
  selectNode: (nodeId: string) => void;
  flyToNode?: (nodeId: string) => void;
  startQuiz?: (functionId: string) => void;
}): {
  isConnected: boolean;
  isSpeaking: boolean;
  status: "disconnected" | "connecting" | "connected" | "disconnecting";
  transcript: Array<{ role: "user" | "agent"; content: string }>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}
```

Implementation:
1. Call `useConversation()` with `clientTools` from `createAgentTools(deps)` and `onMessage`/`onConnect`/`onDisconnect`/`onStatusChange` callbacks
2. `start()` calls `conversation.startSession({ agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID })`
3. `stop()` calls `conversation.endSession()`
4. Track transcript as array via `onMessage` callback
5. Map `conversation.status` to `isConnected` boolean

**Success criteria:**
1. Hook compiles with zero TypeScript errors
2. `start()` initiates ElevenLabs WebRTC connection
3. `stop()` cleanly disconnects
4. Transcript updates in real-time
5. `isConnected` and `isSpeaking` accurately reflect state

---

### P2-A2: Client Tool Handlers

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/lib/agent-tools.ts`

**Reads:**
- `src/lib/agent-tools.ts` (current stub — returns `[]`)
- `docs/architecture/voice-flow.md` (tool schemas)
- `src/lib/kuzu.ts` (queryGraph function)
- `src/types/graph.ts` (OverlayMode type)

**Task:**
Implement `createAgentTools(deps)` returning a `Record<string, (parameters: any) => Promise<string>>`:

```typescript
interface AgentToolDeps {
  executeQuery: (cypher: string) => Promise<unknown[]>;
  highlightNodes: (ids: string[]) => void;
  setOverlay: (mode: OverlayMode) => void;
  selectNode: (nodeId: string) => void;
  flyToNode?: (nodeId: string) => void;
  startQuiz?: (functionId: string) => void;
}
```

Tools:
1. **`queryGraph`** `({ cypher: string })` → execute Cypher, `JSON.stringify(results).slice(0, 2000)`
2. **`highlightNodes`** `({ nodeIds: string[] })` → call deps, return `"Highlighted N nodes"`
3. **`switchViewMode`** `({ mode: string, filterPerson?: string })` → call deps, return confirmation
4. **`flyToNode`** `({ nodeId: string })` → call deps, return confirmation
5. **`showDetailPanel`** `({ nodeId: string })` → call deps, return confirmation
6. **`startQuiz`** `({ topic?: string })` → call deps, return confirmation

**Success criteria:**
1. All 6 handlers return strings (required by ElevenLabs protocol)
2. `queryGraph` truncates results to max 2000 chars
3. Missing optional deps (flyToNode, startQuiz) handled gracefully
4. TypeScript compiles cleanly

---

### P2-A3: App Wiring + VoiceControls Polish

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/App.tsx`, `src/components/VoiceControls.tsx`, `src/components/AgentStatus.tsx`

**Reads:**
- `src/App.tsx` (current hook wiring)
- `src/components/VoiceControls.tsx` (current mic button UI)
- `src/components/AgentStatus.tsx` (current status dots)
- P2-A1 interface (known above)
- P2-A2 deps interface (known above)

**Task:**
1. In `App.tsx`: pass deps from `useKuzu` and `useGraph` into `useVoiceAgent`:
   ```ts
   const voice = useVoiceAgent({
     executeQuery: kuzu.executeQuery,
     highlightNodes: graph.highlightNodes,
     setOverlay: graph.setOverlayMode,
     selectNode: graph.selectNode,
     flyToNode: graphRef.current?.flyToNode,
   });
   ```
2. In `VoiceControls.tsx`: show "Connecting..." state with animated spinner during WebRTC setup; show error message on disconnect error; update mic button to reflect all states (idle/connecting/listening/speaking)
3. In `AgentStatus.tsx`: add yellow dot for "connecting" voice state; keep green for connected, red for error

**Success criteria:**
1. Deps flow correctly from hooks through App to VoiceAgent
2. VoiceControls shows all 4 states visually
3. AgentStatus has 3-color voice indicator (red/yellow/green)
4. TypeScript compiles cleanly

---

## Phase 2b — Test Writing Agent

### P2-B1: Voice Integration Tests

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P2-A1, P2-A2, P2-A3

**Creates:** `src/lib/agent-tools.test.ts` (new), `src/hooks/useVoiceAgent.test.ts` (new)

**Task:**
1. `agent-tools.test.ts`: test each of 6 handlers with mock deps; verify queryGraph truncation at 2000 chars; verify all return strings; verify missing optional deps don't throw
2. `useVoiceAgent.test.ts`: mock `useConversation`; test start/stop; test transcript accumulation; test status mapping

**Success criteria:**
1. All tests pass with `bun test`
2. Agent tools tests verify truncation and return types
3. Voice hook tests verify state management

---

## Phase 2c — Review + Test Runner (parallel)

### P2-C1: Code Review Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P2-B1
**Task:** Review P2 changes. Focus: ElevenLabs API correctness, tool handler return types, race conditions in async voice state.
**Success criteria:** Zero critical issues

### P2-C2: Test Runner Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P2-B1
**Task:** Run `bun test`, `bun run build`, `bun run lint`.
**Success criteria:** All pass with zero errors

---

### GATE 2: P2-C1 zero critical issues AND P2-C2 all green → proceed to Phase 3

---

# PHASE 3: Quiz & Knowledge System

**Goal:** Quiz users on code they don't know; track knowledge in KuzuDB; color the graph by understanding level.

## Phase 3a — Parallel Execution Agents

---

### P3-A1: Knowledge Hook Implementation

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/hooks/useKnowledge.ts`

**Reads:**
- `src/hooks/useKnowledge.ts` (current stub)
- `src/types/graph.ts` (UnderstandsRel, DiscussionNode)
- `src/lib/kuzu.ts` (queryGraph, schema DDL for UNDERSTANDS/Discussion)
- `docs/agents/quiz-master.md` (quiz flow, spaced repetition)
- `docs/architecture/graph-data-model.md` (UNDERSTANDS schema)

**Task:**
Implement full quiz state machine:

```typescript
export function useKnowledge(deps: {
  executeQuery: (cypher: string) => Promise<unknown[]>;
  personId?: string;
}): {
  scores: Map<string, number>;           // functionId → 0.0-1.0
  activeQuiz: null | { functionId: string; question: string; groundTruth?: string };
  isGenerating: boolean;
  startQuiz: (functionId?: string) => Promise<void>;
  submitAnswer: (answer: string) => Promise<{ confidence: string; feedback: string }>;
  getNextQuizTarget: () => Promise<string | null>;
}
```

Key logic:
1. **`startQuiz(functionId?)`**: If no functionId, pick best candidate via spaced repetition:
   ```cypher
   MATCH (f:Function)
   OPTIONAL MATCH (p:Person)-[u:UNDERSTANDS]->(f) WHERE p.id = $personId
   RETURN f.id, f.name, f.summary, f.relevance,
          COALESCE(u.confidence, 'none') AS confidence
   ORDER BY f.relevance DESC
   ```
   Then prioritize: `priority = relevance * (1 - confidenceScore)` where deep=1.0, surface=0.5, none=0.0.
   Fetch function context (name, summary, callers, callees) via Cypher.
   Call Mistral proxy `POST /v1/chat/completions` to generate a question.

2. **`submitAnswer(answer)`**: Call Mistral to evaluate answer against function context. Determine confidence (deep/surface/none). Create/update UNDERSTANDS edge:
   ```cypher
   MERGE (p:Person {id: $personId})-[u:UNDERSTANDS]->(f:Function {id: $funcId})
   SET u.confidence = $confidence, u.source = 'quiz', u.lastAssessed = $now
   ```

3. **`scores`**: Loaded on init via `MATCH (p:Person)-[u:UNDERSTANDS]->(f:Function) RETURN f.id, u.confidence`

**Success criteria:**
1. `startQuiz()` picks a function and generates a question via Mistral
2. `submitAnswer()` evaluates and creates UNDERSTANDS edge in KuzuDB
3. Spaced repetition formula correctly prioritizes low-confidence + high-relevance functions
4. `scores` map accurately reflects KuzuDB data

---

### P3-A2: Quiz UI Enhancement

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/components/QuizPanel.tsx`

**Reads:**
- `src/components/QuizPanel.tsx` (current two-button UI)
- `src/hooks/useKnowledge.ts` (P3-A1 interface above)
- `src/index.css` (theme colors, CSS variables)

**Task:**
Replace the simple quiz UI with a full-featured panel:
1. **Loading state**: Spinner + "Generating question..." while `isGenerating` is true
2. **Question display**: Show function name, file path, and the generated question
3. **Answer input**: Text input field for typed answers (voice answers go through the voice agent)
4. **Quick buttons**: "I know this" (confidence=deep), "Not sure" (confidence=surface), "Skip" (no update)
5. **Result feedback**: After submission, show correct/partial/incorrect with color coding (green/yellow/red)
6. **Confidence badge**: Small colored dot showing current confidence for this function
7. Use existing theme: `bg-surface`, `border-border`, `text-text`, `text-text-muted`

**Success criteria:**
1. QuizPanel shows loading state when `isGenerating` is true
2. Shows question with answer input when quiz is active
3. Shows result feedback after answer submission
4. Uses existing Tailwind theme classes
5. Keyboard accessible (Enter to submit, Escape to close)

---

### P3-A3: Knowledge Wiring + "I'm Waiting" Button

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/App.tsx`, `src/components/Layout.tsx`

**Reads:**
- `src/App.tsx` (current hook wiring)
- `src/components/Layout.tsx` (current sidebar with overlay toggles)
- `src/hooks/useKnowledge.ts` (P3-A1 interface)
- `src/lib/kuzu.ts` (knowledge overlay at lines 313-371)
- `docs/agents/quiz-master.md` ("I'm waiting" button spec)

**Task:**
1. In `App.tsx`:
   - Initialize `useKnowledge({ executeQuery: kuzu.executeQuery, personId: 'p:user' })`
   - Pass knowledge props to `QuizPanel`: `activeQuiz`, `isGenerating`, `submitAnswer`, `startQuiz`
   - Connect voice agent's `startQuiz` tool to `knowledge.startQuiz`
2. In `Layout.tsx`:
   - Add "I'm Waiting" / "Quiz Me" button below the overlay toggles
   - Button calls `knowledge.startQuiz()` (no functionId = auto-pick)
   - Disable button when `isGenerating` is true
   - Show "Generating..." text when active

**Success criteria:**
1. "I'm Waiting" button visible in sidebar, triggers quiz generation
2. QuizPanel appears with generated question
3. Knowledge overlay (already implemented in deriveVizData) colors functions correctly
4. Voice agent's `startQuiz` tool works end-to-end

---

## Phase 3b — Test Writing Agent

### P3-B1: Quiz System Tests

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P3-A1, P3-A2, P3-A3

**Creates:** `src/hooks/useKnowledge.test.ts` (new)

**Task:**
1. Test quiz target selection (spaced repetition scoring formula)
2. Test UNDERSTANDS Cypher generation (correct column names, escaping)
3. Test scores map loading from mock KuzuDB results
4. Test edge cases: no functions in DB, all functions already assessed

**Success criteria:** All tests pass with `bun test`

---

## Phase 3c — Review + Test Runner (parallel)

### P3-C1: Code Review Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P3-B1
**Task:** Review P3 changes. Focus: Cypher query correctness, no injection via user input, Mistral API call format.
**Success criteria:** Zero critical issues; no unescaped user input in Cypher strings

### P3-C2: Test Runner Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P3-B1
**Task:** Run `bun test`, `bun run build`, `bun run lint`.
**Success criteria:** All pass with zero errors

---

### GATE 3: P3-C1 zero critical issues AND P3-C2 all green → proceed to Phase 4

---

# PHASE 4: Polish & Demo Readiness

**Goal:** Visual stunning-ness, error handling, mobile support, demo-ready.

## Phase 4a — Parallel Execution Agents

---

### P4-A1: Camera Animations & Visual Effects

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/components/Graph3D.tsx`

**Reads:**
- `src/components/Graph3D.tsx` (current rendering + flyToNode from P1-A3)
- react-force-graph-3d API docs (linkDirectionalParticles, nodeThreeObject, cameraPosition)
- `src/types/graph.ts` (VizLink type field)

**Task:**
1. **Particles on CALLS edges**: `linkDirectionalParticles={link => link.type === 'calls' ? 2 : 0}`, `linkDirectionalParticleSpeed={0.005}`, `linkDirectionalParticleColor` based on link type
2. **Smooth flyToNode**: Animate camera from current position to target node position over 1000ms using `graphRef.current.cameraPosition()`
3. **Node glow on highlight**: Use `nodeThreeObject` for highlighted nodes — create a Three.js Sprite with a glow texture (or a larger semi-transparent sphere)
4. **Edge colors by type**: CALLS=#f59e0b, IMPORTS=#6366f1, CONTAINS=#374151 (subtle)

**Success criteria:**
1. Particles visibly flow along CALLS edges
2. `flyToNode(nodeId)` smoothly animates camera (not instant jump)
3. Highlighted nodes are visually distinct (glow, pulse, or size increase)
4. Performance stays above 30fps with 200+ nodes

---

### P4-A2: Error Handling & Loading States

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/App.tsx`, `src/components/AgentStatus.tsx`

**Reads:**
- `src/App.tsx` (current structure)
- `src/components/AgentStatus.tsx` (current dots)
- `src/hooks/useKuzu.ts` (error and loading states)

**Task:**
1. **Loading screen**: Show centered spinner + "Initializing graph database..." while KuzuDB loads
2. **Data source indicator**: Small badge in AgentStatus: "Real data (N nodes)" vs "Sample data"
3. **Error boundary**: Wrap Graph3D in error boundary with friendly fallback
4. **Voice error recovery**: Show "Connection lost. Tap to retry." in VoiceControls on disconnect error
5. **No raw stack traces**: All error messages are user-friendly strings

**Success criteria:**
1. Clean loading → graph transition (no flash of empty state)
2. Data source clearly visible
3. Graph3D crash doesn't take down the whole app
4. Voice errors show retry option

---

### P4-A3: UI Polish & Sidebar Enhancement

**Status:** ⬜ pending
**Agent notes:**

**Edits:** `src/components/Layout.tsx`, `src/components/NodeDetail.tsx`

**Reads:**
- `src/components/Layout.tsx` (current sidebar)
- `src/components/NodeDetail.tsx` (current detail panel)
- `src/types/graph.ts` (VizNode type with contributors, knowledgeScore)

**Task:**
1. **Repo stats**: Show file count, function count, contributor count in sidebar header (query KuzuDB)
2. **Contributor filter dropdown**: In Contributors overlay mode, show a dropdown of person names; selecting one sets `personFilter`
3. **Progressive disclosure in NodeDetail**:
   - L1 (default): Name, type badge, file path, summary
   - L2 (expand): Callers, callees, import chain
   - L3 (expand): Contributors, knowledge score, last assessed
4. **Mobile responsive**: Collapsible sidebar (hamburger icon), full-width graph on mobile

**Success criteria:**
1. Sidebar shows repo stats when KuzuDB is loaded
2. Contributor filter dropdown works and graph updates
3. NodeDetail shows L1 by default, expands to L2/L3
4. Layout is usable on mobile viewport (< 768px)

---

## Phase 4b — Test Writing Agent

### P4-B1: Polish Tests

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P4-A1, P4-A2, P4-A3

**Creates:** `src/components/Graph3D.test.ts` (new)

**Task:**
1. Test flyToNode method exists and is callable
2. Test particle configuration props
3. Test error boundary renders fallback on Graph3D error

**Success criteria:** All tests pass; no regressions

---

## Phase 4c — Review + Test Runner (parallel)

### P4-C1: Code Review Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P4-B1
**Task:** Review P4 changes. Focus: Three.js performance, no memory leaks, mobile CSS.
**Success criteria:** Zero critical issues

### P4-C2: Test Runner Agent

**Status:** ⬜ pending
**Agent notes:**

**Depends on:** P4-B1
**Task:** Run `bun test`, `bun run build`, `bun run lint`.
**Success criteria:** All pass with zero errors

---

### GATE 4: P4-C1 zero critical issues AND P4-C2 all green → DEMO READY

---

# Time Estimates

| Phase | Sub-phase | Duration | Cumulative |
|-------|-----------|----------|------------|
| Phase 1 | 1a (parallel) | ~25 min | 25 min |
| | 1b (tests) | ~20 min | 45 min |
| | 1c (review+run) | ~10 min | 55 min |
| Phase 2 | 2a (parallel) | ~30 min | 1h 25m |
| | 2b (tests) | ~25 min | 1h 50m |
| | 2c (review+run) | ~10 min | 2h 00m |
| Phase 3 | 3a (parallel) | ~40 min | 2h 40m |
| | 3b (tests) | ~20 min | 3h 00m |
| | 3c (review+run) | ~10 min | 3h 10m |
| Phase 4 | 4a (parallel) | ~30 min | 3h 40m |
| | 4b (tests) | ~15 min | 3h 55m |
| | 4c (review+run) | ~10 min | 4h 05m |

**Total wall-clock: ~4 hours** (with parallelism within sub-phases)

---

# How to Use This Document

## For the orchestrator (human):
1. Start Phase 1a by launching 3 parallel agents (P1-A1, P1-A2, P1-A3)
2. Each agent reads its section above, executes, updates Status to `✅ done`
3. When all 1a agents are done, launch P1-B1
4. When P1-B1 is done, launch P1-C1 and P1-C2 in parallel
5. Check gate conditions; if passed, proceed to Phase 2a
6. Repeat for each phase

## For each agent:
1. Read your section (ID, task, reads, edits, success criteria)
2. Update your **Status** to `🔄 in_progress`
3. Execute your task
4. Update your **Status** to `✅ done` or `❌ blocked`
5. Add any relevant observations to **Agent notes**

## For review agents:
1. Read all files modified in the phase
2. Check against success criteria
3. Report issues in **Agent notes**
4. Set status to `✅ done` if clean, `❌ blocked` if issues found
