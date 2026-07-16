import { useState, useEffect, useRef } from "react";

export interface RealtimeMessage {
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
}

export function useXaiRealtime() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [transcript, setTranscript] = useState<RealtimeMessage[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const connect = async () => {
    setStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/runtime/voice`;

    console.log(`[xAI Voice] Initiating WebSocket connection to: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
      setIsRecording(true);
      startMicStream();
      console.log("[xAI Voice] WebSocket connected to secure proxy");
    };

    socket.onmessage = async (event) => {
      try {
        let msg;
        if (typeof event.data === "string") {
          msg = JSON.parse(event.data);
        } else {
          // If receiving binary audio feedback, play it
          const arrayBuffer = await event.data.arrayBuffer();
          playAudioBuffer(arrayBuffer);
          return;
        }

        if (msg.type === "audio" && msg.data) {
          const binary = atob(msg.data);
          const arrayBuffer = new ArrayBuffer(binary.length);
          const view = new Uint8Array(arrayBuffer);
          for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
          }
          await playAudioBuffer(arrayBuffer);
        }

        if (msg.type === "transcript") {
          setTranscript(prev => {
            const filtered = prev.filter(m => m.role !== msg.role || !m.isFinal);
            return [...filtered, { role: msg.role, text: msg.text, isFinal: msg.isFinal }];
          });
        }

        if (msg.latencyMs) {
          setLatencyMs(msg.latencyMs);
        }
      } catch (err) {
        console.error("[xAI Voice] Error handling socket message:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("[xAI Voice] WebSocket error:", err);
      setStatus("error");
    };

    socket.onclose = () => {
      setStatus("disconnected");
      setIsRecording(false);
      cleanupStream();
    };
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  const startMicStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(inputData);
          socketRef.current.send(pcm16.buffer);
        }
      };
    } catch (err) {
      console.error("[xAI Voice] Microphone access error:", err);
      disconnect();
    }
  };

  const playAudioBuffer = async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (err) {
      console.error("[xAI Voice] Playback decode error:", err);
    }
  };

  const floatTo16BitPCM = (output: Float32Array) => {
    const buffer = new ArrayBuffer(output.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < output.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, output[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Int16Array(buffer);
  };

  const cleanupStream = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupStream();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return { isRecording, status, transcript, latencyMs, connect, disconnect };
}
