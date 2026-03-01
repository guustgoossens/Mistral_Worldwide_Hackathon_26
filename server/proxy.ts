import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { spawn } from "child_process";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

export const app = express();
const PORT = process.env.PORT ?? 3001;
const MISTRAL_BASE = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MODEL = "devstral-small-2507";

// ── Bedrock Configuration ──────────────────────────────────────────────
const INFERENCE_PROVIDER = process.env.INFERENCE_PROVIDER ?? "mistral";
const AWS_BEARER_TOKEN = process.env.AWS_BEARER_TOKEN_BEDROCK;
const AWS_REGION = process.env.AWS_BEDROCK_REGION ?? "us-east-1";

/** Map Mistral model names to Bedrock model IDs. */
const BEDROCK_MODEL_MAP: Record<string, string> = {
  "devstral-small-2507": "mistral.magistral-small-2509", // DevStral Small not on Bedrock, use Magistral Small
  "devstral-2507": "mistral.devstral-2-123b-v1:0",
  "mistral-large": "mistral.mistral-large-2-675b-instruct-v1:0",
  "magistral-small": "mistral.magistral-small-2509",
};

function getBedrockClient(): BedrockRuntimeClient | null {
  if (!AWS_BEARER_TOKEN) return null;
  return new BedrockRuntimeClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: "unused",
      secretAccessKey: "unused",
      sessionToken: AWS_BEARER_TOKEN,
    },
  });
}

interface BedrockMessage {
  role: "user" | "assistant";
  content: Array<{ text: string }>;
}

/**
 * Convert OpenAI-style messages to Bedrock Converse format.
 * - Extracts system messages to top-level system field
 * - Wraps string content into [{text: "..."}]
 * - Merges consecutive same-role messages (Bedrock requirement)
 */
export function convertToBedrockFormat(messages: Array<Record<string, any>>): {
  system: Array<{ text: string }>;
  messages: BedrockMessage[];
} {
  const system: Array<{ text: string }> = [];
  const bedrockMessages: BedrockMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      system.push({ text });
      continue;
    }

    // Map "tool" role messages to user messages (Bedrock doesn't have tool role in Converse)
    const role: "user" | "assistant" = msg.role === "assistant" ? "assistant" : "user";
    const text = typeof msg.content === "string"
      ? msg.content
      : JSON.stringify(msg.content);

    const content = [{ text }];

    // Merge consecutive same-role messages
    const last = bedrockMessages[bedrockMessages.length - 1];
    if (last && last.role === role) {
      last.content.push(...content);
    } else {
      bedrockMessages.push({ role, content });
    }
  }

  // Bedrock requires alternating user/assistant messages starting with user
  // If first message is assistant, prepend an empty user message
  if (bedrockMessages.length > 0 && bedrockMessages[0].role === "assistant") {
    bedrockMessages.unshift({ role: "user", content: [{ text: "(conversation start)" }] });
  }

  return { system, messages: bedrockMessages };
}

/**
 * Convert Bedrock Converse response to OpenAI format.
 */
