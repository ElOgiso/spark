import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Mic,
  Volume2,
  VolumeX,
  Send,
  User,
  AudioLines,
  Loader2,
  Sparkles,
  CheckCircle2,
  Plus,
  Search,
  History,
  Clock,
  Trash2,
  Edit2,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSpark } from "../state/SparkContext";
import { eventBus } from "../services/runtime/eventBus";
import { useXaiRealtime } from "../hooks/useXaiRealtime";
import { SparkLogo } from "./SparkLogo";
import { SPARK_EXECUTIVE_VOICE_PROFILE } from "../services/geminiService";
import { ProductionGenerationGuard } from "../services/production/ProductionGenerationGuard";
import { DepartmentActivity, DepartmentStep } from "./DepartmentActivity";
import { ConversationSession, GenerationCreditSettings, DEFAULT_CREDIT_SETTINGS } from "../domain/types";
import { generateExecutiveReturnBriefing } from "../services/executiveBriefingService";
import { AIProviderOrchestrator } from "../services/runtime/AIProviderOrchestrator";

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

interface MessageMedia {
  type: "video" | "storyboard" | "opportunity" | "production_status" | "research_source" | "memory_saved";
  id: string;
  title: string;
  videoUrl?: string;
  coverFrame?: string;
  url?: string;
  platform?: string;
  rule?: string;
  category?: string;
  source?: string;
  sceneCount?: number;
  duration?: string;
  status: string;
  concept?: string;
  meta?: string;
}

