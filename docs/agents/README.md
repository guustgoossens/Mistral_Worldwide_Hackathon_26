# Agent Roles

HackStral uses four specialized AI agent roles, each optimized for different tasks with appropriate Mistral model selection.

## Overview

| # | Agent | Model | Latency | Purpose |
|---|-------|-------|---------|---------|
| 1 | [Voice Conversationalist](voice-conversationalist.md) | DevStral Small 2 (24B) | <2s | Real-time voice interaction, Cypher composition |
| 2 | [Quiz Master](quiz-master.md) | DevStral Small 2 (24B) | <2s | Mode of Agent 1 — knowledge assessment, parallel truth-finding |
| 3 | [Graph Reasoner](graph-reasoner.md) | DevStral 2 (123B) | 5-15s | Multi-step Cypher, sub-agent spawning |
| 4 | [Background Enricher](background-enricher.md) | DevStral 2 (123B) | batch | Summaries, quiz bank, cluster analysis |

## Model Selection Map

```
User speaks → Voice Conversationalist (DevStral Small 2, fast)
                │
                ├── Simple query → composes Cypher directly
                ├── Quiz request → switches to Quiz Master mode (same Small 2 pipeline)
                ├── Complex analysis → escalates to Graph Reasoner (DevStral 2)
                └── "Enrich this" → queues for Background Enricher (DevStral 2)
```

## Interaction Pattern

All agents interact with the graph through the same interface:
1. Compose Cypher query based on intent
2. Execute via `queryGraph` client tool
3. Process results
4. Either respond directly or trigger UI updates (highlight, overlay change)

The Voice Conversationalist is the primary interface. It handles most queries directly and escalates to specialized agents when needed.
