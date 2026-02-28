import { cn } from "@/lib/utils";

interface AgentStatusProps {
  kuzuReady: boolean;
  voiceConnected: boolean;
}

export function AgentStatus({ kuzuReady, voiceConnected }: AgentStatusProps) {
  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-1.5">
      <StatusDot label="KuzuDB" active={kuzuReady} />
      <StatusDot label="Voice" active={voiceConnected} />
    </div>
  );
}

function StatusDot({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded bg-surface/80 px-2.5 py-1 backdrop-blur">
      <div className={cn("h-2 w-2 rounded-full", active ? "bg-green-400" : "bg-red-400")} />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
