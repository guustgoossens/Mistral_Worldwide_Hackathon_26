import { useState, useEffect, useRef, useCallback } from "react";
import { initKuzu, queryGraph } from "@/lib/kuzu";
import { loadSampleIntoKuzu, seedKnowledgeData } from "@/data/sample-graph";
import { loadGraphFromData } from "@/lib/graph-builder";
import { loadGitData } from "@/lib/git-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuzuConnection = any;

export interface UseKuzuReturn {
  isReady: boolean;
  conn: KuzuConnection | null;
  error: string | null;
  dataSource: "parsed" | "sample" | null;
  executeQuery: (cypher: string) => Promise<unknown[]>;
}

/**
 * React hook managing KuzuDB WASM lifecycle.
 * Accepts an optional repoId to load per-repo data from /data/{repoId}/.
 * Reinitializes when repoId changes.
 */
export function useKuzu(repoId?: string): UseKuzuReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"parsed" | "sample" | null>(null);
  const connRef = useRef<KuzuConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Reset state on repoId change
    setIsReady(false);
    setError(null);
    setDataSource(null);
    connRef.current = null;

    async function init() {
      try {
        const { conn } = await initKuzu();
        if (cancelled) return;

        connRef.current = conn;

        const dataPrefix = repoId ? `/data/${repoId}` : "/data";
        const graphUrl = `${dataPrefix}/graph.json`;
        const gitUrl = `${dataPrefix}/git-data.json`;
        console.log(`[useKuzu] Loading data for repo="${repoId ?? "default"}" from ${dataPrefix}/`);

        // Try loading parsed graph data — single fetch, parse JSON ourselves.
        // Avoids double-fetch races; SyntaxError (HTML fallback) is caught gracefully.
        let usedParsed = false;
        try {
          const graphResp = await fetch(graphUrl);
          if (!graphResp.ok) throw new Error(`HTTP ${graphResp.status}`);
          const graphData = await graphResp.json(); // throws SyntaxError if Vite served HTML
          if (cancelled) return;
          const result = await loadGraphFromData(conn, graphData);
          usedParsed = true;
          console.log(`[useKuzu] Loaded real graph data (${result.nodeCount} nodes, ${result.edgeCount} edges)`);
        } catch (loadErr) {
          console.log(`[useKuzu] No parsed data at ${graphUrl} — using sample:`, String(loadErr));
        }

        if (!usedParsed) {
          await loadSampleIntoKuzu(conn);
          console.log("[useKuzu] Loaded sample data (no graph.json found)");
        }

        if (cancelled) return;

        // Try loading git contributor data (non-critical)
        try {
          await loadGitData(conn, gitUrl);
          console.log("[useKuzu] Loaded git contributor data");
        } catch {
          // git-data.json not available or not JSON — skip
        }

        // Seed knowledge (UNDERSTANDS edges) based on file path classification
        try {
          await seedKnowledgeData(conn);
          console.log("[useKuzu] Seeded knowledge data");
        } catch (seedErr) {
          console.warn("[useKuzu] Knowledge seeding failed:", seedErr);
        }

        if (cancelled) return;

        setDataSource(usedParsed ? "parsed" : "sample");
        setIsReady(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[useKuzu] Initialization failed:", msg);
        setError(msg);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const executeQuery = useCallback(async (cypher: string): Promise<unknown[]> => {
    if (!connRef.current) {
      console.warn("[useKuzu] executeQuery called before KuzuDB is ready");
      return [];
    }
    return queryGraph(connRef.current, cypher);
  }, []);

  return {
    isReady,
    conn: connRef.current,
    error,
    dataSource,
    executeQuery,
  };
}
