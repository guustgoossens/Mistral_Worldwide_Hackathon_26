# Phased Plan: From Here to Delivery

---

## Phase 1: Real Data Pipeline ✅

**Goal:** Parse a real repo and show it in the 3D graph with git data.

1. **Implement `scripts/git-analyze.ts`** — Use `simple-git` to extract per-file contributor stats → write `data/output/git-data.json`
2. **Implement `scripts/parse-repo.ts`** — Use `web-tree-sitter` to extract functions/classes/imports/calls → write `data/output/graph.json`
3. **Implement `src/lib/git-data.ts`** — Load `git-data.json` → create Person nodes + CONTRIBUTED edges in KuzuDB
4. **Implement `src/lib/graph-builder.ts`** — Load `graph.json` → create File/Function/Class nodes + structural edges in KuzuDB (replacing sample data)
5. **Complete `deriveVizData()`** — Implement contributors, knowledge, and people overlay queries

**Deliverable:** Drop in a real repo → see it as a 3D graph with contributor data. Toggle overlays.

---

## Phase 2: Voice Agent ✅

**Goal:** Talk to the graph. This IS the product.

1. **Implement `src/hooks/useVoiceAgent.ts`** — Wire up ElevenLabs `useConversation()` with custom LLM endpoint (your proxy) + client tools
2. **Implement `src/lib/agent-tools.ts`** — Define client tools: `query_graph`, `highlight_nodes`, `set_overlay`, `get_node_detail`
3. **Configure ElevenLabs agent** — System prompt (codebase assistant), custom LLM URL (ngrok → proxy), register tools
4. **Set up ngrok** — Tunnel localhost:3001 so ElevenLabs can reach Mistral proxy
5. **Wire graph highlighting** — When agent calls `highlight_nodes`, camera flies to those nodes and they glow
6. **Polish VoiceControls component** — Real transcript display, connection status

**Deliverable:** Ask "What does the auth service do?" by voice → agent responds, graph highlights relevant nodes.

---

## Phase 3: Quiz & Knowledge System ✅

**Goal:** Get quizzed on code you don't know.

1. **Implement `src/hooks/useKnowledge.ts`** — Track confidence per Person × Function via UNDERSTANDS edges
2. **Quiz generation** — Agent picks low-familiarity nodes via Cypher, generates contextual questions
3. **Wire QuizPanel** — Show question, capture answer, evaluate, update UNDERSTANDS + DISCUSSED in KuzuDB
4. **Knowledge overlay** — Green/yellow/red coloring based on knowledge scores
5. **"I'm waiting" button** — Triggers quiz mode (Companion V1)

**Deliverable:** Tap "I'm waiting" → voice quiz starts → answer right → node turns green.

---

## Phase 4: Polish & Demo Prep (in progress)

**Goal:** Make it demo-ready and visually stunning.

1. **People overlay** — Person nodes appear, connected to code, visual clusters
2. **Camera animations** — Smooth fly-to on voice queries, zoom transitions between overlays
3. **Particle effects** — Animated dots on edges, glow on active nodes
4. **Pre-index sponsor repos** — Run parse + git-analyze on NVIDIA NeMo / AWS Strands
5. **Mobile responsiveness** — Ensure 3D graph + voice work on phone browser (Eiffel Tower demo)
6. **Edge cases** — Error handling, loading states, empty states

---

## Phase 5: Record & Submit (~2-3 hours)

**Goal:** 2-minute video + submission.

1. **Record desk demo** — Drop repo → graph builds → voice interaction → quiz → overlays
2. **Record Eiffel Tower walk** — AirPods + phone, voice quiz while walking
3. **Edit 2-minute video** — Combine desk + walking footage
4. **Submit on hackiterate.com** — Title, description, screenshot, GitHub URL, video URL
5. **Write README** — Clean up, push final code

---

## Critical Path & Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Tree-sitter WASM is fiddly | 2-hour rule: if it fights you, use regex-based extraction for 80% coverage |
| ElevenLabs custom LLM setup | SDK handles most complexity; ngrok is the main variable |
| Quiz quality | Start with simple "what does X do?" questions; parallel truth-finding is a stretch goal |
| Time pressure on video | Record walking footage during a break at hour ~28, not at the end |

---

## Priority Call

If time gets tight, **Phase 2 (Voice) is non-negotiable** — it's the core differentiator. Phase 1 can fall back to the sample data (still impressive). Phase 3 can be simplified to a basic quiz without spaced repetition. Phase 4 polish is nice-to-have.

**The minimum viable demo is:** Real-looking graph + voice interaction + one overlay toggle + walking footage.
