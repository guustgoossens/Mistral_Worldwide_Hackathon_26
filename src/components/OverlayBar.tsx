import type { OverlayMode } from "@/types/graph";
import { cn } from "@/lib/utils";

const modes: { key: OverlayMode; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "contributors", label: "Contributors" },
  { key: "knowledge", label: "Knowledge" },
];

interface OverlayBarProps {
  overlayModes: Set<OverlayMode>;
  onToggle: (mode: OverlayMode) => void;
}

export function OverlayBar({ overlayModes, onToggle }: OverlayBarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      <div className="flex gap-1 rounded-[10px] bg-surface p-1 border border-border">
        {modes.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={cn(
              "rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors",
              overlayModes.has(key)
                ? "gradient-cta text-white font-bold"
                : "text-text-muted hover:text-text hover:bg-input",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {overlayModes.has("contributors") && overlayModes.has("knowledge") && (
        <span className="rounded-[8px] bg-surface border border-border px-3 py-1.5 text-xs text-text-muted">
          Discrepancy view
        </span>
      )}
    </div>
  );
}
