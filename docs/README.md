# HackStral Documentation

Voice-driven codebase intelligence platform for the Mistral Worldwide Hackathon.

## Navigation

| Section | Description |
|---------|-------------|
| [Getting Started](getting-started/README.md) | Setup, commands, tech stack |
| [Architecture](architecture/README.md) | System design, data model, voice flow, parsing |
| [Agents](agents/README.md) | Four agent roles and their behaviors |
| [Decisions](decisions/README.md) | Key decisions with rationale |
| [Product](product/pitch.md) | Pitch, demo script, sponsor strategy |
| [Idea](idea/GAMEPLAN.md) | Original concept, battle plan, build sequence, and pitch evolution |
| [Agent Infrastructure](idea/AGENTS_INFRA.md) | Complete agent architecture reference (the source of truth for agent design) |
| [Architecture Changes & Roadmap](architecture/ARCHITECTURE_CHANGES.md) | What changed (tool calling → briefing), what was lost, how to fix it, future plans |

## Tech Stack Summary

- **Frontend:** React 19 + Vite 6 + Tailwind CSS v4
- **Graph DB:** KuzuDB WASM (in-browser, Cypher queries)
- **3D Viz:** react-force-graph-3d (Three.js)
- **Voice:** ElevenLabs Conversational AI + [voxtral.c](https://github.com/antirez/voxtral.c) (local Mistral STT via pure C/Metal)
- **LLM:** Mistral AI (DevStral Small 2 for voice, DevStral 2 for deep analysis)
- **Parsing:** web-tree-sitter (multi-language AST)
- **Git:** simple-git (contributor analysis)
- **Server:** Express proxy (ElevenLabs → Mistral)

## Core Concept

HackStral turns any codebase into a navigable knowledge graph. It combines:
1. **Static analysis** (Tree-sitter) for code structure
2. **Git history** for contributor mapping
3. **AI enrichment** (Mistral) for summaries and importance scores
4. **Voice conversation** (ElevenLabs) for natural interaction
5. **Knowledge tracking** (quizzes) for team awareness mapping

The graph is stored in KuzuDB (in-browser WASM) and visualized as an interactive 3D force-directed graph with four overlay modes: structure, contributors, knowledge, and people.