export function bedrockToOpenAI(bedrockResponse: any, model: string): Record<string, any> {
  const output = bedrockResponse.output?.message;
  const content = output?.content?.map((c: any) => c.text).join("") ?? "";

  return {
    id: `chatcmpl-bedrock-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content,
      },
      finish_reason: bedrockResponse.stopReason === "end_turn" ? "stop" : "stop",
    }],
    usage: {
      prompt_tokens: bedrockResponse.usage?.inputTokens ?? 0,
      completion_tokens: bedrockResponse.usage?.outputTokens ?? 0,
      total_tokens: (bedrockResponse.usage?.inputTokens ?? 0) + (bedrockResponse.usage?.outputTokens ?? 0),
    },
  };
}

/** Pre-computed briefing injected as system message when set. */
let currentBriefing: string | null = null;

/** No tools for voice — avoids the tool-result round-trip that kills ElevenLabs. */
const TOOLS: never[] = [];

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use((req, _res, next) => {
  console.log(`[proxy] ${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/** Store a pre-computed briefing to inject as system message. */
app.post("/briefing", (req, res) => {
  const { briefing } = req.body;
  if (!briefing || typeof briefing !== "string") {
    res.status(400).json({ error: "Missing or invalid 'briefing' string" });
    return;
  }
  currentBriefing = briefing;
  console.log(`[proxy] Briefing stored (${briefing.length} chars)`);
  res.json({ ok: true, length: briefing.length });
});

/** Check if a briefing is loaded. */
app.get("/briefing", (_req, res) => {
  res.json({ ready: currentBriefing !== null, length: currentBriefing?.length ?? 0 });
});

app.get("/v1/models", (_req, res) => {
  res.json({ data: [{ id: "devstral-small-2507", object: "model" }] });
});

/**
 * Dedicated graph chat endpoint — completely isolated from voice/briefing.
 * No briefing injection, no message normalization. Clean passthrough + tools.
 */
app.post("/v1/chat/graph", async (req, res) => {
  const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
  if (!MISTRAL_API_KEY) {
    res.status(500).json({ error: "MISTRAL_API_KEY not set" });
    return;
  }

  const body = {
    messages: req.body.messages ?? [],
    model: req.body.model ?? DEFAULT_MODEL,
    tools: req.body.tools,
    max_tokens: req.body.max_tokens ?? 2048,
    temperature: req.body.temperature ?? 0.3,
    stream: false,
    ...(req.body.response_format && { response_format: req.body.response_format }),
  };

  console.log(`[proxy/graph] ← ${body.messages.length} messages, ${body.tools?.length ?? 0} tools, model=${body.model}`);
  console.log(`[proxy/graph] system: "${(body.messages[0]?.content ?? "").slice(0, 100)}..."`);

  try {
    const upstream = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error(`[proxy/graph] ✗ Mistral ${upstream.status}: ${errText.slice(0, 300)}`);
      res.status(upstream.status).json({ error: errText.slice(0, 500) });
      return;
    }

    const data = await upstream.json();
    const choice = data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls?.map((tc: any) => tc.function?.name) ?? [];
    console.log(`[proxy/graph] → tool_calls=[${toolCalls.join(",")}] content="${(choice?.message?.content ?? "").slice(0, 100)}"`);
    res.json(data);
  } catch (err) {
    console.error("[proxy/graph] Error:", err);
    res.status(502).json({ error: "Failed to reach Mistral API" });
  }
});

app.post("/v1/chat/completions", async (req, res) => {
  const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
  if (!MISTRAL_API_KEY) {
    res.status(500).json({ error: "MISTRAL_API_KEY not set" });
    return;
  }

  const messages = req.body.messages ?? [];
  const lastMsg = messages[messages.length - 1];
  const incomingToolNames = (req.body.tools ?? []).map((t: any) => t.function?.name).filter(Boolean);
  console.log(
    `[proxy] ← REQ messages=${messages.length} tools=[${incomingToolNames.join(",")}] lastRole=${lastMsg?.role ?? "none"} stream=${req.body.stream} model=${req.body.model}`,
  );

  // Log each message role + summary
  for (const msg of messages) {
    const content = typeof msg.content === "string" ? msg.content.slice(0, 120) : JSON.stringify(msg.content)?.slice(0, 120);
    const toolCalls = msg.tool_calls ? ` tool_calls=[${msg.tool_calls.map((tc: any) => tc.function?.name).join(",")}]` : "";
    const toolCallId = msg.tool_call_id ? ` tool_call_id=${msg.tool_call_id}` : "";
    console.log(`[proxy]   ${msg.role}${toolCalls}${toolCallId}: ${content}`);
  }

  // Normalize messages for Mistral compatibility
  const normalizedMessages = messages.map((msg: any, i: number) => {
    if (msg.role !== "tool") return msg;

    const fixed = { ...msg };

    // Add `name` by looking up the tool_call_id in the preceding assistant message
    if (!fixed.name && fixed.tool_call_id) {
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j];
        if (prev.role === "assistant" && prev.tool_calls) {
          const tc = prev.tool_calls.find((t: any) => t.id === fixed.tool_call_id);
          if (tc?.function?.name) {
            fixed.name = tc.function.name;
            console.log(`[proxy] Patched tool message: added name="${fixed.name}" from tool_call_id=${fixed.tool_call_id}`);
            break;
          }
        }
      }
    }

    // Ensure content is a string
    if (typeof fixed.content !== "string") {
      fixed.content = JSON.stringify(fixed.content);
      console.log(`[proxy] Patched tool message: stringified content for ${fixed.name ?? fixed.tool_call_id}`);
    }

    return fixed;
  });

  // Inject briefing into system message if available.
  // Chat uses /v1/chat/graph, so everything hitting this endpoint is voice or briefing-gen.
  // Briefing generation now routes through /v1/chat/graph too, so only voice lands here.
  console.log(`[proxy] tools=${req.body.tools?.length ?? 0} briefing=${!!currentBriefing}`);
  if (currentBriefing) {
    const systemIdx = normalizedMessages.findIndex((m: any) => m.role === "system");
    if (systemIdx >= 0) {
      normalizedMessages[systemIdx] = { ...normalizedMessages[systemIdx], content: currentBriefing };
      console.log(`[proxy] Injected briefing into system message`);
    } else {
      normalizedMessages.unshift({ role: "system", content: currentBriefing });
      console.log(`[proxy] Injected briefing as new system message`);
    }
  }

  // Allow devstral-2507 for preparation, otherwise use default
  const model = req.body.model === "devstral-2507" ? "devstral-2507" : DEFAULT_MODEL;
  const stream = req.body.stream === false ? false : true;

  // No tools for voice (avoids round-trip failure). Only pass tools if client explicitly sends them.
  const tools = ("tools" in req.body && req.body.tools?.length) ? req.body.tools : undefined;

  // Ensure max_tokens is large enough for tool calls + conversation
  const maxTokens = Math.max(req.body.max_tokens ?? 1024, 1024);

  console.log(`[proxy] stream=${stream} (raw=${req.body.stream}) max_tokens=${maxTokens} (raw=${req.body.max_tokens})`);

  // Build Mistral body explicitly — do NOT spread ...rest to avoid leaking
  // ElevenLabs-specific fields (conversation_config, metadata, etc.) that Mistral rejects
  const body: Record<string, unknown> = {
    messages: normalizedMessages,
    model,
    stream,
    max_tokens: maxTokens,
    ...(tools && { tools }),
    ...(req.body.temperature != null && { temperature: req.body.temperature }),
    ...(req.body.top_p != null && { top_p: req.body.top_p }),
    ...(req.body.response_format != null && { response_format: req.body.response_format }),
  };

  // Log full request body when it contains tool results
  const hasToolResults = normalizedMessages.some((m: any) => m.role === "tool");
  if (hasToolResults) {
    console.log(`[proxy] ⚡ Tool-result request body:\n${JSON.stringify(body, null, 2).slice(0, 2000)}`);
  }

  // ── Bedrock path ──────────────────────────────────────────────────────
  if (INFERENCE_PROVIDER === "bedrock") {
    const bedrockClient = getBedrockClient();
    if (!bedrockClient) {
      res.status(500).json({ error: "AWS_BEARER_TOKEN_BEDROCK not set" });
      return;
    }

    const bedrockModelId = BEDROCK_MODEL_MAP[model] ?? BEDROCK_MODEL_MAP["devstral-small-2507"]!;
    console.log(`[proxy] Using Bedrock model: ${bedrockModelId} (from ${model})`);

    const converted = convertToBedrockFormat(normalizedMessages);

    // JSON mode workaround: inject into system prompt
    if (req.body.response_format?.type === "json_object") {
      converted.system.push({ text: "IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just raw JSON." });
    }

    try {
      if (body.stream) {
        // Streaming via ConverseStream
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const command = new ConverseStreamCommand({
          modelId: bedrockModelId,
          system: converted.system,
          messages: converted.messages,
          inferenceConfig: {
            maxTokens,
            ...(req.body.temperature != null && { temperature: req.body.temperature }),
            ...(req.body.top_p != null && { topP: req.body.top_p }),
          },
        });

        const response = await bedrockClient.send(command);
        let fullContent = "";
        const streamId = `chatcmpl-bedrock-${Date.now()}`;

        if (response.stream) {
          for await (const event of response.stream) {
            if (event.contentBlockDelta?.delta?.text) {
              const text = event.contentBlockDelta.delta.text;
              fullContent += text;

              // Convert to OpenAI SSE format
              const chunk = {
                id: streamId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                  index: 0,
                  delta: { content: text },
                  finish_reason: null,
                }],
              };
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }

            if (event.messageStop) {
              const chunk = {
                id: streamId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: "stop",
                }],
              };
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
              res.write("data: [DONE]\n\n");
            }
          }
        }

        console.log(`[proxy] → Bedrock stream complete: "${fullContent.slice(0, 150)}"`);
        res.end();
      } else {
        // Non-streaming via Converse
        const command = new ConverseCommand({
          modelId: bedrockModelId,
          system: converted.system,
          messages: converted.messages,
          inferenceConfig: {
            maxTokens,
            ...(req.body.temperature != null && { temperature: req.body.temperature }),
            ...(req.body.top_p != null && { topP: req.body.top_p }),
          },
        });

        const response = await bedrockClient.send(command);
        const openAIResponse = bedrockToOpenAI(response, model);
        console.log(`[proxy] → Bedrock (non-stream):`, JSON.stringify(openAIResponse).slice(0, 300));
        res.json(openAIResponse);
      }
    } catch (err) {
      console.error("[proxy] Bedrock error:", err);
      res.status(502).json({ error: `Bedrock API error: ${String(err)}` });
    }
    return;
  }

  // ── Mistral direct path (default) ──────────────────────────────────
  try {
    const upstream = await fetch(MISTRAL_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    // Check for upstream errors BEFORE streaming
    if (!upstream.ok) {
      const errorBody = await upstream.text();
      console.error(`[proxy] ✗ Mistral returned ${upstream.status}: ${errorBody.slice(0, 500)}`);
      res.status(upstream.status).json({
        error: {
          message: `Mistral API error: ${upstream.status}`,
          detail: errorBody.slice(0, 500),
        },
      });
      return;
    }

    if (body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (!upstream.body) {
        res.status(502).json({ error: "No response body from Mistral" });
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      let fullResponse = "";
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          res.write(chunk);
        }
        res.end();

        // Parse streamed chunks to extract tool_calls and content
        const toolCalls: string[] = [];
        let contentSnippet = "";
        for (const line of fullResponse.split("\n")) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) toolCalls.push(tc.function.name);
              }
            }
            if (delta?.content) contentSnippet += delta.content;
          } catch {}
        }
        console.log(
          `[proxy] → RES tool_calls=[${toolCalls.join(",")}] content="${contentSnippet.slice(0, 150)}"`,
        );
      };

      pump().catch((err) => {
        console.error("[proxy] Stream error:", err);
        res.end();
      });
    } else {
      const data = await upstream.json();
      console.log(`[proxy] → RES (non-stream) status=${upstream.status}`, JSON.stringify(data).slice(0, 300));
      res.status(upstream.status).json(data);
    }
  } catch (err) {
    console.error("[proxy] Error:", err);
    res.status(502).json({ error: "Failed to reach Mistral API" });
  }
});

