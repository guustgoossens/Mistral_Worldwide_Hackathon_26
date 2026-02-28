/**
 * Voice agent hook wrapping ElevenLabs useConversation() + client tools.
 *
 * TODO: Implement:
 * 1. Initialize ElevenLabs conversation with agent ID from env
 * 2. Register client tools (query_graph, highlight_nodes, set_overlay, etc.)
 * 3. Expose start/stop/status + transcript
 */

export function useVoiceAgent() {
  // TODO: Implement ElevenLabs integration
  return {
    isConnected: false,
    isSpeaking: false,
    transcript: [] as { role: string; content: string }[],
    start: async () => console.warn("[useVoiceAgent] Not yet implemented"),
    stop: async () => console.warn("[useVoiceAgent] Not yet implemented"),
  };
}
