/**
 * KuzuDB WASM initialization, schema setup, and query helpers.
 *
 * This is the primary graph store for HackStral. Agents write Cypher
 * dynamically via queryGraph(). In-memory JSON is the fallback if
 * WASM setup fails (2-hour rule).
 */

import type { GraphData, OverlayMode, VizNode, VizLink } from "@/types/graph";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuzuConnection = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuzuDatabase = any;

export interface KuzuInstance {
  db: KuzuDatabase;
  conn: KuzuConnection;
}

/**
 * Initialize KuzuDB WASM in-browser.
 * Requires COEP/COOP headers for SharedArrayBuffer.
 */
export async function initKuzu(): Promise<KuzuInstance> {
  console.time("[KuzuDB] Init");

  const module = await import("@kuzu/kuzu-wasm");
  const kuzu = await module.default();
  const db = await kuzu.Database();
  const conn = await kuzu.Connection(db);

  console.timeEnd("[KuzuDB] Init");
  console.log("[KuzuDB] Initialized");

  await setupSchema(conn);

  return { db, conn };
}

/**
 * Create node and relationship tables in KuzuDB.
 */
export async function setupSchema(conn: KuzuConnection): Promise<void> {
  const nodeTables = [
    `CREATE NODE TABLE IF NOT EXISTS File (id STRING, name STRING, filePath STRING, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Function (id STRING, name STRING, filePath STRING, startLine INT64, endLine INT64, summary_l1 STRING, summary_l2 STRING, summary_l3 STRING, structuralImportance DOUBLE, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Class (id STRING, name STRING, filePath STRING, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Person (id STRING, name STRING, email STRING, PRIMARY KEY (id))`,
  ];

  const relTables = [
    `CREATE REL TABLE IF NOT EXISTS CONTAINS (FROM File TO Function, FROM File TO Class)`,
    `CREATE REL TABLE IF NOT EXISTS CALLS (FROM Function TO Function)`,
    `CREATE REL TABLE IF NOT EXISTS IMPORTS (FROM File TO File)`,
    `CREATE REL TABLE IF NOT EXISTS INHERITS (FROM Class TO Class)`,
    `CREATE REL TABLE IF NOT EXISTS CONTRIBUTED (FROM Person TO File, commits INT64, lastTouch STRING, linesChanged INT64)`,
    `CREATE REL TABLE IF NOT EXISTS UNDERSTANDS (FROM Person TO Function, confidence STRING, source STRING, topics STRING[], lastAssessed STRING)`,
    `CREATE REL TABLE IF NOT EXISTS DISCUSSED (FROM Person TO Function, timestamp STRING, transcript STRING, quizResult STRING, confidenceBefore STRING, confidenceAfter STRING)`,
  ];

  for (const ddl of [...nodeTables, ...relTables]) {
    try {
      await conn.execute(ddl);
    } catch (err) {
      // "IF NOT EXISTS" may not be supported in some WASM versions — ignore "already exists" errors
      const msg = String(err);
      if (msg.includes("already exists")) continue;
      throw err;
    }
  }

  console.log("[KuzuDB] Schema created");
}

/**
 * Execute a Cypher query against KuzuDB with error handling.
 */
export async function queryGraph(
  conn: KuzuConnection,
  cypher: string,
): Promise<unknown[]> {
  try {
    const result = await conn.execute(cypher);
    // WASM version returns { table } — use getAll if available, otherwise parse table
    if (typeof result.getAll === "function") {
      return result.getAll();
    }
    if (result.table) {
      return parseTable(result.table);
    }
    return [];
  } catch (err) {
    console.error("[KuzuDB] Query failed:", cypher, err);
    throw err;
  }
}

/**
 * Parse a KuzuDB WASM table result into an array of row objects.
 */
