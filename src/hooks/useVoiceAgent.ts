/**
 * Voice agent hook wrapping ElevenLabs useConversation() + client tools.
 */

import { useState, useCallback, useMemo } from "react";
import { useConversation } from "@elevenlabs/react";
import { createAgentTools } from "@/lib/agent-tools";
import type { AgentToolDeps } from "@/lib/agent-tools";

export function useVoiceAgent(deps?: AgentToolDeps) {
  const [transcript, setTranscript] = useState<Array<{ role: "user" | "agent"; content: string }>>([]);

  const clientTools = useMemo(
    () => (deps ? createAgentTools(deps) : undefined),
    [deps?.highlightNodes, deps?.setOverlay, deps?.selectNode, deps?.flyToNode],
  );

  const conversation = useConversation({
    ...(clientTools && { clientTools }),
    onMessage: ({ message, role }) => {
      setTranscript((prev) => [...prev, { role, content: message }]);
    },
    onError: (error) => {
      console.error("[useVoiceAgent] Error:", error);
    },
  });

  const start = useCallback(async () => {
    const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
    if (!agentId) {
      console.error("[useVoiceAgent] Missing VITE_ELEVENLABS_AGENT_ID");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId,
        connectionType: "websocket" as const,
      });
    } catch (err) {
      console.error("[useVoiceAgent] Failed to start session:", err);
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return {
    isConnected: conversation.status === "connected",
    isSpeaking: conversation.isSpeaking,
    status: conversation.status as "disconnected" | "connecting" | "connected" | "disconnecting",
    transcript,
    start,
    stop,
    sendContextualUpdate: conversation.sendContextualUpdate,
  };
}
