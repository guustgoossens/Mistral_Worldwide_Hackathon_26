import { useState } from "react";
import type { VizNode } from "@/types/graph";
import { X, FileCode, Box, Braces, ChevronDown, FolderOpen, Brain, Quote, User } from "lucide-react";

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

function DetailSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-xs font-medium text-text-muted hover:text-text"
      >
        {title}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

function extractFilename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function KnowledgeBadge({ score }: { score: number }) {
  if (score >= 0.7) {
    return <span className="rounded bg-amber/20 px-1.5 py-0.5 text-xs font-medium text-amber">Deep</span>;
  }
  if (score >= 0.3) {
    return <span className="rounded bg-accent-muted/20 px-1.5 py-0.5 text-xs font-medium text-accent-muted">Surface</span>;
  }
  return <span className="rounded bg-warm-red/20 px-1.5 py-0.5 text-xs font-medium text-warm-red">None</span>;
}

export function NodeDetail({ node, onClose }: NodeDetailProps) {
  if (!node) return null;

  const Icon = typeIcons[node.type] ?? Box;
  const maxCommits =
    node.contributors && node.contributors.length > 0
      ? Math.max(...node.contributors.map((c) => c.commits))
      : 0;

  return (
    <div className="absolute inset-x-0 top-0 z-10 border-b border-border bg-surface md:inset-x-auto md:right-4 md:top-4 md:w-80 md:rounded-[12px] md:border overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-[2px] w-full gradient-sidebar-bar" />

      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-accent" />
            <h3 className="font-medium text-text">{node.name}</h3>
            <span className="rounded bg-border px-1.5 py-0.5 text-xs text-text-muted">{node.type}</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          {/* Location (always visible) */}
          {node.filePath && (
            <div className="flex items-center gap-1.5" title={node.filePath}>
              <FolderOpen className="h-3 w-3 text-text-muted shrink-0" />
              <span className="text-text-muted">Location:</span>{" "}
              <span className="text-text">{extractFilename(node.filePath)}</span>
            </div>
          )}

          {/* Summary */}
          {node.summary && (
            <div className="flex gap-2">
              <Quote className="h-3 w-3 text-accent shrink-0 mt-1" />
              <blockquote className="border-l-2 border-accent pl-3 text-sm text-text-muted italic">
                {node.summary}
              </blockquote>
            </div>
          )}

          {/* Knowledge badge */}
          {node.knowledgeScore != null && (
            <div className="flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-text-muted shrink-0" />
              <span className="text-text-muted">Knowledge:</span>
              <KnowledgeBadge score={node.knowledgeScore} />
            </div>
          )}

          {/* Contributors (collapsible, default closed) */}
          {node.contributors && node.contributors.length > 0 && (
            <DetailSection title={`Contributors (${node.contributors.length})`} defaultOpen={false}>
              <div className="space-y-1">
                {node.contributors.map((c) => (
                  <div key={c.person} className="flex items-center gap-1.5">
                    <User className="h-2.5 w-2.5 text-text-muted shrink-0" />
                    <span className="w-16 truncate text-[11px] text-text" title={c.person}>
                      {c.person}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${maxCommits > 0 ? (c.commits / maxCommits) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] text-text-muted">{c.commits}</span>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}
