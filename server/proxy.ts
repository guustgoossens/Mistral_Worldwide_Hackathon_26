import express from "express";
import cors from "cors";

export const app = express();
const PORT = process.env.PORT ?? 3001;
const MISTRAL_BASE = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MODEL = "devstral-small-2507";

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

  // Inject briefing into system message if available
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

if (import.meta.main) {
  app.listen(PORT, () => {
    console.log(`[proxy] Listening on http://localhost:${PORT}`);
    console.log(`[proxy] Model: ${DEFAULT_MODEL}`);
    console.log(`[proxy] API key: ${process.env.MISTRAL_API_KEY ? "set" : "MISSING"}`);
  });
}
