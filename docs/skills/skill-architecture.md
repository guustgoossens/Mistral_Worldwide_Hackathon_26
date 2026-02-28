# Skill Architecture

How the Cypher skill (graph schema knowledge + query patterns) is exposed to different consumers.

## Consumer Matrix

| Consumer | Knowledge Source | Query Execution | Runtime |
|----------|-----------------|-----------------|---------|
| Voice Agent (ElevenLabs) | System prompt via `overrides` | `queryGraph` client tool | Browser |
| Graph Reasoner (Agent 3) | System prompt in API call | `queryGraph` function call | Server |
| Background Enricher (Agent 4) | System prompt in API call | `queryGraph` function call | Server |
| Claude Code | `.claude/skills/` | MCP tool (Phase 2c) | CLI |
| Cursor / external editors | MCP server | MCP tool calls (Phase 2c) | Editor |
| ElevenLabs via MCP | MCP server (native support) | MCP tool calls (Phase 2c) | Cloud |

## Knowledge Flow

```
docs/skills/cypher-skill.md          <-- Canonical reference (humans + docs)
        │
        ├── src/prompts/voice-agent.ts       <-- Derived: ElevenLabs system prompt (~800 tokens)
        │       └── useVoiceAgent.ts         <-- Injected via startSession overrides
        │
        ├── src/prompts/graph-reasoner.md    <-- Derived: Agent 3 system prompt (Phase 3)
        ├── src/prompts/background-enricher.md <-- Derived: Agent 4 system prompt (Phase 3)
        │
        └── .claude/skills/hackstral-cypher/ <-- Derived: Claude Code skill (L1/L2/L3)
                └── SKILL.md
```

## Design Principles

1. **Single source of truth**: `docs/skills/cypher-skill.md` has the full schema DDL, all Cypher patterns, and tool documentation. All other prompts are derived from it.

2. **Progressive derivation**: Each consumer gets a prompt tailored to its constraints:
   - Voice agent: <2000 tokens, optimized for speech patterns
   - Graph Reasoner: Longer, includes multi-step reasoning examples
   - Claude Code skill: L1/L2/L3 progressive loading

3. **Runtime injection**: The voice agent prompt is stored in code (`src/prompts/voice-agent.ts`) and injected via ElevenLabs `startSession` overrides. No manual dashboard copy-paste — the code is the source of truth.

4. **MCP bridge (Phase 2c)**: A KuzuDB MCP server will unify access for Claude Code, Cursor, and ElevenLabs (which natively supports MCP). This replaces the need for separate Claude Code skills with a live query interface.

## Current Status

| Component | Status |
|-----------|--------|
| Canonical reference (`cypher-skill.md`) | Done |
| Voice agent prompt (`voice-agent.ts`) | Done |
| Prompt injection (`useVoiceAgent.ts`) | Done |
| Claude Code skill (`.claude/skills/`) | Done |
| Graph Reasoner prompt | Stub (Phase 3) |
| Background Enricher prompt | Stub (Phase 3) |
| KuzuDB MCP server | Not started (Phase 2c) |

## Tool Surface

All agents share the same 6 client tools (defined in `src/lib/agent-tools.ts`):

1. **queryGraph** — Execute Cypher, returns JSON (truncated to 2000 chars)
2. **highlightNodes** — Highlight nodes in 3D visualization
3. **switchViewMode** — Switch overlay mode (structure/contributors/knowledge/people)
4. **flyToNode** — Animate camera to a node
5. **showDetailPanel** — Open detail sidebar for a node
6. **startQuiz** — Start a knowledge quiz

Knowledge updates (UNDERSTANDS relationships) are performed via Cypher through `queryGraph` — there is no dedicated `updateKnowledge` tool.
