import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceStatus = "disconnected" | "connecting" | "connected" | "disconnecting";

interface AgentStatusProps {
  kuzuReady: boolean;
  voiceStatus: VoiceStatus;
  dataSource?: "parsed" | "sample" | null;
  kuzuError?: string | null;
  nodeCount?: number;
}

export function AgentStatus({ kuzuReady, voiceStatus, dataSource, kuzuError, nodeCount }: AgentStatusProps) {
  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-1.5">
      <StatusDot label="KuzuDB" status={kuzuReady ? "active" : "inactive"} />
      <StatusDot
        label="Voice"
        status={voiceStatus === "connected" ? "active" : voiceStatus === "connecting" || voiceStatus === "disconnecting" ? "pending" : "inactive"}
      />

      {/* Data source badge */}
      {dataSource === "parsed" && (
        <div className="flex items-center gap-2 rounded bg-surface/80 px-2.5 py-1 backdrop-blur">
          <Database className="h-3 w-3 text-green-400" />
          <span className="text-xs text-text-muted">
            Parsed data{nodeCount != null && nodeCount > 0 ? ` (${nodeCount})` : ""}
          </span>
        </div>
      )}
      {dataSource === "sample" && (
        <div className="flex items-center gap-2 rounded bg-surface/80 px-2.5 py-1 backdrop-blur">
          <Database className="h-3 w-3 text-yellow-400" />
          <span className="text-xs text-text-muted">Sample data</span>
        </div>
      )}
      {kuzuError && (
        <div className="flex items-center gap-2 rounded bg-surface/80 px-2.5 py-1 backdrop-blur">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-xs text-red-400">DB Error</span>
        </div>
      )}
    </div>
  );
}

function StatusDot({ label, status }: { label: string; status: "active" | "pending" | "inactive" }) {
  return (
    <div className="flex items-center gap-2 rounded bg-surface/80 px-2.5 py-1 backdrop-blur">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          status === "active" ? "bg-green-400" : status === "pending" ? "bg-yellow-400" : "bg-red-400",
        )}
      />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
