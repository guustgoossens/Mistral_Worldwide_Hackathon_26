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

Tools registered with ElevenLabs that execute in the browser:

### `query_graph`
Execute a Cypher query against KuzuDB and return results.
```json
{
  "name": "query_graph",
  "description": "Execute a Cypher query against the codebase knowledge graph",
  "parameters": {
    "cypher": { "type": "string", "description": "Cypher query to execute" }
  }
}
```

### `highlight_nodes`
Highlight specific nodes in the 3D visualization.
```json
{
  "name": "highlight_nodes",
  "description": "Highlight nodes in the 3D graph by their IDs",
  "parameters": {
    "ids": { "type": "array", "items": { "type": "string" } }
  }
}
```

### `set_overlay`
Switch the visualization overlay mode.
```json
{
  "name": "set_overlay",
  "description": "Switch the graph overlay mode",
  "parameters": {
    "mode": { "type": "string", "enum": ["structure", "contributors", "knowledge", "people"] }
  }
}
```

### `start_quiz`
Start a knowledge quiz about a specific function.
```json
{
  "name": "start_quiz",
  "description": "Start a knowledge quiz about a function",
  "parameters": {
    "functionId": { "type": "string" }
  }
}
```

### `get_node_detail`
Get detailed information about a specific node.
```json
{
  "name": "get_node_detail",
  "description": "Get detailed info for a node by ID",
  "parameters": {
    "id": { "type": "string" }
  }
}
```

## Proxy Server

The Express proxy at `server/proxy.ts`:
- Receives OpenAI-compatible chat completion requests from ElevenLabs
- Forwards to Mistral API with the configured API key
- Supports streaming (SSE) for real-time voice responses
- Default model: `devstral-small-2507` (optimized for speed in voice scenarios)

## Conversation Flow Example

1. User: "What functions does the auth module have?"
2. ElevenLabs transcribes → sends to proxy → Mistral
3. Mistral responds with `query_graph` tool call: `MATCH (f:File)-[:CONTAINS]->(fn:Function) WHERE f.filePath CONTAINS 'auth' RETURN fn.name, fn.summary_l1`
4. Client executes Cypher against KuzuDB, returns results
5. Mistral composes natural language response
6. ElevenLabs speaks: "The auth module has 5 functions: authenticateUser handles the main login flow..."
7. Optionally calls `highlight_nodes` to light up the relevant nodes in 3D

> **OPEN QUESTION:** Voxtral Mini 4B Realtime integration depends on GPU availability on-site. If an NVIDIA GPU is available, we could run Voxtral locally for lower latency voice. This is a stretch goal.
