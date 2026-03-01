import { Database, Users, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceStatus = "disconnected" | "connecting" | "connected" | "disconnecting";

interface AgentStatusProps {
  kuzuReady: boolean;
  voiceStatus: VoiceStatus;
  dataSource?: "parsed" | "sample" | null;
  kuzuError?: string | null;
  nodeCount?: number;
  persons?: string[];
  personFilter?: Set<string>;
  onTogglePerson?: (name: string) => void;
  onClearPersonFilter?: () => void;
  showContributors?: boolean;
}

export function AgentStatus({
  kuzuReady,
  voiceStatus,
  dataSource,
  kuzuError,
  nodeCount,
  persons,
  personFilter,
  onTogglePerson,
  onClearPersonFilter,
  showContributors,
}: AgentStatusProps) {
  const hasPersons = showContributors && persons && persons.length > 0;

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-1.5">
      <StatusDot label="KuzuDB" status={kuzuReady ? "active" : "inactive"} icon={Database} />
      <StatusDot
        label="Voice"
        status={voiceStatus === "connected" ? "active" : voiceStatus === "connecting" || voiceStatus === "disconnecting" ? "pending" : "inactive"}
        icon={Mic}
      />

      {/* Data source badge */}
      {dataSource === "parsed" && (
        <div className="flex items-center gap-2 rounded bg-surface px-2.5 py-1">
          <Database className="h-3 w-3 text-accent" />
          <span className="text-xs text-text-muted">
            Parsed data{nodeCount != null && nodeCount > 0 ? ` (${nodeCount})` : ""}
          </span>
        </div>
      )}
      {dataSource === "sample" && (
        <div className="flex items-center gap-2 rounded bg-surface px-2.5 py-1">
          <Database className="h-3 w-3 text-amber" />
          <span className="text-xs text-text-muted">Sample data</span>
        </div>
      )}
      {kuzuError && (
        <div className="flex items-center gap-2 rounded bg-surface px-2.5 py-1">
          <div className="h-2 w-2 rounded-full bg-warm-red" />
          <span className="text-xs text-warm-red">DB Error</span>
        </div>
      )}

      {/* Contributor toggles */}
      {hasPersons && (
        <div className="mt-1 flex flex-col gap-0.5 rounded bg-surface border border-border p-1.5">
          <div className="flex items-center justify-between px-1 mb-0.5">
            <div className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5 text-text-muted" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Contributors</span>
            </div>
            {personFilter && personFilter.size > 0 && (
              <button
                onClick={onClearPersonFilter}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {persons!.map((name) => {
              const active = personFilter?.has(name) ?? false;
              return (
                <button
                  key={name}
                  onClick={() => onTogglePerson?.(name)}
                  className={cn(
                    "flex items-center gap-2 rounded px-1.5 py-0.5 text-[11px] transition-colors",
                    active
                      ? "bg-accent/20 text-text"
                      : "text-text-muted hover:text-text hover:bg-border/50",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full border transition-colors",
                      active
                        ? "border-accent bg-accent"
                        : "border-text-muted bg-transparent",
                    )}
                  />
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ label, status, icon: IconComp }: { label: string; status: "active" | "pending" | "inactive"; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 rounded bg-surface px-2.5 py-1">
      {IconComp ? (
        <IconComp
          className={cn(
            "h-3 w-3",
            status === "active" ? "text-accent-bright" : status === "pending" ? "text-amber animate-pulse" : "text-text-tertiary",
          )}
        />
      ) : (
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            status === "active" ? "bg-accent-bright" : status === "pending" ? "bg-amber animate-pulse" : "bg-text-tertiary",
          )}
        />
      )}
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
