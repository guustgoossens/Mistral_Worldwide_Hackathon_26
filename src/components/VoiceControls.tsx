import { Mic, MicOff, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceStatus = "disconnected" | "connecting" | "connected" | "disconnecting";

interface VoiceControlsProps {
  status: VoiceStatus;
  isSpeaking: boolean;
  transcript: { role: string; content: string }[];
  onStart: () => void;
  onStop: () => void;
  // Quiz mode props (optional for backward compat)
  onStartQuiz?: () => void;
  isQuizActive?: boolean;
}

export function VoiceControls({
  status,
  isSpeaking,
  transcript,
  onStart,
  onStop,
  onStartQuiz,
  isQuizActive = false,
}: VoiceControlsProps) {
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

      {/* Button row: Quiz me + Mic */}
      <div className="flex items-center gap-3">
        {/* Quiz me button */}
        {onStartQuiz && (
          <button
            onClick={onStartQuiz}
            disabled={isTransitioning}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full px-4 transition-all",
              isQuizActive
                ? "bg-amber-500/20 border border-amber-500/30 shadow-lg shadow-amber-500/10"
                : "bg-surface/80 border border-border hover:border-accent/40 hover:bg-surface",
            )}
          >
            <Brain
              className={cn(
                "h-4 w-4 transition-colors",
                isQuizActive ? "text-amber-400 animate-pulse" : "text-text-muted",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium transition-colors",
                isQuizActive ? "text-amber-400" : "text-text-muted",
              )}
            >
              {isQuizActive ? "Quizzing..." : "Quiz me"}
            </span>
          </button>
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
      </div>

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