export function parseTable(table: { toString: () => string; numRows?: number; numColumns?: number; getColumnNames?: () => string[]; getColumnTypes?: () => string[] }): Record<string, unknown>[] {
  // Try structured access first
  if (typeof table.getColumnNames === "function" && table.numRows != null) {
    const colNames = table.getColumnNames();
    const numRows = table.numRows as number;
    const rows: Record<string, unknown>[] = [];
    const raw = table.toString();
    const lines = raw.trim().split("\n");
    // Skip header line(s) and separator lines, parse data lines
    const isSeparator = (l: string) => l.startsWith("─") || (l.includes("│") && l.includes("───"));
    const dataLines = lines.filter((l: string) => !isSeparator(l) && l.includes("│")).slice(1);
    for (let i = 0; i < Math.min(dataLines.length, numRows); i++) {
      const cells = dataLines[i]!.split("│").map((c: string) => c.trim()).filter((c: string) => c !== "");
      const row: Record<string, unknown> = {};
      colNames.forEach((col: string, idx: number) => {
        row[col] = cells[idx] ?? null;
      });
      rows.push(row);
    }
    return rows;
  }

  // Fallback: parse toString output
  const raw = table.toString();
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return [];

  // First line has column headers
  const headerLine = lines.find((l: string) => l.includes("│") && !l.startsWith("─"));
  if (!headerLine) return [];
  const headers = headerLine.split("│").map((h: string) => h.trim()).filter((h: string) => h !== "");

  const dataLines = lines.filter((l: string, idx: number) => {
    if (idx === 0) return false; // skip first header
    return l.includes("│") && !l.startsWith("─") && !l.includes("───");
  });

  return dataLines.map((line: string) => {
    const cells = line.split("│").map((c: string) => c.trim()).filter((c: string) => c !== "");
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? null;
    });
    return row;
  });
}

const TYPE_COLORS: Record<string, string> = {
  file: "#6366f1",
  function: "#f59e0b",
  class: "#10b981",
};

/**
 * Derive visualization data from KuzuDB based on the active overlay mode.
 */
export async function deriveVizData(
  conn: KuzuConnection,
  overlay: OverlayMode,
  _personFilter?: string,
): Promise<GraphData> {
  const nodes: VizNode[] = [];
  const links: VizLink[] = [];

  switch (overlay) {
    case "structure": {
      type Row = Record<string, string>;

      // Query all File nodes
      const files = await queryGraph(conn, `MATCH (f:File) RETURN f.id, f.name, f.filePath`) as Row[];
      for (const row of files) {
        nodes.push({
          id: row["f.id"] ?? "",
          name: row["f.name"] ?? "",
          type: "file",
          filePath: row["f.filePath"] ?? "",
          val: 5,
          color: TYPE_COLORS.file,
        });
      }

      // Query all Function nodes
      const fns = await queryGraph(conn, `MATCH (f:Function) RETURN f.id, f.name, f.filePath, f.summary_l1`) as Row[];
      for (const row of fns) {
        nodes.push({
          id: row["f.id"] ?? "",
          name: row["f.name"] ?? "",
          type: "function",
          filePath: row["f.filePath"] ?? "",
          val: 5,
          color: TYPE_COLORS.function,
          summary: row["f.summary_l1"] || undefined,
        });
      }

      // Query all Class nodes
      const classes = await queryGraph(conn, `MATCH (c:Class) RETURN c.id, c.name, c.filePath`) as Row[];
      for (const row of classes) {
        nodes.push({
          id: row["c.id"] ?? "",
          name: row["c.name"] ?? "",
          type: "class",
          filePath: row["c.filePath"] ?? "",
          val: 7,
          color: TYPE_COLORS.class,
        });
      }

      // Query CONTAINS edges
      const contains = await queryGraph(conn, `MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`) as Row[];
      for (const row of contains) {
        links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "contains" });
      }

      // Query CALLS edges
      const calls = await queryGraph(conn, `MATCH (a:Function)-[:CALLS]->(b:Function) RETURN a.id, b.id`) as Row[];
      for (const row of calls) {
        links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "calls" });
      }

      // Query IMPORTS edges
      const imports = await queryGraph(conn, `MATCH (a:File)-[:IMPORTS]->(b:File) RETURN a.id, b.id`) as Row[];
      for (const row of imports) {
        links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "imports" });
      }

      break;
    }

    case "contributors":
    case "knowledge":
    case "people":
      // TODO: implement non-structure overlays
      break;
  }

  return { nodes, links };
}
