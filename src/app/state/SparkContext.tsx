import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { loadPersistedState, savePersistedState } from "./persistence";
import {
  Brand,
  Character,
  Account,
  AutomationMode,
  ProductionMode,
  ViralSpark,
  Production,
  ReviewItem,
  PublishJob,
  ExportPackage,
  AnalyticsInsight,
  MemoryItem,
  Asset,
} from "../domain/types";
import { ExecutiveDecisionEngine } from "../services/executiveDecisionEngine";
import { ExecutivePolicyEngine } from "../services/executivePolicyEngine";
import { PipelineEngine } from "../services/pipelineEngine";
import { ExecutionTask } from "../domain/runtime/ExecutionTask";
import { CapabilityAnalyzer } from "../services/capabilityAnalyzer";
import { AgentRegistry } from "../services/agentRegistry";
import { AgentDispatcher } from "../services/agentDispatcher";
import { ModelRouter } from "../services/modelRouter";
import { TaskState } from "../domain/runtime/TaskState";
import { TaskScheduler } from "../services/taskScheduler";
import { ExecutionManager } from "../services/executionManager";
import { IDepartmentAgent } from "../domain/runtime/IDepartmentAgent";
import { RuntimeEvents } from "../services/runtime/runtimeEvents";
import { RuntimeOrchestrator } from "../services/runtime/runtimeOrchestrator";
import { InteractionController, ExecutionRequest } from "../services/interaction/interactionController";
import { useAuth } from "./AuthContext";
import { brandRowToDomain, domainBrandToRowPatch } from "../backend/mappers/brandMapper";
import { updateBrand as updateBrandRepository } from "../backend/repositories/brandRepository";

import { isSupabaseConfigured } from "../backend/supabaseClient";
import {
  hydrateWorkspace,
  hydrateExecutiveContext,
  persistExecutiveMessage,
  persistMemoryCreate,
  persistMemoryDelete,
  persistProductionCreate,
  persistProductionUpdate,
  persistPublishJobCreate,
  persistReviewApprove,
  persistReviewCreate,
  persistReviewNeedsEdit,
} from "../backend/workspaceSync";

import {
  ExecutiveConversationMessageRow,
  ExecutiveSessionRow,
  ExecutiveDirectorSummaryRow,
  ExecutiveTimelineRow,
  MemoryItemRow,
} from "../backend/database.types";
import { WorkingMemory, createInitialWorkingMemory } from "./workingMemory";
import { ExecutiveContext } from "./executiveContext";
import { eventBus, SparkEvent, emit, on } from "../services/eventBus";
import { executiveIntelligenceEngine } from "../services/executiveIntelligenceEngine";

export interface ChatMessage {
  id?: string;
  sender: "user" | "spark";
  text: string;
  timestamp: Date;
  media?: any;
  isStreaming?: boolean;
}

interface SparkContextType {
  brand: Brand;
  character: Character;
  accounts: Account[];
  automationMode: AutomationMode;
  productionMode: ProductionMode;
  memoryItems: MemoryItem[];
  viralSparks: ViralSpark[];
  productions: Production[];
  reviewItems: ReviewItem[];
  publishJobs: PublishJob[];
  exportPackages: ExportPackage[];
  analyticsInsights: AnalyticsInsight[];
  assets: Asset[];
  chatMessages: ChatMessage[];

  // Executive Director Persistence States
  executiveConversation: ExecutiveConversationMessageRow[];
  execSession: ExecutiveSessionRow | null;
  execSummary: ExecutiveDirectorSummaryRow | null;
  workingMemory: WorkingMemory;
  timeline: ExecutiveTimelineRow[];
  executiveContext: ExecutiveContext;

  // Execution states
  isExecuting: boolean;
  executionTimeline: Array<{ name: string; status: "idle" | "running" | "completed" | "failed"; duration?: number; provider?: string; cost?: number; confidence?: number; error?: string }>;
  streamingOutput: string;
  streamingMetrics: any;

  // Actions
  updateBrand: (patch: Partial<Brand>) => void;
  updateAutomationMode: (mode: AutomationMode) => void;
  updateProductionMode: (mode: ProductionMode) => void;
  addChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, text: string, isStreaming?: boolean) => void;
  appendExecutiveMessage: (sender: "user" | "director", text: string, metadata?: Record<string, unknown>) => Promise<ExecutiveConversationMessageRow | null>;
  updateWorkingMemory: (patch: Partial<WorkingMemory>) => void;

  createProductionFromSpark: (sparkId: string) => void;
  approveReviewItem: (reviewId: string) => void;
  rejectOrRequestEditReviewItem: (reviewId: string) => void;
  addMemoryItem: (text: string, type: "learned" | "rule", category?: any) => void;
  removeMemoryItem: (id: string) => void;
  addAsset: (name: string, type: "video" | "audio" | "image" | "document", size: string) => void;
  toggleContentPillar: (label: string) => void;
  toggleTone: (label: string) => void;
  sendMessage: (prompt: string, onUpdate?: (text: string) => void) => Promise<string>;
  state: any;
}

