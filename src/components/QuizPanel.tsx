interface QuizPanelProps {
  question: string | null;
  onAnswer: (answer: string) => void;
}

export function QuizPanel({ question, onAnswer }: QuizPanelProps) {
  if (!question) return null;

  return (
    <div className="absolute bottom-24 right-4 z-10 w-80 rounded-lg border border-border bg-surface/95 p-4 backdrop-blur">
      <h3 className="mb-2 text-sm font-medium text-accent">Knowledge Quiz</h3>
      <p className="mb-3 text-sm text-text">{question}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onAnswer("yes")}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80"
        >
          I know this
        </button>
        <button
          onClick={() => onAnswer("no")}
          className="rounded bg-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text"
        >
          Not sure
        </button>
      </div>
    </div>
  );
}
