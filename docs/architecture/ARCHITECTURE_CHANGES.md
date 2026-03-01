# Architecture Changes & Future Roadmap

## What Changed: Tool Calling → Pre-Computed Briefing

### The Original Design (Planned)

The voice agent was designed to compose and execute Cypher queries **in real time** during the voice conversation:

```
User speaks → ElevenLabs transcribes → Mistral API
    │
    ├── Mistral returns tool_call: queryGraph({ cypher: "MATCH ..." })
    │       │
    │       ▼
    │   Client executes Cypher against KuzuDB WASM (browser)
    │       │
    │       ▼
    │   Tool result sent back to Mistral (via ElevenLabs round-trip)
    │       │
    │       ▼
    │   Mistral composes response using query results
    │
    ├── Mistral returns tool_call: highlightNodes(["fn:auth:login"])
    │       → Graph updates in real-time
    │
    └── ElevenLabs speaks the final response
```

This gave the agent 6 tools:
1. `queryGraph` — execute arbitrary Cypher against KuzuDB
2. `highlightNodes` — highlight graph nodes
3. `flyToNode` — animate camera
4. `switchViewMode` — change overlay
5. `showDetailPanel` — open detail panel
6. `startQuiz` — trigger quiz mode

The agent could answer **any question** about the codebase by composing Cypher on the fly.

### What Broke: ElevenLabs Custom LLM Tool Round-Trip

The ElevenLabs Conversational AI "Custom LLM" integration has a critical limitation:

**Tool calls require a round-trip through ElevenLabs' servers.** When Mistral returns a `tool_calls` response:

1. ElevenLabs receives it and dispatches to the client via WebRTC
2. Client executes the tool (e.g., runs Cypher query)
3. Client sends the tool result back through ElevenLabs
4. ElevenLabs forwards the tool result to the Custom LLM endpoint
5. Mistral generates the final response

This round-trip **failed intermittently** in practice:
- ElevenLabs sometimes didn't forward the tool result correctly
- The proxy received malformed tool-result messages
- Mistral rejected messages with missing `name` fields on tool results
- The latency was 3-5 seconds per tool call, killing the conversational feel

We spent significant time debugging this (adding `name` patching in the proxy, normalizing message formats, etc.) but could not make it reliable enough for a demo.

### The Solution: Pre-Computed Briefing

Instead of real-time tool calls, we pre-compute everything **before** the voice session starts:

```
"I'm Ready" button
    │
    ▼
gatherContext() — 6 parallel KuzuDB queries (browser, <100ms)
    │ files, functions, classes, calls, imports, contributors
    ▼
generateBriefing() — Mistral API (stream:false, JSON mode, 2-5s)
    │ generates 5-8 interview questions + ground truth answers
    ▼
POST /briefing → proxy stores the briefing string
    │
    ▼
"Start Interview" button
    │
    ▼
ElevenLabs voice session starts
    │ proxy injects briefing as system message (replaces ElevenLabs default)
    │ NO tools passed to Mistral — system prompt says "NEVER use tool calls"
    ▼
Pure conversation: agent asks questions, evaluates answers by voice
    │
    ▼
Interview complete → optional Quiz Me (useKnowledge hook, independent)
```

### What We Lost

| Feature | Old (Tool Calling) | New (Briefing) | Impact |
|---------|-------------------|----------------|--------|
| **Ad-hoc questions** | Agent could answer ANY question about the codebase | Agent can only discuss pre-generated questions | High — loses exploratory feel |
| **Real-time graph updates** | `highlightNodes`, `flyToNode` fired during conversation | No graph manipulation during voice | Medium — graph is static during interview |
| **Dynamic Cypher** | Agent composed Cypher on the fly based on user questions | All queries pre-computed before voice | High — loses the "talking to the graph" magic |
| **Quiz via voice** | `startQuiz` tool triggered quiz from voice command | Quiz is button-triggered after interview | Low — quiz still works, just different trigger |
| **Overlay switching** | Agent could switch overlays during conversation | No overlay changes during voice | Medium — user can still manually toggle |
| **Infinite depth** | Agent could chain multiple queries to dig deeper | Limited to pre-gathered context (50 files, 100 functions) | Medium — large codebases may be under-represented |

### What We Gained

| Benefit | Details |
|---------|---------|
| **Reliability** | 100% success rate — no tool round-trip failures |
| **Speed** | <500ms response time during voice (no Cypher latency) |
| **Consistency** | Every interview follows a structured flow |
| **Ground truth** | Questions come with correct answers for evaluation |
| **Simplicity** | Proxy code is much simpler without tool message normalization |

