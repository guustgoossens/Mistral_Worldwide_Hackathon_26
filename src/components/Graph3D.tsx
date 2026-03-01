import { useRef, useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import ForceGraph3D from "react-force-graph-3d";
import {
  BoxGeometry,
  TetrahedronGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  MeshLambertMaterial,
  Mesh,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  Group,
  Color,
  AdditiveBlending,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
} from "three";
import type { GraphData, VizNode } from "@/types/graph";

// Shape per node type — distinct blocky shapes for Mistral feel
const NODE_SHAPES: Record<string, "box" | "tetrahedron" | "icosahedron" | "sphere"> = {
  file: "box",            // cube — classic blocky
  function: "tetrahedron", // sharp angular pyramid
  class: "icosahedron",    // faceted gem — distinct from cube
  person: "sphere",        // organic, human
  method: "tetrahedron",
};

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

  // Container dimensions for proper centering
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDims({ width, height });
    });
    ro.observe(el);
    setDims({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

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

  // Configure link distances by relationship type
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("link")?.distance((link: any) => {
      switch (link.type) {
        case "contains": return 20;
        case "inherits": return 30;
        case "calls": return 60;
        case "imports": return 80;
        case "contributed": return 100;
        case "understands": return 100;
        default: return 50;
      }
    });
  });

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({
        ...n,
        __glowColor: (highlightedIds?.size && !highlightedIds.has(n.id))
          ? "#2A2A2A"
          : (n.color ?? "#6C5CE7"),
      })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data, highlightedIds],
  );

  return (
    <div ref={containerRef} className="h-full w-full">
      {dims.width > 0 && (
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          width={dims.width}
          height={dims.height}
          nodeLabel="name"
          linkColor={(link: any) => link.color ?? "#2a2a3a"}
          linkOpacity={0.4}
          linkWidth={1}
          linkDirectionalParticles={(link: any) => link.type === "calls" ? 2 : 0}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleColor={() => "#00CFDD"}
          backgroundColor="#0D0D0D"
          onNodeClick={handleNodeClick}
          enableNodeDrag={true}
          nodeThreeObject={(node: any) => {
            const color = node.__glowColor ?? "#6C5CE7";
            const shape = NODE_SHAPES[node.type] ?? "sphere";
            const group = new Group();

            // Core geometry — distinct blocky shapes per type
            let geo;
            const s = 8;
            switch (shape) {
              case "box":
                geo = new BoxGeometry(s * 1.4, s * 1.4, s * 1.4);
                break;
              case "tetrahedron":
                geo = new TetrahedronGeometry(s * 1.3);
                break;
              case "icosahedron":
                geo = new IcosahedronGeometry(s * 1.1);
                break;
              default:
                geo = new SphereGeometry(s, 16, 16);
            }

            const mat = new MeshLambertMaterial({ color: new Color(color) });
            group.add(new Mesh(geo, mat));

            // Wireframe edges on all non-sphere shapes — blocky Mistral feel
            if (shape !== "sphere") {
              const edges = new EdgesGeometry(geo);
              const lineMat = new LineBasicMaterial({
                color: new Color(color),
                transparent: true,
                opacity: 0.4,
              });
              group.add(new LineSegments(edges, lineMat));
            }

            // Glow sprite
            const spriteMat = new SpriteMaterial({
              map: glowTexRef.current!,
              color: new Color(color),
              transparent: true,
              opacity: 0.2,
              blending: AdditiveBlending,
              depthWrite: false,
            });
            const sprite = new Sprite(spriteMat);
            sprite.scale.set(18, 18, 1);
            group.add(sprite);

            return group;
          }}
          nodeThreeObjectExtend={false}
        />
      )}
    </div>
  );
});
