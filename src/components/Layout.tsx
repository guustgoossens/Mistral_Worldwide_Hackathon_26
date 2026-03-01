import { useState, type ReactNode } from "react";
import type { OverlayMode } from "@/types/graph";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const overlayModes: { key: OverlayMode; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "contributors", label: "Contributors" },
  { key: "knowledge", label: "Knowledge" },
  { key: "people", label: "People" },
];

const contextTips: Record<OverlayMode, string> = {
  structure: "Click nodes to explore code. Amber particles show call flow.",
  contributors: "Filter by contributor. Warmer colors = more activity.",
  knowledge: "Green = deep understanding, red = gap. Quiz to fill gaps.",
  people: "Human topology. Contributors and understanding visible.",
};

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

interface LayoutProps {
  children: ReactNode;
  overlayMode: OverlayMode;
  onOverlayChange: (mode: OverlayMode) => void;
  /** @deprecated Replaced by built-in sidebar sections */
  sidebar?: ReactNode;
  persons?: string[];
  personFilter?: string;
  onPersonFilterChange?: (person: string | undefined) => void;
  dataSource?: "parsed" | "sample" | null;
  nodeCount?: number;
}

export function Layout({
  children,
  overlayMode,
  onOverlayChange,
  persons,
  personFilter,
  onPersonFilterChange,
  dataSource,
  nodeCount,
}: LayoutProps) {
  return (
    <div className="flex h-full w-full bg-bg">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[28rem] shrink-0 flex-col border-r border-border bg-surface">
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-bold text-text">HackStral</h1>
          <p className="text-xs text-text-muted">Voice-driven codebase intelligence</p>
        </div>

        {/* Overlay mode toggle */}
        <div className="border-b border-border p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Overlay</p>
          <div className="flex flex-wrap gap-1.5">
            {overlayModes.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onOverlayChange(key)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  overlayMode === key ? "bg-accent text-white" : "bg-border text-text-muted hover:text-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar sections */}
        <div className="flex-1 overflow-y-auto">
          {/* Repo Stats */}
          <CollapsibleSection title="Repo Stats">
            <div className="space-y-1.5 text-xs">
              {dataSource && (
                <div className="flex items-center gap-2 text-text-muted">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      dataSource === "parsed" ? "bg-green-500" : "bg-amber-500",
                    )}
                  />
                  {dataSource === "parsed" ? "Parsed repo" : "Sample data"}
                </div>
              )}
              {nodeCount != null && <p className="text-text-muted">{nodeCount} nodes in graph</p>}
            </div>
          </CollapsibleSection>

          {/* Contributor Filter */}
          {persons && persons.length > 0 && overlayMode === "contributors" && (
            <CollapsibleSection title="Contributor Filter">
              <select
                className="w-full rounded bg-bg border border-border px-2 py-1 text-sm text-text"
                value={personFilter ?? ""}
                onChange={(e) => onPersonFilterChange?.(e.target.value || undefined)}
              >
                <option value="">All contributors</option>
                {persons.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </CollapsibleSection>
          )}

          {/* Context Tips */}
          <CollapsibleSection title="Context Tips">
            <p className="text-xs text-text-muted">{contextTips[overlayMode]}</p>
          </CollapsibleSection>
        </div>
      </aside>

      {/* Main content area */}
      <main className="relative flex-1">{children}</main>
    </div>
  );
}
