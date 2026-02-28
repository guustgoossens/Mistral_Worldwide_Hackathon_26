/**
 * Load git contributor data JSON into KuzuDB (runs in browser).
 * Creates Person nodes + CONTRIBUTED edges from git-data.json
 * produced by scripts/git-analyze.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuzuConnection = any;

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
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

async function safeExec(conn: KuzuConnection, cypher: string): Promise<void> {
  try {
    await conn.execute(cypher);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("already exists") || msg.includes("duplicate")) return;
    // Silently skip "no node found" errors (file not in graph)
    if (msg.includes("does not exist") || msg.includes("no node")) return;
    console.warn("[git-data] Failed:", cypher.slice(0, 120), err);
  }
}

export async function loadGitData(
  conn: KuzuConnection,
  jsonUrl: string,
): Promise<{ persons: number; edges: number }> {
  const resp = await fetch(jsonUrl);
  if (!resp.ok) throw new Error(`Failed to fetch ${jsonUrl}: ${resp.status}`);
  const data: GitDataJSON = await resp.json();

  let persons = 0;
  let edges = 0;

  for (const contributor of data.contributors) {
    // Create Person node
    await safeExec(conn,
      `CREATE (p:Person {id: '${esc(contributor.id)}', name: '${esc(contributor.name)}', email: '${esc(contributor.email)}'})`,
    );
    persons++;

    // Create CONTRIBUTED edges to files that exist in the graph
    for (const file of contributor.files) {
      const fileId = `f:${file.filePath}`;
      await safeExec(conn,
        `MATCH (p:Person {id: '${esc(contributor.id)}'}), (f:File {id: '${esc(fileId)}'}) CREATE (p)-[:CONTRIBUTED {commits: ${file.commits}, lastTouch: '${esc(file.lastTouch)}', linesChanged: ${file.linesChanged}, blameLines: 0, ownershipPct: 0.0, summary_l1: '', commits_json: '[]'}]->(f)`,
      );
      edges++;
    }
  }

  console.log(`[git-data] Loaded ${persons} persons, ${edges} contributed edges from ${jsonUrl}`);
  return { persons, edges };
}