function formatExecutiveThinkingStep(stepText?: string): string {
  if (!stepText) return "Working on it...";
  const lower = stepText.toLowerCase();

  if (lower.includes("research") || lower.includes("url") || lower.includes("channel") || lower.includes("pattern") || lower.includes("source")) {
    return "Analyzing the source...";
  }
  if (lower.includes("production") || lower.includes("storyboard") || lower.includes("scene") || lower.includes("render")) {
    return "Preparing your production...";
  }
  if (lower.includes("connect") || lower.includes("sync") || lower.includes("network")) {
    return "Connecting your research...";
  }
  if (lower.includes("final") || lower.includes("ready") || lower.includes("complete")) {
    return "Almost ready...";
  }
  if (lower.includes("plan") || lower.includes("strategy") || lower.includes("reasoning")) {
    return "Reviewing your request...";
  }
  return "Working on it...";
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

  const lines = content.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        if (line.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-sm font-bold text-foreground mt-3 mb-1">
              {line.replace("### ", "")}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-base font-bold text-foreground mt-3 mb-1">
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={idx} className="text-xl font-black text-foreground mt-4 mb-2">
              {line.replace("# ", "")}
            </h1>
          );
        }

        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={idx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={pIdx} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

export function AIChatModal({ isOpen, onClose, onNavigate }: AIChatModalProps) {
  const sparkState = useSpark() as any;
  const {
    brand,
    productions,
    reviewItems,
    accounts,
    approveReviewItem,
    rejectOrRequestEditReviewItem,
    createProductionFromSpark,
    generateAssetsForProduction,
    updateAutomationMode,
    addMemoryItem,
    syncResearchSource,
    sendMessage,
    chatMessages,
    addChatMessage,
    updateChatMessage,
    setState,
    activeSessionId,
    sessions = [],
    startNewSession,
    switchSession,
    deleteSession,
    renameSession,
  } = sparkState;

  const messages: Message[] = chatMessages || [];
  const [inputText, setInputText] = useState("");
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);

  // Phase 19F: Dedicated Voice Mode & Read Replies Aloud Settings (Defaults to OFF after initial open greeting)
  const [readRepliesAloud, setReadRepliesAloud] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    try {
      return localStorage.getItem("spark_read_replies_aloud") === "true";
    } catch {
      return false;
    }
  });
  const isMuted = !readRepliesAloud;

  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);

  const handleToggleReadRepliesAloud = () => {
    const next = !readRepliesAloud;
    setReadRepliesAloud(next);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("spark_read_replies_aloud", String(next));
      } catch {}
    }
    if (!next) {
      stopSpeaking();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    } else {
      // User gesture unlocks iOS audio: immediately speak latest Super Spark message
      const lastSparkMessage = [...messages].reverse().find((m) => m.sender === "spark");
      if (lastSparkMessage && lastSparkMessage.text) {
        void speakText(lastSparkMessage.text, false);
      }
    }
  };

  // Phase 19C: Session History UI States (Default Closed)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);

  const { isRecording, status, connect, disconnect, transcript: voiceTranscript, currentText, speakText, stopSpeaking } = useXaiRealtime();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeSparkMsgIdRef = useRef<string | null>(null);

  // Real Event-Driven Swarm Progression listener via eventBus
  useEffect(() => {
    const updateStep = (departmentName: string, status: "idle" | "running" | "completed" | "error", actionText: string) => {
      const msgId = activeSparkMsgIdRef.current;
      if (!msgId) return;

      setState((prev: any) => ({
        ...prev,
        chatMessages: (prev.chatMessages || []).map((m: any) => {
          if (m.id !== msgId || !m.swarmSteps) return m;
          const updatedSteps = m.swarmSteps.map((step: any) => {
            if (step.department === departmentName) {
              return { ...step, status, action: actionText };
            }
            return step;
          });
          return {
            ...m,
            activeDepartment: departmentName,
            swarmSteps: updatedSteps,
          };
        }),
      }));
    };

    const unsubTrend = eventBus.on("TREND_FOUND", (evt) => {
      const title = evt.data?.title || "Inspiration signal analyzed";
      updateStep("Research Department", "completed", `Extracted signal: "${title}"`);
      updateStep("Creative Director", "running", "Synthesizing production brief & hook...");
    });

    const unsubOpp = eventBus.on("OPPORTUNITY_CREATED", (evt) => {
      const title = evt.data?.title || "Production Draft";
      updateStep("Creative Director", "completed", `Brief created: "${title}"`);
      updateStep("Visual Producer", "running", "Structuring visual shot list & pacing...");
    });

    const unsubScript = eventBus.on("SCRIPT_READY", (evt) => {
      const title = evt.data?.title || "Curiosity Hook";
      updateStep("Creative Director", "completed", `Script & hook finalized ("${title}")`);
    });

    const unsubRender = eventBus.on("RENDER_STARTED", () => {
      updateStep("Visual Producer", "running", "Rendering multi-scene storyboard frames...");
    });

    const unsubBoard = eventBus.on("STORYBOARD_READY", () => {
      updateStep("Visual Producer", "completed", "Multi-scene storyboard rendered");
      updateStep("Publishing Department", "running", "Preparing review queue entry...");
    });

    const unsubReview = eventBus.on("REVIEW_REQUIRED", (evt) => {
      const reviewId = evt.data?.reviewId || "";
      updateStep("Publishing Department", "completed", `Queued in Creative Review (${reviewId})`);
    });

    return () => {
      unsubTrend();
      unsubOpp();
      unsubScript();
      unsubRender();
      unsubBoard();
      unsubReview();
    };
  }, [setState]);

  // Lock body scroll when modal is open to prevent page layout shift
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const hasPlayedOpenGreetingRef = useRef(false);

  // Deliver Executive Return Briefing when user opens chat on fresh session
  useEffect(() => {
    if (isOpen && messages.length === 0 && !hasPlayedOpenGreetingRef.current) {
      hasPlayedOpenGreetingRef.current = true;
      const returnBriefing = generateExecutiveReturnBriefing(sparkState);
      addChatMessage({
        sender: "spark",
        text: returnBriefing,
        timestamp: new Date(),
      });

      // Speak greeting ONCE on first open of fresh session, then ensure speaker remains OFF for replies
      void speakText(returnBriefing, false);
      setReadRepliesAloud(false);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("spark_read_replies_aloud", "false");
        } catch {}
      }
    }
  }, [isOpen, messages.length]);

  // Auto scroll container to bottom without triggering window/page layout scroll shift
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, sparkState.thinkingState]);

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

  const toggleVoiceMode = () => {
    if (!isVoiceModeOpen) {
      setIsVoiceModeOpen(true);
      connect();
    } else {
      if (isRecording) {
        disconnect();
      } else {
        connect();
      }
    }
  };

  const closeVoiceMode = () => {
    setIsVoiceModeOpen(false);
    disconnect();
    stopSpeaking();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleCloseModal = () => {
    stopSpeaking();
    onClose();
  };

  // Filter and group sessions by time
  const filteredSessions = sessions.filter((s: ConversationSession) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.subtitle?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)
    );
  });

  const groupSessions = (sessionList: ConversationSession[]) => {
    const today: ConversationSession[] = [];
    const yesterday: ConversationSession[] = [];
    const thisWeek: ConversationSession[] = [];
    const older: ConversationSession[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 86400000 * 6;

    sessionList.forEach((s) => {
      const t = new Date(s.updatedAt || s.createdAt).getTime();
      if (t >= todayStart) {
        today.push(s);
      } else if (t >= yesterdayStart) {
        yesterday.push(s);
      } else if (t >= weekStart) {
        thisWeek.push(s);
      } else {
        older.push(s);
      }
    });

    return { today, yesterday, thisWeek, older };
  };

  const grouped = groupSessions(filteredSessions);

function parseCreditSettingsCommand(text: string, current: GenerationCreditSettings): { updated: GenerationCreditSettings; message: string } | null {
  const lower = text.toLowerCase();

  if (lower.includes("thumb") || lower.includes("thumbnail")) {
    let count: number | null = null;
    if (/\b(1|one)\b/.test(lower)) count = 1;
    else if (/\b(2|two)\b/.test(lower)) count = 2;
    else if (/\b(3|three)\b/.test(lower)) count = 3;

    if (count !== null) {
      return {
        updated: { ...current, thumbnailCount: count },
        message: `Set thumbnail variant count to ${count} per production.`,
      };
    }
  }

  if (lower.includes("keyframe") || lower.includes("panel") || lower.includes("storyboard count")) {
    const match = lower.match(/\b(1|2|3|4|5|6|one|two|three|four|five|six)\b/);
    if (match) {
      const numMap: Record<string, number> = { "1": 1, "one": 1, "2": 2, "two": 2, "3": 3, "three": 3, "4": 4, "four": 4, "5": 5, "five": 5, "6": 6, "six": 6 };
      const count = numMap[match[1]];
      if (count) {
        return {
          updated: { ...current, keyframeCount: count, maxVideoClips: count },
          message: `Set keyframe panel count to ${count} per production.`,
        };
      }
    }
  }

  if (lower.includes("short")) {
    let sec: number | null = null;
    if (lower.includes("5")) sec = 5;
    else if (lower.includes("8")) sec = 8;
    else if (lower.includes("10")) sec = 10;
    else if (lower.includes("15")) sec = 15;

    if (sec) {
      return {
        updated: { ...current, shortsDurationSec: sec },
        message: `Set Shorts video duration to ${sec}s.`,
      };
    }
  }

  if (lower.includes("cinematic")) {
    let sec: number | null = null;
    if (lower.includes("8")) sec = 8;
    else if (lower.includes("12")) sec = 12;
    else if (lower.includes("15")) sec = 15;
    else if (lower.includes("20")) sec = 20;

    if (sec) {
      return {
        updated: { ...current, cinematicDurationSec: sec },
        message: `Set Cinematic video duration to ${sec}s.`,
      };
    }
  }

  return null;
}

  // Deep Live AI Department Swarm Pipeline Execution Streamer
  const executeNaturalLanguageCommand = (commandText: string) => {
    const userMessage: Message = {
      sender: "user",
      text: commandText,
      timestamp: new Date(),
    };

    addChatMessage(userMessage);
    setInputText("");

    const sparkMessageId = `spark-msg-${Date.now()}`;
    activeSparkMsgIdRef.current = sparkMessageId;
    const lower = commandText.toLowerCase();

    // Check Credit / Generation Control commands
    const currentCreditSettings = sparkState.creditSettings || DEFAULT_CREDIT_SETTINGS;
    const creditMatch = parseCreditSettingsCommand(commandText, currentCreditSettings);
    if (creditMatch) {
      if (sparkState.updateCreditSettings) {
        sparkState.updateCreditSettings(creditMatch.updated);
      }
      const confirmText = `Understood. ${creditMatch.message} Saved credit controls for ${sparkState.brand?.name || "your brand"}.`;
      addChatMessage({
        sender: "spark",
        text: confirmText,
        timestamp: new Date(),
      });
      void speakText(confirmText, isMuted);
      return;
    }

    const prodEnabled = ProductionGenerationGuard.isEnabled();

    const isConfirmationToEnable =
      lower === "yes" ||
      lower.includes("yes, enable") ||
      lower.includes("enable production") ||
      lower.includes("turn on production");

    if (!prodEnabled) {
      if (isConfirmationToEnable) {
        sparkState.toggleProductionGeneration(true);
        const confirmText = "Production Generation is now enabled. Would you like me to proceed with drafting and generating your video now?";
        addChatMessage({
          sender: "spark",
          text: confirmText,
          timestamp: new Date(),
        });
        void speakText(confirmText, isMuted);
        return;
      }

      const isGenerationIntent =
        lower.includes("generate") ||
        lower.includes("create") ||
        lower.includes("render") ||
        lower.includes("make video") ||
        lower.includes("draft brief") ||
        lower.includes("storyboard");

      if (isGenerationIntent) {
        const blockedText = "Production Generation is currently turned off. No drafting or asset generation can run while it's disabled. Would you like me to enable Production Generation first?";
        addChatMessage({
          sender: "spark",
          text: blockedText,
          timestamp: new Date(),
        });
        void speakText(blockedText, isMuted);
        return;
      }
    }

    const isGenerationCommand =
      lower.includes("create") ||
      lower.includes("make video") ||
      lower.includes("generate") ||
      lower.includes("script") ||
      lower.includes("campaign") ||
      lower.includes("storyboard") ||
      lower.includes("short") ||
      lower.includes("trend");

    // Initialize initial message state with clean real stage tracking
    addChatMessage({
      id: sparkMessageId,
      sender: "spark",
      text: isGenerationCommand ? "Executing AI Production Loop..." : "Thinking...",
      timestamp: new Date(),
      isStreaming: true,
      ...(isGenerationCommand
        ? {
            activeDepartment: "Research Department",
            swarmSteps: [
              { department: "Executive Director", status: "completed", action: "Executive Mission Accepted" },
              { department: "Research Department", status: "running", action: "Analyzing brand memory & live signals..." },
              { department: "Creative Director", status: "idle", action: "Generating production brief & shot list..." },
              { department: "Visual Producer", status: "idle", action: "Rendering multi-scene storyboard..." },
              { department: "Publishing Department", status: "idle", action: "Queuing for Executive Review..." },
            ],
          }
        : {}),
    });

    // Send to SparkContext & LLM Engine
    sendMessage(commandText, (chunk: string) => {
      updateChatMessage(sparkMessageId, chunk, true);
    }).then(async (res: any) => {
      const finalText = typeof res === "string" ? res : res?.text || "";
      const media = typeof res === "object" ? res?.media : null;
      const providerId = typeof res === "object" ? res?.providerId : AIProviderOrchestrator.getLastUsedProviderId();
      let audioUrl = typeof res === "object" ? res?.audioUrl : null;

      if (!audioUrl && finalText && !isMuted) {
        try {
          const { generateSuperSparkVoice } = await import("../services/geminiService");
          audioUrl = await generateSuperSparkVoice(finalText, providerId);
        } catch (err) {
          console.warn("[AIChatModal] Voice fallback notice:", err);
        }
      }

      setState((prev: any) => ({
        ...prev,
        chatMessages: (prev.chatMessages || []).map((m: any) =>
          m.id === sparkMessageId
            ? {
                ...m,
                text: finalText,
                isStreaming: false,
                media: media || m.media,
                audioUrl: audioUrl || m.audioUrl,
              }
            : m
        ),
      }));

      // Play provider-native female executive voice audio immediately
      if (audioUrl && !isMuted && typeof window !== "undefined") {
        try {
          stopSpeaking();
          if (activeAudioRef.current) {
            activeAudioRef.current.pause();
            activeAudioRef.current = null;
          }
          const audio = new Audio(audioUrl);
          activeAudioRef.current = audio;
          await audio.play().catch(async (playErr) => {
            console.log("[AIChatModal] Primary audio playback notice:", playErr?.message || playErr);
            if (!isMuted && providerId === "gemini") {
              try {
                const { generateSuperSparkVoice } = await import("../services/geminiService");
                const fallbackUrl = await generateSuperSparkVoice(finalText, "openai");
                if (fallbackUrl) {
                  const fallbackAudio = new Audio(fallbackUrl);
                  activeAudioRef.current = fallbackAudio;
                  await fallbackAudio.play().catch(() => {});
                }
              } catch {}
            }
          });
        } catch (audioErr) {
          console.warn("[AIChatModal] Audio playback notice:", audioErr);
        }
      } else if (!isMuted) {
        void speakText(finalText, isMuted, providerId);
      }
    });
  };

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

  const handleActionRegenerate = async (reviewId: string) => {
    setLoadingCardId(reviewId);
    try {
      const review = reviewItems?.find((r: any) => r.id === reviewId);
      const prodId = review?.productionId || reviewId;
      if (generateAssetsForProduction) {
        await generateAssetsForProduction(prodId);
      }
      const feedbackText = `Regenerated scenes and visual storyboard for "${review?.title || "Cut"}". Storyboard and review items updated.`;
      addChatMessage({ sender: "spark", text: feedbackText, timestamp: new Date() });
      if (readRepliesAloud) speakText(feedbackText, isMuted);
    } catch (err: any) {
      console.warn("[AIChatModal] Regenerate notice:", err);
      addChatMessage({ sender: "spark", text: `Regeneration notice: ${err?.message || "Failed to regenerate assets."}`, timestamp: new Date() });
    } finally {
      setLoadingCardId(null);
    }
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

  const renderSessionCard = (s: ConversationSession) => {
    const isActive = s.id === activeSessionId;
    const isEditing = editingSessionId === s.id;

    return (
      <div
        key={s.id}
        onClick={() => {
          switchSession(s.id);
          setIsMobileDrawerOpen(false);
        }}
        className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
          isActive
            ? "bg-purple-600/20 border-purple-500/40 text-white shadow-lg shadow-purple-900/20"
            : "border-border/40 hover:border-purple-500/30 hover:bg-card/60 text-muted-foreground hover:text-foreground"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border ${
              s.category === "research"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                : s.category === "production"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
            }`}
          >
            {s.category || "Executive"}
          </span>
          <span className="text-[10px] text-muted-foreground/80">
            {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  renameSession(s.id, editingTitle.trim() || s.title);
                  setEditingSessionId(null);
                }
              }}
              className="w-full bg-input-background border border-purple-500/50 text-xs text-foreground px-2 py-1 rounded-lg outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                renameSession(s.id, editingTitle.trim() || s.title);
                setEditingSessionId(null);
              }}
              className="p-1 text-success hover:text-success/80"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <h4 className="text-xs font-semibold truncate text-foreground leading-tight mt-0.5">{s.title}</h4>
        )}

        {s.subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.subtitle}</p>}

        {/* Option Menu (...) */}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuSessionId(activeMenuSessionId === s.id ? null : s.id);
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {activeMenuSessionId === s.id && (
            <div
              className="absolute right-0 top-7 z-30 w-36 rounded-xl border border-border/80 bg-card/95 backdrop-blur-xl p-1.5 shadow-xl space-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setEditingSessionId(s.id);
                  setEditingTitle(s.title);
                  setActiveMenuSessionId(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-foreground hover:bg-accent/10 rounded-lg cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-accent-foreground" /> Rename
              </button>
              {confirmDeleteSessionId === s.id ? (
                <div className="w-full p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs space-y-1.5">
                  <p className="text-[11px] text-rose-300 font-medium">Delete conversation?</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        deleteSession(s.id);
                        setConfirmDeleteSessionId(null);
                        setActiveMenuSessionId(null);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-500 text-white font-semibold text-[10px] hover:bg-rose-600 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteSessionId(null)}
                      className="px-2 py-0.5 rounded bg-muted/40 text-muted-foreground hover:text-foreground text-[10px] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteSessionId(s.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full space-y-4 p-4">
      {/* Top Action: + New Chat */}
      <button
        onClick={() => {
          startNewSession();
          setIsMobileDrawerOpen(false);
        }}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4" />
        New Chat
      </button>

      {/* Search Input */}
      <div className="relative flex items-center bg-input-background/60 border border-border/60 rounded-xl overflow-hidden shrink-0">
        <Search className="w-3.5 h-3.5 text-muted-foreground ml-3 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Session History Groups */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
        {grouped.today.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-purple-400" /> Today
            </h5>
            <div className="space-y-1.5">{grouped.today.map(renderSessionCard)}</div>
          </div>
        )}

        {grouped.yesterday.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Yesterday</h5>
            <div className="space-y-1.5">{grouped.yesterday.map(renderSessionCard)}</div>
          </div>
        )}

        {grouped.thisWeek.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">This Week</h5>
            <div className="space-y-1.5">{grouped.thisWeek.map(renderSessionCard)}</div>
          </div>
        )}

        {grouped.older.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Older</h5>
            <div className="space-y-1.5">{grouped.older.map(renderSessionCard)}</div>
          </div>
        )}

        {filteredSessions.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No matching sessions found.
          </div>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex bg-background text-foreground font-sans overflow-hidden"
      >
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-success/5 blur-[150px] pointer-events-none" />

        {/* Phase 19C Desktop Left Sidebar (280–320px) */}
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="hidden md:flex flex-col border-r border-border/50 bg-card/40 backdrop-blur-2xl shrink-0 z-20"
          >
            {renderSidebarContent()}
          </motion.aside>
        )}

        {/* Phase 19C Mobile Full-Height Slide-Over Drawer */}
        <AnimatePresence>
          {isMobileDrawerOpen && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="md:hidden fixed inset-y-0 left-0 w-[85%] max-w-sm bg-card/95 backdrop-blur-2xl border-r border-border/60 z-50 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">Executive History</span>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">{renderSidebarContent()}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Super Spark Chat Container */}
        <div className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden">
          {/* Phase 19F: Dedicated Executive Voice Mode Overlay Surface */}
          <AnimatePresence>
            {isVoiceModeOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="absolute inset-0 z-40 bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-between p-6 sm:p-8 text-center"
                style={{
                  paddingTop: "max(1.5rem, env(safe-area-inset-top, 16px))",
                  paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 16px))",
                }}
              >
                {/* Voice Mode Header */}
                <div className="w-full max-w-2xl flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3 text-left">
                    <SparkLogo className="w-8 h-8" variant="superspark" />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Super Spark Voice Mode</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Provider: <span className="font-semibold text-accent-foreground">{SPARK_EXECUTIVE_VOICE_PROFILE.name} ({SPARK_EXECUTIVE_VOICE_PROFILE.accent})</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleReadRepliesAloud}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        readRepliesAloud
                          ? "bg-accent/20 text-accent-foreground border-accent/40"
                          : "bg-muted/20 text-muted-foreground border-border/50"
                      }`}
                    >
                      {readRepliesAloud ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      {readRepliesAloud ? "Voice ON" : "Voice OFF"}
                    </button>

                    <button
                      onClick={closeVoiceMode}
                      className="p-2 rounded-xl border border-border/60 hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                      title="Return to Text Chat"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Center Executive Voice Orb */}
                <div className="relative flex flex-col items-center justify-center my-auto space-y-8">
                  <div className="relative flex items-center justify-center">
                    {/* Outer Pulsing Aura Rings */}
                    <motion.div
                      animate={
                        sparkState.thinkingState
                          ? { scale: [1, 1.25, 1], rotate: [0, 180, 360], opacity: [0.3, 0.7, 0.3] }
                          : isRecording
                          ? { scale: [1, 1.35, 1], opacity: [0.4, 0.8, 0.4] }
                          : { scale: [1, 1.1, 1], opacity: [0.2, 0.5, 0.2] }
                      }
                      transition={{ repeat: Infinity, duration: sparkState.thinkingState ? 3 : 2, ease: "easeInOut" }}
                      className={`w-64 h-64 rounded-full border-2 absolute ${
                        sparkState.thinkingState
                          ? "border-purple-500/40 bg-purple-500/10 shadow-[0_0_80px_rgba(168,85,247,0.3)]"
                          : isRecording
                          ? "border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_80px_rgba(6,182,212,0.3)]"
                          : "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_80px_rgba(16,185,129,0.3)]"
                      }`}
                    />

                    {/* Core Executive Glass Orb */}
                    <div className="w-40 h-40 rounded-full border border-white/20 bg-card/80 backdrop-blur-2xl flex items-center justify-center shadow-2xl relative z-10">
                      {sparkState.thinkingState ? (
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                      ) : isRecording ? (
                        <AudioLines className="w-12 h-12 text-cyan-400 animate-pulse" />
                      ) : (
                        <Sparkles className="w-12 h-12 text-emerald-400 animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Live Transcript / Status Indicator */}
                  <div className="max-w-md space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-3 py-1 rounded-full border border-border/50 bg-background/50">
                      {sparkState.thinkingState
                        ? "Formulating Executive Response..."
                        : isRecording
                        ? "Listening to Creator..."
                        : "Voice Session Active"}
                    </span>

                    <p className="text-base font-medium text-foreground min-h-[3rem] px-4 py-2 flex items-center justify-center">
                      {currentText ||
                        (sparkState.thinkingState
                          ? sparkState.thinkingState.step
                          : "Speak freely to Super Spark...")}
                    </p>
                  </div>
                </div>

                {/* Bottom Voice Controls */}
                <div className="w-full max-w-md flex items-center justify-center gap-6 pb-4">
                  <button
                    onClick={toggleRecording}
                    className={`p-5 rounded-full border transition-all duration-300 active:scale-95 shadow-xl cursor-pointer ${
                      isRecording
                        ? "bg-destructive/20 border-destructive/50 text-destructive"
                        : "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30"
                    }`}
                    title={isRecording ? "Pause Listening" : "Resume Listening"}
                  >
                    <Mic className="w-6 h-6" />
                  </button>

                  <button
                    onClick={closeVoiceMode}
                    className="px-6 py-3 rounded-full border border-border/80 bg-card/80 hover:bg-card text-xs font-semibold text-foreground transition-all cursor-pointer shadow-lg"
                  >
                    Exit Voice Mode
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Modal Header — Fixed h-16, shrink-0, zero reflow */}
          <header
            className="relative flex items-center justify-between border-b border-border/50 px-4 sm:px-6 h-16 bg-card/40 backdrop-blur-md shrink-0 z-30"
            style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
          >
            <div className="flex items-center gap-3">
              {/* Desktop Toggle Sidebar */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden md:flex p-2 rounded-xl border border-border/60 hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title={isSidebarOpen ? "Collapse History Sidebar" : "Expand History Sidebar"}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>

              {/* Mobile History Drawer Button */}
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                History
              </button>

              <SparkLogo className="w-9 h-9" variant="superspark" />
              <div>
                <h2 className="text-base font-semibold leading-tight flex items-center gap-1.5">
                  Super Spark
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mt-0.5" />
                </h2>
                <p className="text-xs text-muted-foreground">Executive Creative Director & Media OS Partner</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleReadRepliesAloud}
                className={`p-2.5 rounded-xl border border-border/80 transition-all duration-200 active:scale-95 cursor-pointer ${
                  readRepliesAloud ? "text-accent-foreground bg-accent/15 border-accent/40 shadow-sm" : "text-muted-foreground bg-accent/5 opacity-70"
                }`}
                title={readRepliesAloud ? "Read Replies Aloud: ON" : "Read Replies Aloud: OFF"}
              >
                {readRepliesAloud ? <Volume2 className="w-4 h-4 text-accent-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
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

          {/* Messages Chat Area — Locked min-h-0 flex-1 scroll container */}
          <main ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scrollbar-none min-h-0">
            <div className="max-w-3xl mx-auto space-y-6 min-h-full flex flex-col justify-start">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto my-auto space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-900/20">
                    <SparkLogo className="w-8 h-8" variant="superspark" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Start a new executive session.</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Super Spark remembers your workspace, not every conversation.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
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
                    {isSpark && <SparkLogo className="w-9 h-9 shrink-0" variant="superspark" />}

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
                          currentStageIndex={msg.swarmSteps.filter((s) => s.status === "completed").length}
                        />
                      )}

                      {/* Interactive Media Card Attachment */}
                      {msg.media && (
                        <div className="relative mt-2.5 rounded-xl border border-border/80 bg-background/50 p-4 space-y-3.5 overflow-hidden">
                          {loadingCardId === msg.media.id && (
                            <div className="absolute inset-0 bg-background/90 z-30 flex flex-col items-center justify-center gap-2">
                              <Loader2 className="w-6 h-6 text-accent-foreground animate-spin" />
                              <span className="text-[10px] font-bold text-accent-foreground uppercase tracking-widest animate-pulse">
                                Regenerating assets...
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-xs font-semibold truncate flex-1 leading-snug">{msg.media.title}</h4>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border shrink-0 ${
                                msg.media.status === "Approved"
                                  ? "bg-success/10 text-success border-success/20"
                                  : msg.media.status === "Needs Edit"
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : "bg-warning/10 text-warning border-warning/20"
                              }`}
                            >
                              {msg.media.status}
                            </span>
                          </div>

                          {msg.media.type === "video" && msg.media.videoUrl && (
                            <div className="relative rounded-lg overflow-hidden border border-border/40 aspect-video bg-black flex items-center justify-center">
                              <video src={msg.media.videoUrl} controls className="w-full h-full object-cover" />
                            </div>
                          )}

                          {msg.media.concept && (
                            <div className="text-[11px] leading-relaxed text-muted-foreground bg-input-background/40 border border-border/40 rounded-lg p-2.5">
                              <p className="font-bold text-[9px] text-foreground/80 uppercase tracking-wider mb-1">Concept Hook & Story</p>
                              <p className="italic">"{msg.media.concept}"</p>
                            </div>
                          )}

                          {msg.media.meta && <p className="text-[10px] text-muted-foreground/85 font-medium">{msg.media.meta}</p>}

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

                            {msg.media.type === "production_status" && (
                              <button
                                onClick={() => {
                                  onNavigate?.("/more/production-settings");
                                  onClose();
                                }}
                                className="w-full py-2.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-foreground border border-accent/30 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                              >
                                Configure Production Settings
                              </button>
                            )}

                            {msg.media.type === "research_source" && (
                              <div className="w-full flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    onNavigate?.("/my-spark");
                                    onClose();
                                  }}
                                  className="flex-1 py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  View in My Spark
                                </button>
                                <button
                                  onClick={() => {
                                    if (msg.media?.id) syncResearchSource?.(msg.media.id);
                                  }}
                                  className="px-3 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  Sync Now
                                </button>
                              </div>
                            )}

                            {msg.media.type === "memory_saved" && (
                              <button
                                onClick={() => {
                                  onNavigate?.("/more/memory");
                                  onClose();
                                }}
                                className="w-full py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                              >
                                View Memory Bank
                              </button>
                            )}

                            {msg.media.type === "storyboard" && (
                              <div className="w-full flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    onNavigate?.("/review");
                                    onClose();
                                  }}
                                  className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  Open in Review
                                </button>
                                <button
                                  onClick={() => {
                                    onNavigate?.("/review");
                                    onClose();
                                  }}
                                  className="flex-1 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  Open Storyboard
                                </button>
                              </div>
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
                        {msg.timestamp instanceof Date
                          ? msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

              {sparkState.thinkingState && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent-foreground font-medium animate-pulse my-2">
                  <Sparkles className="w-4 h-4 text-accent-foreground animate-spin" />
                  <span>{formatExecutiveThinkingStep(sparkState.thinkingState.step)}</span>
                </div>
              )}

                  </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input Bar Area with Quick Actions */}
          <footer
            className="border-t border-border/50 bg-card/95 backdrop-blur-md px-4 sm:px-6 pt-3 space-y-3 shrink-0 z-30"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 16px))" }}
          >
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
                  onFocus={(e) => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                  placeholder={
                    status === "error"
                      ? "Voice unavailable."
                      : isRecording
                      ? "Listening to your voice..."
                      : "Ask Super Spark to play a video, approve drafts, or initialize options..."
                  }
                  disabled={isRecording}
                  className="w-full bg-transparent px-4 sm:px-5 py-3.5 sm:py-4 text-sm outline-none border-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                />

                {isRecording && (
                  <div className="absolute inset-0 bg-accent/5 flex items-center justify-center gap-1.5 pointer-events-none animate-pulse">
                    <AudioLines className="w-5 h-5 text-accent-foreground" />
                    <span className="text-xs text-accent-foreground font-medium uppercase tracking-widest animate-pulse">
                      Recording Voice Note...
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={toggleVoiceMode}
                className={`
                  relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 active:scale-95 overflow-hidden shrink-0 cursor-pointer
                  ${
                    isVoiceModeOpen || isRecording
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-md shadow-purple-900/20"
                      : "bg-input-background border-border text-muted-foreground hover:text-foreground hover:border-border-hover"
                  }
                `}
                title={isVoiceModeOpen ? "Exit Voice Mode" : "Open Super Spark Voice Mode"}
              >
                {isRecording && <span className="absolute inset-0 bg-purple-500/20 animate-ping rounded-2xl" />}
                <Mic className="w-5 h-5 relative" />
              </button>

              <button
                onClick={handleSendMessage}
                disabled={isRecording}
                className="p-3.5 sm:p-4 rounded-2xl bg-foreground text-background transition-all duration-300 active:scale-95 disabled:opacity-50 hover:bg-foreground/90 shrink-0 cursor-pointer shadow-md shadow-black/25"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
