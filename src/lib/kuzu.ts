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
    `CREATE NODE TABLE IF NOT EXISTS File (id STRING, name STRING, filePath STRING, summary STRING, relevance DOUBLE, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Function (id STRING, name STRING, filePath STRING, startLine INT64, endLine INT64, summary STRING, relevance DOUBLE, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Class (id STRING, name STRING, filePath STRING, summary STRING, relevance DOUBLE, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Person (id STRING, name STRING, email STRING, PRIMARY KEY (id))`,
    `CREATE NODE TABLE IF NOT EXISTS Discussion (id STRING, timestamp STRING, transcript STRING, summary_l1 STRING, quizResult STRING, confidenceBefore STRING, confidenceAfter STRING, PRIMARY KEY (id))`,
  ];

  const relTables = [
    `CREATE REL TABLE IF NOT EXISTS CONTAINS (FROM File TO Function, FROM File TO Class)`,
    `CREATE REL TABLE IF NOT EXISTS CALLS (FROM Function TO Function)`,
    `CREATE REL TABLE IF NOT EXISTS IMPORTS (FROM File TO File)`,
    `CREATE REL TABLE IF NOT EXISTS INHERITS (FROM Class TO Class)`,
    `CREATE REL TABLE IF NOT EXISTS CONTRIBUTED (FROM Person TO File, commits INT64, lastTouch STRING, linesChanged INT64, blameLines INT64, ownershipPct DOUBLE, summary_l1 STRING, commits_json STRING)`,
    `CREATE REL TABLE IF NOT EXISTS UNDERSTANDS (FROM Person TO Function, confidence STRING, source STRING, topics STRING[], lastAssessed STRING, needsRetest BOOLEAN, summary_l1 STRING, sessions_json STRING)`,
    `CREATE REL TABLE IF NOT EXISTS HAS_PARTICIPANT (FROM Discussion TO Person, role STRING)`,
    `CREATE REL TABLE IF NOT EXISTS ABOUT (FROM Discussion TO Function, FROM Discussion TO File, FROM Discussion TO Class, focus STRING)`,
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
    // KuzuDB WASM v0.7: result.table.toString() returns JSON
    if (result.table) {
      const raw = result.table.toString();
      // Try JSON parse first (KuzuDB WASM returns JSON from table.toString())
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0) {
            console.log("[KuzuDB] Query result keys:", Object.keys(parsed[0]), "for:", cypher.slice(0, 80));
          }
          return parsed;
        }
        return [];
      } catch {
        // Not JSON — try pipe-delimited table format
        console.log("[KuzuDB] table.toString() is not JSON, trying pipe format. First 200 chars:", raw.slice(0, 200));
        return parseTable(result.table);
      }
    }
    // Fallback: getAll() (newer WASM versions)
    if (typeof result.getAll === "function") {
      return result.getAll();
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
  person: "#8b5cf6",
};

