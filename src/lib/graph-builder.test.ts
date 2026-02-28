import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { loadGraphFromJSON } from "./graph-builder";

// ---------------------------------------------------------------------------
// Mock connection factory
// ---------------------------------------------------------------------------

function createMockConn() {
  const calls: string[] = [];
  return {
    calls,
    execute: mock(async (cypher: string) => {
      calls.push(cypher);
    }),
  };
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleGraphJSON = {
  nodes: {
    files: [{ id: "f:src/index.ts", name: "index.ts", filePath: "src/index.ts" }],
    functions: [{ id: "fn:main", name: "main", filePath: "src/index.ts", startLine: 1, endLine: 10 }],
    classes: [{ id: "c:App", name: "App", filePath: "src/index.ts", startLine: 12, endLine: 50 }],
    methods: [{ id: "m:App.render", name: "render", filePath: "src/index.ts", startLine: 15, endLine: 30 }],
  },
  edges: {
    contains: [
      { source: "f:src/index.ts", target: "fn:main" },
      { source: "f:src/index.ts", target: "c:App" },
    ],
    calls: [{ source: "fn:main", target: "fn:main", confidence: 0.9, reason: "direct" }],
    imports: [{ source: "f:src/index.ts", target: "f:src/index.ts" }],
  },
};

// ---------------------------------------------------------------------------
// Helpers to set up / tear down global fetch mock
// ---------------------------------------------------------------------------

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchOk(body: unknown) {
  globalThis.fetch = mock(async (_url: string) => ({
    ok: true,
    status: 200,
    json: async () => body,
  })) as unknown as typeof fetch;
}

function mockFetchFail(status = 404) {
  globalThis.fetch = mock(async (_url: string) => ({
    ok: false,
    status,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadGraphFromJSON", () => {
  it("returns correct nodeCount and edgeCount on successful load", async () => {
    mockFetchOk(sampleGraphJSON);
    const conn = createMockConn();

    const result = await loadGraphFromJSON(conn, "/graph.json");

    // 1 file + 1 function + 1 class + 1 method = 4 nodes
    expect(result.nodeCount).toBe(4);
    // 2 contains + 1 calls (fn→fn) + 1 imports = 4 edge attempts
    // But the calls edge source is "fn:main" (not "f:"), so it IS a Function→Function call
    expect(result.edgeCount).toBe(4);
  });

  it("inserts File nodes with correct Cypher", async () => {
    mockFetchOk(sampleGraphJSON);
    const conn = createMockConn();

    await loadGraphFromJSON(conn, "/graph.json");

    const fileCreates = conn.calls.filter((c) => c.includes("CREATE (n:File"));
    expect(fileCreates).toHaveLength(1);
    expect(fileCreates[0]).toContain("f:src/index.ts");
    expect(fileCreates[0]).toContain("index.ts");
    expect(fileCreates[0]).toContain("src/index.ts");
    expect(fileCreates[0]).toContain("summary:");
    expect(fileCreates[0]).toContain("relevance:");
  });

  it("inserts Function nodes with correct Cypher", async () => {
    mockFetchOk(sampleGraphJSON);
    const conn = createMockConn();

    await loadGraphFromJSON(conn, "/graph.json");

    const fnCreates = conn.calls.filter(
      (c) => c.includes("CREATE (n:Function") && c.includes("fn:main"),
    );
    expect(fnCreates).toHaveLength(1);
    expect(fnCreates[0]).toContain("fn:main");
    expect(fnCreates[0]).toContain("main");
    expect(fnCreates[0]).toContain("startLine: 1");
    expect(fnCreates[0]).toContain("endLine: 10");
    expect(fnCreates[0]).toContain("summary:");
  });

  it("inserts Class nodes with correct Cypher", async () => {
    mockFetchOk(sampleGraphJSON);
    const conn = createMockConn();

    await loadGraphFromJSON(conn, "/graph.json");

    const classCreates = conn.calls.filter((c) => c.includes("CREATE (n:Class"));
    expect(classCreates).toHaveLength(1);
    expect(classCreates[0]).toContain("c:App");
    expect(classCreates[0]).toContain("App");
    expect(classCreates[0]).toContain("src/index.ts");
    expect(classCreates[0]).toContain("summary:");
  });

  it("inserts Method nodes into the Function table", async () => {
    mockFetchOk(sampleGraphJSON);
    const conn = createMockConn();

    await loadGraphFromJSON(conn, "/graph.json");

    // Methods are stored as Function nodes
    const methodAsFunction = conn.calls.filter(
      (c) => c.includes("CREATE (n:Function") && c.includes("m:App.render"),
    );
    expect(methodAsFunction).toHaveLength(1);
    expect(methodAsFunction[0]).toContain("render");
    expect(methodAsFunction[0]).toContain("startLine: 15");
    expect(methodAsFunction[0]).toContain("endLine: 30");
  });

  it("inserts CONTAINS, CALLS, and IMPORTS edges with MATCH…CREATE Cypher", async () => {
    mockFetchOk(sampleGraphJSON);
    const conn = createMockConn();

    await loadGraphFromJSON(conn, "/graph.json");

    const edgeCalls = conn.calls.filter(
      (c) => c.includes("MATCH") && c.includes("CREATE"),
    );

    // 2 CONTAINS + 1 CALLS (fn→fn) + 1 IMPORTS
    expect(edgeCalls).toHaveLength(4);

    const containsEdges = edgeCalls.filter((c) => c.includes("CONTAINS"));
    expect(containsEdges).toHaveLength(2);
    // First CONTAINS: File → Function
    expect(containsEdges[0]).toContain("Function");
    // Second CONTAINS: File → Class
    expect(containsEdges[1]).toContain("Class");

    const callsEdges = edgeCalls.filter((c) => c.includes("CALLS"));
    expect(callsEdges).toHaveLength(1);
    expect(callsEdges[0]).toContain("fn:main");

    const importsEdges = edgeCalls.filter((c) => c.includes("IMPORTS"));
    expect(importsEdges).toHaveLength(1);
    expect(importsEdges[0]).toContain("f:src/index.ts");
  });

  it("tolerates duplicate and already-exists errors without throwing", async () => {
    mockFetchOk(sampleGraphJSON);
    const conn = {
      calls: [] as string[],
      execute: mock(async (cypher: string) => {
        (conn.calls as string[]).push(cypher);
        throw new Error("duplicate key already exists");
      }),
    };

    // Must not throw
    const result = await loadGraphFromJSON(conn, "/graph.json");
    // Counts are still incremented even when safeExec returns false for duplicates
    expect(result.nodeCount).toBe(4);
    expect(result.edgeCount).toBe(4);
  });

  it("throws when fetch returns a non-ok response", async () => {
    mockFetchFail(404);
    const conn = createMockConn();

    expect(loadGraphFromJSON(conn, "/missing.json")).rejects.toThrow("404");
  });
});
