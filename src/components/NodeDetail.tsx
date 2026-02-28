import type { VizNode } from "@/types/graph";
import { X, FileCode, Box, Braces } from "lucide-react";

interface NodeDetailProps {
  node: VizNode | null;
  onClose: () => void;
}

const typeIcons = {
  file: FileCode,
  function: Braces,
  class: Box,
  method: Braces,
  person: Box,
};

export function NodeDetail({ node, onClose }: NodeDetailProps) {
  if (!node) return null;

  const Icon = typeIcons[node.type] ?? Box;

  return (
    <div className="absolute right-4 top-4 z-10 w-80 rounded-lg border border-border bg-surface/95 p-4 backdrop-blur">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent" />
          <h3 className="font-medium text-text">{node.name}</h3>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="text-text-muted">Type:</span>{" "}
          <span className="rounded bg-border px-1.5 py-0.5 text-text">{node.type}</span>
        </div>

        {node.filePath && (
          <div>
            <span className="text-text-muted">Path:</span> <span className="text-text">{node.filePath}</span>
          </div>
        )}

        {node.summary && (
          <div>
            <span className="text-text-muted">Summary:</span> <span className="text-text">{node.summary}</span>
          </div>
        )}

        {node.contributors && node.contributors.length > 0 && (
          <div>
            <p className="mb-1 text-text-muted">Contributors:</p>
            {node.contributors.map((c) => (
              <p key={c.person} className="ml-2 text-text">
                {c.person} — {c.commits} commits
              </p>
            ))}
          </div>
        )}

        {node.knowledgeScore != null && (
          <div>
            <span className="text-text-muted">Knowledge:</span>{" "}
            <span className="text-text">{Math.round(node.knowledgeScore * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
