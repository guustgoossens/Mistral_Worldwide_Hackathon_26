import { useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import ForceGraph3D from "react-force-graph-3d";
import {
  SphereGeometry,
  MeshLambertMaterial,
  Mesh,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  Group,
  Color,
  AdditiveBlending,
} from "three";
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

  // Glow texture (created once, reused across renders)
  const glowTexRef = useRef<CanvasTexture | null>(null);
  if (!glowTexRef.current) {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,0.7)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    glowTexRef.current = new CanvasTexture(canvas);
  }

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({
        ...n,
        __glowColor: (highlightedIds?.size && !highlightedIds.has(n.id))
          ? "#333"
          : (n.color ?? "#6366f1"),
      })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data, highlightedIds],
  );

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      nodeLabel="name"
      linkColor={(link: any) => link.color ?? "#2a2a3a"}
      linkOpacity={0.4}
      linkWidth={1}
      linkDirectionalParticles={(link: any) => link.type === "calls" ? 2 : 0}
      linkDirectionalParticleSpeed={0.006}
      linkDirectionalParticleWidth={1.5}
      linkDirectionalParticleColor={() => "#f59e0b"}
      backgroundColor="#0a0a0f"
      onNodeClick={handleNodeClick}
      enableNodeDrag={true}
      nodeThreeObject={(node: any) => {
        const color = node.__glowColor ?? "#6366f1";
        const group = new Group();

        // Core sphere
        const geo = new SphereGeometry(4, 16, 16);
        const mat = new MeshLambertMaterial({ color: new Color(color) });
        group.add(new Mesh(geo, mat));

        // Glow sprite
        const spriteMat = new SpriteMaterial({
          map: glowTexRef.current!,
          color: new Color(color),
          transparent: true,
          opacity: 0.25,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new Sprite(spriteMat);
        sprite.scale.set(20, 20, 1);
        group.add(sprite);

        return group;
      }}
      nodeThreeObjectExtend={false}
    />
  );
});
