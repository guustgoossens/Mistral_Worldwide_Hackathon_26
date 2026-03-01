import { useState, useCallback, useEffect, useMemo } from "react";
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
  const [overlayModes, setOverlayModes] = useState<Set<OverlayMode>>(new Set(["structure"]));
  const [selectedNode, setSelectedNode] = useState<VizNode | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [personFilter, setPersonFilter] = useState<Set<string>>(new Set());

  const togglePerson = useCallback((name: string) => {
    setPersonFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const clearPersonFilter = useCallback(() => {
    setPersonFilter(new Set());
  }, []);

  // Backward-compatible single mode (for interview agent, tips, etc.)
  const overlayMode: OverlayMode = useMemo(() => {
    if (overlayModes.has("people")) return "people";
    if (overlayModes.has("contributors") && overlayModes.has("knowledge")) return "contributors";
    if (overlayModes.has("knowledge")) return "knowledge";
    if (overlayModes.has("contributors")) return "contributors";
    return "structure";
  }, [overlayModes]);

  // Set a single mode (backward compat wrapper for interview agent etc.)
  const setOverlayMode = useCallback((mode: OverlayMode) => {
    setOverlayModes(new Set([mode]));
  }, []);

  // Toggle a mode on/off with constraints
  const toggleOverlayMode = useCallback((mode: OverlayMode) => {
    setOverlayModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) {
        next.delete(mode);
        if (next.size === 0) next.add("structure");
      } else {
        // People mode is exclusive
        if (mode === "people") return new Set<OverlayMode>(["people"]);
        // Adding a non-people mode clears "people" if present
        next.delete("people");
        next.add(mode);
      }
      return next;
    });
  }, []);

  // Stable serialization for useEffect dependencies
  const modesKey = useMemo(() => [...overlayModes].sort().join(","), [overlayModes]);
  const filterKey = useMemo(() => [...personFilter].sort().join(","), [personFilter]);

  // Derive graph data from KuzuDB when ready or when overlay mode changes
  useEffect(() => {
    if (!kuzu?.isReady || !kuzu.conn) return;

    let cancelled = false;

    async function derive() {
      try {
        const data = await deriveVizData(kuzu!.conn, overlayModes, personFilter);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuzu?.isReady, kuzu?.conn, modesKey, filterKey]);

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
    overlayModes,
    toggleOverlayMode,
    selectedNode,
    selectNode,
    highlightedIds,
    highlightNodes,
    personFilter,
    togglePerson,
    clearPersonFilter,
  };
}
