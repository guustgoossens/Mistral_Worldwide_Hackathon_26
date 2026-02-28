import { Mic, MicOff, Loader2, Play, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InterviewState } from "@/hooks/useInterview";

type VoiceStatus = "disconnected" | "connecting" | "connected" | "disconnecting";

interface VoiceControlsProps {
  interviewState: InterviewState;
  voiceStatus: VoiceStatus;
  isSpeaking: boolean;
  transcript: { role: string; content: string }[];
  kuzuReady: boolean;
  onPrepare: () => void;
  onStartInterview: () => void;
  onStopInterview: () => void;
  error?: string | null;
}

export function VoiceControls({
  interviewState,
  voiceStatus,
  isSpeaking,
  transcript,
  kuzuReady,
  onPrepare,
  onStartInterview,
  onStopInterview,
  error,
}: VoiceControlsProps) {
  const isVoiceConnected = voiceStatus === "connected";
  const isVoiceTransitioning = voiceStatus === "connecting" || voiceStatus === "disconnecting";

  return (
    <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
      {/* Error message */}
      {error && (
        <div className="w-96 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Transcript (visible during interview) */}
      {interviewState === "interviewing" && transcript.length > 0 && (
        <div className="max-h-32 w-96 overflow-y-auto rounded-lg bg-surface/90 p-3 backdrop-blur">
          {transcript.slice(-3).map((msg, i) => (
            <p key={i} className={cn("text-xs", msg.role === "user" ? "text-accent" : "text-text-muted")}>
              <span className="font-medium">{msg.role === "user" ? "You" : "Agent"}:</span> {msg.content}
            </p>
          ))}
        </div>
      )}

      {/* State-specific controls */}
      {interviewState === "idle" && (
        <button
          onClick={onPrepare}
          disabled={!kuzuReady}
          className={cn(
            "flex h-14 items-center gap-3 rounded-full px-8 text-sm font-medium transition-all",
            kuzuReady
              ? "bg-accent text-white shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:scale-105"
              : "bg-surface/50 text-text-muted cursor-not-allowed",
          )}
        >
          <Play className="h-5 w-5" />
          I'm Ready
        </button>
      )}

      {interviewState === "preparing" && (
        <div className="flex h-14 items-center gap-3 rounded-full bg-surface/80 px-8">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm text-text-muted">Analyzing codebase...</span>
        </div>
      )}

      {interviewState === "ready" && (
        <button
          onClick={onStartInterview}
          className="flex h-14 items-center gap-3 rounded-full bg-green-500 px-8 text-sm font-medium text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all"
        >
          <Mic className="h-5 w-5" />
          Start Interview
        </button>
      )}

      {interviewState === "interviewing" && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={isVoiceConnected ? onStopInterview : undefined}
            disabled={isVoiceTransitioning}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full transition-all",
              isVoiceConnected
                ? isSpeaking
                  ? "animate-pulse bg-accent shadow-lg shadow-accent/40"
                  : "bg-accent shadow-lg shadow-accent/30"
                : isVoiceTransitioning
                  ? "cursor-wait bg-surface/80"
                  : "bg-surface hover:bg-border",
            )}
          >
            {isVoiceTransitioning ? (
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            ) : isVoiceConnected ? (
              <MicOff className="h-6 w-6 text-white" />
            ) : (
              <Mic className="h-6 w-6 text-text-muted" />
            )}
          </button>
        </div>
      )}

      {interviewState === "complete" && (
        <div className="flex h-14 items-center gap-3 rounded-full bg-green-500/10 border border-green-500/30 px-8">
          <CheckCircle className="h-5 w-5 text-green-400" />
          <span className="text-sm text-green-400">Interview Complete</span>
        </div>
      )}

      {/* Status text */}
      <p className="text-xs text-text-muted">
        {interviewState === "idle"
          ? kuzuReady
            ? "Click to start your codebase interview"
            : "Waiting for graph database..."
          : interviewState === "preparing"
            ? "Generating interview questions..."
            : interviewState === "ready"
              ? "Questions ready — start when you are"
              : interviewState === "interviewing"
                ? isVoiceConnected
                  ? isSpeaking
                    ? "Agent speaking..."
                    : "Listening..."
                  : voiceStatus === "connecting"
                    ? "Connecting..."
                    : "Disconnecting..."
                : "Thanks for the interview!"}
      </p>
    </div>
  );
}
