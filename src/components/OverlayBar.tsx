import type { OverlayMode } from "@/types/graph";
import { cn } from "@/lib/utils";
import { Network, Users, GraduationCap, Split } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const modes: { key: OverlayMode; label: string; icon: LucideIcon }[] = [
  { key: "structure", label: "Structure", icon: Network },
  { key: "contributors", label: "Contributors", icon: Users },
  { key: "knowledge", label: "Knowledge", icon: GraduationCap },
];

interface OverlayBarProps {
  overlayModes: Set<OverlayMode>;
  onToggle: (mode: OverlayMode) => void;
}

export function OverlayBar({ overlayModes, onToggle }: OverlayBarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      <div className="flex gap-1 rounded-[10px] bg-surface/80 backdrop-blur-sm p-1 border border-border">
        {modes.map(({ key, label, icon: ModeIcon }) => (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors",
              overlayModes.has(key)
                ? "gradient-cta text-white font-bold"
                : "text-text-muted hover:text-text hover:bg-input hover:border-accent/40",
            )}
          >
            <ModeIcon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {overlayModes.has("contributors") && overlayModes.has("knowledge") && (
        <span className="flex items-center gap-1.5 rounded-[8px] bg-surface/80 backdrop-blur-sm border border-border px-3 py-1.5 text-xs text-text-muted">
          <Split className="h-3.5 w-3.5" />
          Discrepancy view
        </span>
      )}
    </div>
  );
}
