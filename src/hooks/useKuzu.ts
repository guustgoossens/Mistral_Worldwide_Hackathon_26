import { useState, useEffect, useRef, useCallback } from "react";
import { initKuzu, queryGraph } from "@/lib/kuzu";
import { loadSampleIntoKuzu } from "@/data/sample-graph";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuzuConnection = any;

export interface UseKuzuReturn {
  isReady: boolean;
  conn: KuzuConnection | null;
  error: string | null;
  executeQuery: (cypher: string) => Promise<unknown[]>;
}

/**
 * React hook managing KuzuDB WASM lifecycle.
 * Initializes KuzuDB on mount, runs schema setup, seeds sample data, exposes connection.
 */
export function useKuzu(): UseKuzuReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connRef = useRef<KuzuConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { conn } = await initKuzu();
        if (cancelled) return;

        connRef.current = conn;

        await loadSampleIntoKuzu(conn);
        if (cancelled) return;

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
    executeQuery,
  };
}
