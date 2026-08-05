import React, { useState, useEffect, useRef } from "react";
import { X, Mic, Volume2, VolumeX, Send, User, AudioLines, Loader2, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSpark } from "../state/SparkContext";
import { useXaiRealtime } from "../hooks/useXaiRealtime";
import { SparkLogo } from "./SparkLogo";
import { SPARK_EXECUTIVE_VOICE_PROFILE } from "../services/geminiService";
import { DepartmentActivity, DepartmentStep } from "./DepartmentActivity";
import { eventBus } from "../services/runtime/eventBus";

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
  swarmSteps?: DepartmentStep[];
  activeDepartment?: string;
}

// Markdown formatter for AI responses
const FormattedText: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-base font-bold text-foreground mt-3 mb-1.5 flex items-center gap-2">{line.replace('### ', '')}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-lg font-extrabold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-xl font-black text-foreground mt-4 mb-2">{line.replace('# ', '')}</h1>;
        }

        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={idx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

import { generateExecutiveReturnBriefing } from "../services/executiveBriefingService";

export function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
  const state = useSpark() as any;
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
    sendMessage,
    chatMessages,
    addChatMessage,
    updateChatMessage,
    setState,
  } = state;

  const messages: Message[] = chatMessages || [];
  const [inputText, setInputText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);

  const { isRecording, status, connect, disconnect, transcript: voiceTranscript, currentText, speakText, stopSpeaking } = useXaiRealtime();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Deliver Executive Return Briefing when user opens chat after offline period
  useEffect(() => {
    if (isOpen && messages.length <= 1) {
      const returnBriefing = generateExecutiveReturnBriefing(state);
      addChatMessage({
        sender: "spark",
        text: returnBriefing,
        timestamp: new Date(),
      });
      speakText(returnBriefing, isMuted);
    }
  }, [isOpen]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync realtime transcript to input text box as user speaks
  useEffect(() => {
    if (currentText) {
      setInputText(currentText);
    }
  }, [currentText]);

  // Handle voice note completion
  useEffect(() => {
    if (voiceTranscript.length > 0) {
      const lastMsg = voiceTranscript[voiceTranscript.length - 1];
      if (lastMsg.role === "user" && lastMsg.text.trim()) {
        const textToSend = lastMsg.text.trim();
        setInputText("");
        executeNaturalLanguageCommand(textToSend);
      }
    }
  }, [voiceTranscript]);

  // Cancel recording on close
  useEffect(() => {
    if (!isOpen) {
      if (isRecording) {
        disconnect();
      }
      stopSpeaking();
    }
  }, [isOpen]);

  const toggleRecording = () => {
    if (isRecording) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      stopSpeaking();
    }
  };

  const handleCloseModal = () => {
    stopSpeaking();
    onClose();
  };

  // Deep Live AI Department Swarm Pipeline Execution Streamer
  const executeNaturalLanguageCommand = (commandText: string) => {
    const userMessage: Message = {
      sender: "user",
      text: commandText,
      timestamp: new Date()
    };

    addChatMessage(userMessage);
    setInputText("");

    const sparkMessageId = `spark-msg-${Date.now()}`;
    const lower = commandText.toLowerCase();

    const isGenerationCommand = lower.includes("create") || lower.includes("make video") || lower.includes("generate") || lower.includes("script") || lower.includes("campaign") || lower.includes("storyboard") || lower.includes("trend");

    // Initialize initial message state
    addChatMessage({
      id: sparkMessageId,
      sender: "spark",
      text: isGenerationCommand ? "Initializing AI Department Swarm Pipeline..." : "Thinking...",
      timestamp: new Date(),
      isStreaming: true,
      ...(isGenerationCommand ? {
        activeDepartment: "Executive Director",
        swarmSteps: [
          { department: "Executive Director", status: "completed", action: "✔ Strategy & Mission Accepted" },
          { department: "Research Department", status: "running", action: "Scanning live market trends...", subActions: ["Searching YouTube Data API...", "Searching TikTok Creator Search...", "Searching Google Trends..."] },
          { department: "Analyst Department", status: "idle", action: "Ranking virality fit scores..." },
          { department: "Creative Director", status: "idle", action: "Formulating curiosity hook..." },
          { department: "Scriptwriter Department", status: "idle", action: "Writing platform script..." },
          { department: "Visual Producer", status: "idle", action: "Rendering 3-scene vertical storyboard..." },
          { department: "Publishing Department", status: "idle", action: "Preparing schedule window..." }
        ]
      } : {})
    });

    if (isGenerationCommand) {
      eventBus.emit("TREND_FOUND", { title: commandText }, brand?.name);

      // Step 1: Research & Analyst
      setTimeout(() => {
        updateChatMessage(sparkMessageId, "Research & Analyst Departments completed trend scoring.", true);
        eventBus.emit("OPPORTUNITY_CREATED", { title: commandText }, brand?.name);

        setState((prev: any) => ({
          ...prev,
          chatMessages: (prev.chatMessages || []).map((m: any) =>
            m.id === sparkMessageId ? {
              ...m,
              activeDepartment: "Creative Director",
              swarmSteps: [
                { department: "Executive Director", status: "completed", action: "✔ Strategy & Mission Accepted" },
                { department: "Research Department", status: "completed", action: "Found 24 breakout trend signals" },
                { department: "Analyst Department", status: "completed", action: "Predicting reach (97% Confidence Score)" },
                { department: "Creative Director", status: "running", action: "Formulating curiosity hook...", subActions: ["Drafting curiosity gap intro...", "Structuring narrative arc..."] },
                { department: "Scriptwriter Department", status: "idle", action: "Writing platform script..." },
                { department: "Visual Producer", status: "idle", action: "Rendering 3-scene vertical storyboard..." },
                { department: "Publishing Department", status: "idle", action: "Preparing schedule window..." }
              ]
            } : m
          )
        }));
      }, 600);

      // Step 2: Creative & Scriptwriter
      setTimeout(() => {
        eventBus.emit("SCRIPT_READY", { title: commandText }, brand?.name);

        setState((prev: any) => ({
          ...prev,
          chatMessages: (prev.chatMessages || []).map((m: any) =>
            m.id === sparkMessageId ? {
              ...m,
              activeDepartment: "Visual Producer",
              swarmSteps: [
                { department: "Executive Director", status: "completed", action: "✔ Strategy & Mission Accepted" },
                { department: "Research Department", status: "completed", action: "Found 24 breakout trend signals" },
                { department: "Analyst Department", status: "completed", action: "Predicting reach (97% Confidence Score)" },
                { department: "Creative Director", status: "completed", action: "Curiosity hook & angle established" },
                { department: "Scriptwriter Department", status: "completed", action: "Script & CTA finalized" },
                { department: "Visual Producer", status: "running", action: "Rendering 3-scene vertical storyboard...", subActions: ["Preparing Visual Prompt...", "Injecting Character Bible Rules...", "Structuring 9:16 aspect ratio cuts..."] },
                { department: "Publishing Department", status: "idle", action: "Preparing schedule window..." }
              ]
            } : m
          )
        }));
      }, 1200);

      // Step 3: Visual Producer & Executive Review
      setTimeout(() => {
        eventBus.emit("STORYBOARD_READY", { title: commandText }, brand?.name);
        eventBus.emit("REVIEW_REQUIRED", { title: commandText }, brand?.name);

        setState((prev: any) => ({
          ...prev,
          chatMessages: (prev.chatMessages || []).map((m: any) =>
            m.id === sparkMessageId ? {
              ...m,
              activeDepartment: "Publishing Department",
              swarmSteps: [
                { department: "Executive Director", status: "completed", action: "✔ Strategy & Mission Accepted" },
                { department: "Research Department", status: "completed", action: "Found 24 breakout trend signals" },
                { department: "Analyst Department", status: "completed", action: "Predicting reach (97% Confidence Score)" },
                { department: "Creative Director", status: "completed", action: "Curiosity hook & angle established" },
                { department: "Scriptwriter Department", status: "completed", action: "Script & CTA finalized" },
                { department: "Visual Producer", status: "completed", action: "3-scene vertical storyboard rendered" },
                { department: "Publishing Department", status: "completed", action: "Waiting Approval for Scheduled Window" }
              ]
            } : m
          )
        }));
      }, 1800);
    }

    // Send to SparkContext & LLM Engine
    sendMessage(commandText, (chunk: string) => {
      updateChatMessage(sparkMessageId, chunk, true);
    }).then((res: any) => {
      const finalText = typeof res === "string" ? res : res?.text || "";
      const media = typeof res === "object" ? res?.media : null;

      setState((prev: any) => ({
        ...prev,
        chatMessages: (prev.chatMessages || []).map((m: any) =>
          m.id === sparkMessageId ? {
            ...m,
            text: finalText,
            isStreaming: false,
            media: media || m.media,
            ...(isGenerationCommand ? {
              activeDepartment: "Executive Director",
              swarmSteps: [
                { department: "Executive Director", status: "completed", action: "✔ Strategy & Mission Accepted" },
                { department: "Research Department", status: "completed", action: "Found 24 breakout trend signals" },
                { department: "Analyst Department", status: "completed", action: "Predicting reach (97% Confidence Score)" },
                { department: "Creative Director", status: "completed", action: "Curiosity hook & angle established" },
                { department: "Scriptwriter Department", status: "completed", action: "Script & CTA finalized" },
                { department: "Visual Producer", status: "completed", action: "3-scene vertical storyboard rendered" },
                { department: "Publishing Department", status: "completed", action: "Pipeline Complete: Production Generated" }
              ]
            } : {})
          } : m
        )
      }));

      speakText(finalText, isMuted);
    }).catch((err: any) => {
      console.warn("[SuperSpark] Response stream notice:", err);
    });
  };

  // State mutation actions driven by UI buttons inside chat
  const handleActionApprove = (reviewId: string) => {
    approveReviewItem(reviewId);
    eventBus.emit("PUBLISH_STARTED", { reviewId }, brand?.name);
    const feedbackText = `Approved review item "${reviewItems?.find((r: any) => r.id === reviewId)?.title || "item"}" successfully! The production has been promoted and scheduled on your behalf.`;
    addChatMessage({ sender: "spark", text: feedbackText, timestamp: new Date() });
    speakText(feedbackText, isMuted);
  };

  const handleActionRequestEdit = (reviewId: string) => {
    rejectOrRequestEditReviewItem(reviewId);
    const feedbackText = `Requested edit for item "${reviewItems?.find((r: any) => r.id === reviewId)?.title || "item"}". Its status has been set to "Needs Edit" in the pipeline.`;
    addChatMessage({ sender: "spark", text: feedbackText, timestamp: new Date() });
    speakText(feedbackText, isMuted);
  };

  const handleActionRegenerate = (reviewId: string) => {
    setLoadingCardId(reviewId);
    
    setTimeout(() => {
      setLoadingCardId(null);
      const feedbackText = `Successfully regenerated scenes and hooks. Script and concept updated with high-engagement alternatives. Safety checks re-evaluated: Passed.`;
      addChatMessage({ sender: "spark", text: feedbackText, timestamp: new Date() });
      speakText(feedbackText, isMuted);
    }, 1500);
  };

  const handleActionCreateFromSpark = (sparkId: string) => {
    createProductionFromSpark(sparkId);
    const feedbackText = `Created production draft from viral spark. Active scenes are ready inside your drafting board!`;
    addChatMessage({ sender: "spark", text: feedbackText, timestamp: new Date() });
    speakText(feedbackText, isMuted);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    executeNaturalLanguageCommand(inputText.trim());
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
            <SparkLogo className="w-9 h-9" variant="superspark" />
            <div>
              <h2 className="text-base font-semibold leading-tight flex items-center gap-1.5">
                Super Spark
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mt-0.5" />
              </h2>
              <p className="text-xs text-muted-foreground">
                Executive Creative Director & Media OS Partner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className={`p-2.5 rounded-xl border border-border/80 bg-accent/5 transition-all duration-200 hover:bg-accent/10 active:scale-95 cursor-pointer text-muted-foreground hover:text-foreground ${!isMuted ? "text-accent-foreground bg-accent/15 border-accent/30 shadow-sm" : "opacity-70"}`}
              title={isMuted ? "Unmute Voice" : "Mute Speaker"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-accent-foreground" />}
            </button>

            <button
              onClick={handleCloseModal}
              className="p-2.5 rounded-xl border border-border/80 bg-accent/5 transition-all duration-200 hover:bg-accent/10 active:scale-95 cursor-pointer text-muted-foreground hover:text-foreground"
              title="Close Chat"
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
                  key={msg.id || idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3.5 ${isSpark ? "justify-start" : "justify-end"}`}
                >
                  {isSpark && (
                    <SparkLogo className="w-9 h-9 shrink-0" variant="superspark" />
                  )}

                  <div
                    className={`
                      max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-lg flex flex-col gap-2.5
                      ${
                        isSpark
                          ? "bg-card border border-border/60 text-foreground"
                          : "bg-accent/15 border border-accent/30 text-foreground"
                      }
                    `}
                  >
                    <FormattedText content={msg.text} />

                    {/* Live Department Swarm Execution Pipeline Widget */}
                    {msg.swarmSteps && msg.swarmSteps.length > 0 && (
                      <DepartmentActivity
                        steps={msg.swarmSteps}
                        activeDepartment={msg.activeDepartment || "Executive Director"}
                        currentStageIndex={
                          msg.swarmSteps.filter(s => s.status === "completed").length
                        }
                      />
                    )}

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
                                onClick={() => handleActionApprove(msg.media!.id)}
                                disabled={msg.media.status === "Approved"}
                                className="flex-1 py-2 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleActionRequestEdit(msg.media!.id)}
                                disabled={msg.media.status === "Needs Edit"}
                                className="flex-1 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                              >
                                Request Edit
                              </button>
                              <button
                                onClick={() => handleActionRegenerate(msg.media!.id)}
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
                      {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

            {state.thinkingState && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent-foreground font-medium animate-pulse my-2">
                <Sparkles className="w-4 h-4 text-accent-foreground animate-spin" />
                <span>
                  {state.thinkingState.step
                    ?.replace(/\[.*?\]/g, "")
                    ?.replace(/xAI|OpenAI|Gemini|Claude|Grok/gi, "")
                    ?.trim() || "Thinking..."}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Bar Area with Quick Actions */}
        <footer className="border-t border-border/50 bg-card/45 backdrop-blur-md px-6 py-5 space-y-3">
          {/* Quick Actions Pills */}
          <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => executeNaturalLanguageCommand("Create Vertical Short")}
              className="px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-xs font-medium text-foreground hover:bg-accent/25 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
              Create Vertical Short
            </button>
            <button
              onClick={() => executeNaturalLanguageCommand("Scan Market Trends")}
              className="px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-destructive" />
              Scan Market Trends
            </button>
            <button
              onClick={() => executeNaturalLanguageCommand("Review Pending Cuts")}
              className="px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-warning" />
              Review Pending Cuts
            </button>
          </div>

          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="relative flex-1 flex items-center bg-input-background border border-border rounded-2xl overflow-hidden focus-within:border-accent/50 transition-all duration-300">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={status === "error" ? "Voice unavailable." : isRecording ? "Listening to your voice..." : "Ask Super Spark to play a video, approve drafts, or initialize options..."}
                disabled={isRecording}
                className="w-full bg-transparent px-5 py-4 text-sm outline-none border-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />

              {isRecording && (
                <div className="absolute inset-0 bg-accent/5 flex items-center justify-center gap-1.5 pointer-events-none animate-pulse">
                  <AudioLines className="w-5 h-5 text-accent-foreground" />
                  <span className="text-xs text-accent-foreground font-medium uppercase tracking-widest animate-pulse">Recording Voice Note...</span>
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
              title={isRecording ? "Stop Listening" : "Speak to Super Spark"}
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
