/**
 * useVoxtralSTT — parallel Voxtral Mini 4B Realtime transcription.
 *
 * Captures mic audio, converts to PCM16LE via AudioWorklet, streams binary
 * frames to the proxy WebSocket (/voxtral/stream), and receives text tokens
 * back in real time.
 *
 * Runs alongside ElevenLabs as a second-opinion transcript showcase.
 */

import { useState, useCallback, useRef } from "react";

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? "http://localhost:3001";
const WS_URL = PROXY_URL.replace(/^http/, "ws") + "/voxtral/stream";

// URL for the AudioWorklet module — Vite bundles files in src/worklets/ as assets
const WORKLET_URL = new URL("../worklets/pcm-processor.worklet.ts", import.meta.url).href;

export interface VoxtralSTTState {
  transcript: string;
  partialToken: string;
  isConnected: boolean;
  isAvailable: boolean | null; // null = unknown (not yet checked)
  start: () => Promise<void>;
  stop: () => void;
}

export function useVoxtralSTT(): VoxtralSTTState {
  const [transcript, setTranscript] = useState<string>("");
  const [partialToken, setPartialToken] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    // Disconnect AudioWorklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Close AudioContext
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setPartialToken("");
  }, []);

  const start = useCallback(async () => {
    if (isConnected) return;

    setTranscript("");
    setPartialToken("");

    // 1. Open WebSocket first — fail fast if server endpoint unavailable
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        setIsAvailable(true);
        setIsConnected(true);
        resolve();
      };
      ws.onerror = () => {
        setIsAvailable(false);
        reject(new Error("Voxtral WebSocket unavailable"));
      };
    });

    // Receive text tokens from voxtral.c stdout
    ws.onmessage = (event: MessageEvent<string>) => {
      const token: string = event.data;
      setPartialToken(token);
      setTranscript((prev) => prev + token);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setPartialToken("");
    };

    // 2. Capture mic audio
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000, // Request 16 kHz if browser supports it; voxtral.c auto-resamples otherwise
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = stream;

    // 3. Create AudioContext at native rate — voxtral.c resamples internally
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    // 4. Load PCM processor worklet
    await audioCtx.audioWorklet.addModule(WORKLET_URL);
    const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
    workletNodeRef.current = workletNode;

    // 5. Forward PCM16LE frames to WebSocket
    workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };

    // 6. Connect: mic → worklet (no need to connect to destination — we only capture)
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(workletNode);
  }, [isConnected]);

  return { transcript, partialToken, isConnected, isAvailable, start, stop };
}
