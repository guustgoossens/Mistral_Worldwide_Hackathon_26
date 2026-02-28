import express from "express";
import cors from "cors";

export const app = express();
const PORT = process.env.PORT ?? 3001;
const MISTRAL_BASE = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MODEL = "devstral-small-2507";

/** Tool definitions injected when ElevenLabs doesn't send its own. */
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "queryGraph",
      description:
        "Execute a Cypher query against the codebase knowledge graph in KuzuDB. Use this to answer any question about files, functions, classes, contributors, or relationships.",
      parameters: {
        type: "object",
        properties: {
          cypher: {
            type: "string",
            description: "The Cypher query to execute",
          },
        },
        required: ["cypher"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "highlightNodes",
      description:
        "Highlight specific nodes in the 3D graph visualization. Call after queryGraph with the IDs from results.",
      parameters: {
        type: "object",
        properties: {
          nodeIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of node IDs to highlight",
          },
        },
        required: ["nodeIds"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "switchViewMode",
      description:
        'Switch the visualization overlay mode. Modes: "structure" (code only), "contributors" (git activity), "knowledge" (understanding depth), "people" (Person nodes).',
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["structure", "contributors", "knowledge", "people"],
            description: "The overlay mode to switch to",
          },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "flyToNode",
      description:
        "Animate the camera to focus on a specific node in the 3D graph.",
      parameters: {
        type: "object",
        properties: {
          nodeId: {
            type: "string",
            description: "The node ID to fly to",
          },
        },
        required: ["nodeId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "showDetailPanel",
      description:
        "Open the detail sidebar panel for a specific node to show its full information.",
      parameters: {
        type: "object",
        properties: {
          nodeId: {
            type: "string",
            description: "The node ID to show details for",
          },
        },
        required: ["nodeId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "startQuiz",
      description:
        "Start a knowledge quiz to test the user's understanding of the codebase. Optionally focused on a topic.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Optional topic to focus the quiz on",
          },
        },
        required: [],
      },
    },
  },
];

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[proxy] ${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
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
  console.log(
    `[proxy] messages=${messages.length} tools=${req.body.tools?.length ?? 0} lastRole=${lastMsg?.role ?? "none"} stream=${req.body.stream}`,
  );

  // Strip ElevenLabs-specific fields Mistral doesn't understand
  const { user_id, elevenlabs_extra_body, ...rest } = req.body;

  const body = {
    ...rest,
    model: DEFAULT_MODEL,
    stream: true, // ElevenLabs always requires SSE streaming
    tools: req.body.tools?.length ? req.body.tools : TOOLS,
  };

  try {
    const upstream = await fetch(MISTRAL_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

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

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
        res.end();
      };

      pump().catch((err) => {
        console.error("[proxy] Stream error:", err);
        res.end();
      });
    } else {
      const data = await upstream.json();
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