const SparkContext = createContext<SparkContextType | undefined>(undefined);

// Default mock data matching existing templates
const defaultBrand: Brand = {
  name: "Tech Insights Nigeria",
  niche: "AI & Technology Education",
  archetype: "The Expert Guide",
  purpose: "Demystifying technology for African creators and entrepreneurs — making the complex accessible, practical, and profitable.",
  contentPillars: [
    { label: "AI & Automation", active: true },
    { label: "Mobile Technology", active: true },
    { label: "Digital Marketing", active: true },
    { label: "Content Creation", active: true },
    { label: "Tech Entrepreneurship", active: true },
    { label: "African Tech Ecosystem", active: false },
  ],
  audience: {
    primary: "Nigerian tech enthusiasts, entrepreneurs, and creators aged 18–35",
    painPoints: [
      "Tech feels inaccessible or too Western-focused",
      "Don't know which tools to invest in",
      "Want to build online income but don't know how",
    ],
    desires: [
      "Feel ahead of the curve on technology",
      "Build a profitable online presence",
      "Connect with a community of similar minds",
    ],
  },
  tone: [
    { label: "Energetic", active: true },
    { label: "Relatable", active: true },
    { label: "Expert", active: true },
    { label: "Humorous", active: true },
    { label: "Inspiring", active: true },
    { label: "Direct", active: false },
    { label: "Academic", active: false },
    { label: "Formal", active: false },
  ],
};

const defaultCharacter: Character = {
  name: "Tunde",
  role: "Primary Host",
  style: "Young Nigerian male, tech-casual — glasses, branded tees, high energy",
  traits: ["Energetic", "Relatable", "Knowledgeable", "Humorous"],
  voice: {
    name: "Spark_Nigeria_English",
    language: "English (Nigerian accent)",
    tone: "Energetic & Friendly",
    locked: true,
  },
};

const defaultAccounts: Account[] = [
  { platform: "YouTube", handle: "@TechInsightsNG", status: "connected", posts: 187 },
  { platform: "TikTok", handle: "@techinsightsng", status: "connected", posts: 312 },
  { platform: "Instagram", handle: "@techinsightsng", status: "connected", posts: 89 },
  { platform: "LinkedIn", handle: "Tech Insights Nigeria", status: "connected", posts: 45 },
  { platform: "Twitter/X", handle: "@TechInsightsNG", status: "disconnected", posts: 0 },
];

const defaultMemoryItems: MemoryItem[] = [
  { id: "m-1", type: "learned", text: "Hook style: 'Nobody talks about this' achieves 3× retention on TikTok", dateAdded: "2026-06-28" },
  { id: "m-2", type: "learned", text: "Peak engagement window: Tue–Thu 2–4 PM across all accounts", dateAdded: "2026-06-29" },
  { id: "m-3", type: "learned", text: "Long-form YouTube content outperforms short-form by 2.4× for this audience", dateAdded: "2026-06-30" },
  { id: "m-4", type: "rule", text: "Never publish without a clear call to action in final 10 seconds", dateAdded: "2026-06-15" },
  { id: "m-5", type: "rule", text: "All thumbnails must include a human face with visible emotion", dateAdded: "2026-06-18" },
  { id: "m-6", type: "rule", text: "Avoid Western examples without local Nigerian context equivalent", dateAdded: "2026-06-20" },
];

