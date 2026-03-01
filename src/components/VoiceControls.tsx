import { Mic, MicOff, Loader2, Play, CheckCircle, Brain, Square } from "lucide-react";
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
  onStartQuiz?: () => void;
  onStopQuiz?: () => void;
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
  onStartQuiz,
  onStopQuiz,
  error,
}: VoiceControlsProps) {
  const isVoiceConnected = voiceStatus === "connected";
  const isVoiceTransitioning = voiceStatus === "connecting" || voiceStatus === "disconnecting";

  return (
    <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
      {/* Error message */}
      {error && (
        <div className="w-96 rounded-lg bg-warm-red/10 border border-warm-red/30 p-3">
          <p className="text-xs text-warm-red">{error}</p>
        </div>
      )}

      {/* Transcript (visible during interview) */}
      {interviewState === "interviewing" && transcript.length > 0 && (
        <div className="max-h-32 w-96 overflow-y-auto rounded-lg bg-surface p-3">
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
            "flex h-14 items-center gap-3 rounded-[10px] px-8 text-sm font-medium transition-all",
            kuzuReady
              ? "gradient-cta text-white font-bold hover:scale-105"
              : "bg-surface/50 text-text-muted cursor-not-allowed",
          )}
        >
          <Play className="h-5 w-5" />
          I'm Ready
        </button>
      )}

      {interviewState === "preparing" && (
        <div className="flex h-14 items-center gap-3 rounded-[10px] bg-surface px-8">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm text-text-muted">Analyzing codebase...</span>
        </div>
      )}

      {interviewState === "ready" && (
        <button
          onClick={onStartInterview}
          className="flex h-14 items-center gap-3 rounded-[10px] gradient-cta px-8 text-sm font-bold text-white hover:scale-105 transition-all"
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
                  ? "animate-pulse gradient-cta"
                  : "gradient-cta"
                : isVoiceTransitioning
                  ? "cursor-wait bg-surface"
                  : "bg-input hover:bg-border-medium",
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
        <div className="flex items-center gap-3">
          <div className="flex h-14 items-center gap-3 rounded-[10px] bg-accent-muted/10 border border-accent-muted/30 px-8">
            <CheckCircle className="h-5 w-5 text-accent-muted" />
            <span className="text-sm text-accent-muted">Interview Complete</span>
          </div>
          {onStartQuiz && (
            <button
              onClick={onStartQuiz}
              className="flex h-14 items-center gap-2 rounded-[10px] gradient-cta px-6 text-sm font-bold text-white hover:scale-105 transition-all"
            >
              <Brain className="h-5 w-5" />
              Quiz Me
            </button>
          )}
        </div>
      )}

      {interviewState === "quizzing" && (
        <div className="flex items-center gap-3">
          <div className="flex h-14 items-center gap-3 rounded-[10px] bg-amber/10 border border-amber/30 px-8">
            <Brain className="h-5 w-5 text-amber" />
            <span className="text-sm text-amber">Quizzing...</span>
          </div>
          {onStopQuiz && (
            <button
              onClick={onStopQuiz}
              className="flex h-14 items-center gap-2 rounded-[10px] bg-warm-red/80 px-6 text-sm font-medium text-white hover:bg-warm-red hover:scale-105 transition-all"
            >
              <Square className="h-4 w-4" />
              Stop Quiz
            </button>
          )}
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
                : interviewState === "quizzing"
                  ? "Test your codebase knowledge"
                  : "Thanks for the interview!"}
      </p>
    </div>
  );
}
