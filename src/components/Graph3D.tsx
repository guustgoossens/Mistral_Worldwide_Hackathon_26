import { useRef, useCallback, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { GraphData, VizNode } from "@/types/graph";

interface Graph3DProps {
  data: GraphData;
  onNodeClick?: (node: VizNode) => void;
  highlightedIds?: Set<string>;
}

export function Graph3D({ data, onNodeClick, highlightedIds }: Graph3DProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      onNodeClick?.(node as VizNode);

      // Zoom to node
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      fgRef.current?.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        2000,
      );
    },
    [onNodeClick],
  );

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data],
  );

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      nodeLabel="name"
      nodeVal="val"
      nodeColor={(node) => {
        const n = node as VizNode;
        if (highlightedIds?.size && !highlightedIds.has(n.id)) return "#333";
        return n.color ?? "#6366f1";
      }}
      linkColor={() => "#2a2a3a"}
      linkOpacity={0.4}
      linkWidth={1}
      backgroundColor="#0a0a0f"
      onNodeClick={handleNodeClick}
      nodeOpacity={0.9}
      enableNodeDrag={true}
    />
  );
}
