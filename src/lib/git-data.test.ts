import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { loadGitData } from "./git-data";

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

const sampleGitData = {
  contributors: [
    {
      id: "p:alice",
      name: "Alice",
      email: "alice@example.com",
      files: [
        { filePath: "src/index.ts", commits: 5, linesChanged: 120, lastTouch: "2026-01-15" },
      ],
    },
  ],
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

describe("loadGitData", () => {
  it("returns correct persons and edges count on successful load", async () => {
    mockFetchOk(sampleGitData);
    const conn = createMockConn();

    const result = await loadGitData(conn, "/git-data.json");

    expect(result.persons).toBe(1);
    expect(result.edges).toBe(1);
  });

  it("creates Person nodes with correct Cypher", async () => {
    mockFetchOk(sampleGitData);
    const conn = createMockConn();

    await loadGitData(conn, "/git-data.json");

    const personCreates = conn.calls.filter((c) => c.includes("CREATE (p:Person"));
    expect(personCreates).toHaveLength(1);
    expect(personCreates[0]).toContain("p:alice");
    expect(personCreates[0]).toContain("Alice");
    expect(personCreates[0]).toContain("alice@example.com");
  });

  it("creates CONTRIBUTED edges with commit properties", async () => {
    mockFetchOk(sampleGitData);
    const conn = createMockConn();

    await loadGitData(conn, "/git-data.json");

    const contribEdges = conn.calls.filter((c) => c.includes("CONTRIBUTED"));
    expect(contribEdges).toHaveLength(1);

    const edge = contribEdges[0]!;
    // Uses MATCH…CREATE pattern
    expect(edge).toContain("MATCH");
    expect(edge).toContain("CREATE");
    expect(edge).toContain("p:alice");
    // File id is derived as f:<filePath>
    expect(edge).toContain("f:src/index.ts");
    // Edge properties
    expect(edge).toContain("commits: 5");
    expect(edge).toContain("linesChanged: 120");
    expect(edge).toContain("2026-01-15");
  });

  it("tolerates duplicate and already-exists errors without throwing", async () => {
    mockFetchOk(sampleGitData);
    const conn = {
      calls: [] as string[],
      execute: mock(async (cypher: string) => {
        (conn.calls as string[]).push(cypher);
        throw new Error("duplicate key already exists");
      }),
    };

    // Must not throw
    const result = await loadGitData(conn, "/git-data.json");
    expect(result.persons).toBe(1);
    expect(result.edges).toBe(1);
  });

  it("tolerates 'does not exist' errors for missing file nodes without throwing", async () => {
    mockFetchOk(sampleGitData);
    const conn = {
      calls: [] as string[],
      execute: mock(async (cypher: string) => {
        (conn.calls as string[]).push(cypher);
        if (cypher.includes("CONTRIBUTED")) {
          throw new Error("Node does not exist in graph");
        }
      }),
    };

    // Must not throw — missing file is silently skipped
    const result = await loadGitData(conn, "/git-data.json");
    expect(result.persons).toBe(1);
    expect(result.edges).toBe(1);
  });

  it("throws when fetch returns a non-ok response", async () => {
    mockFetchFail(500);
    const conn = createMockConn();

    expect(loadGitData(conn, "/git-data.json")).rejects.toThrow("500");
  });
});
