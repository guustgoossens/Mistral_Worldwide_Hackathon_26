import { useState, useEffect, useRef, useCallback } from "react";
import { initKuzu, queryGraph } from "@/lib/kuzu";
import { loadSampleIntoKuzu, seedKnowledgeData } from "@/data/sample-graph";
import { loadGraphFromJSON } from "@/lib/graph-builder";
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
 * Initializes KuzuDB on mount, tries loading parsed data (graph.json),
 * falls back to sample data if not available.
 */
export function useKuzu(): UseKuzuReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"parsed" | "sample" | null>(null);
  const connRef = useRef<KuzuConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { conn } = await initKuzu();
        if (cancelled) return;

        connRef.current = conn;

        // Try loading parsed graph data first
        let usedParsed = false;
        try {
          const graphResp = await fetch("/data/graph.json", { method: "HEAD" });
          if (graphResp.ok) {
            const result = await loadGraphFromJSON(conn, "/data/graph.json");
            usedParsed = true;
            console.log("[useKuzu] Loaded parsed graph data:", result);
          } else {
            console.log("[useKuzu] graph.json HEAD returned:", graphResp.status);
          }
        } catch (loadErr) {
          console.error("[useKuzu] Failed to load graph.json:", loadErr);
        }

        if (!usedParsed) {
          await loadSampleIntoKuzu(conn);
          console.log("[useKuzu] Loaded sample data (no graph.json found)");
        }

        if (cancelled) return;

        // Try loading git contributor data
        try {
          const gitResp = await fetch("/data/git-data.json", { method: "HEAD" });
          if (gitResp.ok) {
            await loadGitData(conn, "/data/git-data.json");
            console.log("[useKuzu] Loaded git contributor data");
          }
        } catch {
          // git-data.json not available — skip
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
  }, []);

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
