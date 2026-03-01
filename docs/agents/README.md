# Agent Roles

HackStral uses four specialized AI agent roles, each optimized for different tasks with appropriate Mistral model selection.

## Overview

| # | Agent | Model | Latency | Purpose |
|---|-------|-------|---------|---------|
| 1 | [Interview Agent](voice-conversationalist.md) | DevStral Small 2 (24B) | <2s | Pre-computed briefing → voice interview (no tool calls during voice) |
| 2 | [Quiz System](quiz-master.md) | DevStral Small 2 (24B) | <2s | Independent `useKnowledge` hook — question generation + answer evaluation |
| 3 | [Graph Reasoner](graph-reasoner.md) | DevStral 2 (123B) | 5-15s | *Not implemented — stretch goal* |
| 4 | [Background Enricher](background-enricher.md) | DevStral 2 (123B) | batch | *Not implemented — stretch goal* |

## Model Selection Map

```
User clicks "I'm Ready"
    │
    ├── gatherContext() → KuzuDB queries (browser, instant)
    ├── generateBriefing() → Mistral (DevStral Small 2, stream:false, JSON mode)
    └── composeBriefingPrompt() → system message stored on proxy
        │
        ▼
User clicks "Start Interview"
    │
    └── ElevenLabs voice session → Mistral (DevStral Small 2, streaming)
        │ no tool calls — pure conversation
        ▼
Interview complete → optional "Quiz Me" (useKnowledge hook, independent)
```

## Interaction Pattern

The Interview Agent is the primary interface. It uses a pre-computed briefing flow:
1. `gatherContext()` runs Cypher queries against KuzuDB (before voice starts)
2. `generateBriefing()` sends context to Mistral to generate interview questions
3. Briefing is stored on the proxy and injected as system message during voice
4. Voice session is pure conversation — no tool calls, no real-time Cypher

The Quiz System (`useKnowledge` hook) operates independently after the interview, using `queryGraph()` directly for question generation and answer evaluation.