---

## How to Fix It (Restore Real-Time Tool Calling)

If ElevenLabs fixes their Custom LLM tool round-trip, or if we find a workaround:

### Option A: Fix ElevenLabs Tool Round-Trip

1. **Debug the exact failure point** — Add verbose logging to see if ElevenLabs is:
   - Not forwarding tool results at all
   - Forwarding them with wrong format
   - Timing out before the tool result arrives

2. **Test with ElevenLabs' latest SDK** — They may have fixed this in newer versions

3. **Re-enable tools in proxy** — The proxy currently filters tools out. In `server/proxy.ts`:
   ```typescript
   // Current: only passes tools if client explicitly sends them
   const tools = ("tools" in req.body && req.body.tools?.length) ? req.body.tools : undefined;
   ```
   The briefing system prompt also says `NEVER use tool calls`. Remove both restrictions.

4. **Re-add `queryGraph` and `startQuiz` to `agent-tools.ts`** — These were removed. The old implementations are in git history (commit before `dc9e528`).

### Option B: Hybrid Approach (Recommended)

Keep the briefing flow for structured interviews, but add a "free explore" mode:

1. After interview completes, offer "Free Explore" button
2. In free explore mode, inject tools into the Mistral request
3. Use a different system prompt that enables Cypher composition
4. Fall back to briefing-only if tool calls fail

### Option C: Client-Side Tool Execution (Skip ElevenLabs)

Instead of routing tool calls through ElevenLabs:

1. Intercept the Mistral response at the proxy level
2. If it contains `tool_calls`, execute them server-side (proxy queries a KuzuDB instance or uses pre-loaded data)
3. Feed the tool results back to Mistral immediately
4. Return the final response to ElevenLabs as a regular text response

This eliminates the ElevenLabs round-trip entirely. The proxy handles tool calls transparently.

---

## Future Roadmap

### 1. Marketing Website

**Priority: Medium**
**Effort: 2-3 days**

Build a clean landing page for HackStral. Separate from the app — probably a static site.

Pages:
- **Hero** — One-liner, demo video embed, "Try it" CTA
- **How it works** — 3-step flow: Parse → Visualize → Talk
- **Features** — Voice interview, knowledge quiz, 3D graph, overlay modes
- **Tech stack** — Mistral, ElevenLabs, KuzuDB, Three.js
- **For teams** — Bus factor detection, onboarding acceleration, knowledge gap mapping

Tech: Could be a simple Astro/Next.js static site, or even a single-page React app. Deploy on Vercel separately from the main app.

### 2. Mistral-Style UI Design System

**Priority: Medium**
**Effort: 1-2 days**

Create a design skill/reference for Mistral's visual language:
- Color palette (Mistral brand colors, dark theme variants)
- Typography (font choices, sizes, spacing)
- Component patterns (buttons, cards, panels, overlays)
- The characteristic pixel/grid aesthetic

Implementation: Add as a `docs/design/` directory with:
- `colors.md` — hex values, CSS variables, usage guidelines
- `components.md` — component patterns with Tailwind classes
- `reference/` — screenshots or links to Mistral's design system

### 3. Contributor/People Filters in Graph View

**Priority: HIGH — most important for demo**
**Effort: 3-4 hours**
**Status: Backend implemented, UI missing**

The backend is ready:
- `personFilter` state exists in `useGraph.ts`
- `deriveVizData()` in `kuzu.ts` already filters by person in Contributors mode
- Grays out non-matching files, colors matching ones by commit activity

What's missing — **a dropdown UI in Layout.tsx**:

```
┌─────────────────────────┐
│  Overlays               │
│  ● Structure            │
│  ○ Contributors         │
│    └─ Filter: [Alice ▼] │  ← THIS IS MISSING
│  ○ Knowledge            │
│  ○ People               │
└─────────────────────────┘
```

Implementation steps:
1. Query all Person nodes from KuzuDB on load: `MATCH (p:Person) RETURN p.name`
2. Add a `<select>` dropdown in Layout.tsx, visible only in Contributors mode
3. On selection, call `setPersonFilter(name)` from useGraph
4. Graph re-derives with filter → matching files colored, others grayed out
5. Add a "Clear filter" option

Also needed:
- In Knowledge mode: show which person's knowledge is displayed (or aggregate)
- In People mode: click a person node to filter Contributors view to that person
- Cross-overlay filtering: select a person in People mode → switch to Contributors → auto-filtered

### 4. Vercel Deployment

**Priority: HIGH — needed for mobile demo**
**Effort: 4-6 hours**

#### Frontend (Vite static build)

