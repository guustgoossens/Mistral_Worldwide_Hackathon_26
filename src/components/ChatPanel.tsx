import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Loader2, Trash2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useChat";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
  onStop: () => void;
  onHighlight?: (nodeIds: string[]) => void;
}

export function ChatPanel({
  messages,
  isLoading,
  onSend,
  onClear,
  onStop,
  onHighlight,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  };

  // Toggle button (bottom-left)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-6 left-6 z-20 flex h-12 w-12 items-center justify-center rounded-full gradient-cta text-white shadow-lg transition-transform hover:scale-110"
        title="Ask about this codebase"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 left-6 z-20 flex w-96 flex-col rounded-[12px] border border-border bg-surface/95 shadow-2xl backdrop-blur-md" style={{ maxHeight: "70vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-text">Ask about this codebase</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(70vh - 120px)" }}>
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="mb-3 h-8 w-8 text-text-muted/40" />
            <p className="text-sm text-text-muted">Ask anything about the codebase</p>
            <p className="mt-1 text-xs text-text-muted/60">
              "What does queryGraph do?" or "Who contributed most to kuzu.ts?"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "mb-3",
              msg.role === "user" ? "flex justify-end" : "flex justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-[10px] px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-accent/20 text-text"
                  : "bg-elevated text-text-muted",
              )}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {/* Clickable node highlights */}
              {msg.nodeIds && msg.nodeIds.length > 0 && (
                <button
                  onClick={() => onHighlight?.(msg.nodeIds!)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-accent hover:text-accent-muted transition-colors"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
                  {msg.nodeIds.length} node{msg.nodeIds.length !== 1 ? "s" : ""} highlighted
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="mb-3 flex justify-start">
            <div className="flex items-center gap-2 rounded-[10px] bg-elevated px-3.5 py-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              <span className="text-sm text-text-muted">Querying graph...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the code..."
            disabled={isLoading}
            className="flex-1 rounded-[8px] bg-input px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none ring-1 ring-transparent transition-all focus:ring-accent/40"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-warm-red/20 text-warm-red transition-colors hover:bg-warm-red/30"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[8px] transition-all",
                input.trim()
                  ? "gradient-cta text-white hover:scale-105"
                  : "bg-input text-text-muted/30 cursor-not-allowed",
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
