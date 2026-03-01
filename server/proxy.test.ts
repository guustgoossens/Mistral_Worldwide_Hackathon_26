import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";
import http from "node:http";
import { app, convertToBedrockFormat, bedrockToOpenAI } from "./proxy";

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

function mockUpstreamError(status: number, errorBody: string) {
  globalThis.fetch = mock(async () => ({
    ok: false,
    status,
    text: async () => errorBody,
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
// POST /briefing + GET /briefing
// ---------------------------------------------------------------------------

describe("POST /briefing", () => {
  it("stores briefing string and returns { ok: true, length }", async () => {
    const briefing = "You are a friendly interviewer. Ask about the codebase.";
    const res = await request("POST", "/briefing", { briefing });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.ok).toBe(true);
    expect(data.length).toBe(briefing.length);
  });

  it("rejects missing briefing with 400", async () => {
    const res = await request("POST", "/briefing", {});
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain("Missing");
  });

  it("rejects non-string briefing with 400", async () => {
    const res = await request("POST", "/briefing", { briefing: 123 });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain("invalid");
  });
});

describe("GET /briefing", () => {
  it("returns { ready: true, length: N } after POST", async () => {
    const briefing = "Test briefing content";
    await request("POST", "/briefing", { briefing });
    const res = await request("GET", "/briefing");
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.ready).toBe(true);
    expect(data.length).toBe(briefing.length);
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
        stream: false,
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
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.model).toBe("devstral-small-2507");
    });

    it("coerces non-devstral-2507 models to default", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        model: "mistral-large-latest",
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.model).toBe("devstral-small-2507");
    });

    it("allows devstral-2507 for preparation", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        model: "devstral-2507",
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.model).toBe("devstral-2507");
    });

    it("proxies upstream response status and body", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      const mockBody = { choices: [{ message: { content: "response" } }] };
      mockUpstreamOk(mockBody, 200);

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        stream: false,
      });

      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual(mockBody);
    });

    it("returns 502 when upstream fetch throws", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamFail();

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        stream: false,
      });

      expect(res.status).toBe(502);
      expect(JSON.parse(res.body).error).toBe("Failed to reach Mistral API");
    });

    it("returns upstream status code and error detail on non-OK response", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamError(422, "Invalid model specified");

      const res = await request("POST", "/v1/chat/completions", {
        messages: [{ role: "user", content: "hello" }],
        stream: false,
      });

      expect(res.status).toBe(422);
      const data = JSON.parse(res.body);
      expect(data.error.message).toContain("Mistral API error");
      expect(data.error.detail).toContain("Invalid model");
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

  describe("message normalization", () => {
    it("patches tool message name from preceding assistant's tool_calls", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      await request("POST", "/v1/chat/completions", {
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "", tool_calls: [{ id: "tc_1", function: { name: "highlightNodes", arguments: "{}" } }] },
          { role: "tool", tool_call_id: "tc_1", content: "done" },
        ],
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const toolMsg = sentBody.messages.find((m: any) => m.role === "tool");
      expect(toolMsg.name).toBe("highlightNodes");
    });

    it("stringifies non-string content on tool messages", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      await request("POST", "/v1/chat/completions", {
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "", tool_calls: [{ id: "tc_2", function: { name: "foo", arguments: "{}" } }] },
          { role: "tool", tool_call_id: "tc_2", name: "foo", content: { result: true } },
        ],
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const toolMsg = sentBody.messages.find((m: any) => m.role === "tool");
      expect(typeof toolMsg.content).toBe("string");
      expect(toolMsg.content).toBe('{"result":true}');
    });

    it("leaves non-tool messages unchanged", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      await request("POST", "/v1/chat/completions", {
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "hello" },
        ],
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const userMsg = sentBody.messages.find((m: any) => m.role === "user");
      expect(userMsg.content).toBe("hello");
    });
  });

  describe("briefing injection", () => {
    it("replaces existing system message content with briefing", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      // Set briefing first
      await request("POST", "/briefing", { briefing: "Injected briefing content" });

      await request("POST", "/v1/chat/completions", {
        messages: [
          { role: "system", content: "Original system prompt" },
          { role: "user", content: "hello" },
        ],
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const systemMsg = sentBody.messages.find((m: any) => m.role === "system");
      expect(systemMsg.content).toBe("Injected briefing content");
    });

    it("prepends new system message when none exists", async () => {
      process.env.MISTRAL_API_KEY = "test-key";
      mockUpstreamOk({ choices: [] });

      // Briefing was set in previous test (stateful)
      await request("POST", "/briefing", { briefing: "Prepended briefing" });

      await request("POST", "/v1/chat/completions", {
        messages: [
          { role: "user", content: "hello" },
        ],
        stream: false,
      });

      const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.messages[0].role).toBe("system");
      expect(sentBody.messages[0].content).toBe("Prepended briefing");
    });
  });
});

// ---------------------------------------------------------------------------
// convertToBedrockFormat (pure function)
// ---------------------------------------------------------------------------

describe("convertToBedrockFormat", () => {
  it("extracts system messages to top-level", () => {
    const result = convertToBedrockFormat([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "hi" },
    ]);

    expect(result.system).toEqual([{ text: "Be helpful" }]);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
  });

  it("merges consecutive same-role messages", () => {
    const result = convertToBedrockFormat([
      { role: "user", content: "hello" },
      { role: "user", content: "world" },
    ]);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toEqual([{ text: "hello" }, { text: "world" }]);
  });

  it("prepends user message if first is assistant", () => {
    const result = convertToBedrockFormat([
      { role: "assistant", content: "I am ready" },
      { role: "user", content: "hi" },
    ]);

    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content[0].text).toBe("(conversation start)");
    expect(result.messages[1].role).toBe("assistant");
  });

  it("maps tool role to user role", () => {
    const result = convertToBedrockFormat([
      { role: "user", content: "call tool" },
      { role: "assistant", content: "calling" },
      { role: "tool", content: "tool result" },
    ]);

    // tool message becomes user
    expect(result.messages[2].role).toBe("user");
    expect(result.messages[2].content[0].text).toBe("tool result");
  });

  it("stringifies non-string content", () => {
    const result = convertToBedrockFormat([
      { role: "system", content: { key: "value" } },
      { role: "user", content: ["array", "content"] },
    ]);

    expect(result.system[0].text).toBe('{"key":"value"}');
    expect(result.messages[0].content[0].text).toBe('["array","content"]');
  });
});

// ---------------------------------------------------------------------------
// bedrockToOpenAI (pure function)
// ---------------------------------------------------------------------------

describe("bedrockToOpenAI", () => {
  it("converts response to OpenAI-compatible format", () => {
    const bedrockResponse = {
      output: { message: { content: [{ text: "Hello " }, { text: "world" }] } },
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 5 },
    };

    const result = bedrockToOpenAI(bedrockResponse, "devstral-small-2507");

    expect(result.object).toBe("chat.completion");
    expect(result.model).toBe("devstral-small-2507");
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].message.content).toBe("Hello world");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage.prompt_tokens).toBe(10);
    expect(result.usage.completion_tokens).toBe(5);
    expect(result.usage.total_tokens).toBe(15);
  });

  it("handles missing usage and content fields", () => {
    const bedrockResponse = {
      output: {},
      stopReason: "max_tokens",
    };

    const result = bedrockToOpenAI(bedrockResponse, "devstral-2507");

    expect(result.choices[0].message.content).toBe("");
    expect(result.usage.prompt_tokens).toBe(0);
    expect(result.usage.completion_tokens).toBe(0);
    expect(result.usage.total_tokens).toBe(0);
  });
});
