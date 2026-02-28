# Setup

## Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- Node.js 20+ (for compatibility)

## Installation

```bash
bun install
```

## Environment Variables

Copy the example and fill in your keys:

```bash
cp .env.local.example .env.local
```

### Required Keys

**MISTRAL_API_KEY**
- Get from [console.mistral.ai](https://console.mistral.ai)
- Used by the proxy server to forward requests to Mistral API
- Hackathon coupon: redeem at console.mistral.ai/billing (check on-site for code)

**VITE_ELEVENLABS_AGENT_ID**
- Create a conversational agent at [elevenlabs.io](https://elevenlabs.io)
- Set the agent's custom LLM URL to your proxy (see below)
- The agent ID is in the agent settings URL

### Optional Keys

**VITE_PROXY_URL**
- Default: `http://localhost:3001`
- Change if running proxy elsewhere

**NGROK_URL**
- Required for ElevenLabs to reach your local proxy
- Install: `brew install ngrok`
- Run: `ngrok http 3001`
- Copy the HTTPS URL to your ElevenLabs agent's custom LLM settings

## ElevenLabs Agent Configuration

1. Create a new conversational agent at elevenlabs.io
2. Set "Custom LLM" as the language model
3. Set the URL to your ngrok HTTPS URL + `/v1/chat/completions`
4. Configure client tools (query_graph, highlight_nodes, etc.) — see [voice flow](../architecture/voice-flow.md)

## Running

```bash
bun run dev:all  # starts Vite (5173) + proxy (3001)
```

Open http://localhost:5173 in a browser that supports SharedArrayBuffer (Chrome/Edge with COEP/COOP headers — handled by Vite config).
