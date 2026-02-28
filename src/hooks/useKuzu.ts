import { useState, useEffect } from "react";

/**
 * React hook managing KuzuDB WASM lifecycle.
 * Initializes KuzuDB on mount, runs schema setup, exposes connection.
 */
export function useKuzu() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Initialize KuzuDB WASM
    // initKuzu().then(({ conn }) => { ... }).catch(setError)
    console.log("[useKuzu] KuzuDB WASM initialization not yet implemented");
    void setIsReady;
    void setError;
  }, []);

  const executeQuery = async (_cypher: string): Promise<unknown[]> => {
    // TODO: Execute against real KuzuDB connection
    console.warn("[useKuzu] executeQuery stub called");
    return [];
  };

  return {
    isReady,
    conn: null,
    error,
    executeQuery,
  };
}
