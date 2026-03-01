/**
 * KuzuDB server-side initialization for MCP.
 * Uses the native kuzu package (not WASM) for Node.js.
 * Loads graph.json + git-data.json from filesystem.
 */

import kuzu from "kuzu";
import fs from "fs";
import path from "path";

export interface KuzuServer {
  db: kuzu.Database;
  conn: kuzu.Connection;
  repoId: string;
}

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
}

const SCHEMA_DDL = {
  nodeTables: [
    `CREATE NODE TABLE IF NOT EXISTS File (id STRING, name STRING, filePath STRING, summary STRING, relevance DOUBLE, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Function (id STRING, name STRING, filePath STRING, startLine INT64, endLine INT64, summary STRING, relevance DOUBLE, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Class (id STRING, name STRING, filePath STRING, summary STRING, relevance DOUBLE, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Person (id STRING, name STRING, email STRING, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Discussion (id STRING, timestamp STRING, transcript STRING, summary_l1 STRING, quizResult STRING, confidenceBefore STRING, confidenceAfter STRING, PRIMARY KEY (id))`,
  ],
  relTables: [
    `CREATE REL TABLE IF NOT EXISTS CONTAINS (FROM File TO Function, FROM File TO Class)`,
    `CREATE REL TABLE IF NOT EXISTS CALLS (FROM Function TO Function)`,
    `CREATE REL TABLE IF NOT EXISTS IMPORTS (FROM File TO File)`,
    `CREATE REL TABLE IF NOT EXISTS INHERITS (FROM Class TO Class)`,
    `CREATE REL TABLE IF NOT EXISTS CONTRIBUTED (FROM Person TO File, commits INT64, lastTouch STRING, linesChanged INT64, blameLines INT64, ownershipPct DOUBLE, summary_l1 STRING, commits_json STRING)`,
    `CREATE REL TABLE IF NOT EXISTS UNDERSTANDS (FROM Person TO Function, confidence STRING, source STRING, topics STRING[], lastAssessed STRING, needsRetest BOOLEAN, summary_l1 STRING, sessions_json STRING)`,
    `CREATE REL TABLE IF NOT EXISTS HAS_PARTICIPANT (FROM Discussion TO Person, role STRING)`,
    `CREATE REL TABLE IF NOT EXISTS ABOUT (FROM Discussion TO Function, FROM Discussion TO File, FROM Discussion TO Class, focus STRING)`,
  ],
};

/** Full schema DDL as a string (for get_schema tool). */
export function getSchemaDescription(): string {
  return [
    "-- Node Tables",
    ...SCHEMA_DDL.nodeTables,
    "",
    "-- Relationship Tables",
    ...SCHEMA_DDL.relTables,
    "",
    "-- ID Conventions:",
    "-- File IDs: 'f:<filePath>' (e.g., 'f:src/App.tsx')",
    "-- Function IDs: 'fn:<filePath>::<functionName>' (e.g., 'fn:src/lib/kuzu.ts::initKuzu')",
    "-- Class IDs: 'c:<filePath>::<className>' (e.g., 'c:src/types/graph.ts::VizNode')",
    "-- Person IDs: 'p:<uniqueId>_<email>' (e.g., 'p:73305423_user@example.com')",
    "-- Method IDs: 'fn:<filePath>::<ClassName>.<methodName>'",
    "",
    "-- Example Cypher Patterns:",
    "-- All functions in a file: MATCH (f:File {id: 'f:src/App.tsx'})-[:CONTAINS]->(fn:Function) RETURN fn.name",
    "-- What a function calls: MATCH (fn:Function {name: 'initKuzu'})-[:CALLS]->(callee:Function) RETURN callee.name",
    "-- Who calls a function: MATCH (caller:Function)-[:CALLS]->(fn:Function {name: 'queryGraph'}) RETURN caller.name, caller.filePath",
    "-- File imports: MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.name = 'App.tsx' RETURN b.name, b.filePath",
    "-- Contributors to a file: MATCH (p:Person)-[c:CONTRIBUTED]->(f:File) WHERE f.name = 'kuzu.ts' RETURN p.name, c.commits, c.linesChanged",
    "-- Who understands a function: MATCH (p:Person)-[u:UNDERSTANDS]->(fn:Function {name: 'queryGraph'}) RETURN p.name, u.confidence",
    "-- Blast radius (2-hop call chain): MATCH (fn:Function {name: 'queryGraph'})<-[:CALLS*1..2]-(caller:Function) RETURN DISTINCT caller.name, caller.filePath",
    "-- Node name search: MATCH (n:Function) WHERE n.name CONTAINS 'graph' RETURN n.id, n.name, n.filePath",
  ].join("\n");
}

interface GraphJSON {
  nodes: {
    files: Array<{ id: string; name: string; filePath: string }>;
    functions: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
    classes: Array<{ id: string; name: string; filePath: string; startLine?: number; endLine?: number }>;
    methods: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
  };
  edges: {
    contains: Array<{ source: string; target: string }>;
    calls: Array<{ source: string; target: string }>;
    imports: Array<{ source: string; target: string }>;
  };
}

interface GitDataJSON {
  contributors: Array<{
    id: string;
    name: string;
    email: string;
    files: Array<{
      filePath: string;
      commits: number;
      linesChanged: number;
      lastTouch: string;
    }>;
  }>;
}

