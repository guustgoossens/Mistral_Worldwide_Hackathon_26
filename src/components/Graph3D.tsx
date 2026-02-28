import { useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { GraphData, VizNode } from "@/types/graph";

interface Graph3DProps {
  data: GraphData;
  onNodeClick?: (node: VizNode) => void;
  highlightedIds?: Set<string>;
}

export interface Graph3DHandle {
  flyToNode: (nodeId: string) => void;
}

export const Graph3D = forwardRef<Graph3DHandle, Graph3DProps>(function Graph3D(
  { data, onNodeClick, highlightedIds },
  ref,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    flyToNode: (nodeId: string) => {
      const node = data.nodes.find((n) => n.id === nodeId);
      if (!node || !fgRef.current) return;
      // Use internal force-graph coordinates
      const gNode = fgRef.current.graphData().nodes.find((n: any) => n.id === nodeId);
      if (!gNode) return;
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(gNode.x, gNode.y, gNode.z);
      fgRef.current.cameraPosition(
        { x: gNode.x * distRatio, y: gNode.y * distRatio, z: gNode.z * distRatio },
        gNode,
        1000,
      );
    },
  }));

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
});
