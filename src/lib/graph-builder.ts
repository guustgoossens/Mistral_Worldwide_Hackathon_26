/**
 * Load parsed graph JSON into KuzuDB (runs in browser).
 * Fetches graph.json produced by scripts/parse-repo.ts and inserts
 * File, Function, Class nodes + CONTAINS, CALLS, IMPORTS edges.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuzuConnection = any;

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
}

interface GraphJSON {
  nodes: {
    files: Array<{ id: string; name: string; filePath: string }>;
    functions: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
    classes: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
    methods: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
  };
  edges: {
    contains: Array<{ source: string; target: string }>;
    calls: Array<{ source: string; target: string; confidence: number; reason: string }>;
    imports: Array<{ source: string; target: string }>;
  };
}

let _failCount = 0;
async function safeExec(conn: KuzuConnection, cypher: string): Promise<boolean> {
  try {
    await conn.execute(cypher);
    return true;
  } catch (err) {
    const msg = String(err);
    if (msg.includes("already exists") || msg.includes("duplicate")) return true;
    _failCount++;
    if (_failCount <= 5) {
      console.warn("[graph-builder] Failed:", cypher.slice(0, 200), msg);
    }
    return false;
  }
}

export async function loadGraphFromData(
  conn: KuzuConnection,
  data: GraphJSON,
): Promise<{ nodeCount: number; edgeCount: number }> {
  _failCount = 0;

  console.log("[graph-builder] Parsed JSON:", {
    files: data.nodes.files.length,
    functions: data.nodes.functions.length,
    classes: data.nodes.classes.length,
    methods: data.nodes.methods.length,
    contains: data.edges.contains.length,
    calls: data.edges.calls.length,
    imports: data.edges.imports.length,
  });

  let nodeCount = 0;
  let edgeCount = 0;

  // Insert File nodes
  for (const f of data.nodes.files) {
    await safeExec(conn,
      `CREATE (n:File {id: '${esc(f.id)}', name: '${esc(f.name)}', filePath: '${esc(f.filePath)}', summary: '', relevance: 0.5})`,
    );
    nodeCount++;
  }

  // Insert Function nodes
  for (const fn of data.nodes.functions) {
    await safeExec(conn,
      `CREATE (n:Function {id: '${esc(fn.id)}', name: '${esc(fn.name)}', filePath: '${esc(fn.filePath)}', startLine: ${fn.startLine}, endLine: ${fn.endLine}, summary: '', relevance: 0.5})`,
    );
    nodeCount++;
  }

  // Insert Class nodes
  for (const c of data.nodes.classes) {
    await safeExec(conn,
      `CREATE (n:Class {id: '${esc(c.id)}', name: '${esc(c.name)}', filePath: '${esc(c.filePath)}', summary: '', relevance: 0.5})`,
    );
    nodeCount++;
  }

  // Insert Method nodes into Function table (schema has no separate Method table)
  for (const m of data.nodes.methods) {
    await safeExec(conn,
      `CREATE (n:Function {id: '${esc(m.id)}', name: '${esc(m.name)}', filePath: '${esc(m.filePath)}', startLine: ${m.startLine}, endLine: ${m.endLine}, summary: '', relevance: 0.5})`,
    );
    nodeCount++;
  }

  // Insert CONTAINS edges (File → Function or File → Class)
  for (const edge of data.edges.contains) {
    const targetLabel = edge.target.startsWith("c:") ? "Class" : "Function";
    await safeExec(conn,
      `MATCH (a:File {id: '${esc(edge.source)}'}), (b:${targetLabel} {id: '${esc(edge.target)}'}) CREATE (a)-[:CONTAINS]->(b)`,
    );
    edgeCount++;
  }

  // Insert CALLS edges (Function → Function)
  for (const edge of data.edges.calls) {
    // Source could be a file (top-level call) or function
    const srcLabel = edge.source.startsWith("f:") ? "File" : "Function";
    // Only Function→Function CALLS are in schema, skip File→Function calls
    if (srcLabel === "File") continue;
    await safeExec(conn,
      `MATCH (a:Function {id: '${esc(edge.source)}'}), (b:Function {id: '${esc(edge.target)}'}) CREATE (a)-[:CALLS]->(b)`,
    );
    edgeCount++;
  }

  // Insert IMPORTS edges (File → File)
  for (const edge of data.edges.imports) {
    await safeExec(conn,
      `MATCH (a:File {id: '${esc(edge.source)}'}), (b:File {id: '${esc(edge.target)}'}) CREATE (a)-[:IMPORTS]->(b)`,
    );
    edgeCount++;
  }

  console.log(`[graph-builder] Loaded ${nodeCount} nodes, ${edgeCount} edges (${_failCount} failures)`);
  return { nodeCount, edgeCount };
}

/** Convenience wrapper: fetch URL then load. Prefer loadGraphFromData when you already have the response. */
export async function loadGraphFromJSON(
  conn: KuzuConnection,
  jsonUrl: string,
): Promise<{ nodeCount: number; edgeCount: number }> {
  const resp = await fetch(jsonUrl);
  if (!resp.ok) throw new Error(`Failed to fetch ${jsonUrl}: ${resp.status}`);
  const data: GraphJSON = await resp.json();
  return loadGraphFromData(conn, data);
}
