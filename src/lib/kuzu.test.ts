import { describe, it, expect, mock, beforeEach } from "bun:test";
import { setupSchema, queryGraph, parseTable, deriveVizData } from "./kuzu";
import { loadSampleIntoKuzu, sampleGraph } from "../data/sample-graph";

// ---------------------------------------------------------------------------
// Mock connection factory
// ---------------------------------------------------------------------------

/** Creates a fake KuzuDB connection that records calls and returns canned results. */
function createMockConn(responses?: Map<string, unknown>) {
  const calls: string[] = [];
  return {
    calls,
    execute: mock(async (cypher: string) => {
      calls.push(cypher);
      if (responses?.has(cypher)) {
        return responses.get(cypher);
      }
      // Default: return empty result with getAll
      return { getAll: () => [] };
    }),
  };
}

// ---------------------------------------------------------------------------
// parseTable
// ---------------------------------------------------------------------------

describe("parseTable", () => {
  it("parses a table with structured access (getColumnNames + numRows)", () => {
    const table = {
      numRows: 2,
      getColumnNames: () => ["f.id", "f.name"],
      toString: () =>
        [
          "│ f.id        │ f.name       │",
          "│ ─────────── │ ──────────── │",
          "│ f:auth.ts   │ auth.ts      │",
          "│ f:login.ts  │ login.ts     │",
        ].join("\n"),
    };

    const rows = parseTable(table);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ "f.id": "f:auth.ts", "f.name": "auth.ts" });
    expect(rows[1]).toEqual({ "f.id": "f:login.ts", "f.name": "login.ts" });
  });

  it("falls back to toString parsing when getColumnNames is unavailable", () => {
    const table = {
      toString: () =>
        [
          "│ c.id          │ c.name       │",
          "│ ───────────── │ ──────────── │",
          "│ c:AuthService │ AuthService  │",
        ].join("\n"),
    };

    const rows = parseTable(table);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ "c.id": "c:AuthService", "c.name": "AuthService" });
  });

  it("returns empty array for empty table output", () => {
    const table = { toString: () => "" };
    expect(parseTable(table)).toEqual([]);
  });

  it("returns empty array when no pipe-delimited header found", () => {
    const table = { toString: () => "no results" };
    expect(parseTable(table)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// queryGraph
// ---------------------------------------------------------------------------

describe("queryGraph", () => {
  it("uses getAll() when available on the result", async () => {
    const expected = [{ id: "1" }, { id: "2" }];
    const conn = createMockConn(
      new Map([["MATCH (n) RETURN n", { getAll: () => expected }]]),
    );

    const rows = await queryGraph(conn, "MATCH (n) RETURN n");
    expect(rows).toBe(expected);
  });

  it("falls back to parseTable when result has .table but no getAll", async () => {
    const table = {
      toString: () =>
        ["│ n.id │", "│ ──── │", "│ abc  │"].join("\n"),
    };
    const conn = createMockConn(
      new Map([["MATCH (n) RETURN n.id", { table }]]),
    );

    const rows = await queryGraph(conn, "MATCH (n) RETURN n.id");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ "n.id": "abc" });
  });

  it("returns empty array when result has neither getAll nor table", async () => {
    const conn = createMockConn(
      new Map([["MATCH (n) RETURN n", {}]]),
    );

    const rows = await queryGraph(conn, "MATCH (n) RETURN n");
    expect(rows).toEqual([]);
  });

  it("throws and logs on query error", async () => {
    const conn = {
      execute: mock(() => Promise.reject(new Error("syntax error"))),
    };

    expect(queryGraph(conn, "BAD CYPHER")).rejects.toThrow("syntax error");
  });
});

// ---------------------------------------------------------------------------
// setupSchema
// ---------------------------------------------------------------------------

describe("setupSchema", () => {
  it("executes all DDL statements (5 node tables + 8 rel tables)", async () => {
    const conn = createMockConn();
    await setupSchema(conn);

    // 5 node tables + 8 relationship tables = 13 DDL statements
    expect(conn.calls).toHaveLength(13);
    expect(conn.calls[0]).toContain("CREATE NODE TABLE");
    expect(conn.calls[0]).toContain("File");
    expect(conn.calls[5]).toContain("CREATE REL TABLE");
    expect(conn.calls[5]).toContain("CONTAINS");
  });

  it("ignores 'already exists' errors", async () => {
    const conn = {
      execute: mock(() => Promise.reject(new Error("Table already exists"))),
    };

    // Should not throw
    await setupSchema(conn);
  });

  it("rethrows non-'already exists' errors", async () => {
    const conn = {
      execute: mock(() => Promise.reject(new Error("disk full"))),
    };

    expect(setupSchema(conn)).rejects.toThrow("disk full");
  });
});

// ---------------------------------------------------------------------------
// loadSampleIntoKuzu
// ---------------------------------------------------------------------------

describe("loadSampleIntoKuzu", () => {
  let conn: ReturnType<typeof createMockConn>;

  beforeEach(() => {
    conn = createMockConn();
  });

  it("inserts all sample nodes and links", async () => {
    await loadSampleIntoKuzu(conn);

    // Should have called execute for each node + each link
    const totalExpected = sampleGraph.nodes.length + sampleGraph.links.length;
    expect(conn.calls.length).toBe(totalExpected);
  });

  it("creates File nodes with correct Cypher", async () => {
    await loadSampleIntoKuzu(conn);

    const fileCreates = conn.calls.filter((c) => c.includes("CREATE (n:File"));
    const fileNodes = sampleGraph.nodes.filter((n) => n.type === "file");
    expect(fileCreates).toHaveLength(fileNodes.length);

    // Spot-check one
    expect(fileCreates[0]).toContain("f:auth/index.ts");
    expect(fileCreates[0]).toContain("auth/index.ts");
  });

  it("creates Function nodes with summary", async () => {
    await loadSampleIntoKuzu(conn);

    const fnCreates = conn.calls.filter((c) => c.includes("CREATE (n:Function"));
    const fnNodes = sampleGraph.nodes.filter((n) => n.type === "function");
    expect(fnCreates).toHaveLength(fnNodes.length);

    // Check that summary is populated from the sample summary
    expect(fnCreates[0]).toContain("summary");
    expect(fnCreates[0]).toContain("Main login entry");
  });

  it("creates Class nodes", async () => {
    await loadSampleIntoKuzu(conn);

    const classCreates = conn.calls.filter((c) => c.includes("CREATE (n:Class"));
    const classNodes = sampleGraph.nodes.filter((n) => n.type === "class");
    expect(classCreates).toHaveLength(classNodes.length);
  });

  it("creates edges with MATCH + CREATE pattern", async () => {
    await loadSampleIntoKuzu(conn);

    const edgeCalls = conn.calls.filter((c) => c.includes("MATCH") && c.includes("CREATE"));
    expect(edgeCalls).toHaveLength(sampleGraph.links.length);

    // Check CONTAINS edges reference correct labels
    const containsEdges = edgeCalls.filter((c) => c.includes("CONTAINS"));
    const containsLinks = sampleGraph.links.filter((l) => l.type === "contains");
    expect(containsEdges).toHaveLength(containsLinks.length);

    // Check CALLS edges
    const callsEdges = edgeCalls.filter((c) => c.includes("CALLS"));
    const callsLinks = sampleGraph.links.filter((l) => l.type === "calls");
    expect(callsEdges).toHaveLength(callsLinks.length);
  });

  it("tolerates duplicate insert errors", async () => {
    const failConn = {
      execute: mock(() => Promise.reject(new Error("duplicate key"))),
    };

    // Should not throw
    await loadSampleIntoKuzu(failConn);
  });
});

// ---------------------------------------------------------------------------
// deriveVizData — structure overlay
// ---------------------------------------------------------------------------

describe("deriveVizData", () => {
  /** Build a mock conn that returns canned data per Cypher pattern. */
  function createStructureMockConn() {
    const responses = new Map<string, unknown>();

    // Files
    responses.set(`MATCH (f:File) RETURN f.id, f.name, f.filePath`, {
      getAll: () => [
        { "f.id": "f:auth.ts", "f.name": "auth.ts", "f.filePath": "src/auth.ts" },
      ],
    });

    // Functions
    responses.set(`MATCH (f:Function) RETURN f.id, f.name, f.filePath, f.summary`, {
      getAll: () => [
        { "f.id": "fn:login", "f.name": "login", "f.filePath": "src/auth.ts", "f.summary": "Handles login" },
      ],
    });

    // Classes
    responses.set(`MATCH (c:Class) RETURN c.id, c.name, c.filePath`, {
      getAll: () => [
        { "c.id": "c:Auth", "c.name": "Auth", "c.filePath": "src/auth.ts" },
      ],
    });

    // CONTAINS
    responses.set(`MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`, {
      getAll: () => [
        { "a.id": "f:auth.ts", "b.id": "fn:login" },
        { "a.id": "f:auth.ts", "b.id": "c:Auth" },
      ],
    });

    // CALLS
    responses.set(`MATCH (a:Function)-[:CALLS]->(b:Function) RETURN a.id, b.id`, {
      getAll: () => [],
    });

    // IMPORTS
    responses.set(`MATCH (a:File)-[:IMPORTS]->(b:File) RETURN a.id, b.id`, {
      getAll: () => [],
    });

    return createMockConn(responses);
  }

  it("returns nodes and links for structure overlay", async () => {
    const conn = createStructureMockConn();
    const data = await deriveVizData(conn, "structure");

    // 1 file + 1 function + 1 class = 3 nodes
    expect(data.nodes).toHaveLength(3);
    // 2 CONTAINS edges
    expect(data.links).toHaveLength(2);
  });

  it("assigns correct types and colors", async () => {
    const conn = createStructureMockConn();
    const data = await deriveVizData(conn, "structure");

    const file = data.nodes.find((n) => n.id === "f:auth.ts");
    expect(file?.type).toBe("file");
    expect(file?.color).toBe("#6366f1");

    const fn = data.nodes.find((n) => n.id === "fn:login");
    expect(fn?.type).toBe("function");
    expect(fn?.color).toBe("#f59e0b");
    expect(fn?.summary).toBe("Handles login");

    const cls = data.nodes.find((n) => n.id === "c:Auth");
    expect(cls?.type).toBe("class");
    expect(cls?.color).toBe("#10b981");
  });

  it("returns correct link types", async () => {
    const conn = createStructureMockConn();
    const data = await deriveVizData(conn, "structure");

    expect(data.links.every((l) => l.type === "contains")).toBe(true);
    expect(data.links[0]?.source).toBe("f:auth.ts");
    expect(data.links[0]?.target).toBe("fn:login");
  });

  it("returns nodes for contributors overlay with contributor data", async () => {
    const responses = new Map<string, unknown>();

    // Files, Functions, Classes queries for contributors overlay
    responses.set(`MATCH (f:File) RETURN f.id, f.name, f.filePath`, {
      getAll: () => [{ "f.id": "f:auth.ts", "f.name": "auth.ts", "f.filePath": "src/auth.ts" }],
    });
    responses.set(`MATCH (f:Function) RETURN f.id, f.name, f.filePath`, {
      getAll: () => [],
    });
    responses.set(`MATCH (c:Class) RETURN c.id, c.name, c.filePath`, {
      getAll: () => [],
    });
    // Contributor data
    responses.set(`MATCH (p:Person)-[r:CONTRIBUTED]->(f:File) RETURN f.id AS fileId, p.name AS contributor, r.commits AS commits, r.linesChanged AS linesChanged`, {
      getAll: () => [{ fileId: "f:auth.ts", contributor: "Alice", commits: "10", linesChanged: "200" }],
    });
    // Structural edges
    responses.set(`MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`, { getAll: () => [] });
    responses.set(`MATCH (a:Function)-[:CALLS]->(b:Function) RETURN a.id, b.id`, { getAll: () => [] });
    responses.set(`MATCH (a:File)-[:IMPORTS]->(b:File) RETURN a.id, b.id`, { getAll: () => [] });

    const conn = createMockConn(responses);
    const data = await deriveVizData(conn, "contributors");

    expect(data.nodes).toHaveLength(1);
    expect(data.nodes[0]!.id).toBe("f:auth.ts");
    expect(data.nodes[0]!.contributors).toBeDefined();
  });
});
