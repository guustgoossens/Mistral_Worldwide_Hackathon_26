# Product Pitch

## One-liner

HackStral turns any codebase into a living knowledge graph you can talk to.

## 60-Second Pitch

Every engineering team has the same problem: institutional knowledge is trapped in people's heads. When someone leaves, gets sick, or just forgets — critical understanding vanishes.

HackStral solves this by building a **knowledge graph** of your codebase and the people who work on it. We parse code structure with Tree-sitter, map contributor history from Git, and let you **talk to the graph** through a voice AI agent powered by Mistral.

Ask "who understands the authentication flow?" and see the answer visualized in 3D. Say "quiz me on the payment module" and the AI tests your knowledge, tracking confidence levels over time.

The result: a live map of **who knows what** — and more importantly, **what nobody knows**.

## Demo Script

### Scene 1: The Graph (30s)
- Open HackStral showing a parsed codebase as a 3D force-directed graph
- Code nodes colored by type (files=purple, functions=amber, classes=green)
- Click a function node → show detail panel with summary + contributors

### Scene 2: Voice Interaction (45s)
- Click mic → "Show me the auth module"
- Graph highlights auth-related nodes, zooms in
- "Who worked on this the most?"
- Switch to contributor overlay → nodes sized by commit count
- "Are there any knowledge gaps here?"
- Switch to knowledge overlay → red nodes (gaps) vs green nodes (covered)

### Scene 3: Knowledge Quiz (30s)
- "Quiz me on authenticateUser"
- Quiz panel appears with a targeted question
- Answer via voice → AI evaluates against ground truth
- UNDERSTANDS relationship updated → knowledge overlay changes in real-time

### Scene 4: The Insight (15s)
- "What's our biggest bus-factor risk?"
- AI queries for high-importance functions with single-contributor knowledge
- Highlights critical gaps: "The session management code has no deep knowledge coverage — only Alice has touched it, and she hasn't been quizzed."

## Key Metrics to Highlight

- **METR study finding:** AI agents with access to project documentation and structure solve tasks 2-3x faster than those without context
- **Bus factor:** Average team has 15-20% of codebase understood by only one person
- **Onboarding:** New engineers typically take 3-6 months to build mental models that HackStral can surface in minutes

## Sponsor Strategy

### Mistral AI (Primary)
- All LLM calls go through Mistral API
- Multiple model tiers: devstral-small (voice), codestral (analysis), mistral-medium (quiz)
- Demonstrates Mistral's versatility across latency/capability spectrum

### ElevenLabs
- Voice AI is the primary interaction mode
- Client tool integration showcases ElevenLabs Conversational AI platform
- Natural language → graph query is a compelling demo

### KuzuDB
- Showcases WASM deployment (no server needed)
- Complex Cypher queries for real-time graph analysis
- Graph DB in the browser is a novel architecture

## Judging Criteria Alignment

| Criterion | How HackStral Addresses It |
|-----------|---------------------------|
| Innovation | Voice-driven codebase exploration is novel. Knowledge graph + voice AI + 3D viz is unique combination |
| Technical depth | KuzuDB WASM, Tree-sitter AST, multi-model agent architecture, real-time Cypher |
| Usefulness | Solves real team problem: knowledge silos, bus factor, onboarding |
| Completeness | Full pipeline: parse → enrich → visualize → talk → quiz → track |
| Presentation | 3D graph is visually striking, voice interaction is engaging for live demo |
