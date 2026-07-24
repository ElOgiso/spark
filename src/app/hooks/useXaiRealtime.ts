import { useState, useCallback } from "react";

export function useXaiRealtime() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [transcript, setTranscript] = useState("");

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      setIsRecording(true);
      setStatus("connected");
    } catch {
      setStatus("error");
      setIsRecording(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsRecording(false);
    setStatus("idle");
  }, []);

  return {
    isRecording,
    status,
    transcript,
    connect,
    disconnect,
  };
}
