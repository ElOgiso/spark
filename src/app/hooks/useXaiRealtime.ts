import { useState, useCallback, useRef, useEffect } from 'react';
import { generateSuperSparkVoice, SPARK_EXECUTIVE_VOICE_PROFILE } from '../services/geminiService';

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

    // 1. Try Gemini TTS Male Voice ('Puck' / 'Fenrir')
    try {
      const geminiAudioUri = await generateSuperSparkVoice(spokenText);
      if (geminiAudioUri) {
        const audio = new Audio(geminiAudioUri);
        audioRef.current = audio;
        await audio.play();
        return;
      }
    } catch (e) {
      console.warn('[SuperSparkVoice] Gemini audio fallback:', e);
    }

    // 2. Web Speech API Fallback with guaranteed Executive Male Voice configuration
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      
      const getExecutiveMaleVoice = (): SpeechSynthesisVoice | null => {
        const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return null;

        const femaleKeywords = [
          'female', 'samantha', 'karen', 'victoria', 'zira', 'siri', 'veena', 'fiona',
          'moira', 'tessa', 'samantha', 'kyoko', 'yuri', 'tingting', 'sinji', 'monica',
          'paulina', 'helena', 'anna', 'laura', 'sora', 'amelie', 'sara', 'alva'
        ];

        const isFemale = (v: SpeechSynthesisVoice) => {
          const nameLower = v.name.toLowerCase();
          return femaleKeywords.some((kw) => nameLower.includes(kw));
        };

        // Preferred male voice list
        const maleKeywords = [
          'google us english',
          'david',
          'george',
          'guy',
          'james',
          'daniel',
          'alex',
          'fred',
          'puck',
          'fenrir',
          'male'
        ];

        for (const kw of maleKeywords) {
          const match = voices.find(
            (v) => v.name.toLowerCase().includes(kw) && v.lang.startsWith('en') && !isFemale(v)
          );
          if (match) return match;
        }

        // Fallback: any non-female English voice
        const nonFemaleEn = voices.find((v) => v.lang.startsWith('en') && !isFemale(v));
        if (nonFemaleEn) return nonFemaleEn;

        // Fallback to English voice
        return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
      };

      const voice = getExecutiveMaleVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.pitch = SPARK_EXECUTIVE_VOICE_PROFILE.pitch; // Deep warm executive male pitch
      utterance.rate = SPARK_EXECUTIVE_VOICE_PROFILE.rate;   // Articulate speaking speed
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
