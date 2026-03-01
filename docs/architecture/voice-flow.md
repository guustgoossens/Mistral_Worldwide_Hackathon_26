# Voice Flow

## Overview

Voice interaction uses ElevenLabs Conversational AI with a custom LLM (Mistral via proxy). Interview questions are **pre-computed** before the voice session starts — no tool calls occur during voice to avoid ElevenLabs Custom LLM round-trip failures.

```
"I'm Ready" button click
    │
    ▼
KuzuDB queries (browser, instant)
    │ gatherContext() — files, functions, classes, calls, imports, contributors
    ▼
Mistral API (via proxy, stream:false, JSON mode)
    │ generateBriefing() — 5-8 interview questions + ground truth
    ▼
POST /briefing → stored on proxy
    │
    ▼
"Start Interview" button click
    │
    ▼
ElevenLabs voice session starts
    │ proxy injects briefing as system message
    ▼
Agent asks pre-prepared questions, evaluates answers
    │ no tool calls — pure conversation
    ▼
Interview complete → optional Quiz Me flow
```

## Briefing Pipeline

The briefing is generated in `src/lib/briefing.ts`:

1. **`gatherContext(executeQuery)`** — Runs 6 parallel KuzuDB queries to collect files, functions, classes, calls, imports, and contributors. Results are capped (50 files, 100 functions, etc.) to stay within prompt limits.

2. **`generateBriefing(context, proxyUrl)`** — Sends the context to Mistral via the proxy with `stream: false` and `response_format: { type: "json_object" }`. Returns a `BriefingPacket` with:
   - `summary`: 2-3 sentence codebase overview
   - `questions`: Array of `{ question, groundTruth, relatedNodes }`

3. **`composeBriefingPrompt(packet)`** — Formats the briefing into a full system prompt for the voice agent, including personality, interview flow instructions, voice guidelines, and guardrails.

## Interview Lifecycle (`useInterview`)

The `src/hooks/useInterview.ts` hook manages the full lifecycle:

| State | Description |
|-------|-------------|
| `idle` | Initial state, waiting for user to start |
| `preparing` | Gathering context + generating briefing |
| `ready` | Briefing stored on proxy, ready to start voice |
| `interviewing` | ElevenLabs voice session active |
| `complete` | Interview finished |
| `quizzing` | Optional quiz mode after interview |

## ElevenLabs Configuration

The ElevenLabs agent is configured with:
- **Custom LLM**: Points to the Express proxy (`NGROK_URL/v1/chat/completions`)
- **Voice**: Low-latency voice model
- **No client tools injected** — tools are defined in `agent-tools.ts` but NOT passed to Mistral during voice to avoid round-trip failures

## Client Tools (Reference Only)

These 4 tools are defined in `src/lib/agent-tools.ts` but are **NOT injected into Mistral requests** during voice. They exist for potential future use:

### `highlightNodes`
Highlight specific nodes in the 3D visualization.
```json
{
  "name": "highlightNodes",
  "parameters": {
    "nodeIds": { "type": "array", "items": { "type": "string" } }
  }
}
```

### `flyToNode`
Animate camera to focus on a specific node.
```json
{
  "name": "flyToNode",
  "parameters": {
    "nodeId": { "type": "string" }
  }
}
```

### `switchViewMode`
Switch the visualization overlay mode.
```json
{
  "name": "switchViewMode",
  "parameters": {
    "mode": { "type": "string", "enum": ["structure", "contributors", "knowledge", "people"] }
  }
}
```

### `showDetailPanel`
Show the detail panel for a specific node.
```json
{
  "name": "showDetailPanel",
  "parameters": {
    "nodeId": { "type": "string" }
  }
}
```

## Parallel Voxtral STT

