/**
 * Interview lifecycle hook.
 *
 * States: idle → preparing → ready → interviewing → complete
 *
 * Pre-computes a briefing from KuzuDB, sends it to the proxy,
 * then starts the voice agent with no tool-call dependencies.
 */

import { useState, useCallback } from "react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { gatherContext, generateBriefing, composeBriefingPrompt } from "@/lib/briefing";
import type { BriefingPacket } from "@/lib/briefing";
import type { OverlayMode } from "@/types/graph";

export type InterviewState = "idle" | "preparing" | "ready" | "interviewing" | "complete" | "quizzing";

interface UseInterviewDeps {
  executeQuery: (cypher: string) => Promise<unknown[]>;
  highlightNodes: (ids: string[]) => void;
  setOverlay: (mode: OverlayMode) => void;
  selectNode: (nodeId: string) => void;
  flyToNode?: (nodeId: string) => void;
  proxyUrl: string;
}

export function useInterview(deps: UseInterviewDeps) {
  const [state, setState] = useState<InterviewState>("idle");
  const [briefing, setBriefing] = useState<BriefingPacket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceAgent({
    highlightNodes: deps.highlightNodes,
    setOverlay: deps.setOverlay,
    selectNode: deps.selectNode,
    flyToNode: deps.flyToNode,
  });

  const prepare = useCallback(async () => {
    setState("preparing");
    setError(null);

    try {
      console.log("[interview] Gathering codebase context...");
      const context = await gatherContext(deps.executeQuery);
      console.log("[interview] Context gathered:", {
        files: context.files.length,
        functions: context.functions.length,
        classes: context.classes.length,
        calls: context.calls.length,
        imports: context.imports.length,
        contributors: context.contributors.length,
      });

      console.log("[interview] Generating briefing via Mistral...");
      const packet = await generateBriefing(context, deps.proxyUrl);
      console.log("[interview] Briefing generated:", packet.questions.length, "questions");
      setBriefing(packet);

      const prompt = composeBriefingPrompt(packet);
      console.log("[interview] Sending briefing to proxy...");
      const storeRes = await fetch(`${deps.proxyUrl}/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: prompt }),
      });

      if (!storeRes.ok) {
        throw new Error(`Failed to store briefing: ${storeRes.status}`);
      }

      console.log("[interview] Briefing stored on proxy, ready to start");
      setState("ready");
    } catch (err) {
      console.error("[interview] Preparation failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("idle");
    }
  }, [deps.executeQuery, deps.proxyUrl]);

  const startInterview = useCallback(async () => {
    setState("interviewing");
    await voice.start();
  }, [voice]);

  const stopInterview = useCallback(async () => {
    await voice.stop();
    setState("complete");
  }, [voice]);

  const startQuizMode = useCallback(() => {
    setState("quizzing");
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setBriefing(null);
    setError(null);
  }, []);

  return {
    state,
    briefing,
    error,
    prepare,
    startInterview,
    stopInterview,
    startQuizMode,
    reset,
    // Voice passthrough
    voiceStatus: voice.status,
    transcript: voice.transcript,
    isSpeaking: voice.isSpeaking,
  };
}
