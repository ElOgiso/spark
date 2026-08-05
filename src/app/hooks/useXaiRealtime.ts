import { useState, useCallback, useRef, useEffect } from 'react';
import { generateSuperSparkVoice, SPARK_EXECUTIVE_VOICE_PROFILE } from '../services/geminiService';
import { resolveProviderKey } from '../services/runtime/AIProviderOrchestrator';

export interface VoiceMessage {
  role: 'user' | 'model';
  text: string;
  isFinal: boolean;
}

export function useXaiRealtime() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'recording' | 'error'>('idle');
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [currentText, setCurrentText] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Pre-fetch and cache available Web Speech voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          voicesRef.current = v;
        }
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  /**
   * Stop any ongoing speech or audio immediately
   */
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsRecording(true);
          setStatus('recording');
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const combinedText = finalTranscript || interimTranscript;
          setCurrentText(combinedText);

          if (combinedText.trim()) {
            setTranscript([
              {
                role: 'user',
                text: combinedText.trim(),
                isFinal: !!finalTranscript,
              },
            ]);
          }
        };

        recognition.onerror = (err: any) => {
          console.warn('[VoiceNote] Speech recognition event note:', err?.error);
          if (err?.error !== 'no-speech') {
            setStatus('error');
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          setStatus('idle');
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('[VoiceNote] SpeechRecognition init failed:', e);
      }
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setCurrentText('');
    setTranscript([]);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Handle if already started
        setIsRecording(true);
        setStatus('recording');
      }
    } else {
      // Fallback recording state if SpeechRecognition not present in environment
      setIsRecording(true);
      setStatus('recording');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsRecording(false);
    setStatus('idle');
  }, []);

  /**
   * Speak response using Gemini TTS Male Voice or browser male voice fallback
   */
  const speakText = useCallback(async (text: string, isMuted: boolean = false) => {
    // If muted or empty text, stop any active audio and exit
    if (isMuted || !text) {
      stopSpeaking();
      return;
    }

    // Stop any currently playing audio before starting new speech
    stopSpeaking();

    // Clean text for speech synthesis (strip markdown headers, bold symbols, bullet dashes)
    const spokenText = text
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/^[-*•]\s+/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .trim();

    if (!spokenText) return;

    // 1. Try ElevenLabs API if key is available
    try {
      const elevenKey = resolveProviderKey("elevenlabs");
      if (elevenKey) {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${SPARK_EXECUTIVE_VOICE_PROFILE.elevenLabsVoiceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenKey,
          },
          body: JSON.stringify({
            text: spokenText.slice(0, 400),
            model_id: "eleven_monolingual_v1",
            voice_settings: { stability: 0.75, similarity_boost: 0.85 },
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          await audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn('[SuperSparkVoice] ElevenLabs TTS notice:', e);
    }

    // 2. Try Gemini TTS Female Voice ('Kore')
    try {
      const geminiAudioUri = await generateSuperSparkVoice(spokenText);
      if (geminiAudioUri) {
        const audio = new Audio(geminiAudioUri);
        audioRef.current = audio;
        await audio.play();
        return;
      }
    } catch (e) {
      console.warn('[SuperSparkVoice] Gemini audio notice:', e);
    }

    // 3. Web Speech API Fallback with guaranteed Executive Female Voice configuration
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      
      const getExecutiveFemaleVoice = (): SpeechSynthesisVoice | null => {
        const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return null;

        const preferredVoices = [
          'samantha', 'karen', 'zira', 'victoria', 'google uk english female',
          'google us english', 'veena', 'fiona', 'moira', 'tessa', 'female'
        ];

        for (const pref of preferredVoices) {
          const match = voices.find((v) => v.name.toLowerCase().includes(pref) && v.lang.startsWith('en'));
          if (match) return match;
        }

        return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
      };

      const voice = getExecutiveFemaleVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.pitch = SPARK_EXECUTIVE_VOICE_PROFILE.pitch; // Warm executive female pitch (1.05)
      utterance.rate = SPARK_EXECUTIVE_VOICE_PROFILE.rate;   // Natural executive rate (1.0)
      window.speechSynthesis.speak(utterance);
    }
  }, [stopSpeaking]);

  return {
    isRecording,
    status,
    transcript,
    currentText,
    connect,
    disconnect,
    speakText,
    stopSpeaking,
  };
}
