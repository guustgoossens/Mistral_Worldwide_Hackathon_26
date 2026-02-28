import { useState, useCallback, useEffect } from "react";
import type { GraphData, OverlayMode, VizNode } from "@/types/graph";
import { sampleGraph } from "@/data/sample-graph";
import { deriveVizData } from "@/lib/kuzu";
import type { UseKuzuReturn } from "@/hooks/useKuzu";

/**
 * Graph state hook: manages nodes/links, overlay mode, and selection.
 * Derives data from KuzuDB when ready; falls back to sample data otherwise.
 */
export function useGraph(kuzu?: UseKuzuReturn) {
  const [graphData, setGraphData] = useState<GraphData>(sampleGraph);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("structure");
  const [selectedNode, setSelectedNode] = useState<VizNode | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  // Derive graph data from KuzuDB when ready or when overlay mode changes
  useEffect(() => {
    if (!kuzu?.isReady || !kuzu.conn) return;

    let cancelled = false;

    async function derive() {
      try {
        const data = await deriveVizData(kuzu!.conn, overlayMode);
        if (cancelled) return;

        // Fallback to sample data if KuzuDB returned empty results
        if (data.nodes.length === 0) {
          setGraphData(sampleGraph);
        } else {
          setGraphData(data);
        }
      } catch (err) {
        console.error("[useGraph] Failed to derive from KuzuDB:", err);
        setGraphData(sampleGraph);
      }
    }

    derive();

    return () => {
      cancelled = true;
    };
  }, [kuzu?.isReady, kuzu?.conn, overlayMode]);

  const selectNode = useCallback((node: VizNode | null) => {
    setSelectedNode(node);
  }, []);

  const highlightNodes = useCallback((ids: string[]) => {
    setHighlightedIds(new Set(ids));
  }, []);

  return {
    graphData,
    overlayMode,
    setOverlayMode,
    selectedNode,
    selectNode,
    highlightedIds,
    highlightNodes,
  };
}
