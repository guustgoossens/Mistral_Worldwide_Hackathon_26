import { describe, it, expect, mock, beforeEach } from "bun:test";
import { setupSchema, queryGraph, parseTable, deriveVizData } from "./kuzu";
import { loadSampleIntoKuzu, sampleGraph, sampleContributed, sampleUnderstands, samplePersons } from "../data/sample-graph";

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

  it("inserts all sample nodes, links, persons, contributions, and understands", async () => {
    await loadSampleIntoKuzu(conn);

    // nodes + links + persons + CONTRIBUTED edges + UNDERSTANDS edges
    const totalExpected = sampleGraph.nodes.length + sampleGraph.links.length
      + samplePersons.length + sampleContributed.length + sampleUnderstands.length;
    expect(conn.calls.length).toBe(totalExpected);
  });

  it("creates File nodes with correct Cypher", async () => {
    await loadSampleIntoKuzu(conn);

    const fileCreates = conn.calls.filter((c) => c.includes("CREATE (n:File"));
    const fileNodes = sampleGraph.nodes.filter((n) => n.type === "file");
    expect(fileCreates).toHaveLength(fileNodes.length);

    // Spot-check one
    expect(fileCreates[0]).toContain("f:lib/briefing.ts");
    expect(fileCreates[0]).toContain("lib/briefing.ts");
  });

  it("creates Function nodes with summary", async () => {
    await loadSampleIntoKuzu(conn);

    const fnCreates = conn.calls.filter((c) => c.includes("CREATE (n:Function"));
    const fnNodes = sampleGraph.nodes.filter((n) => n.type === "function");
    expect(fnCreates).toHaveLength(fnNodes.length);

    // Check that summary is populated from the sample summary
    expect(fnCreates[0]).toContain("summary");
    expect(fnCreates[0]).toContain("Queries KuzuDB for codebase context");
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
    expect(edgeCalls).toHaveLength(sampleGraph.links.length + sampleContributed.length + sampleUnderstands.length);

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
    expect(file?.color).toBe("#6C5CE7");

    const fn = data.nodes.find((n) => n.id === "fn:login");
    expect(fn?.type).toBe("function");
    expect(fn?.color).toBe("#00CFDD");
    expect(fn?.summary).toBe("Handles login");

    const cls = data.nodes.find((n) => n.id === "c:Auth");
    expect(cls?.type).toBe("class");
    expect(cls?.color).toBe("#FF2D78");
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

// ---------------------------------------------------------------------------
// deriveVizData — knowledge overlay
// ---------------------------------------------------------------------------

describe("deriveVizData — knowledge overlay", () => {
  function createKnowledgeMockConn(understandRows: Record<string, string>[] = []) {
    const responses = new Map<string, unknown>();

    responses.set(`MATCH (f:Function) RETURN f.id, f.name, f.filePath`, {
      getAll: () => [
        { "f.id": "fn:login", "f.name": "login", "f.filePath": "src/auth.ts" },
        { "f.id": "fn:logout", "f.name": "logout", "f.filePath": "src/auth.ts" },
        { "f.id": "fn:hash", "f.name": "hash", "f.filePath": "src/crypto.ts" },
      ],
    });

    responses.set(`MATCH (p:Person)-[u:UNDERSTANDS]->(f:Function) RETURN f.id AS funcId, u.confidence AS confidence`, {
      getAll: () => understandRows,
    });

    responses.set(`MATCH (f:File) RETURN f.id, f.name, f.filePath`, {
      getAll: () => [
        { "f.id": "f:auth.ts", "f.name": "auth.ts", "f.filePath": "src/auth.ts" },
      ],
    });

    responses.set(`MATCH (c:Class) RETURN c.id, c.name, c.filePath`, {
      getAll: () => [
        { "c.id": "c:Auth", "c.name": "Auth", "c.filePath": "src/auth.ts" },
      ],
    });

    responses.set(`MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`, {
      getAll: () => [{ "a.id": "f:auth.ts", "b.id": "fn:login" }],
    });

    responses.set(`MATCH (a:Function)-[:CALLS]->(b:Function) RETURN a.id, b.id`, {
      getAll: () => [{ "a.id": "fn:login", "b.id": "fn:hash" }],
    });

    return createMockConn(responses);
  }

  it("colors functions by confidence: deep=#0A2463, surface=#3E7CB1, none=#A8DADC", async () => {
    const conn = createKnowledgeMockConn([
      { funcId: "fn:login", confidence: "deep" },
      { funcId: "fn:logout", confidence: "surface" },
    ]);
    const data = await deriveVizData(conn, "knowledge");

    const login = data.nodes.find((n) => n.id === "fn:login");
    const logout = data.nodes.find((n) => n.id === "fn:logout");
    const hash = data.nodes.find((n) => n.id === "fn:hash");

    expect(login?.color).toBe("#0A2463");
    expect(logout?.color).toBe("#3E7CB1");
    expect(hash?.color).toBe("#A8DADC");
  });

  it("assigns knowledgeScore: deep=1.0, surface=0.5, none=0.0", async () => {
    const conn = createKnowledgeMockConn([
      { funcId: "fn:login", confidence: "deep" },
      { funcId: "fn:logout", confidence: "surface" },
    ]);
    const data = await deriveVizData(conn, "knowledge");

    const login = data.nodes.find((n) => n.id === "fn:login");
    const logout = data.nodes.find((n) => n.id === "fn:logout");
    const hash = data.nodes.find((n) => n.id === "fn:hash");

    expect(login?.knowledgeScore).toBe(1.0);
    expect(logout?.knowledgeScore).toBe(0.5);
    expect(hash?.knowledgeScore).toBe(0.0);
  });

  it("confidence priority: deep > surface > none (multiple UNDERSTANDS for same function)", async () => {
    const conn = createKnowledgeMockConn([
      { funcId: "fn:login", confidence: "none" },
      { funcId: "fn:login", confidence: "surface" },
      { funcId: "fn:login", confidence: "deep" },
    ]);
    const data = await deriveVizData(conn, "knowledge");

    const login = data.nodes.find((n) => n.id === "fn:login");
    expect(login?.color).toBe("#0A2463");
    expect(login?.knowledgeScore).toBe(1.0);
  });

  it("files/classes get neutral gray #3A3A3A", async () => {
    const conn = createKnowledgeMockConn();
    const data = await deriveVizData(conn, "knowledge");

    const file = data.nodes.find((n) => n.id === "f:auth.ts");
    const cls = data.nodes.find((n) => n.id === "c:Auth");

    expect(file?.color).toBe("#3A3A3A");
    expect(cls?.color).toBe("#3A3A3A");
  });

  it("graceful degradation when no UNDERSTANDS data", async () => {
    const conn = createKnowledgeMockConn([]);
    const data = await deriveVizData(conn, "knowledge");

    // All functions should be icy blue (no knowledge)
    const fns = data.nodes.filter((n) => n.type === "function");
    expect(fns).toHaveLength(3);
    for (const fn of fns) {
      expect(fn.color).toBe("#A8DADC");
      expect(fn.knowledgeScore).toBe(0.0);
    }
  });

  it("includes CONTAINS and CALLS edges, no IMPORTS", async () => {
    const conn = createKnowledgeMockConn();
    const data = await deriveVizData(conn, "knowledge");

    const containsEdges = data.links.filter((l) => l.type === "contains");
    const callsEdges = data.links.filter((l) => l.type === "calls");
    const importsEdges = data.links.filter((l) => l.type === "imports");

    expect(containsEdges).toHaveLength(1);
    expect(callsEdges).toHaveLength(1);
    expect(importsEdges).toHaveLength(0);
  });

  it("no Person nodes in output", async () => {
    const conn = createKnowledgeMockConn([
      { funcId: "fn:login", confidence: "deep" },
    ]);
    const data = await deriveVizData(conn, "knowledge");

    const personNodes = data.nodes.filter((n) => n.type === "person");
    expect(personNodes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deriveVizData — people overlay
// ---------------------------------------------------------------------------

describe("deriveVizData — people overlay", () => {
  function createPeopleMockConn(
    personRows: Record<string, string>[] = [],
    contribEdges: Record<string, string>[] = [],
    understandEdges: Record<string, string>[] = [],
  ) {
    const responses = new Map<string, unknown>();

    responses.set(`MATCH (p:Person) RETURN p.id, p.name, p.email`, {
      getAll: () => personRows,
    });

    responses.set(`MATCH (f:File) RETURN f.id, f.name, f.filePath`, {
      getAll: () => [
        { "f.id": "f:auth.ts", "f.name": "auth.ts", "f.filePath": "src/auth.ts" },
      ],
    });

    responses.set(`MATCH (f:Function) RETURN f.id, f.name, f.filePath`, {
      getAll: () => [
        { "f.id": "fn:login", "f.name": "login", "f.filePath": "src/auth.ts" },
      ],
    });

    responses.set(`MATCH (c:Class) RETURN c.id, c.name, c.filePath`, {
      getAll: () => [
        { "c.id": "c:Auth", "c.name": "Auth", "c.filePath": "src/auth.ts" },
      ],
    });

    responses.set(`MATCH (p:Person)-[:CONTRIBUTED]->(f:File) RETURN p.id, f.id`, {
      getAll: () => contribEdges,
    });

    responses.set(`MATCH (p:Person)-[:UNDERSTANDS]->(f:Function) RETURN p.id, f.id`, {
      getAll: () => understandEdges,
    });

    responses.set(`MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`, {
      getAll: () => [{ "a.id": "f:auth.ts", "b.id": "fn:login" }],
    });

    return createMockConn(responses);
  }

  it("Person nodes are visible: type 'person', color #FF9F1A, val 8", async () => {
    const conn = createPeopleMockConn(
      [{ "p.id": "p:alice", "p.name": "Alice", "p.email": "alice@example.com" }],
    );
    const data = await deriveVizData(conn, "people");

    const person = data.nodes.find((n) => n.id === "p:alice");
    expect(person).toBeDefined();
    expect(person?.type).toBe("person");
    expect(person?.color).toBe("#FF9F1A");
    expect(person?.val).toBe(8);
  });

  it("code nodes have reduced val 3", async () => {
    const conn = createPeopleMockConn(
      [{ "p.id": "p:alice", "p.name": "Alice", "p.email": "alice@example.com" }],
    );
    const data = await deriveVizData(conn, "people");

    const file = data.nodes.find((n) => n.id === "f:auth.ts");
    const fn = data.nodes.find((n) => n.id === "fn:login");
    const cls = data.nodes.find((n) => n.id === "c:Auth");

    expect(file?.val).toBe(3);
    expect(fn?.val).toBe(3);
    expect(cls?.val).toBe(3);
  });

  it("code nodes keep standard TYPE_COLORS", async () => {
    const conn = createPeopleMockConn(
      [{ "p.id": "p:alice", "p.name": "Alice", "p.email": "alice@example.com" }],
    );
    const data = await deriveVizData(conn, "people");

    const file = data.nodes.find((n) => n.id === "f:auth.ts");
    const fn = data.nodes.find((n) => n.id === "fn:login");
    const cls = data.nodes.find((n) => n.id === "c:Auth");

    expect(file?.color).toBe("#6C5CE7");
    expect(fn?.color).toBe("#00CFDD");
    expect(cls?.color).toBe("#FF2D78");
  });

  it("CONTRIBUTED edges (Person→File) present", async () => {
    const conn = createPeopleMockConn(
      [{ "p.id": "p:alice", "p.name": "Alice", "p.email": "alice@example.com" }],
      [{ "p.id": "p:alice", "f.id": "f:auth.ts" }],
    );
    const data = await deriveVizData(conn, "people");

    const contribLinks = data.links.filter((l) => l.type === "contributed");
    expect(contribLinks).toHaveLength(1);
    expect(contribLinks[0]?.source).toBe("p:alice");
    expect(contribLinks[0]?.target).toBe("f:auth.ts");
  });

  it("UNDERSTANDS edges (Person→Function) present", async () => {
    const conn = createPeopleMockConn(
      [{ "p.id": "p:alice", "p.name": "Alice", "p.email": "alice@example.com" }],
      [],
      [{ "p.id": "p:alice", "f.id": "fn:login" }],
    );
    const data = await deriveVizData(conn, "people");

    const understandLinks = data.links.filter((l) => l.type === "understands");
    expect(understandLinks).toHaveLength(1);
    expect(understandLinks[0]?.source).toBe("p:alice");
    expect(understandLinks[0]?.target).toBe("fn:login");
  });

  it("CONTAINS edges as structural context", async () => {
    const conn = createPeopleMockConn();
    const data = await deriveVizData(conn, "people");

    const containsLinks = data.links.filter((l) => l.type === "contains");
    expect(containsLinks).toHaveLength(1);
    expect(containsLinks[0]?.source).toBe("f:auth.ts");
    expect(containsLinks[0]?.target).toBe("fn:login");
  });

  it("graceful degradation when no Person data", async () => {
    const conn = createPeopleMockConn([], [], []);
    const data = await deriveVizData(conn, "people");

    const personNodes = data.nodes.filter((n) => n.type === "person");
    expect(personNodes).toHaveLength(0);

    // Code nodes still present
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.nodes.every((n) => n.type !== "person")).toBe(true);
  });
});
