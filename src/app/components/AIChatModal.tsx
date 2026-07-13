import React, { useState, useEffect, useRef } from "react";
import { X, Mic, Volume2, VolumeX, Send, Sparkles, User, AudioLines, Crown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSpark } from "../state/SparkContext";

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MessageMedia {
  type: "video" | "storyboard" | "opportunity";
  id: string;
  title: string;
  videoUrl?: string;
  status: string;
  concept?: string;
  meta?: string;
}

interface Message {
  sender: "user" | "spark";
  text: string;
  timestamp: Date;
  media?: MessageMedia;
}

export function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
  const {
    brand,
    productions,
    reviewItems,
    accounts,
    character,
    approveReviewItem,
    rejectOrRequestEditReviewItem,
    createProductionFromSpark,
    updateAutomationMode,
    addMemoryItem
  } = useSpark() as any;

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "spark",
      text: `Hello! I am Spark, your Media OS AI Assistant. I have indexed your brand voice rules and channel metrics.

I notice you have a hot opportunity: **"How Nigerian Creators Are Using AI"** (97% fit). I also found **2 creative reviews** awaiting your approval. 

How can I help you operate your workspace today?`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);

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
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.includes("en-NG") || v.lang.includes("en-GB") || v.lang.includes("en-US"));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.rate = 1.05;
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

  // State mutation actions driven by AI agent
  const handleActionApprove = (reviewId: string, msgIndex: number) => {
    // Perform live update in SparkContext
    approveReviewItem(reviewId);

    // Update message card state dynamically
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === msgIndex && msg.media
          ? { ...msg, media: { ...msg.media, status: "Approved" } }
          : msg
      )
    );

    const feedbackText = `Approved review item "${reviewItems.find((r: any) => r.id === reviewId)?.title || "item"}" successfully! The production has been promoted and scheduled on your behalf.`;
    setMessages((prev) => [
      ...prev,
      { sender: "spark", text: feedbackText, timestamp: new Date() }
    ]);
    speakText(feedbackText);
  };

  const handleActionRequestEdit = (reviewId: string, msgIndex: number) => {
    // Perform live update in SparkContext
    rejectOrRequestEditReviewItem(reviewId);

    // Update message card state dynamically
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === msgIndex && msg.media
          ? { ...msg, media: { ...msg.media, status: "Needs Edit" } }
          : msg
      )
    );

    const feedbackText = `Requested edit for item "${reviewItems.find((r: any) => r.id === reviewId)?.title || "item"}". Its status has been set to "Needs Edit" in the pipeline.`;
    setMessages((prev) => [
      ...prev,
      { sender: "spark", text: feedbackText, timestamp: new Date() }
    ]);
    speakText(feedbackText);
  };

  const handleActionRegenerate = (reviewId: string, msgIndex: number) => {
    setLoadingCardId(reviewId);
    
    // Simulate generation delay
    setTimeout(() => {
      setLoadingCardId(null);
      
      const alternativeHooks = [
        "I analyzed 12 top-performing campaigns, and they all shared this single pattern...",
        "Here is the secret algorithm behind Lagos creator success that they never share...",
        "Before you post your next video, make sure you hook them with this curiosity method..."
      ];
      const newHook = alternativeHooks[Math.floor(Math.random() * alternativeHooks.length)];

      setMessages((prev) =>
        prev.map((msg, i) =>
          i === msgIndex && msg.media
            ? { ...msg, media: { ...msg.media, concept: newHook, status: "Pending Review" } }
            : msg
        )
      );

      const feedbackText = `Successfully regenerated scenes and hooks. Script and concept updated with high-engagement alternatives. Safety checks re-evaluated: Passed.`;
      setMessages((prev) => [
        ...prev,
        { sender: "spark", text: feedbackText, timestamp: new Date() }
      ]);
      speakText(feedbackText);
    }, 1500);
  };

  const handleActionCreateFromSpark = (sparkId: string) => {
    const targetSpark = Sparkles;
    createProductionFromSpark(sparkId);
    
    const feedbackText = `Created production draft from viral spark "${productions.find((p: any) => p.sparkId === sparkId)?.title || "AI Media Empires"}". You will find the active scenes ready inside your drafting board!`;
    setMessages((prev) => [
      ...prev,
      { sender: "spark", text: feedbackText, timestamp: new Date() }
    ]);
    speakText(feedbackText);
  };

  const getSystemOverview = () => {
    const activeProds = productions ? productions.filter((p: any) => p.status !== "Completed" && p.status !== "Published") : [];
    const pendingReviews = reviewItems ? reviewItems.filter((r: any) => r.status === "Pending Review" || r.status === "Ready for Review") : [];
    return `You have ${activeProds.length} active productions in pipeline, ${pendingReviews.length} files awaiting creative review. Your primary brand is "${brand?.name || "Tech Insights Nigeria"}".`;
  };

  // Main natural language action router
  const processResponse = (query: string) => {
    const q = query.toLowerCase();
    let text = "";
    let media: MessageMedia | undefined = undefined;

    // A. APPROVE action via text command
    if (q.includes("approve") && (q.includes("tactics") || q.includes("r1") || q.includes("marketing"))) {
      approveReviewItem("r1");
      text = `I have successfully approved "5 Viral Marketing Tactics That Actually Work in 2026" on your behalf. The publishing queue has updated!`;
      speakText(text);
      setMessages((prev) => [...prev, { sender: "spark", text, timestamp: new Date() }]);
      return;
    }
    if (q.includes("approve") && (q.includes("psychology") || q.includes("r2"))) {
      approveReviewItem("r2");
      text = `I have successfully approved "The Psychology Behind Viral Content" on your behalf. The publishing queue has updated!`;
      speakText(text);
      setMessages((prev) => [...prev, { sender: "spark", text, timestamp: new Date() }]);
      return;
    }

    // B. CREATE production action via text command
    if (q.includes("create") || q.includes("initialize") || q.includes("start")) {
      if (q.includes("empires") || q.includes("nigerian creators") || q.includes("s1")) {
        createProductionFromSpark("s1");
        text = `Initialized new storyboard and production draft for "How Nigerian Creators Are Using AI to Build Media Empires". Check your drafting board!`;
        speakText(text);
        setMessages((prev) => [...prev, { sender: "spark", text, timestamp: new Date() }]);
        return;
      }
    }

    // C. FETCH VIDEO / MEDIA REQUESTS
    if (q.includes("video") || q.includes("preview") || q.includes("storyboard") || q.includes("play") || q.includes("watch")) {
      if (q.includes("marketing") || q.includes("tactics") || q.includes("r1")) {
        const item = reviewItems.find((r: any) => r.id === "r1") || { title: "5 Viral Marketing Tactics That Actually Work in 2026", status: "Pending Review", conceptText: "Unpack 5 unconventional growth models used by the top 1% of creators." };
        text = `Here is the current draft and review status for: **5 Viral Marketing Tactics That Actually Work in 2026**. Watch the video preview below and trigger pipeline actions directly:`;
        media = {
          type: "video",
          id: "r1",
          title: item.title,
          status: item.status,
          videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-matrix-style-computer-code-running-9114-large.mp4",
          concept: item.conceptText || item.openingMoment,
          meta: "Channel: YouTube | Aspect: 16:9 | Length: 2m 15s"
        };
      } else if (q.includes("psychology") || q.includes("viral content") || q.includes("r2")) {
        const item = reviewItems.find((r: any) => r.id === "r2") || { title: "The Psychology Behind Viral Content", status: "Pending Review", conceptText: "Explain cognitive loopholes and curiosity gaps." };
        text = `Here is the preview and details for: **The Psychology Behind Viral Content**. Play the clip directly in the bubble and approve it to schedule:`;
        media = {
          type: "video",
          id: "r2",
          title: item.title,
          status: item.status,
          videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smartphone-over-a-keyboard-41315-large.mp4",
          concept: item.conceptText || item.openingMoment,
          meta: "Channel: TikTok | Aspect: 9:16 | Length: 58s"
        };
      } else if (q.includes("free tools") || q.includes("r3") || q.includes("creator needs")) {
        text = `Here is the vertical edit for: **Free Tools Every Creator Needs**. Ready for final distribution approval:`;
        media = {
          type: "video",
          id: "r3",
          title: "Free Tools Every Creator Needs",
          status: "Pending Review",
          videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-slow-movement-of-waves-on-the-shore-43405-large.mp4",
          concept: "Show ₦500K → ₦0 software comparison values on screen.",
          meta: "Channel: TikTok | Aspect: 9:16 | Length: 45s"
        };
      } else {
        // Fallback list of reviews
        text = `I couldn't find a specific video match. Here is the active opportunity from your signal feeds. Would you like to initialize its storyboard?`;
        media = {
          type: "opportunity",
          id: "s1",
          title: "How Nigerian Creators Are Using AI to Build Media Empires",
          status: "Hot Opportunity",
          concept: "\"I replaced my entire production team with one AI tool — and tripled output.\"",
          meta: "Velocity: +182% | Brand Fit: 97% | Category: Hot"
        };
      }
      speakText(text);
      setMessages((prev) => [...prev, { sender: "spark", text, media, timestamp: new Date() }]);
      return;
    }

    // D. REVENUE & STATS
    if (q.includes("revenue") || q.includes("money") || q.includes("earnings")) {
      text = `We tracked $142K in revenue this month, which is up 24.5% compared to last month. All channel monetization streams are performing optimally.`;
    } else if (q.includes("views") || q.includes("traffic") || q.includes("analytics")) {
      text = `Across all accounts, we have hit 24.8M views this month (up by 18.2%). The top performer was the "How AI Creates Viral Content" video.`;
    } else if (q.includes("brand") || q.includes("niche") || q.includes("audience")) {
      text = `Your active brand workspace is "${brand?.name}" targeting "${brand?.audience?.primary}". Our main focus is "${brand?.niche}" using an "${brand?.archetype}" voice style.`;
    } else if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
      text = `Hello! I'm Spark, your brand's AI Media Assistant. ${getSystemOverview()} Ask me to show a video, approve drafts, or initialize new opportunities.`;
    } else {
      text = `I am analyzing your request. I can pull video files, approve/edit drafts, or check view statistics. Try saying: "Show me the video for marketing tactics" or "What should I do today?".`;
    }

    speakText(text);
    setMessages((prev) => [...prev, { sender: "spark", text, timestamp: new Date() }]);
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

    setTimeout(() => {
      processResponse(userMessage.text);
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
                Spark Studio AI Agent
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mt-0.5" />
              </h2>
              <p className="text-xs text-muted-foreground">Operating with Pro Workspace Credentials</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            {messages.map((msg, idx) => {
              const isSpark = msg.sender === "spark";
              return (
                <motion.div
                  key={idx}
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
                      max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-lg flex flex-col gap-2
                      ${
                        isSpark
                          ? "bg-card border border-border/60 text-foreground"
                          : "bg-accent/15 border border-accent/30 text-foreground"
                      }
                    `}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Interactive Media Card Attachment */}
                    {msg.media && (
                      <div className="relative mt-2.5 rounded-xl border border-border/80 bg-background/50 p-4 space-y-3.5 overflow-hidden">
                        {loadingCardId === msg.media.id && (
                          <div className="absolute inset-0 bg-background/90 z-30 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-6 h-6 text-accent-foreground animate-spin" />
                            <span className="text-[10px] font-bold text-accent-foreground uppercase tracking-widest animate-pulse">Regenerating assets...</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs font-semibold truncate flex-1 leading-snug">{msg.media.title}</h4>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border shrink-0 ${
                            msg.media.status === "Approved" ? "bg-success/10 text-success border-success/20" :
                            msg.media.status === "Needs Edit" ? "bg-destructive/10 text-destructive border-destructive/20" :
                            "bg-warning/10 text-warning border-warning/20"
                          }`}>
                            {msg.media.status}
                          </span>
                        </div>

                        {msg.media.type === "video" && msg.media.videoUrl && (
                          <div className="relative rounded-lg overflow-hidden border border-border/40 aspect-video bg-black flex items-center justify-center">
                            <video
                              src={msg.media.videoUrl}
                              controls
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {msg.media.concept && (
                          <div className="text-[11px] leading-relaxed text-muted-foreground bg-input-background/40 border border-border/40 rounded-lg p-2.5">
                            <p className="font-bold text-[9px] text-foreground/80 uppercase tracking-wider mb-1">Concept Hook & Story</p>
                            <p className="italic">"{msg.media.concept}"</p>
                          </div>
                        )}

                        {msg.media.meta && (
                          <p className="text-[10px] text-muted-foreground/85 font-medium">{msg.media.meta}</p>
                        )}

                        {/* Interactive Buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-border/30 z-20">
                          {msg.media.type === "video" && (
                            <>
                              <button
                                onClick={() => handleActionApprove(msg.media!.id, idx)}
                                disabled={msg.media.status === "Approved"}
                                className="flex-1 py-2 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleActionRequestEdit(msg.media!.id, idx)}
                                disabled={msg.media.status === "Needs Edit"}
                                className="flex-1 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                              >
                                Request Edit
                              </button>
                              <button
                                onClick={() => handleActionRegenerate(msg.media!.id, idx)}
                                className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/90 text-foreground text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                                title="Regenerate scenes"
                              >
                                Regenerate
                              </button>
                            </>
                          )}

                          {msg.media.type === "opportunity" && (
                            <button
                              onClick={() => handleActionCreateFromSpark(msg.media!.id)}
                              className="w-full py-2.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                            >
                              Initialize Production Storyboard
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <span className="block text-[10px] text-muted-foreground mt-1 text-right leading-none">
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
            <div className="relative flex-1 flex items-center bg-input-background border border-border rounded-2xl overflow-hidden focus-within:border-accent/50 transition-all duration-300">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Listening to your voice..." : "Ask Spark to play a video, approve drafts, or initialize options..."}
                disabled={isRecording}
                className="w-full bg-transparent px-5 py-4 text-sm outline-none border-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />

              {isRecording && (
                <div className="absolute inset-0 bg-accent/5 flex items-center justify-center gap-1.5 pointer-events-none animate-pulse">
                  <AudioLines className="w-5 h-5 text-accent-foreground" />
                  <span className="text-xs text-accent-foreground font-medium uppercase tracking-widest animate-pulse">Recording Speech...</span>
                </div>
              )}
            </div>

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
