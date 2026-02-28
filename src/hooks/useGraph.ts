import { useState, useCallback } from "react";
import type { GraphData, OverlayMode, VizNode } from "@/types/graph";
import { sampleGraph } from "@/data/sample-graph";

/**
 * Graph state hook: manages nodes/links, overlay mode, and selection.
 * Currently returns sample data; will derive from KuzuDB when ready.
 */
export function useGraph() {
  const [graphData] = useState<GraphData>(sampleGraph);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("structure");
  const [selectedNode, setSelectedNode] = useState<VizNode | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

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