const KNOWLEDGE_COLORS = {
  deep: "#10b981",    // green
  surface: "#f59e0b", // yellow
  none: "#ef4444",    // red
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
      console.log("[deriveVizData] Files query returned:", files.length, "rows", files.length > 0 ? "first:" : "", files[0]);
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
      const fns = await queryGraph(conn, `MATCH (f:Function) RETURN f.id, f.name, f.filePath, f.summary`) as Row[];
      for (const row of fns) {
        nodes.push({
          id: row["f.id"] ?? "",
          name: row["f.name"] ?? "",
          type: "function",
          filePath: row["f.filePath"] ?? "",
          val: 5,
          color: TYPE_COLORS.function,
          summary: row["f.summary"] || undefined,
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

    case "contributors": {
      type CRow = Record<string, string>;

      // Same code nodes as structure
      const cFiles = await queryGraph(conn, `MATCH (f:File) RETURN f.id, f.name, f.filePath`) as CRow[];
      const cFns = await queryGraph(conn, `MATCH (f:Function) RETURN f.id, f.name, f.filePath`) as CRow[];
      const cClasses = await queryGraph(conn, `MATCH (c:Class) RETURN c.id, c.name, c.filePath`) as CRow[];

      // Build contributor data per file
      let contribRows: CRow[] = [];
      try {
        contribRows = await queryGraph(conn,
          `MATCH (p:Person)-[r:CONTRIBUTED]->(f:File) RETURN f.id AS fileId, p.name AS contributor, r.commits AS commits, r.linesChanged AS linesChanged`,
        ) as CRow[];
      } catch { /* no contributor data yet */ }

      // Aggregate contributors per file
      const fileContribs = new Map<string, { person: string; commits: number }[]>();
      const fileTotalCommits = new Map<string, number>();
      for (const row of contribRows) {
        const fid = row["fileId"] ?? "";
        const c = parseInt(row["commits"] ?? "0", 10) || 0;
        if (!fileContribs.has(fid)) fileContribs.set(fid, []);
        fileContribs.get(fid)!.push({ person: row["contributor"] ?? "", commits: c });
        fileTotalCommits.set(fid, (fileTotalCommits.get(fid) ?? 0) + c);
      }

      // Max commits for color scaling
      const maxCommits = Math.max(1, ...fileTotalCommits.values());

      // Apply person filter if set
      const filterPerson = _personFilter;
      const highlightFiles = new Set<string>();
      if (filterPerson) {
        for (const [fid, contribs] of fileContribs) {
          if (contribs.some(c => c.person === filterPerson)) {
            highlightFiles.add(fid);
          }
        }
      }

      for (const row of cFiles) {
        const id = row["f.id"] ?? "";
        const totalC = fileTotalCommits.get(id) ?? 0;
        const heat = totalC / maxCommits;
        // Interpolate from cool blue to warm orange/red
        const isFiltered = filterPerson && !highlightFiles.has(id);
        const color = isFiltered ? "#374151" : `hsl(${Math.round(30 - heat * 30)}, ${Math.round(60 + heat * 40)}%, ${Math.round(50 - heat * 10)}%)`;
        nodes.push({
          id, name: row["f.name"] ?? "", type: "file", filePath: row["f.filePath"] ?? "",
          val: 5 + Math.round(heat * 8), color,
          contributors: fileContribs.get(id),
        });
      }
      for (const row of cFns) {
        const id = row["f.id"] ?? "";
        nodes.push({
          id, name: row["f.name"] ?? "", type: "function", filePath: row["f.filePath"] ?? "",
          val: 4, color: filterPerson ? "#374151" : TYPE_COLORS.function,
        });
      }
      for (const row of cClasses) {
        const id = row["c.id"] ?? "";
        nodes.push({
          id, name: row["c.name"] ?? "", type: "class", filePath: row["c.filePath"] ?? "",
          val: 5, color: filterPerson ? "#374151" : TYPE_COLORS.class,
        });
      }

      // Same structural edges
      const cContains = await queryGraph(conn, `MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`) as CRow[];
      for (const row of cContains) links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "contains" });
      const cCalls = await queryGraph(conn, `MATCH (a:Function)-[:CALLS]->(b:Function) RETURN a.id, b.id`) as CRow[];
      for (const row of cCalls) links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "calls" });
      const cImports = await queryGraph(conn, `MATCH (a:File)-[:IMPORTS]->(b:File) RETURN a.id, b.id`) as CRow[];
      for (const row of cImports) links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "imports" });

      break;
    }

    case "knowledge": {
      type KRow = Record<string, string>;

      // All functions with optional understanding data
      const kFns = await queryGraph(conn, `MATCH (f:Function) RETURN f.id, f.name, f.filePath`) as KRow[];

      // Try to get understanding data
      let understandRows: KRow[] = [];
      try {
        understandRows = await queryGraph(conn,
          `MATCH (p:Person)-[u:UNDERSTANDS]->(f:Function) RETURN f.id AS funcId, u.confidence AS confidence`,
        ) as KRow[];
      } catch { /* no understanding data yet */ }

      const funcConfidence = new Map<string, string>();
      for (const row of understandRows) {
        const fid = row["funcId"] ?? "";
        const conf = row["confidence"] ?? "none";
        // Keep the highest confidence level
        const existing = funcConfidence.get(fid);
        if (!existing || (conf === "deep") || (conf === "surface" && existing === "none")) {
          funcConfidence.set(fid, conf);
        }
      }

      for (const row of kFns) {
        const id = row["f.id"] ?? "";
        const conf = funcConfidence.get(id) ?? "none";
        const color = KNOWLEDGE_COLORS[conf as keyof typeof KNOWLEDGE_COLORS] ?? KNOWLEDGE_COLORS.none;
        nodes.push({
          id, name: row["f.name"] ?? "", type: "function", filePath: row["f.filePath"] ?? "",
          val: 5, color, knowledgeScore: conf === "deep" ? 1.0 : conf === "surface" ? 0.5 : 0.0,
        });
      }

      // Files and classes (neutral color)
      const kFiles = await queryGraph(conn, `MATCH (f:File) RETURN f.id, f.name, f.filePath`) as KRow[];
      for (const row of kFiles) {
        nodes.push({
          id: row["f.id"] ?? "", name: row["f.name"] ?? "", type: "file", filePath: row["f.filePath"] ?? "",
          val: 4, color: "#4b5563",
        });
      }
      const kClasses = await queryGraph(conn, `MATCH (c:Class) RETURN c.id, c.name, c.filePath`) as KRow[];
      for (const row of kClasses) {
        nodes.push({
          id: row["c.id"] ?? "", name: row["c.name"] ?? "", type: "class", filePath: row["c.filePath"] ?? "",
          val: 5, color: "#4b5563",
        });
      }

      // Edges
      const kContains = await queryGraph(conn, `MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`) as KRow[];
      for (const row of kContains) links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "contains" });
      const kCalls = await queryGraph(conn, `MATCH (a:Function)-[:CALLS]->(b:Function) RETURN a.id, b.id`) as KRow[];
      for (const row of kCalls) links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "calls" });

      break;
    }

    case "people": {
      type PRow = Record<string, string>;

      // Person nodes (visible in this mode)
      let personRows: PRow[] = [];
      try {
        personRows = await queryGraph(conn, `MATCH (p:Person) RETURN p.id, p.name, p.email`) as PRow[];
      } catch { /* no person data */ }

      for (const row of personRows) {
        nodes.push({
          id: row["p.id"] ?? "", name: row["p.name"] ?? "", type: "person",
          val: 8, color: TYPE_COLORS.person,
        });
      }

      // Code nodes (smaller, as context)
      const pFiles = await queryGraph(conn, `MATCH (f:File) RETURN f.id, f.name, f.filePath`) as PRow[];
      for (const row of pFiles) {
        nodes.push({
          id: row["f.id"] ?? "", name: row["f.name"] ?? "", type: "file", filePath: row["f.filePath"] ?? "",
          val: 3, color: TYPE_COLORS.file,
        });
      }
      const pFns = await queryGraph(conn, `MATCH (f:Function) RETURN f.id, f.name, f.filePath`) as PRow[];
      for (const row of pFns) {
        nodes.push({
          id: row["f.id"] ?? "", name: row["f.name"] ?? "", type: "function", filePath: row["f.filePath"] ?? "",
          val: 3, color: TYPE_COLORS.function,
        });
      }
      const pClasses = await queryGraph(conn, `MATCH (c:Class) RETURN c.id, c.name, c.filePath`) as PRow[];
      for (const row of pClasses) {
        nodes.push({
          id: row["c.id"] ?? "", name: row["c.name"] ?? "", type: "class", filePath: row["c.filePath"] ?? "",
          val: 3, color: TYPE_COLORS.class,
        });
      }

      // CONTRIBUTED edges (Person → File)
      try {
        const contribEdges = await queryGraph(conn, `MATCH (p:Person)-[:CONTRIBUTED]->(f:File) RETURN p.id, f.id`) as PRow[];
        for (const row of contribEdges) {
          links.push({ source: row["p.id"] ?? "", target: row["f.id"] ?? "", type: "contributed" });
        }
      } catch { /* no contributor edges */ }

      // UNDERSTANDS edges (Person → Function)
      try {
        const understandEdges = await queryGraph(conn, `MATCH (p:Person)-[:UNDERSTANDS]->(f:Function) RETURN p.id, f.id`) as PRow[];
        for (const row of understandEdges) {
          links.push({ source: row["p.id"] ?? "", target: row["f.id"] ?? "", type: "understands" });
        }
      } catch { /* no understand edges */ }

      // Structural edges (lighter, as context)
      const pContains = await queryGraph(conn, `MATCH (a:File)-[:CONTAINS]->(b) RETURN a.id, b.id`) as PRow[];
      for (const row of pContains) links.push({ source: row["a.id"] ?? "", target: row["b.id"] ?? "", type: "contains" });

      break;
    }
  }

  return { nodes, links };
}
