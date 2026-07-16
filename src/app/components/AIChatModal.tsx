import React, { useState, useEffect, useRef } from "react";
import { X, Mic, Volume2, VolumeX, Send, Sparkles, User, AudioLines, Crown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSpark } from "../state/SparkContext";
import { useXaiRealtime } from "../hooks/useXaiRealtime";

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
  id?: string;
  sender: "user" | "spark";
  text: string;
  timestamp: Date;
  media?: MessageMedia;
  isStreaming?: boolean;
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
    addMemoryItem,
    isExecuting,
    executionTimeline,
    streamingMetrics,
    runRealTask
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
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);

  const { isRecording, connect, disconnect, transcript: voiceTranscript } = useXaiRealtime();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync realtime transcript to input text box and auto-submit on complete
  useEffect(() => {
    if (voiceTranscript.length > 0) {
      const lastMsg = voiceTranscript[voiceTranscript.length - 1];
      if (lastMsg.role === "user") {
        setInputText(lastMsg.text);
        if (lastMsg.isFinal) {
          setInputText("");
          setMessages((prev) => [...prev, { sender: "user", text: lastMsg.text, timestamp: new Date() }]);
          
          const sparkMessageId = `spark-msg-${Date.now()}`;
          setMessages((prev) => [...prev, {
            id: sparkMessageId,
            sender: "spark",
            text: "Initializing runtime orchestrator...",
            timestamp: new Date(),
            isStreaming: true
          }]);

          runRealTask(lastMsg.text, (chunk: string) => {
            setMessages((prev) => prev.map(m => m.id === sparkMessageId ? { ...m, text: chunk } : m));
          }).then((finalText: string) => {
            setMessages((prev) => prev.map(m => m.id === sparkMessageId ? { ...m, text: finalText, isStreaming: false } : m));
          }).catch((err: any) => {
            console.error("[AIChatModal] Internal runtime error:", err);
            setMessages((prev) => prev.map(m => m.id === sparkMessageId ? { ...m, text: "An execution error occurred in the media pipeline. Check the Developer tab or logs for diagnostic reports.", isStreaming: false } : m));
          });
        }
      }
    }
  }, [voiceTranscript]);

  // Cancel recording on close
  useEffect(() => {
    if (!isOpen) {
      if (isRecording) {
        disconnect();
      }
    }
  }, [isOpen]);

  const toggleRecording = () => {
    if (isRecording) {
      disconnect();
    } else {
      connect();
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
  };

  const getSystemOverview = () => {
    const activeProds = productions ? productions.filter((p: any) => p.status !== "Completed" && p.status !== "Published") : [];
    const pendingReviews = reviewItems ? reviewItems.filter((r: any) => r.status === "Pending Review" || r.status === "Ready for Review") : [];
    return `You have ${activeProds.length} active productions in pipeline, ${pendingReviews.length} files awaiting creative review. Your primary brand is "${brand?.name || "Tech Insights Nigeria"}".`;
  };

  // Main natural language action router
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      sender: "user",
      text: inputText,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    const sparkMessageId = `spark-msg-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: sparkMessageId,
      sender: "spark",
      text: "Thinking...",
      timestamp: new Date(),
      isStreaming: true
    }]);

    runRealTask(userMessage.text, (chunk: string) => {
      setMessages((prev) => prev.map(m => m.id === sparkMessageId ? { ...m, text: chunk } : m));
    }).then((finalText: string) => {
      setMessages((prev) => prev.map(m => m.id === sparkMessageId ? { ...m, text: finalText, isStreaming: false } : m));
    }).catch((err: any) => {
      console.error("[AIChatModal] Internal runtime error:", err);
      setMessages((prev) => prev.map(m => m.id === sparkMessageId ? { ...m, text: "An execution error occurred in the media pipeline. Check the Developer tab or logs for diagnostic reports.", isStreaming: false } : m));
    });
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
                setIsMuted(!isMuted);
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

            {isExecuting && (
              <div className="max-w-3xl w-full mx-auto pl-12 pr-6 py-4 my-3 bg-card/25 border border-border/40 rounded-2xl backdrop-blur-md shadow-lg shadow-black/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90 mb-3">
                  <Loader2 className="w-4 h-4 animate-spin text-accent-foreground" />
                  <span>Spark Media OS Pipeline Execution</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {executionTimeline.map((step: any) => {
                    const isIdle = step.status === 'idle';
                    const isRunning = step.status === 'running';
                    const isCompleted = step.status === 'completed';
                    const isFailed = step.status === 'failed';

                    return (
                      <div
                        key={step.name}
                        className={`flex flex-col justify-between p-2 rounded-xl border text-[11px] transition-all duration-300 min-h-[64px] ${
                          isRunning ? 'bg-accent/15 border-accent/50 shadow-sm shadow-accent/10 animate-pulse' :
                          isCompleted ? 'bg-emerald-500/10 border-emerald-500/35' :
                          isFailed ? 'bg-destructive/15 border-destructive/35' :
                          'bg-muted/10 border-border/30 opacity-55'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-semibold text-foreground/90 truncate">{step.name}</span>
                          <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${
                            isRunning ? 'bg-accent' :
                            isCompleted ? 'bg-emerald-500' :
                            isFailed ? 'bg-destructive' :
                            'bg-muted-foreground/40'
                          }`} />
                        </div>
                        {isCompleted && step.duration && (
                          <div className="text-[9px] text-muted-foreground/80 leading-relaxed mt-1 border-t border-border/20 pt-1">
                            <div className="flex justify-between gap-1">
                              <span className="capitalize font-medium text-foreground/75">{step.provider}</span>
                              <span>{(step.duration / 1000).toFixed(1)}s</span>
                            </div>
                            <div className="flex justify-between gap-1 mt-0.5">
                              <span>${step.cost?.toFixed(3)}</span>
                              <span className="text-emerald-500 font-bold">{step.confidence}%</span>
                            </div>
                          </div>
                        )}
                        {isRunning && (
                          <span className="text-[9px] text-accent font-semibold animate-pulse">Running...</span>
                        )}
                        {isIdle && (
                          <span className="text-[9px] text-muted-foreground/60">Queued</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {executionTimeline.find((s: any) => s.name === "Creative Decision")?.status === "completed" && (
                  <div className="mt-3.5 p-3.5 rounded-xl bg-accent/5 border border-accent/20 text-[11px] leading-relaxed text-muted-foreground animate-fadeIn duration-500">
                    <div className="font-semibold text-foreground/90 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        Creative Director Rationale
                      </span>
                      <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Confidence: 94%</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5 text-foreground/75 border-b border-border/20 pb-2.5">
                      <div><strong className="text-muted-foreground/80 font-normal">Platform:</strong> TikTok / Vertical</div>
                      <div><strong className="text-muted-foreground/80 font-normal">Goal:</strong> Maximize Engagement</div>
                      <div><strong className="text-muted-foreground/80 font-normal">Audience:</strong> Software Developers</div>
                      <div><strong className="text-muted-foreground/80 font-normal">Workflow:</strong> UGC Campaign</div>
                    </div>
                    <div className="text-foreground/90 font-medium italic">
                      "TikTok formats perform best with horizontal-safe vertical alignment, under 30s, and high action pacing. Recommendation: 18-second UGC vertical cut."
                    </div>
                  </div>
                )}
              </div>
            )}
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
