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

## Data Pipeline (multi-repo)

The app visualizes parsed graph data from `public/data/{repoId}/`. To generate it:

```bash
bun run clone-repos   # shallow-clone all non-local repos into .repos/
bun run parse         # parse all repos → public/data/{id}/graph.json + git-data.json
```

Repos are defined in `public/data/repos.json`. The `hackstral` entry (marked `local: true`) always points to the project root; all others are cloned into `.repos/`.

You only need to re-run `clone-repos` if repos are added/updated. Re-run `parse` whenever you want fresh graph data.

## Voxtral STT (Optional — Local Speech-to-Text)

[voxtral.c](https://github.com/antirez/voxtral.c) is antirez's pure-C inference engine for Mistral's Voxtral Mini 4B Realtime model. It enables parallel local STT alongside ElevenLabs during voice sessions. Requires Apple Silicon (Metal/MPS).

```bash
# Clone into vendor/
git clone https://github.com/antirez/voxtral.c vendor/voxtral.c

# Build with Metal acceleration
cd vendor/voxtral.c && make mps

# Download model weights (~9 GB)
bash download_model.sh

# Verify
./voxtral -d voxtral-model -i test.wav
# → should output transcribed text

cd ../..
```

The proxy auto-detects `vendor/voxtral.c/voxtral` on startup. If present, it enables the `/voxtral/stream` WebSocket endpoint. If absent, the app works normally without it.

## Running

```bash
bun run dev:all  # starts Vite (5173) + proxy (3001)
```

Open http://localhost:5173 in a browser that supports SharedArrayBuffer (Chrome/Edge with COEP/COOP headers — handled by Vite config).
