import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";
import http from "node:http";
import { app } from "./proxy";

// ---------------------------------------------------------------------------
// Server lifecycle — listen on port 0 (random)
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ---------------------------------------------------------------------------
// Upstream fetch mock helpers
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.MISTRAL_API_KEY;
});

function mockUpstreamOk(body: unknown, status = 200) {
  globalThis.fetch = mock(async () => ({
    ok: true,
    status,
    json: async () => body,
    body: null,
  })) as unknown as typeof fetch;
}

function mockUpstreamStream(chunks: string[]) {
  globalThis.fetch = mock(async () => {
    let idx = 0;
    return {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => {
            if (idx < chunks.length) {
              const value = new TextEncoder().encode(chunks[idx]!);
              idx++;
              return { done: false, value };
            }
            return { done: true, value: undefined };
          },
        }),
      },
    };
  }) as unknown as typeof fetch;
}

function mockUpstreamFail() {
  globalThis.fetch = mock(async () => {
    throw new Error("Network error");
  }) as unknown as typeof fetch;
}

function mockUpstreamNullBody() {
  globalThis.fetch = mock(async () => ({
    ok: true,
    status: 200,
    body: null,
  })) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Helper: make HTTP requests using node:http (avoids globalThis.fetch conflict)
// ---------------------------------------------------------------------------

function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
          ...(bodyStr ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode!,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe("GET /health", () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await request("GET", "/health");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });
});

// ---------------------------------------------------------------------------
// GET /v1/models
// ---------------------------------------------------------------------------

describe("GET /v1/models", () => {
  it("returns model list with devstral-small-2507", async () => {
    const res = await request("GET", "/v1/models");
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data[0].id).toBe("devstral-small-2507");
  });
});

// ---------------------------------------------------------------------------
// POST /v1/chat/completions
// ---------------------------------------------------------------------------

describe("POST /v1/chat/completions", () => {
  describe("missing API key", () => {
    it('returns 500 with { error: "MISTRAL_API_KEY not set" }', async () => {
      delete process.env.MISTRAL_API_KEY;
      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
      });
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: "MISTRAL_API_KEY not set" });
    });
  });

  describe("non-streaming", () => {
    it("forwards request to Mistral with Bearer token auth", async () => {
      process.env.MISTRAL_API_KEY = "test-key-123";
      const mockBody = { choices: [{ message: { content: "hi" } }] };
      mockUpstreamOk(mockBody);

      await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      expect(fetchMock).toHaveBeenCalled();
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe("https://api.mistral.ai/v1/chat/completions");
      expect(callArgs[1].headers.Authorization).toBe("Bearer test-key-123");
    });

    it("applies default model (devstral-small-2507) when not specified", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.model).toBe("devstral-small-2507");
    });

    it("preserves client-specified model", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        model: "mistral-large-latest",
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.model).toBe("mistral-large-latest");
    });

    it("proxies upstream response status and body", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      const mockBody = { choices: [{ message: { content: "response" } }] };
      mockUpstreamOk(mockBody, 200);

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual(mockBody);
    });

    it("returns 502 when upstream fetch throws", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamFail();

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(502);
      expect(JSON.parse(res.body).error).toBe("Failed to reach Mistral API");
    });
  });

  describe("streaming", () => {
    it("sets SSE headers (Content-Type, Cache-Control, Connection)", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamStream(["data: {}\n\n", "data: [DONE]\n\n"]);

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        stream: true,
      });

      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(res.headers["cache-control"]).toBe("no-cache");
    });

    it("pipes streamed chunks from upstream to client", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      const chunks = ["data: {\"chunk\":1}\n\n", "data: {\"chunk\":2}\n\n"];
      mockUpstreamStream(chunks);

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        stream: true,
      });

      expect(res.body).toContain("data: {\"chunk\":1}");
      expect(res.body).toContain("data: {\"chunk\":2}");
    });

    it("returns 502 when upstream body is null", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamNullBody();

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        stream: true,
      });

      expect(res.status).toBe(502);
      expect(JSON.parse(res.body).error).toBe("No response body from Mistral");
    });
  });
});