// Start the server. import.meta.main is Bun-only; for tsx/node we check argv.
const _isMain = import.meta.main ?? process.argv[1]?.endsWith("proxy.ts");
if (_isMain !== false) {
  const httpServer = createServer(app);

  // Voxtral STT WebSocket endpoint
  const VOXTRAL_BIN = path.resolve("vendor/voxtral.c/voxtral");
  const VOXTRAL_MODEL = path.resolve("vendor/voxtral.c/voxtral-model");

  if (fs.existsSync(VOXTRAL_BIN)) {
    const wss = new WebSocketServer({ server: httpServer, path: "/voxtral/stream" });
    console.log(`[proxy] Voxtral STT WebSocket endpoint: ws://localhost:${PORT}/voxtral/stream`);

    wss.on("connection", (ws) => {
      console.log("[proxy] Voxtral STT client connected");

      const proc = spawn(VOXTRAL_BIN, ["-d", VOXTRAL_MODEL, "--stdin"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        console.error(`[voxtral] stderr: ${chunk.toString().trim()}`);
      });

      // Browser sends PCM16LE binary frames → pipe to voxtral stdin
      ws.on("message", (data: Buffer) => {
        if (proc.stdin.writable) proc.stdin.write(data);
      });

      // voxtral stdout (text tokens) → forward to browser
      proc.stdout.on("data", (chunk: Buffer) => {
        if (ws.readyState === ws.OPEN) ws.send(chunk.toString());
      });

      ws.on("close", () => {
        console.log("[proxy] Voxtral STT client disconnected");
        proc.kill();
      });

      proc.on("exit", (code) => {
        console.log(`[proxy] Voxtral process exited (code=${code})`);
        if (ws.readyState === ws.OPEN) ws.close();
      });

      proc.on("error", (err) => {
        console.error(`[proxy] Voxtral spawn error: ${err.message}`);
        ws.close(1011, "Voxtral process error");
      });
    });
  } else {
    console.warn(`[proxy] Voxtral binary not found at ${VOXTRAL_BIN} — /voxtral/stream endpoint disabled`);
    console.warn(`[proxy] Run: git clone https://github.com/antirez/voxtral.c vendor/voxtral.c && cd vendor/voxtral.c && make mps && bash download_model.sh`);
  }

  httpServer.listen(PORT, () => {
    console.log(`[proxy] Listening on http://localhost:${PORT}`);
    console.log(`[proxy] Model: ${DEFAULT_MODEL}`);
    console.log(`[proxy] Inference provider: ${INFERENCE_PROVIDER}`);
    if (INFERENCE_PROVIDER === "bedrock") {
      console.log(`[proxy] AWS region: ${AWS_REGION}`);
      console.log(`[proxy] AWS token: ${AWS_BEARER_TOKEN ? "set" : "MISSING"}`);
    } else {
      console.log(`[proxy] API key: ${process.env.MISTRAL_API_KEY ? "set" : "MISSING"}`);
    }
  });
}
