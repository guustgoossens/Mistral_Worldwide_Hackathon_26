# Key Decisions

Architectural and product decisions made during planning, with rationale.

## Decision 1: KuzuDB WASM as Primary Store

**Choice:** KuzuDB WASM (in-browser) over alternatives (Neo4j, NetworkX, plain JSON).

**Rationale:**
- Runs entirely in the browser — no server-side graph DB needed
- Native Cypher support — agents compose real graph queries
- WASM performance is sufficient for hackathon-scale graphs (thousands of nodes)
- Fallback: if WASM proves problematic within 2 hours, switch to in-memory JSON with a Cypher-like query interface

**Risk:** WASM initialization requires COEP/COOP headers (SharedArrayBuffer). Handled in vite.config.ts.

## Decision 2: Person Nodes as Invisible Infrastructure

**Choice:** Option B — Person nodes exist in KuzuDB but are hidden from default 3D view.

**Rationale:**
- Code-first visualization is cleaner and more focused
- Person data surfaces through overlay modes (contributors, knowledge, people)
- Powerful queries still available: "who knows X?", "what's the bus factor for Y?"
- People overlay makes Person nodes visible when explicitly requested

**Alternative considered:** Option A (always visible) — too cluttered; Option C (no Person nodes) — loses relationship query power.

## Decision 3: Four Overlay Modes

**Choice:** Modal display with structure/contributors/knowledge/people overlays.

**Rationale:**
- Each overlay answers different questions about the codebase
- Same underlying graph data, different visual projections
- Overlay switching is a natural voice command ("show me contributors")
- Keeps the default view simple while enabling rich exploration

## Decision 4: Devstral-small for Voice

**Choice:** devstral-small-2507 as the default voice model.

**Rationale:**
- Optimized for speed (~200ms first token) — critical for voice UX
- Good enough for Cypher composition and conversational responses
- More powerful models (codestral, mistral-medium) used for complex tasks
- Easy to swap model per-request via the proxy

## Decision 5: ElevenLabs Client Tools over Server Tools

**Choice:** Client-side tool execution (browser) rather than server-side.

**Rationale:**
- KuzuDB runs in the browser — tools need direct access
- No additional server roundtrip for graph queries
- Real-time UI updates (highlight, overlay) happen client-side
- ElevenLabs SDK supports client tool registration natively

## Decision 6: Express Proxy for Mistral

**Choice:** Lightweight Express server rather than direct API calls.

**Rationale:**
- ElevenLabs custom LLM requires an OpenAI-compatible endpoint
- Proxy adds API key server-side (not exposed to browser)
- Supports streaming (SSE) for real-time voice
- Can add rate limiting, logging, model routing later

## Open Questions

- **Voxtral Mini 4B Realtime:** Depends on GPU availability on-site. If NVIDIA GPU available, could run locally for lower latency.
- **KuzuDB WASM initialization:** Exact pattern needs live testing. 2-hour rule applies.
- **Agent 3 sub-agent spawning:** Implementation depth depends on hackathon time.
- **Raise Paris challenge:** Check specifics on-site.
- **NVIDIA GPU for local inference:** Stretch goal.
