import React, { useState, useEffect, useRef } from "react";
import { X, Mic, Volume2, VolumeX, Send, Sparkles, User, AudioLines, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSpark } from "../state/SparkContext";

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  sender: "user" | "spark";
  text: string;
  timestamp: Date;
}

export function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
  const {
    brand,
    metrics,
    productions,
    reviewItems,
    accounts,
    character
  } = useSpark() as any;

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "spark",
      text: `Hello, I am Spark. I've analyzed your channels and brand intelligence dashboard. Need any help or recommendations today?`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speech Recognition (STT) setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsRecording(false);
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition Error", e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Text to Speech (TTS) handler
  const speakText = (text: string) => {
    if (isMuted) return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a high quality English voice, ideally matches primary host Tunde
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.includes("en-NG") || v.lang.includes("en-GB") || v.lang.includes("en-US"));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.rate = 1.05; // slightly faster for energetic tone
      window.speechSynthesis.speak(utterance);
    }
  };

  // Cancel speech on close
  useEffect(() => {
    if (!isOpen) {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [isOpen]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const getSystemOverview = () => {
    const activeProds = productions ? productions.filter((p: any) => p.status !== "Completed" && p.status !== "Published") : [];
    const pendingReviews = reviewItems ? reviewItems.filter((r: any) => r.status === "Ready for Review") : [];
    return `You have ${activeProds.length} active productions in pipeline, ${pendingReviews.length} files awaiting creative review. Your primary brand is "${brand?.name || "Tech Insights Nigeria"}", archetyped as "${brand?.archetype || "The Expert Guide"}".`;
  };

  const processResponse = (query: string): string => {
    const q = query.toLowerCase();

    // 1. Revenue
    if (q.includes("revenue") || q.includes("money") || q.includes("earnings")) {
      return `We tracked $142K in revenue this month, which is up 24.5% compared to last month. All channel monetization streams are performing optimally.`;
    }
    
    // 2. Views / Traffic
    if (q.includes("views") || q.includes("views count") || q.includes("traffic") || q.includes("views metric")) {
      return `Across all accounts, we have hit 24.8M views this month (up by 18.2%). The top performer was the "How AI Creates Viral Content" video.`;
    }

    // 3. Pending approvals / reviews
    if (q.includes("review") || q.includes("approval") || q.includes("approve") || q.includes("queue")) {
      const pendingReviews = reviewItems ? reviewItems.filter((r: any) => r.status === "Ready for Review") : [];
      if (pendingReviews.length > 0) {
        return `You have ${pendingReviews.length} items waiting in the review center. The oldest is a storyboard titled "5 Viral Marketing Tactics", with a brand fit score of 94%.`;
      }
      return `Your review queue is fully cleared right now. Good job!`;
    }

    // 4. Brand / Niche info
    if (q.includes("brand") || q.includes("niche") || q.includes("audience")) {
      return `Your active brand workspace is "${brand?.name}" targeting "${brand?.audience?.primary}". Our main focus is "${brand?.niche}" using an "${brand?.archetype}" voice style.`;
    }

    // 5. Active productions
    if (q.includes("production") || q.includes("pipeline") || q.includes("schedule")) {
      const activeProds = productions ? productions.filter((p: any) => p.status !== "Completed" && p.status !== "Published") : [];
      return `We have ${activeProds.length} active productions currently in progress. The next publication is scheduled for today at 2:00 PM: "Psychology of Viral Content" onto YouTube and TikTok.`;
    }

    // 6. Tunde/Character/Host
    if (q.includes("host") || q.includes("character") || q.includes("tunde") || q.includes("voice")) {
      return `The host configured for your content is "${character?.name || "Tunde"}", acting as the "${character?.role || "Primary Host"}". The voice accent is configured as "${character?.voice?.language || "English (Nigerian Accent)"}" to match local audience patterns.`;
    }

    // 7. General greetings
    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
      return `Hello! I'm Spark, your brand's AI Media Assistant. ${getSystemOverview()} Ask me anything about your analytics, reviews, or active content pillars.`;
    }

    // Fallback general response
    return `I am analyzing your query. The current setup for ${brand?.name || "your brand"} focuses on digital marketing and AI education. If you'd like, I can help you inspect the review queue, summarize view growth, or toggle brand rules. What would you like to explore next?`;
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      sender: "user",
      text: inputText,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    // Simulate AI processing response
    setTimeout(() => {
      const aiReplyText = processResponse(userMessage.text);
      const aiMessage: Message = {
        sender: "spark",
        text: aiReplyText,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, aiMessage]);
      speakText(aiReplyText);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-2xl text-foreground font-sans"
      >
        {/* Floating gradient ambient background glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-success/5 blur-[150px] pointer-events-none" />

        {/* Modal Header */}
        <header className="relative flex items-center justify-between border-b border-border/50 px-6 py-4.5 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 text-accent-foreground">
              <span className="absolute inset-0 rounded-lg bg-accent/20 blur-xs animate-pulse" />
              <Sparkles className="w-4 h-4 relative" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight flex items-center gap-1.5">
                Spark Studio AI Assistant
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mt-0.5" />
              </h2>
              <p className="text-xs text-muted-foreground">Connected to Tech Insights Nigeria</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mute/Voice Toggle */}
            <button
              onClick={() => {
                const newMute = !isMuted;
                setIsMuted(newMute);
                if (newMute && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              className={`p-2.5 rounded-xl border border-border/80 bg-accent/5 transition-all duration-200 hover:bg-accent/10 active:scale-95 text-muted-foreground hover:text-foreground ${!isMuted ? "text-accent-foreground bg-accent/10 border-accent/20" : ""}`}
              title={isMuted ? "Unmute Voice" : "Mute Voice"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl border border-border/80 bg-accent/5 transition-all duration-200 hover:bg-accent/10 active:scale-95 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Messages Chat Area */}
        <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-none">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const isSpark = msg.sender === "spark";
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`flex gap-3.5 ${isSpark ? "justify-start" : "justify-end"}`}
                >
                  {isSpark && (
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-accent/10 border border-accent/20 text-accent-foreground flex items-center justify-center shadow-md">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`
                      max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-lg
                      ${
                        isSpark
                          ? "bg-card border border-border/60 text-foreground"
                          : "bg-accent/15 border border-accent/30 text-foreground"
                      }
                    `}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <span className="block text-[10px] text-muted-foreground mt-2 text-right">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {!isSpark && (
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-foreground/10 border border-foreground/20 text-foreground flex items-center justify-center shadow-md">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Bar Area */}
        <footer className="border-t border-border/50 bg-card/45 backdrop-blur-md px-6 py-6.5">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            {/* Input wrap */}
            <div className="relative flex-1 flex items-center bg-input-background border border-border rounded-2xl overflow-hidden focus-within:border-accent/50 transition-all duration-300">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Listening to your voice..." : "Ask Spark about your workspace..."}
                disabled={isRecording}
                className="w-full bg-transparent px-5 py-4 text-sm outline-none border-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />

              {/* Dictation animation overlay */}
              {isRecording && (
                <div className="absolute inset-0 bg-accent/5 flex items-center justify-center gap-1.5 pointer-events-none animate-pulse">
                  <AudioLines className="w-5 h-5 text-accent-foreground" />
                  <span className="text-xs text-accent-foreground font-medium uppercase tracking-widest animate-pulse">Recording Speech...</span>
                </div>
              )}
            </div>

            {/* Mic / Dictation button */}
            <button
              onClick={toggleRecording}
              className={`
                relative p-4 rounded-2xl border transition-all duration-300 active:scale-95 overflow-hidden shrink-0 cursor-pointer
                ${isRecording 
                  ? "bg-destructive/10 border-destructive/30 text-destructive shadow-md shadow-destructive/5" 
                  : "bg-input-background border-border text-muted-foreground hover:text-foreground hover:border-border-hover"
                }
              `}
              title={isRecording ? "Stop Listening" : "Speak to Spark"}
            >
              {isRecording && (
                <span className="absolute inset-0 bg-destructive/10 animate-ping rounded-2xl" />
              )}
              <Mic className="w-5 h-5 relative" />
            </button>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={isRecording}
              className="p-4 rounded-2xl bg-foreground text-background transition-all duration-300 active:scale-95 disabled:opacity-50 hover:bg-foreground/90 shrink-0 cursor-pointer shadow-md shadow-black/25"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
