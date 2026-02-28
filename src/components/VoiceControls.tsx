import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceStatus = "disconnected" | "connecting" | "connected" | "disconnecting";

interface VoiceControlsProps {
  status: VoiceStatus;
  isSpeaking: boolean;
  transcript: { role: string; content: string }[];
  onStart: () => void;
  onStop: () => void;
}

export function VoiceControls({ status, isSpeaking, transcript, onStart, onStop }: VoiceControlsProps) {
  const isConnected = status === "connected";
  const isTransitioning = status === "connecting" || status === "disconnecting";

  return (
    <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="max-h-32 w-96 overflow-y-auto rounded-lg bg-surface/90 p-3 backdrop-blur">
          {transcript.slice(-3).map((msg, i) => (
            <p key={i} className={cn("text-xs", msg.role === "user" ? "text-accent" : "text-text-muted")}>
              <span className="font-medium">{msg.role === "user" ? "You" : "Agent"}:</span> {msg.content}
            </p>
          ))}
        </div>
      )}

      {/* Mic button */}
      <button
        onClick={isConnected ? onStop : onStart}
        disabled={isTransitioning}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full transition-all",
          isConnected
            ? isSpeaking
              ? "animate-pulse bg-accent shadow-lg shadow-accent/40"
              : "bg-accent shadow-lg shadow-accent/30"
            : isTransitioning
              ? "cursor-wait bg-surface/80"
              : "bg-surface hover:bg-border",
        )}
      >
        {isTransitioning ? (
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        ) : isConnected ? (
          <MicOff className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-text-muted" />
        )}
      </button>

      <p className="text-xs text-text-muted">
        {status === "connected"
          ? isSpeaking
            ? "Agent speaking..."
            : "Listening..."
          : status === "connecting"
            ? "Connecting..."
            : status === "disconnecting"
              ? "Disconnecting..."
              : "Click to start voice"}
      </p>
    </div>
  );
}