export const SparkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const hydratedBrandIdRef = useRef<string | null>(null);
  const backendBrandIdRef = useRef<string | null>(null);
  const [backendBrandId, setBackendBrandId] = useState<string | null>(null);

  // Executive Director Persistence States
  const [executiveConversation, setExecutiveConversation] = useState<ExecutiveConversationMessageRow[]>([]);
  const [execSession, setExecSession] = useState<ExecutiveSessionRow | null>(null);
  const [execSummary, setExecSummary] = useState<ExecutiveDirectorSummaryRow | null>(null);
  const [workingMemory, setWorkingMemory] = useState<WorkingMemory>(createInitialWorkingMemory());
  const [timeline, setTimeline] = useState<ExecutiveTimelineRow[]>([]);

  // Domain state
  const [state, setState] = useState(() => {
    const local = loadPersistedState<any>();
    if (local) {
      return local;
    }
    return {
      brand: defaultBrand,
      character: defaultCharacter,
      accounts: defaultAccounts,
      automationMode: "balanced" as AutomationMode,
      productionMode: "standard" as ProductionMode,
      memoryItems: defaultMemoryItems,
      viralSparks: [],
      productions: [],
      reviewItems: [],
      publishJobs: [],
      exportPackages: [],
      analyticsInsights: [],
      assets: []
    };
  });

  // Local cache persistence
  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  // Construct current ExecutiveContext
  const getExecutiveContext = (): ExecutiveContext => ({
    summary: execSummary,
    session: execSession,
    memory: [], // mapped in engine
    workingMemory,
    conversation: executiveConversation,
    timeline,
  });

  // Initialize Executive Intelligence Engine
  useEffect(() => {
    executiveIntelligenceEngine.initialize(getExecutiveContext);
  }, []);

  // Listen to typed event bus for reactive state sync
  useEffect(() => {
    const unsubMemory = on(SparkEvent.MemoryUpdated, (newRows) => {
      console.log("[SparkContext] MemoryUpdated via EventBus:", newRows.length);
    });

    const unsubSummary = on(SparkEvent.SummaryUpdated, (summary) => {
      setExecSummary(summary);
    });

    const unsubSession = on(SparkEvent.SessionUpdated, (session) => {
      setExecSession(session);
    });

    const unsubTimeline = on(SparkEvent.TimelineRecorded, (item) => {
      setTimeline((prev) => [item, ...prev]);
    });

    return () => {
      unsubMemory();
      unsubSummary();
      unsubSession();
      unsubTimeline();
    };
  }, []);

  // Hydrate brand + ExecutiveContext from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured() || !auth.isAuthenticated || !auth.brand) {
      if (!auth.isAuthenticated) {
        setBackendBrandId(null);
        backendBrandIdRef.current = null;
        hydratedBrandIdRef.current = null;
      }
      return;
    }

    if (hydratedBrandIdRef.current === auth.brand.id) return;
    hydratedBrandIdRef.current = auth.brand.id;
    setBackendBrandId(auth.brand.id);
    backendBrandIdRef.current = auth.brand.id;

    const domain = brandRowToDomain(auth.brand);
    void hydrateWorkspace(auth.brand.id).then((workspace) => {
      setState((prev: any) => ({
        ...prev,
        brand: domain,
        automationMode: auth.brand!.automation_mode,
        character: workspace.character ?? prev.character,
        accounts: workspace.accounts.length ? workspace.accounts : prev.accounts,
        memoryItems: workspace.memoryItems,
        viralSparks: workspace.viralSparks,
        productions: workspace.productions,
        reviewItems: workspace.reviewItems,
        publishJobs: workspace.publishJobs,
        analyticsInsights: workspace.analyticsInsights,
      }));
    });

    void hydrateExecutiveContext(auth.brand.id).then((execCtx) => {
      setExecSummary(execCtx.summary);
      setExecSession(execCtx.session);
      setWorkingMemory(execCtx.workingMemory);
      setExecutiveConversation(execCtx.conversation);
      setTimeline(execCtx.timeline);
    });
  }, [auth.isAuthenticated, auth.brand]);

  // Persist brand edits to Supabase
  useEffect(() => {
    if (!isSupabaseConfigured() || !auth.isAuthenticated || !backendBrandId) return;
    if (hydratedBrandIdRef.current !== backendBrandId) return;

    const timer = window.setTimeout(() => {
      void updateBrandRepository(
        backendBrandId,
        domainBrandToRowPatch(state.brand, state.automationMode),
      );
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    auth.isAuthenticated,
    backendBrandId,
    state.brand,
    state.automationMode,
  ]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTimeline, setExecutionTimeline] = useState<Array<{ name: string; status: "idle" | "running" | "completed" | "failed"; duration?: number; provider?: string; cost?: number; confidence?: number; error?: string }>>([
    { name: "Research", status: "idle" },
    { name: "Creative Decision", status: "idle" },
    { name: "Planning", status: "idle" },
    { name: "Storyboard", status: "idle" },
    { name: "Generation", status: "idle" },
    { name: "Analysis", status: "idle" },
    { name: "Editing Decision", status: "idle" },
    { name: "Editing", status: "idle" },
    { name: "Review", status: "idle" },
    { name: "Publishing", status: "idle" },
    { name: "Learning", status: "idle" }
  ]);
  const [streamingOutput, setStreamingOutput] = useState("");
  const [streamingMetrics, setStreamingMetrics] = useState<any>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: "init-1",
      sender: "spark",
      text: `Spark Operating System Online.

Welcome to your Executive Workspace. Let's direct your media brand.`,
      timestamp: new Date(),
    },
  ]);

  const addChatMessage = (msg: ChatMessage) => {
    setChatMessages((prev) => [...prev, msg]);
  };

  const updateChatMessage = (id: string, text: string, isStreaming: boolean = false) => {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text, isStreaming } : m))
    );
  };

  const appendExecutiveMessage = async (
    sender: "user" | "director",
    text: string,
    metadata?: Record<string, unknown>
  ): Promise<ExecutiveConversationMessageRow | null> => {
    const brandId = backendBrandId || "demo-brand-id";
    const sessionId = execSession?.id || "demo-session-id";

    const persisted = await persistExecutiveMessage(brandId, sessionId, sender, text, metadata);
    const newMsg: ExecutiveConversationMessageRow = persisted || {
      id: `msg-${Date.now()}`,
      brand_id: brandId,
      session_id: sessionId,
      sender,
      text,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    setExecutiveConversation((prev) => [...prev, newMsg]);
    emit(SparkEvent.MessageCreated, newMsg);
    return newMsg;
  };

  const updateWorkingMemory = (patch: Partial<WorkingMemory>) => {
    setWorkingMemory((prev) => ({
      ...prev,
      ...patch,
      context: { ...prev.context, ...patch.context },
    }));
  };

  const updateBrand = (patch: Partial<Brand>) => {
    setState((prev: any) => ({
      ...prev,
      brand: { ...prev.brand, ...patch }
    }));
  };

  const updateAutomationMode = (mode: AutomationMode) => {
    setState((prev: any) => ({ ...prev, automationMode: mode }));
  };

  const updateProductionMode = (mode: ProductionMode) => {
    setState((prev: any) => ({ ...prev, productionMode: mode }));
  };

  const toggleContentPillar = (label: string) => {
    setState((prev: any) => {
      const pillars = prev.brand.contentPillars.map((p: any) =>
        p.label === label ? { ...p, active: !p.active } : p
      );
      return {
        ...prev,
        brand: { ...prev.brand, contentPillars: pillars }
      };
    });
  };

  const toggleTone = (label: string) => {
    setState((prev: any) => {
      const tone = prev.brand.tone.map((t: any) =>
        t.label === label ? { ...t, active: !t.active } : t
      );
      return {
        ...prev,
        brand: { ...prev.brand, tone: tone }
      };
    });
  };

  const addMemoryItem = (text: string, type: "learned" | "rule", category?: any) => {
    const newItem: MemoryItem = {
      id: `m-${Date.now()}`,
      type,
      text,
      dateAdded: new Date().toISOString().split("T")[0]
    };
    setState((prev: any) => ({
      ...prev,
      memoryItems: [newItem, ...prev.memoryItems]
    }));
    if (backendBrandId) {
      void persistMemoryCreate(backendBrandId, newItem);
    }
  };

  const removeMemoryItem = (id: string) => {
    setState((prev: any) => ({
      ...prev,
      memoryItems: prev.memoryItems.filter((m: any) => m.id !== id)
    }));
    void persistMemoryDelete(id);
  };

  const addAsset = (name: string, type: "video" | "audio" | "image" | "document", size: string) => {
    const newAsset: Asset = {
      id: `as-${Date.now()}`,
      name,
      type,
      size,
      url: "#"
    };
    setState((prev: any) => ({
      ...prev,
      assets: [newAsset, ...prev.assets]
    }));
  };

  const createProductionFromSpark = (sparkId: string) => {
    const spark = state.viralSparks.find((s: any) => s.id === sparkId);
    if (!spark) return;

    const newProd: Production = {
      id: `prod-${Date.now()}`,
      sparkId,
      title: spark.title,
      status: "Ready for Review",
      mode: "standard",
      dateCreated: new Date().toISOString().split("T")[0],
      aspectRatio: "16:9",
      formats: [spark.platforms],
      reasoning: {
        rationale: spark.whyNow || "High viral potential identified.",
        evidence: [spark.hook],
        learnedRules: ["Hook-first editing boosts retention"],
        expectedOutcome: spark.velocity,
        risk: "Low Risk"
      },
      scenes: [
        { scene: 1, description: `Hook: ${spark.hook}`, duration: "0-5s" },
        { scene: 2, description: `Main concept: ${spark.angle || spark.title}`, duration: "5-30s" }
      ]
    };

    const newReview: ReviewItem = {
      id: `rev-${Date.now()}`,
      productionId: newProd.id,
      title: newProd.title,
      account: spark.platforms.includes("TikTok") ? "TikTok" : "YouTube",
      series: "Viral Opportunity",
      status: "Pending Review",
      dateCreated: newProd.dateCreated,
      scriptSnippet: spark.hook,
      conceptText: spark.whyNow || "AI generated concept",
      openingMoment: "High impact hook",
      qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
    };

    setState((prev: any) => ({
      ...prev,
      productions: [newProd, ...prev.productions],
      reviewItems: [newReview, ...prev.reviewItems]
    }));

    if (backendBrandId) {
      void persistProductionCreate(backendBrandId, newProd);
      void persistReviewCreate(backendBrandId, newReview);
    }
  };

  const approveReviewItem = (reviewId: string) => {
    const item = state.reviewItems.find((r: any) => r.id === reviewId);
    if (!item) return;

    setState((prev: any) => {
      const updatedReviews = prev.reviewItems.map((r: any) =>
        r.id === reviewId ? { ...r, status: "Approved" } : r
      );
      const updatedProds = prev.productions.map((p: any) =>
        p.id === item.productionId ? { ...p, status: "Approved" } : p
      );

      const newJob: PublishJob = {
        id: `job-${Date.now()}`,
        productionId: item.productionId,
        title: item.title,
        platform: item.account,
        scheduledTime: "Scheduled for Tomorrow 2:00 PM",
        status: "Scheduled"
      };

      const newPackage: ExportPackage = {
        id: `exp-${Date.now()}`,
        productionId: item.productionId,
        title: item.title,
        size: "34.5 MB",
        formats: [`${item.account} Video Cut`, "Metadata JSON"],
        readyAt: "Just now"
      };

      return {
        ...prev,
        reviewItems: updatedReviews,
        productions: updatedProds,
        publishJobs: [newJob, ...prev.publishJobs],
        exportPackages: [newPackage, ...prev.exportPackages]
      };
    });

    if (backendBrandId) {
      void persistReviewApprove(reviewId);
    }
  };

  const rejectOrRequestEditReviewItem = (reviewId: string) => {
    const item = state.reviewItems.find((r: any) => r.id === reviewId);
    if (!item) return;

    setState((prev: any) => ({
      ...prev,
      reviewItems: prev.reviewItems.map((r: any) =>
        r.id === reviewId ? { ...r, status: "Needs Edit" } : r
      ),
      productions: prev.productions.map((p: any) =>
        p.id === item.productionId ? { ...p, status: "Needs Edit" } : p
      )
    }));

    if (backendBrandId) {
      void persistReviewNeedsEdit(reviewId);
    }
  };

  const sendMessage = async (prompt: string, onUpdate?: (text: string) => void): Promise<string> => {
    await appendExecutiveMessage("user", prompt);
    const replyText = `I've analyzed your directive: "${prompt}". Your Executive Team is coordinating the next action.`;
    await appendExecutiveMessage("director", replyText);

    if (onUpdate) {
      onUpdate(replyText);
    }
    return replyText;
  };

  const executiveContext = getExecutiveContext();

  return (
    <SparkContext.Provider
      value={{
        brand: state.brand,
        character: state.character,
        accounts: state.accounts,
        automationMode: state.automationMode,
        productionMode: state.productionMode,
        memoryItems: state.memoryItems,
        viralSparks: state.viralSparks,
        productions: state.productions,
        reviewItems: state.reviewItems,
        publishJobs: state.publishJobs,
        exportPackages: state.exportPackages,
        analyticsInsights: state.analyticsInsights,
        assets: state.assets,
        chatMessages,

        executiveConversation,
        execSession,
        execSummary,
        workingMemory,
        timeline,
        executiveContext,

        isExecuting,
        executionTimeline,
        streamingOutput,
        streamingMetrics,

        updateBrand,
        updateAutomationMode,
        updateProductionMode,
        addChatMessage,
        updateChatMessage,
        appendExecutiveMessage,
        updateWorkingMemory,

        createProductionFromSpark,
        approveReviewItem,
        rejectOrRequestEditReviewItem,
        addMemoryItem,
        removeMemoryItem,
        addAsset,
        toggleContentPillar,
        toggleTone,
        sendMessage,
        state,
      }}
    >
      {children}
    </SparkContext.Provider>
  );
};

export const useSpark = () => {
  const context = useContext(SparkContext);
  if (!context) {
    throw new Error("useSpark must be used within a SparkProvider");
  }
  return context;
};
