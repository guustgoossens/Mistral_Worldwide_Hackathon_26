# Agent Roles

HackStral uses four specialized AI agent roles, each optimized for different tasks with appropriate Mistral model selection.

## Overview

| # | Agent | Model | Latency | Purpose |
|---|-------|-------|---------|---------|
| 1 | [Voice Conversationalist](voice-conversationalist.md) | devstral-small-2507 | ~200ms | Real-time voice interaction, Cypher composition |
| 2 | [Quiz Master](quiz-master.md) | mistral-medium | ~1s | Knowledge assessment, truth-finding |
| 3 | [Graph Reasoner](graph-reasoner.md) | codestral | ~2s | Multi-step Cypher, complex analysis |
| 4 | [Background Enricher](background-enricher.md) | codestral | batch | Summaries, quiz bank, cluster analysis |

## Model Selection Map

```
User speaks → Voice Conversationalist (devstral-small, fast)
                │
                ├── Simple query → composes Cypher directly
                ├── Quiz request → delegates to Quiz Master (mistral-medium)
                ├── Complex analysis → escalates to Graph Reasoner (codestral)
                └── "Enrich this" → queues for Background Enricher (codestral)
```

## Interaction Pattern

All agents interact with the graph through the same interface:
1. Compose Cypher query based on intent
2. Execute via `query_graph` client tool
3. Process results
4. Either respond directly or trigger UI updates (highlight, overlay change)

The Voice Conversationalist is the primary interface. It handles most queries directly and escalates to specialized agents when needed.