async function safeQuery(conn: kuzu.Connection, cypher: string): Promise<void> {
  try {
    await conn.query(cypher);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("already exists") || msg.includes("duplicate")) return;
    if (msg.includes("does not exist") || msg.includes("no node")) return;
    // Silently skip for data loading robustness
  }
}

export async function queryRows(conn: kuzu.Connection, cypher: string): Promise<Record<string, unknown>[]> {
  const result = await conn.query(cypher);
  const rows: Record<string, unknown>[] = [];
  while (result.hasNext()) {
    rows.push(result.getNext());
  }
  return rows;
}

export async function initKuzuServer(dataDir: string): Promise<KuzuServer> {
  const repoId = path.basename(dataDir);
  console.error(`[mcp] Initializing KuzuDB for repo: ${repoId}`);

  const db = new kuzu.Database(":memory:");
  const conn = new kuzu.Connection(db);

  // Create schema
  for (const ddl of [...SCHEMA_DDL.nodeTables, ...SCHEMA_DDL.relTables]) {
    try {
      await conn.query(ddl);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already exists")) continue;
      console.error(`[mcp] Schema DDL failed: ${ddl.slice(0, 80)}`, msg);
    }
  }
  console.error(`[mcp] Schema created`);

  // Load graph.json
  const graphPath = path.join(dataDir, "graph.json");
  if (fs.existsSync(graphPath)) {
    const data: GraphJSON = JSON.parse(fs.readFileSync(graphPath, "utf-8"));
    let nodeCount = 0;
    let edgeCount = 0;

    for (const f of data.nodes.files) {
      await safeQuery(conn, `CREATE (n:File {id: '${esc(f.id)}', name: '${esc(f.name)}', filePath: '${esc(f.filePath)}', summary: '', relevance: 0.5})`);
      nodeCount++;
    }
    for (const fn of data.nodes.functions) {
      await safeQuery(conn, `CREATE (n:Function {id: '${esc(fn.id)}', name: '${esc(fn.name)}', filePath: '${esc(fn.filePath)}', startLine: ${fn.startLine}, endLine: ${fn.endLine}, summary: '', relevance: 0.5})`);
      nodeCount++;
    }
    for (const c of data.nodes.classes) {
      await safeQuery(conn, `CREATE (n:Class {id: '${esc(c.id)}', name: '${esc(c.name)}', filePath: '${esc(c.filePath)}', summary: '', relevance: 0.5})`);
      nodeCount++;
    }
    for (const m of data.nodes.methods) {
      await safeQuery(conn, `CREATE (n:Function {id: '${esc(m.id)}', name: '${esc(m.name)}', filePath: '${esc(m.filePath)}', startLine: ${m.startLine}, endLine: ${m.endLine}, summary: '', relevance: 0.5})`);
      nodeCount++;
    }

    for (const edge of data.edges.contains) {
      const targetLabel = edge.target.startsWith("c:") ? "Class" : "Function";
      await safeQuery(conn, `MATCH (a:File {id: '${esc(edge.source)}'}), (b:${targetLabel} {id: '${esc(edge.target)}'}) CREATE (a)-[:CONTAINS]->(b)`);
      edgeCount++;
    }
    for (const edge of data.edges.calls) {
      if (edge.source.startsWith("f:")) continue;
      await safeQuery(conn, `MATCH (a:Function {id: '${esc(edge.source)}'}), (b:Function {id: '${esc(edge.target)}'}) CREATE (a)-[:CALLS]->(b)`);
      edgeCount++;
    }
    for (const edge of data.edges.imports) {
      await safeQuery(conn, `MATCH (a:File {id: '${esc(edge.source)}'}), (b:File {id: '${esc(edge.target)}'}) CREATE (a)-[:IMPORTS]->(b)`);
      edgeCount++;
    }

    console.error(`[mcp] Loaded graph: ${nodeCount} nodes, ${edgeCount} edges`);
  } else {
    console.error(`[mcp] Warning: ${graphPath} not found`);
  }

  // Load git-data.json
  const gitPath = path.join(dataDir, "git-data.json");
  if (fs.existsSync(gitPath)) {
    const data: GitDataJSON = JSON.parse(fs.readFileSync(gitPath, "utf-8"));
    let persons = 0;
    let edges = 0;

    for (const contributor of data.contributors) {
      await safeQuery(conn, `CREATE (p:Person {id: '${esc(contributor.id)}', name: '${esc(contributor.name)}', email: '${esc(contributor.email)}'})`);
      persons++;

      for (const file of contributor.files) {
        const fileId = `f:${file.filePath}`;
        await safeQuery(conn,
          `MATCH (p:Person {id: '${esc(contributor.id)}'}), (f:File {id: '${esc(fileId)}'}) ` +
          `CREATE (p)-[:CONTRIBUTED {commits: ${file.commits}, lastTouch: '${esc(file.lastTouch)}', linesChanged: ${file.linesChanged}, blameLines: 0, ownershipPct: 0.0, summary_l1: '', commits_json: '[]'}]->(f)`
        );
        edges++;
      }
    }

    console.error(`[mcp] Loaded git data: ${persons} persons, ${edges} contributed edges`);
  } else {
    console.error(`[mcp] Warning: ${gitPath} not found`);
  }

  return { db, conn, repoId };
}