The Vite app can deploy to Vercel as a static site, but needs **COOP/COEP headers** for KuzuDB WASM (SharedArrayBuffer).

Create `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```

#### Proxy Server

The Express proxy (`server/proxy.ts`) needs to be deployed separately:
- **Option A:** Vercel serverless function (convert Express to serverless handler)
- **Option B:** Railway / Render / Fly.io (keeps Express as-is)
- **Option C:** Vercel Edge Function (needs rewrite, but fastest)

The proxy needs:
- `MISTRAL_API_KEY` env var
- Persistent memory for `currentBriefing` (serverless functions are stateless — may need Redis or a different approach)

**Statelessness problem:** The current proxy stores the briefing in memory (`let currentBriefing`). Serverless functions don't persist state between invocations. Solutions:
- Use Vercel KV (Redis) to store the briefing
- Pass the briefing in every request (larger payloads)
- Use a persistent server (Railway/Render) instead of serverless

#### ElevenLabs Custom LLM URL

ElevenLabs needs to reach the proxy. Options:
- If proxy is on Railway/Render: use the public URL directly
- If proxy is serverless on Vercel: use the Vercel URL
- No more ngrok needed in production

#### Mobile Considerations

- Touch-friendly 3D graph controls (pinch-to-zoom, drag-to-rotate)
- Collapsible sidebar for small screens
- Voice works natively via browser WebRTC (AirPods work)
- Test on iOS Safari (WebRTC + SharedArrayBuffer support)

### 5. Progressive Disclosure Per Node (Tree-Based)

**Priority: Medium**
**Effort: 3-4 hours**
**Status: Not implemented**

The NodeDetail panel currently shows everything flat. The plan was:

| Level | Content | Trigger |
|-------|---------|---------|
| **L0** | Name + type badge + file path | Click node |
| **L1** | + Summary + contributors | Default expanded |
| **L2** | + Callers, callees, imports | Click "Show relationships" |
| **L3** | + Knowledge scores, discussion history, confidence breakdown | Click "Show knowledge" |

The data infrastructure exists:
- `getFunctionContext()` in `kuzu.ts` (lines 673-786) queries callers, callees, imports — but it's never called from the UI
- UNDERSTANDS edges have `confidence`, `topics`, `lastAssessed` — never displayed
- Discussion nodes have `transcript`, `quizResult` — never queried from NodeDetail

Implementation:
1. Add expand/collapse sections to NodeDetail.tsx
2. Lazy-load L2/L3 data via `queryGraph()` when sections expand
3. Show relationship tree: File → Functions → Callers/Callees
4. Show knowledge timeline: quiz attempts, confidence changes

### 6. Restore Real-Time Tool Calling (see detailed section above)

**Priority: High (for "wow factor")**
**Effort: 2-5 days depending on approach**

### 7. Graph Reasoner Agent

**Priority: Low (stretch goal)**
**Effort: 3-5 days**

Multi-step Cypher analysis for complex questions like "what's the blast radius if we refactor X?" — requires chaining multiple queries and synthesizing results. Design is in `docs/agents/graph-reasoner.md`.

### 8. Background Enricher Agent

**Priority: Low (stretch goal)**
**Effort: 3-5 days**

Batch AI enrichment: generate summaries for all nodes, compute relevance scores from graph structure, build quiz question banks, detect code clusters. Design is in `docs/agents/background-enricher.md`.

### 9. Pre-Index Sponsor Repos

**Priority: Medium (for hackathon demo value)**
**Effort: 2-3 hours**

Run `bun run parse` and `bun run git-analyze` on real open-source repos to have impressive demo data ready:
- Mistral's own repos
- NVIDIA NeMo
- AWS Strands
- Any repo with rich contributor history

### 10. Video Recording & Walking Demo

**Priority: High (hackathon submission)**
**Effort: 2-3 hours**

- Desk demo: full flow from parse → graph → voice interview → quiz → overlays
- Walking demo: AirPods + phone, voice quiz while walking past Eiffel Tower
- Needs: Vercel deployment working, mobile-responsive UI, stable voice connection

---

## Implementation Priority Order

For maximum demo impact with limited time:

1. **Contributor filter dropdown UI** — 3-4 hours, makes the demo "click" for everyone
2. **Vercel deployment** — 4-6 hours, enables the walking demo
3. **Progressive disclosure per node** — 3-4 hours, adds depth to the UI
4. **Restore tool calling (hybrid approach)** — 2-3 days, brings back the magic
5. **Marketing website** — 2-3 days, for post-hackathon presence
6. **Everything else** — as time allows
