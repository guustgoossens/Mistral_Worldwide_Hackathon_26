import type { ReactNode } from "react";
import type { OverlayMode } from "@/types/graph";
import { cn } from "@/lib/utils";

const overlayModes: { key: OverlayMode; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "contributors", label: "Contributors" },
  { key: "knowledge", label: "Knowledge" },
  { key: "people", label: "People" },
];

interface LayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  overlayMode: OverlayMode;
  onOverlayChange: (mode: OverlayMode) => void;
}

export function Layout({ children, sidebar, overlayMode, onOverlayChange }: LayoutProps) {
  return (
    <div className="flex h-full w-full bg-bg">
      {/* Sidebar */}
      <aside className="flex w-80 flex-col border-r border-border bg-surface">
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

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto p-4">{sidebar}</div>
      </aside>

      {/* Main content area */}
      <main className="relative flex-1">{children}</main>
    </div>
  );
}
