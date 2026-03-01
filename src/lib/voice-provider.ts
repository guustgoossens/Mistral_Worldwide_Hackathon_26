/**
 * VoiceProvider interface — contract that both ElevenLabs useConversation()
 * and any future custom pipeline (Voxtral STT → DevStral → ElevenLabs TTS)
 * must satisfy. Swap the provider in useInterview.ts without touching the UI.
 */
export interface VoiceProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
  readonly isSpeaking: boolean;
  readonly transcript: Array<{ role: 'user' | 'agent'; content: string }>;
  sendContextualUpdate?: (text: string) => void;
}
