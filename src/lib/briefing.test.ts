import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  composeBriefingPrompt,
  gatherContext,
  generateBriefing,
  type BriefingPacket,
  type CodebaseContext,
} from "./briefing";

// ---------------------------------------------------------------------------
// composeBriefingPrompt
// ---------------------------------------------------------------------------

describe("composeBriefingPrompt", () => {
  const basePacket: BriefingPacket = {
    summary: "A voice-driven codebase intelligence platform.",
    questions: [
      { question: "What does gatherContext do?", groundTruth: "Queries KuzuDB for context", relatedNodes: ["fn:gatherContext"] },
      { question: "What file contains the proxy?", groundTruth: "server/proxy.ts", relatedNodes: ["f:server/proxy.ts"] },
    ],
  };

  it("returns string containing the summary text", () => {
    const result = composeBriefingPrompt(basePacket);
    expect(result).toContain("A voice-driven codebase intelligence platform.");
  });

  it("embeds numbered questions", () => {
    const result = composeBriefingPrompt(basePacket);
    expect(result).toContain("### Question 1");
    expect(result).toContain("### Question 2");
    expect(result).toContain("What does gatherContext do?");
    expect(result).toContain("What file contains the proxy?");
  });

  it("includes question count in prompt", () => {
    const result = composeBriefingPrompt(basePacket);
    expect(result).toContain(`${basePacket.questions.length} questions`);
    expect(result).toContain(`${basePacket.questions.length} pre-prepared questions`);
  });

  it("handles empty questions array", () => {
    const emptyPacket: BriefingPacket = { summary: "No questions.", questions: [] };
    const result = composeBriefingPrompt(emptyPacket);
    expect(result).toContain("No questions.");
    expect(result).toContain("0 questions");
    expect(result).not.toContain("### Question 1");
  });

  it("includes ground truth for each question", () => {
    const result = composeBriefingPrompt(basePacket);
    expect(result).toContain("Queries KuzuDB for context");
    expect(result).toContain("server/proxy.ts");
  });

  it("handles special characters in questions", () => {
    const packet: BriefingPacket = {
      summary: "Test",
      questions: [
        { question: 'What\'s the "main" function?', groundTruth: "It's the <entry> point & root", relatedNodes: [] },
      ],
    };
    const result = composeBriefingPrompt(packet);
    expect(result).toContain('What\'s the "main" function?');
    expect(result).toContain("It's the <entry> point & root");
  });
});

// ---------------------------------------------------------------------------
// gatherContext
// ---------------------------------------------------------------------------

describe("gatherContext", () => {
  it("maps query results to CodebaseContext fields correctly", async () => {
    const executeQuery = mock(async (cypher: string) => {
      // Check specific relationship types before node types (CONTRIBUTED query contains "File")
      if (cypher.includes("CONTRIBUTED")) return [{ "p.name": "Alice", "f.name": "auth.ts" }];
      if (cypher.includes("CALLS")) return [{ "a.name": "login", "b.name": "hash" }];
      if (cypher.includes("IMPORTS")) return [{ "a.name": "auth.ts", "b.name": "utils.ts" }];
      if (cypher.includes("File")) return [{ "f.name": "auth.ts", "f.filePath": "src/auth.ts" }];
      if (cypher.includes("Function")) return [{ "fn.name": "login", "fn.filePath": "src/auth.ts" }];
      if (cypher.includes("Class")) return [{ "c.name": "Auth", "c.filePath": "src/auth.ts" }];
      return [];
    });

    const ctx = await gatherContext(executeQuery);

    expect(ctx.files).toEqual([{ name: "auth.ts", filePath: "src/auth.ts" }]);
    expect(ctx.functions).toEqual([{ name: "login", filePath: "src/auth.ts" }]);
    expect(ctx.classes).toEqual([{ name: "Auth", filePath: "src/auth.ts" }]);
    expect(ctx.calls).toEqual([{ caller: "login", callee: "hash" }]);
    expect(ctx.imports).toEqual([{ importer: "auth.ts", imported: "utils.ts" }]);
    expect(ctx.contributors).toEqual([{ person: "Alice", file: "auth.ts" }]);
  });

  it("handles failed queries (returns empty arrays via .catch)", async () => {
    const executeQuery = mock(async () => {
      throw new Error("query failed");
    });

    const ctx = await gatherContext(executeQuery);

    expect(ctx.files).toEqual([]);
    expect(ctx.functions).toEqual([]);
    expect(ctx.classes).toEqual([]);
    expect(ctx.calls).toEqual([]);
    expect(ctx.imports).toEqual([]);
    expect(ctx.contributors).toEqual([]);
  });

  it("handles missing fields in result rows (fallback to empty string)", async () => {
    const executeQuery = mock(async (cypher: string) => {
      if (cypher.includes("File")) return [{ weird_key: "val" }];
      return [];
    });

    const ctx = await gatherContext(executeQuery);

    expect(ctx.files).toEqual([{ name: "", filePath: "" }]);
  });
});

