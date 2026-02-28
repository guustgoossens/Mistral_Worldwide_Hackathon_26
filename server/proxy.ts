import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ?? 3001;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_BASE = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MODEL = "devstral-small-2507";

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
  if (!MISTRAL_API_KEY) {
    res.status(500).json({ error: "MISTRAL_API_KEY not set" });
    return;
  }

  const body = {
    ...req.body,
    model: req.body.model ?? DEFAULT_MODEL,
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

app.listen(PORT, () => {
  console.log(`[proxy] Listening on http://localhost:${PORT}`);
  console.log(`[proxy] Model: ${DEFAULT_MODEL}`);
  console.log(`[proxy] API key: ${MISTRAL_API_KEY ? "set" : "MISSING"}`);
});