During a voice session, a second STT stream can run in parallel using [voxtral.c](https://github.com/antirez/voxtral.c) — antirez's pure-C inference engine for Mistral's Voxtral Mini 4B Realtime model. It runs locally on Apple Silicon via Metal (MPS) at ~2.5x real-time speed with zero Python/PyTorch dependencies.

```
Browser mic (MediaStream)
    │
    ├── [ElevenLabs] → WebSocket → Cloud STT → DevStral → TTS → Speaker
    │
    └── [Voxtral]  → AudioWorklet (PCM16LE 16kHz mono)
                       │
                       WebSocket ws://localhost:3001/voxtral/stream
                       │
                       proxy spawns: vendor/voxtral.c/voxtral --stdin
                       │
                       stdout tokens → WS → browser
                       │
                       useVoxtralSTT hook → parallel transcript (orange)
```

### How it works

1. `src/worklets/pcm-processor.worklet.ts` — AudioWorklet converts Float32 mic audio to PCM16LE binary frames on the audio rendering thread
2. `src/hooks/useVoxtralSTT.ts` — Connects mic → AudioWorklet → WebSocket, receives text tokens
3. `server/proxy.ts` — WebSocket endpoint at `/voxtral/stream` spawns a persistent voxtral.c process, pipes PCM stdin, streams text stdout
4. `src/components/VoiceControls.tsx` — "Voxtral STT" toggle button shows the parallel transcript in Mistral brand orange

### Graceful degradation

If `vendor/voxtral.c/voxtral` binary doesn't exist, the proxy skips WebSocket setup and logs a warning. The Voxtral toggle is hidden in the UI. Everything else works normally.

### VoiceProvider interface

`src/lib/voice-provider.ts` defines a `VoiceProvider` interface that both the current ElevenLabs flow (`useVoiceAgent`) and a future custom pipeline must satisfy. This is the architectural seam for eventually replacing ElevenLabs Conversational AI with:

```
Voxtral STT → DevStral + tool calls → ElevenLabs TTS (standalone)
```

This restores real-time Cypher tool calls mid-conversation — the feature the ElevenLabs Custom LLM round-trip broke.

## Proxy Server

The Express proxy at `server/proxy.ts` handles:

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/chat/completions` | Forward to Mistral API (streaming or non-streaming) |
| `POST` | `/briefing` | Store pre-computed briefing string |
| `GET` | `/briefing` | Check if briefing is loaded |
| `GET` | `/v1/models` | Return available model list |
| `GET` | `/health` | Health check |
| `WS` | `/voxtral/stream` | Voxtral STT — PCM audio in, text tokens out (requires voxtral.c binary) |

### Briefing Injection

When a briefing is stored via `POST /briefing`, the proxy injects it as the system message in every subsequent `/v1/chat/completions` request. This replaces any existing system message from ElevenLabs.

### Body Construction

The proxy explicitly constructs the Mistral request body — it does NOT spread the incoming request. This filters out ElevenLabs-specific fields (`conversation_config`, `metadata`, etc.) that Mistral would reject.

Supported passthrough fields: `messages`, `model`, `stream`, `max_tokens`, `temperature`, `top_p`, `response_format`, `tools` (only if explicitly provided).

### Model Selection

- Default: `devstral-small-2507` (24B, fast for voice)
- Briefing generation can use `devstral-2507` (123B) when explicitly requested

## Conversation Flow Example

1. User clicks "I'm Ready" — briefing generation starts
2. KuzuDB queries gather codebase context (instant)
3. Mistral generates 5-8 interview questions with ground truth (2-5s)
4. Briefing stored on proxy via `POST /briefing`
5. User clicks "Start Interview" — ElevenLabs voice session starts
6. Agent greets: "Hi! I have 7 questions about your codebase. Let's start."
7. Agent asks Question 1 (from briefing)
8. User answers by voice
9. Agent evaluates against ground truth, gives feedback: "That's right! The kuzu module does handle..."
10. Agent moves to Question 2
11. After all questions: "Great session! You got 5 out of 7. Want to try the quiz mode?"
12. User can click "Quiz Me" for the `useKnowledge` quiz system