// ---------------------------------------------------------------------------
// generateBriefing
// ---------------------------------------------------------------------------

describe("generateBriefing", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockContext: CodebaseContext = {
    files: [{ name: "auth.ts", filePath: "src/auth.ts" }],
    functions: [{ name: "login", filePath: "src/auth.ts" }],
    classes: [],
    calls: [],
    imports: [],
    contributors: [],
  };

  it("parses standard JSON response", async () => {
    const packet: BriefingPacket = {
      summary: "A simple auth system",
      questions: [{ question: "What does login do?", groundTruth: "Authenticates users", relatedNodes: [] }],
    };

    globalThis.fetch = mock(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify(packet) } }],
      }),
    })) as unknown as typeof fetch;

    const result = await generateBriefing(mockContext, "http://localhost:3001");

    expect(result.summary).toBe("A simple auth system");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toBe("What does login do?");
  });

  it("parses SSE streaming response (data: chunks)", async () => {
    const packet: BriefingPacket = {
      summary: "Streamed summary",
      questions: [{ question: "Q1?", groundTruth: "A1", relatedNodes: [] }],
    };
    const content = JSON.stringify(packet);
    const chunk1 = content.slice(0, 20);
    const chunk2 = content.slice(20);

    globalThis.fetch = mock(async () => ({
      ok: true,
      text: async () => [
        `data: ${JSON.stringify({ choices: [{ delta: { content: chunk1 } }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: chunk2 } }] })}`,
        "data: [DONE]",
      ].join("\n"),
    })) as unknown as typeof fetch;

    const result = await generateBriefing(mockContext, "http://localhost:3001");

    expect(result.summary).toBe("Streamed summary");
    expect(result.questions).toHaveLength(1);
  });

  it("strips markdown fences from JSON", async () => {
    const packet: BriefingPacket = {
      summary: "Fenced JSON",
      questions: [],
    };

    globalThis.fetch = mock(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: "```json\n" + JSON.stringify(packet) + "\n```" } }],
      }),
    })) as unknown as typeof fetch;

    const result = await generateBriefing(mockContext, "http://localhost:3001");

    expect(result.summary).toBe("Fenced JSON");
  });

  it("returns fallback on parse failure", async () => {
    globalThis.fetch = mock(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: "This is not valid JSON at all!!!" } }],
      }),
    })) as unknown as typeof fetch;

    const result = await generateBriefing(mockContext, "http://localhost:3001");

    expect(result.summary).toContain("Could not generate");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toContain("main files");
  });

  it("throws on non-OK HTTP response", async () => {
    globalThis.fetch = mock(async () => ({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    })) as unknown as typeof fetch;

    expect(generateBriefing(mockContext, "http://localhost:3001")).rejects.toThrow("Briefing generation failed");
  });
});
