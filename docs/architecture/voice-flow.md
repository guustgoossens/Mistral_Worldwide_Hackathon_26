# Voice Flow

## Overview

Voice interaction uses ElevenLabs Conversational AI with a custom LLM (Mistral via proxy) and client-side tools that execute against the in-browser KuzuDB.

```
User speaks
    │
    ▼
ElevenLabs (cloud)
    │ transcribes speech
    ▼
Custom LLM request → Express Proxy → Mistral API
    │                                      │
    │ LLM response (may include tool calls)│
    ◄──────────────────────────────────────┘
    │
    ▼
Client tool execution (browser)
    │ query_graph, highlight_nodes, etc.
    ▼
KuzuDB WASM → Graph update → 3D visualization
    │
    ▼
ElevenLabs speaks response
```

## ElevenLabs Configuration

The ElevenLabs agent is configured with:
- **Custom LLM**: Points to the Express proxy (`NGROK_URL/v1/chat/completions`)
- **Voice**: Low-latency voice model
- **Client tools**: Registered via `useConversation()` hook

## Client Tools

Tools registered with ElevenLabs that execute in the browser. All use **camelCase** naming.

### `queryGraph`
Execute a Cypher query against KuzuDB and return results.
```json
{
  "name": "queryGraph",
  "description": "Execute a Cypher query against the codebase knowledge graph",
  "parameters": {
    "cypher": { "type": "string", "description": "Cypher query to execute" }
  }
}
```

### `highlightNodes`
Highlight specific nodes in the 3D visualization.
```json
{
  "name": "highlightNodes",
  "description": "Highlight nodes in the 3D graph by their IDs",
  "parameters": {
    "nodeIds": { "type": "array", "items": { "type": "string" } },
    "color": { "type": "string", "description": "Optional highlight color" }
  }
}
```

### `flyToNode`
Animate camera to focus on a specific node.
```json
{
  "name": "flyToNode",
  "description": "Fly the 3D camera to focus on a specific node",
  "parameters": {
    "nodeId": { "type": "string" }
  }
}
```

### `switchViewMode`
Switch the visualization overlay mode, optionally filtering by person.
```json
{
  "name": "switchViewMode",
  "description": "Switch the graph overlay mode",
  "parameters": {
    "mode": { "type": "string", "enum": ["structure", "contributors", "knowledge", "people"] },
    "filterPerson": { "type": "string", "description": "Optional person name to filter by" }
  }
}
```

### `showDetailPanel`
Show the detail panel for a specific node at a given disclosure level.
```json
{
  "name": "showDetailPanel",
  "description": "Show detailed info panel for a node",
  "parameters": {
    "nodeId": { "type": "string" },
    "level": { "type": "number", "description": "Detail level: 1 (summary), 2 (detailed), 3 (full)" }
  }
}
```

### `startQuiz`
Start a knowledge quiz, optionally focused on a topic.
```json
{
  "name": "startQuiz",
  "description": "Start a knowledge quiz",
  "parameters": {
    "topic": { "type": "string", "description": "Optional topic or function to quiz on" }
  }
}
```

### `updateKnowledge`
Update a person's UNDERSTANDS relationship with a code node after a quiz.
```json
{
  "name": "updateKnowledge",
  "description": "Update knowledge score after quiz evaluation",
  "parameters": {
    "person": { "type": "string" },
    "nodeId": { "type": "string" },
    "confidence": { "type": "string", "enum": ["deep", "surface", "none"] },
    "topics": { "type": "array", "items": { "type": "string" } }
  }
}
```

## Proxy Server

The Express proxy at `server/proxy.ts`:
- Receives OpenAI-compatible chat completion requests from ElevenLabs
- Forwards to Mistral API with the configured API key
- Supports streaming (SSE) for real-time voice responses
- Default model: DevStral Small 2 (24B, 200 t/s — optimized for speed in voice scenarios)

## Conversation Flow Example

1. User: "What functions does the auth module have?"
2. ElevenLabs transcribes → sends to proxy → Mistral
3. Mistral responds with `queryGraph` tool call: `MATCH (f:File)-[:CONTAINS]->(fn:Function) WHERE f.filePath CONTAINS 'auth' RETURN fn.name, fn.summary`
4. Client executes Cypher against KuzuDB, returns results
5. Mistral composes natural language response
6. ElevenLabs speaks: "The auth module has 5 functions: authenticateUser handles the main login flow..."
7. Optionally calls `highlightNodes` to light up the relevant nodes in 3D

> **OPEN QUESTION:** Voxtral Mini 4B Realtime integration depends on GPU availability on-site. If an NVIDIA GPU is available, we could run Voxtral locally for lower latency voice. This is a stretch goal.
