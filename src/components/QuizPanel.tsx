import { useState, useRef, useEffect } from "react";
import { Brain, Send, SkipForward, ArrowRight, X, Zap, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuizFeedback {
  isCorrect: boolean;
  explanation: string;
  correctAnswer?: string;
}

export interface QuizSessionStats {
  questionNumber: number;
  correctCount: number;
  streak: number;
}

interface QuizPanelProps {
  question: string | null;
  onAnswer: (answer: string) => void;
  // Extended props (all optional for backward compat)
  isLoading?: boolean;
  feedback?: QuizFeedback | null;
  sessionStats?: QuizSessionStats | null;
  onNextQuestion?: () => void;
  onClose?: () => void;
  targetName?: string; // name of the function/file being quizzed on
}

export function QuizPanel({
  question,
  onAnswer,
  isLoading = false,
  feedback = null,
  sessionStats = null,
  onNextQuestion,
  onClose,
  targetName,
}: QuizPanelProps) {
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when a new question arrives
  useEffect(() => {
    if (question && !feedback && !isLoading) {
      inputRef.current?.focus();
    }
  }, [question, feedback, isLoading]);

  // Clear answer input when question changes
  useEffect(() => {
    setAnswer("");
  }, [question]);

  // Nothing to show if no question and not loading
  if (!question && !isLoading) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onAnswer(answer.trim());
      setAnswer("");
    }
  };

  const handleSkip = () => {
    onAnswer("skip");
    setAnswer("");
  };

  return (
    <div className="absolute bottom-24 right-4 z-10 w-96 animate-in rounded-lg border border-border bg-surface/95 shadow-xl shadow-black/20 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-text">Knowledge Quiz</h3>
          {sessionStats && (
            <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-medium text-text-muted">
              Q{sessionStats.questionNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Streak indicator */}
          {sessionStats && sessionStats.streak > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5">
              <Zap className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400">{sessionStats.streak}</span>
            </div>
          )}
          {/* Score */}
          {sessionStats && sessionStats.questionNumber > 1 && (
            <span className="text-[10px] text-text-muted">
              {sessionStats.correctCount}/{sessionStats.questionNumber - 1}
            </span>
          )}
          {onClose && (
            <button onClick={onClose} className="text-text-muted transition-colors hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Target context */}
        {targetName && (
          <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
            About: <span className="text-accent">{targetName}</span>
          </p>
        )}

        {/* Loading state */}
        {isLoading && !question && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
            </div>
            <p className="text-xs text-text-muted">Generating a question...</p>
          </div>
        )}

        {/* Question */}
        {question && (
          <>
            <p className="mb-4 text-sm leading-relaxed text-text">{question}</p>

            {/* Feedback display */}
            {feedback ? (
              <div className="space-y-3">
                {/* Correct/Incorrect banner */}
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2",
                    feedback.isCorrect ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20",
                  )}
                >
                  {feedback.isCorrect ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      feedback.isCorrect ? "text-green-400" : "text-red-400",
                    )}
                  >
                    {feedback.isCorrect ? "Correct!" : "Not quite"}
                  </span>
                </div>

                {/* Explanation */}
                <p className="text-xs leading-relaxed text-text-muted">{feedback.explanation}</p>

                {/* Correct answer if wrong */}
                {!feedback.isCorrect && feedback.correctAnswer && (
                  <div className="rounded-md bg-border/50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Expected answer</p>
                    <p className="mt-1 text-xs text-text">{feedback.correctAnswer}</p>
                  </div>
                )}

                {/* Next question button */}
                {onNextQuestion && (
                  <button
                    onClick={onNextQuestion}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/80"
                  >
                    Next question
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              /* Answer input form */
              <form onSubmit={handleSubmit} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-xs text-text placeholder-text-muted outline-none transition-colors focus:border-accent"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!answer.trim() || isLoading}
                    className={cn(
                      "flex items-center justify-center rounded-md px-3 py-2 transition-colors",
                      answer.trim()
                        ? "bg-accent text-white hover:bg-accent/80"
                        : "bg-border text-text-muted cursor-not-allowed",
                    )}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-border/50 px-3 py-1.5 text-[11px] text-text-muted transition-colors hover:bg-border hover:text-text"
                >
                  <SkipForward className="h-3 w-3" />
                  Not sure / Skip
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Progress bar at bottom */}
      {sessionStats && sessionStats.questionNumber > 0 && (
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>Session progress</span>
            <span>
              {sessionStats.correctCount} correct out of {sessionStats.questionNumber > 1 ? sessionStats.questionNumber - 1 : 0} answered
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{
                width: `${sessionStats.questionNumber > 1 ? (sessionStats.correctCount / (sessionStats.questionNumber - 1)) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
