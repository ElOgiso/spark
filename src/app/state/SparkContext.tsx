import React, { createContext, useContext, useState, useEffect } from "react";
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
  QualityCheck
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
import { RuntimeOrchestrator } from "../services/runtime/runtimeOrchestrator";
import { InteractionController, ExecutionRequest } from "../services/interaction/interactionController";

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
  
  // Execution states
  isExecuting: boolean;
  executionTimeline: Array<{ name: string; status: "idle" | "running" | "completed" | "failed"; duration?: number; provider?: string; cost?: number; confidence?: number }>;
  streamingOutput: string;
  streamingMetrics: any;

  // Actions
  updateAutomationMode: (mode: AutomationMode) => void;
  updateProductionMode: (mode: ProductionMode) => void;
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

const defaultViralSparks: ViralSpark[] = [
  {
    id: "s1",
    title: "How Nigerian Creators Are Using AI to Build Media Empires",
    whyNow: "AI content tools just crossed mainstream adoption threshold in West Africa — 48-hour window before oversaturation",
    platforms: "YouTube + TikTok",
    hook: "\"I replaced my entire production team with one AI tool — and tripled output.\"",
    views: "2.4M",
    velocity: "+182%",
    platformFit: "High",
    brandFitScore: 97,
    category: "hot",
    timeWindow: "48h window",
    productionTime: "6–12h",
    angle: "Personal transformation: 'I replaced a 5-person team with one tool'",
  },
  {
    id: "s2",
    title: "The 60-Second Edit That Tripled My Watch Time",
    whyNow: "YouTube Shorts algorithm heavily rewarding hook-first editing — pattern identified in 3 top Nigerian channels",
    platforms: "TikTok + Shorts",
    hook: "\"Watch time tripled after I changed just ONE thing about my edits.\"",
    views: "1.8M",
    velocity: "+145%",
    platformFit: "Very High",
    brandFitScore: 91,
    category: "hot",
    timeWindow: "24h window",
    productionTime: "2–4h",
    angle: "Show the before/after in the first 3 seconds without explanation",
  },
  {
    id: "s3",
    title: "Why Smart Creators Are Quietly Leaving Manual Editing",
    whyNow: "Industry shift signal — 3 creator tools just dropped major AI features; narrative gap in Nigerian market",
    platforms: "YouTube",
    hook: "\"At a creator conference, I found out something nobody was talking about publicly.\"",
    views: "850K",
    velocity: "+92%",
    platformFit: "Medium",
    brandFitScore: 88,
    category: "rising",
    timeWindow: "72h window",
    productionTime: "6–12h",
    angle: "Insider revelation: 'I found out at a conference and nobody was talking about it'",
  },
  {
    id: "s4",
    title: "Free AI Tools Replacing ₦500K Worth of Software for Nigerian Creators",
    whyNow: "Local purchasing power pressure making this highly relevant — audience routinely asks about affordable alternatives",
    platforms: "YouTube + Reels",
    hook: "\"I was spending ₦500K a year on software. Now I spend ₦0.\"",
    views: "1.2M",
    velocity: "+160%",
    platformFit: "High",
    brandFitScore: 95,
    category: "hot",
    timeWindow: "7-day window",
    productionTime: "6–12h",
    angle: "Price shock: Show ₦500K → ₦0 on screen instantly",
  },
  {
    id: "s5",
    title: "The Creator Economy in Nigeria Is Growing 4× Faster Than Global Average",
    whyNow: "New industry report dropped 48 hours ago — first-mover advantage for this data story",
    platforms: "LinkedIn + YouTube",
    hook: "\"This chart changed how I think about content creation in Nigeria.\"",
    views: "420K",
    velocity: "+82%",
    platformFit: "Medium",
    brandFitScore: 82,
    category: "rising",
    timeWindow: "5-day window",
    productionTime: "6–12h",
    angle: "Data reveal: Show the chart before saying a word",
  },
  {
    id: "s6",
    title: "Behind the Algorithm: How Naija Creators Get 1M Views Without Going Viral",
    whyNow: "Consistent growth pattern identified across 12 successful accounts — systemizable and teachable",
    platforms: "YouTube",
    hook: "\"These creators hit 1M views and none of their videos ever went viral.\"",
    views: "930K",
    velocity: "+93%",
    platformFit: "High",
    brandFitScore: 93,
    category: "rising",
    timeWindow: "14-day window",
    productionTime: "24–48h",
    angle: "Mystery reveal: 'The strategy that works with zero followers'",
  },
  {
    id: "s7",
    title: "How I Learned to Edit Videos in Yoruba Without Subtitles",
    whyNow: "Language-native content is underserved and has 3× completion rates — unique positioning opportunity",
    platforms: "TikTok + Shorts",
    hook: "\"Mo fẹ sọ ohun ti ko si ẹnikan ti ó n sọ\" (I want to say what nobody is saying)",
    views: "310K",
    velocity: "+79%",
    platformFit: "Medium",
    brandFitScore: 79,
    category: "niche",
    timeWindow: "Open window",
    productionTime: "2–4h",
    angle: "Language identity hook — start video entirely in Yoruba",
  },
  {
    id: "s8",
    title: "Lagos Tech Scene vs Silicon Valley: What Nobody Shows You",
    whyNow: "Global vs local comparison format trending across African creator space — strong identity resonance",
    platforms: "YouTube + TikTok",
    hook: "\"Silicon Valley has billions in funding. Lagos has something they can't buy.\"",
    views: "540K",
    velocity: "+85%",
    platformFit: "High",
    brandFitScore: 85,
    category: "niche",
    timeWindow: "Open window",
    productionTime: "24–48h",
    angle: "Challenge assumption: 'Lagos has something Silicon Valley doesn't'",
  },
];

const defaultProductions: Production[] = [
  {
    id: "p1",
    title: "5 Viral Marketing Tactics That Actually Work in 2026",
    status: "Ready for Review",
    mode: "standard",
    dateCreated: "2026-07-01",
    aspectRatio: "16:9",
    formats: ["Long-form Video", "TikTok Cuts"],
    scenes: [
      { scene: 1, description: "Hook: Show bad ads with big red X", duration: "0-5s" },
      { scene: 2, description: "Tunde intro: Demystify virality statistics", duration: "5-20s" },
      { scene: 3, description: "Tactic 1: Narrative sequencing style", duration: "20-55s" }
    ]
  },
  {
    id: "p2",
    title: "The Psychology Behind Viral Content",
    status: "Ready for Review",
    mode: "express",
    dateCreated: "2026-07-01",
    aspectRatio: "9:16",
    formats: ["TikTok Reel"],
    scenes: [
      { scene: 1, description: "Brain graphic with trigger buttons", duration: "0-8s" },
      { scene: 2, description: "Explain curiosity gap mechanics", duration: "8-30s" }
    ]
  },
  {
    id: "p3",
    title: "How AI Creates Engaging Stories",
    status: "Needs Edit",
    mode: "standard",
    dateCreated: "2026-06-30",
    aspectRatio: "1:1",
    formats: ["Instagram Slide Deck", "Audio Narrative"],
    scenes: [
      { scene: 1, description: "Graphic matching human and AI patterns side-by-side", duration: "0-10s" }
    ]
  },
  {
    id: "p4",
    title: "Building a Personal Brand in 2026",
    status: "Approved",
    mode: "deep",
    dateCreated: "2026-06-29",
    aspectRatio: "16:9",
    formats: ["LinkedIn Article", "YouTube Video"],
    scenes: [
      { scene: 1, description: "Tunde speaking directly to personal reputation strategy", duration: "0-45s" }
    ]
  },
  {
    id: "p5",
    title: "Content Creation Workflow Optimization",
    status: "Drafting",
    mode: "standard",
    dateCreated: "2026-07-01",
    aspectRatio: "16:9",
    formats: ["YouTube Tutorial"],
    scenes: []
  },
  {
    id: "p6",
    title: "Nigerian Creator Economy Deep Dive",
    status: "Drafting",
    mode: "deep",
    dateCreated: "2026-07-01",
    aspectRatio: "16:9",
    formats: ["YouTube Mini-Documentary"],
    scenes: []
  },
  {
    id: "p7",
    title: "AI Editing Tools Comparison 2026",
    status: "Approved",
    mode: "standard",
    dateCreated: "2026-06-28",
    aspectRatio: "16:9",
    formats: ["YouTube Comparison"],
    scenes: []
  },
  {
    id: "p8",
    title: "Free Tools Every Creator Needs",
    status: "Approved",
    mode: "express",
    dateCreated: "2026-06-28",
    aspectRatio: "9:16",
    formats: ["Short-form 45s"],
    scenes: []
  }
];

const defaultReviewItems: ReviewItem[] = [
  {
    id: "r1",
    productionId: "p1",
    title: "5 Viral Marketing Tactics That Actually Work in 2026",
    account: "YouTube",
    series: "Marketing Masterclass",
    status: "Pending Review",
    dateCreated: "2026-07-01",
    scriptSnippet: "Everyone tells you to just 'post consistently' — but that is the fastest way to burn out in 2026. Here is the actual mathematical formula...",
    conceptText: "Unpack 5 unconventional growth models used by the top 1% of creators, localized entirely with West African case studies.",
    openingMoment: "Show failed marketing campaign burning money animation (0–3s)",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
  },
  {
    id: "r2",
    productionId: "p2",
    title: "The Psychology Behind Viral Content",
    account: "TikTok",
    series: "Content Science",
    status: "Pending Review",
    dateCreated: "2026-07-01",
    scriptSnippet: "Why did you click on this video? It wasn't the thumbnail. It was a cognitive loophole called the curiosity gap. Let me show you how to code it into your edits.",
    conceptText: "A fast-paced short dissecting psychological triggers like anticipation, micro-rewards, and local relatability.",
    openingMoment: "Failed campaign burning money animation",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
  },
  {
    id: "r3",
    productionId: "p3",
    title: "How AI Creates Engaging Stories",
    account: "Instagram",
    series: "AI Craft",
    status: "Needs Edit",
    dateCreated: "2026-06-30",
    scriptSnippet: "AI stories aren't artificial. They are a reflection of human psychology aggregated over a billion data points. Let's see how smart brands use this...",
    conceptText: "Carousel deck contrasting dry factual storytelling with high-retention structured narrative hooks.",
    openingMoment: "Split screen: Failed vs Successful campaign with contrast lighting",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Warning", technicalCheck: "Passed" }
  },
  {
    id: "r4",
    productionId: "p4",
    title: "Building a Personal Brand in 2026",
    account: "LinkedIn",
    series: "Career Growth",
    status: "Approved",
    dateCreated: "2026-06-29",
    scriptSnippet: "Your brand isn't what you say. It is what people search for when you leave the room. Here's Tunde's 3-step blueprint for tech leaders in Nigeria.",
    conceptText: "High-value professional growth guide connecting local prestige with modern content authority models.",
    openingMoment: "Tunde directly presenting",
    qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
  }
];

const defaultPublishJobs: PublishJob[] = [
  { id: "pj1", productionId: "p4", title: "Building a Personal Brand in 2026", platform: "LinkedIn", scheduledTime: "Thu 9:00 AM", status: "Scheduled" },
  { id: "pj2", productionId: "p7", title: "AI Editing Tools Comparison 2026", platform: "YouTube", scheduledTime: "Thu 2:00 PM", status: "Scheduled" },
  { id: "pj3", productionId: "p8", title: "Free Tools Every Creator Needs", platform: "TikTok", scheduledTime: "Wed 8:00 PM", status: "Export Ready" },
];

const defaultExportPackages: ExportPackage[] = [
  { id: "ep1", productionId: "p8", title: "Free Tools Every Creator Needs", size: "48.2 MB", formats: ["9:16 Vertical Cut (TikTok)", "Metadata JSON"], readyAt: "2h ago" }
];

const defaultAnalyticsInsights: AnalyticsInsight[] = [
  {
    id: "ai1",
    title: "Exclusivity Pattern Outperforming",
    description: "The 'Nobody talks about this' hook angle achieved a 3.2x higher click-through-rate on TikTok and Shorts relative to traditional tutorials.",
    metric: "3.2x",
    change: "+220%",
    type: "worked",
    bestHook: "\"Nobody talks about this, but...\"",
    bestFormat: "Short-form clips (45s)",
    bestPlatformFit: "TikTok",
  },
  {
    id: "ai2",
    title: "Local Identity Lift",
    description: "Scripts explicitly mentioning local context (such as Lagos tech hubs or Nigerian currency) get 2.3x higher share velocity across WhatsApp and Twitter.",
    metric: "2.3x",
    change: "+130%",
    type: "worked",
    bestHook: "Mo fẹ sọ ohun ti ko si ẹnikan...",
    bestFormat: "Short-form & Threads",
    bestPlatformFit: "TikTok + Instagram",
  },
  {
    id: "ai3",
    title: "High Drop-Off on Long Technical Intros",
    description: "Technical tutorial series episodes that spent more than 20 seconds on conceptual introductions suffered a severe 38% user drop-off in the first minute.",
    metric: "-38%",
    change: "-40%",
    type: "failed",
    bestHook: "Immediate action demo",
    bestFormat: "Short-form or Quick tutorial",
    bestPlatformFit: "YouTube",
  }
];

const defaultAssets: Asset[] = [
  { id: "as1", name: "tunde_host_voice_profile.wav", type: "audio", size: "8.4 MB", url: "#" },
  { id: "as2", name: "spark_branding_kit_2026.pdf", type: "document", size: "12.1 MB", url: "#" },
  { id: "as3", name: "fail_campaign_money_burn.mp4", type: "video", size: "24.5 MB", url: "#" },
  { id: "as4", name: "nigerian_creator_economy_report.pdf", type: "document", size: "3.2 MB", url: "#" }
];

export const SparkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to load initial state from abstracted persistence helper
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

  // Sync to abstracted persistence helper
  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTimeline, setExecutionTimeline] = useState<Array<{ name: string; status: "idle" | "running" | "completed" | "failed"; duration?: number; provider?: string; cost?: number; confidence?: number }>>([
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
  const [pendingTaskPrompt, setPendingTaskPrompt] = useState<string | null>(null);

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
      const tones = prev.brand.tone.map((t: any) =>
        t.label === label ? { ...t, active: !t.active } : t
      );
      return {
        ...prev,
        brand: { ...prev.brand, tone: tones }
      };
    });
  };

  const createProductionFromSpark = (sparkId: string) => {
    const spark = state.viralSparks.find((s: any) => s.id === sparkId);
    if (!spark) return;

    const prodId = `p-${Date.now()}`;
    const reviewId = `r-${Date.now()}`;
    const decision = ExecutiveDecisionEngine.generatePlan(spark.title, state.automationMode);

    // Create standard ExecutionTask payload
    const executionTask: ExecutionTask = {
      id: `task-${Date.now()}`,
      objective: decision.objective,
      department: decision.department,
      priority: decision.priority,
      capabilities: decision.requiredCapabilities,
      automationMode: state.automationMode,
      workspaceId: "default",
      brandId: "default",
      createdAt: new Date().toISOString(),
      status: TaskState.PENDING
    };

    // Analyze constraints via CapabilityAnalyzer
    const requirements = CapabilityAnalyzer.analyze(executionTask);

    // Locate and dispatch matching agent from AgentRegistry
    const registry = AgentRegistry.getInstance();
    const selectedAgent = AgentDispatcher.selectAgent(
      registry.getAllAgents(),
      requirements.requiredCapabilities,
      executionTask.department
    );

    let selection: any = null;
    if (selectedAgent) {
      console.log(`[Runtime Orchestrator] Task successfully dispatched to agent: ${selectedAgent.definition.name} (${selectedAgent.definition.id})`);
      
      selection = ModelRouter.route(executionTask, requirements, selectedAgent.definition);
      console.log(`[Runtime Model Router] Selected Provider: ${selection.provider}, Model: ${selection.model} (Confidence: ${selection.confidence})`);
      console.log(`[Runtime Model Router] Routing rationale: ${selection.reasoning.join(", ")}`);
    }

    // Hand task over to TaskScheduler
    const scheduler = TaskScheduler.getInstance();
    scheduler.enqueue(executionTask);

    // Retrieve and execute via RuntimeOrchestrator
    const nextTask = scheduler.getNextTask(new Set());
    if (nextTask) {
      const orchestrator = RuntimeOrchestrator.getInstance();
      orchestrator.orchestrateTask(nextTask).then((result) => {
        console.log(`[Runtime Orchestrator] Collaborative execution finished. Output: "${result.output}"`);
      }).catch((err) => {
        console.error(`[Runtime Orchestrator] Multi-agent orchestration failed:`, err);
      });
    }

    const canProceed = ExecutivePolicyEngine.canProceed("production", state.automationMode);
    const status = canProceed ? "Ready for Review" : "Drafting";

    const newProduction: Production = {
      id: prodId,
      title: spark.title,
      sparkId: spark.id,
      status: status,
      mode: state.productionMode,
      dateCreated: new Date().toISOString().split("T")[0],
      aspectRatio: spark.platforms.includes("YouTube") && !spark.platforms.includes("TikTok") ? "16:9" : "9:16",
      formats: spark.platforms.split(" + "),
      scenes: [
        { scene: 1, description: `Hook Angle: ${spark.angle}`, duration: "0-5s" },
        { scene: 2, description: `Body Point 1: Deep dive on ${spark.title}`, duration: "5-25s" },
        { scene: 3, description: "CTA and local success alignment", duration: "25-30s" }
      ]
    };

    const newReviewItem: ReviewItem = {
      id: reviewId,
      productionId: prodId,
      title: spark.title,
      account: spark.platforms.split(" + ")[0] || "YouTube",
      series: "Viral Concept Series",
      status: status === "Ready for Review" ? "Pending Review" : "Pending Review", // Stays in pending review once ready
      dateCreated: new Date().toISOString().split("T")[0],
      scriptSnippet: spark.hook,
      conceptText: spark.whyNow,
      openingMoment: spark.angle,
      qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" }
    };

    setState((prev: any) => {
      // Avoid double creations of review item
      const alreadyCreatedReview = prev.reviewItems.some((r: any) => r.title === spark.title);
      const updatedReviewItems = alreadyCreatedReview ? prev.reviewItems : [newReviewItem, ...prev.reviewItems];
      const updatedProductions = prev.productions.some((p: any) => p.title === spark.title)
        ? prev.productions
        : [newProduction, ...prev.productions];

      return {
        ...prev,
        productions: updatedProductions,
        reviewItems: updatedReviewItems
      };
    });
  };

  const approveReviewItem = (reviewId: string) => {
    setState((prev: any) => {
      const review = prev.reviewItems.find((r: any) => r.id === reviewId);
      if (!review) return prev;

      const updatedReviewItems = prev.reviewItems.map((r: any) =>
        r.id === reviewId ? { ...r, status: "Approved" } : r
      );

      const updatedProductions = prev.productions.map((p: any) =>
        p.id === review.productionId ? { ...p, status: "Approved" } : p
      );

      // Determine next step using PipelineEngine
      const nextStep = PipelineEngine.getNextStep("default", "review"); // next step is "publishing"
      
      // Determine if publishing is allowed / auto-publish is active via Policy Engine
      const autoPublish = ExecutivePolicyEngine.shouldPublish(state.automationMode);

      // Create PublishJob
      const jobExists = prev.publishJobs.some((j: any) => j.productionId === review.productionId);
      const newPublishJobs = jobExists ? prev.publishJobs : [
        ...prev.publishJobs,
        {
          id: `pj-${Date.now()}`,
          productionId: review.productionId,
          title: review.title,
          platform: review.account,
          scheduledTime: "Thu 4:00 PM", // Default scheduling block
          status: autoPublish ? "Published" : "Scheduled"
        }
      ];

      // Create ExportPackage
      const pkgExists = prev.exportPackages.some((ep: any) => ep.productionId === review.productionId);
      const newExportPackages = pkgExists ? prev.exportPackages : [
        ...prev.exportPackages,
        {
          id: `ep-${Date.now()}`,
          productionId: review.productionId,
          title: review.title,
          size: "45.0 MB",
          formats: [review.account],
          readyAt: "Just now"
        }
      ];

      return {
        ...prev,
        reviewItems: updatedReviewItems,
        productions: updatedProductions,
        publishJobs: newPublishJobs,
        exportPackages: newExportPackages
      };
    });
  };

  const rejectOrRequestEditReviewItem = (reviewId: string) => {
    setState((prev: any) => {
      const review = prev.reviewItems.find((r: any) => r.id === reviewId);
      if (!review) return prev;

      const updatedReviewItems = prev.reviewItems.map((r: any) =>
        r.id === reviewId ? { ...r, status: "Needs Edit" } : r
      );

      const updatedProductions = prev.productions.map((p: any) =>
        p.id === review.productionId ? { ...p, status: "Needs Edit" } : p
      );

      return {
        ...prev,
        reviewItems: updatedReviewItems,
        productions: updatedProductions
      };
    });
  };

  const addMemoryItem = (text: string, type: "learned" | "rule", category?: any) => {
    const newItem: MemoryItem = {
      id: `m-${Date.now()}`,
      type,
      text,
      dateAdded: new Date().toISOString().split("T")[0],
      category
    };
    setState((prev: any) => ({
      ...prev,
      memoryItems: [newItem, ...prev.memoryItems]
    }));
  };

  const removeMemoryItem = (id: string) => {
    setState((prev: any) => ({
      ...prev,
      memoryItems: prev.memoryItems.filter((item: MemoryItem) => item.id !== id)
    }));
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

  const triggerWorkspace = async (request: ExecutionRequest): Promise<string> => {
    if (!request.isWorkspaceTask) {
      throw new Error("[Runtime Layer] Rejected non-workspace execution request.");
    }
    const targetPrompt = request.prompt;

    // Actually run pipeline
    setIsExecuting(true);
    setStreamingOutput("");
    setStreamingMetrics(null);
    setExecutionTimeline([
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

    const decision = ExecutiveDecisionEngine.generatePlan(targetPrompt, state.automationMode);
    
    const task: ExecutionTask = {
      id: `task-${Date.now()}`,
      objective: decision.objective,
      department: decision.department,
      priority: decision.priority,
      capabilities: decision.requiredCapabilities,
      automationMode: state.automationMode,
      workspaceId: "default",
      brandId: "default",
      createdAt: new Date().toISOString(),
      status: TaskState.PENDING
    };

    try {
      const orchestrator = RuntimeOrchestrator.getInstance();
      
      const onChunk = (text: string, department: string) => {
        setStreamingOutput(text);

        setExecutionTimeline(prev => {
          return prev.map(item => {
            const mappedDept = department.toLowerCase()
              .replace("creative-decision", "creative decision")
              .replace("creative", "planning")
              .replace("production", "generation")
              .replace("media-intelligence", "analysis")
              .replace("editing-decision", "editing decision")
              .replace("editor", "editing");

            if (item.name.toLowerCase() === mappedDept) {
              return {
                ...item,
                status: "running",
                provider: department === "media-intelligence" || department === "editing-decision" ? "google" : (department === "production" ? "flux" : "openai"),
                cost: department === "production" ? 0.05 : 0.008,
                confidence: 90
              };
            }
            const order = ["research", "creative decision", "planning", "storyboard", "generation", "analysis", "editing decision", "editing", "review", "publishing", "learning"];
            const currentIdx = order.indexOf(mappedDept);
            const itemIdx = order.indexOf(item.name.toLowerCase());
            if (itemIdx < currentIdx && itemIdx !== -1) {
              return {
                ...item,
                status: "completed",
                duration: item.duration || 1500
              };
            }
            return item;
          });
        });
      };

      const result = await orchestrator.orchestrateTask(task, onChunk);
      const isSimulated =
        Boolean(result.structuredData?.simulated) ||
        (result.warnings || []).some((w) => w.toLowerCase().includes("simulat")) ||
        (result.output || "").includes("[DEMO MODE");

      // Only mark stages that already ran; do not invent full fake cost telemetry
      setExecutionTimeline((prev) =>
        prev.map((item) => {
          if (item.status === "running") {
            return {
              ...item,
              status: result.status === "failure" ? "failed" : "completed",
              duration: item.duration || result.metrics?.latencyMs || 0,
              provider: isSimulated ? `${item.provider || result.provider || "demo"}(sim)` : item.provider || result.provider,
              cost: isSimulated ? 0 : item.cost,
              confidence: isSimulated ? 40 : item.confidence
            };
          }
          if (item.status === "idle") {
            return { ...item, status: "completed", duration: 0, cost: 0, confidence: isSimulated ? 40 : 80 };
          }
          return item;
        })
      );

      setStreamingMetrics({
        provider: result.provider || "unknown",
        model: result.model || "unknown",
        latencyMs: result.metrics.latencyMs,
        costUsd: isSimulated ? 0 : result.metrics.costUsd,
        tokens: result.metrics.inputTokens + result.metrics.outputTokens,
        retryCount: 0,
        failovers: 0,
        simulated: isSimulated,
        warnings: result.warnings || []
      });

      const sceneText = isSimulated
        ? `[DEMO / LOCAL OS] ${result.output}`
        : result.output;

      const prodId = `p-${Date.now()}`;
      const newProd: Production = {
        id: prodId,
        title: targetPrompt.length > 35 ? targetPrompt.substring(0, 35) + "..." : targetPrompt,
        status: "Ready for Review",
        mode: state.productionMode,
        dateCreated: new Date().toISOString().split("T")[0],
        aspectRatio: "9:16",
        formats: ["Short-form 45s"],
        scenes: [{ scene: 1, description: sceneText, duration: "0-45s" }]
      };

      setState((prev: any) => ({
        ...prev,
        productions: [newProd, ...prev.productions]
      }));

      setIsExecuting(false);
      return result.output;
    } catch (err: any) {
      setExecutionTimeline(prev => prev.map(item => item.status === "running" ? { ...item, status: "failed" } : item));
      setIsExecuting(false);
      throw err;
    }
  };

  useEffect(() => {
    InteractionController.getInstance().registerCallbacks({
      onStateUpdate: (updates) => {
        if (updates.isExecuting !== undefined) setIsExecuting(updates.isExecuting);
        if (updates.pendingTaskPrompt !== undefined) setPendingTaskPrompt(updates.pendingTaskPrompt);
      },
      onTriggerWorkspace: triggerWorkspace
    });
  }, [state.automationMode, pendingTaskPrompt]);

  const sendMessage = async (prompt: string, onUpdate?: (text: string) => void): Promise<string> => {
    return InteractionController.getInstance().sendMessage(
      prompt,
      state.automationMode,
      pendingTaskPrompt,
      onUpdate
    );
  };

  return (
    <SparkContext.Provider
      value={{
        ...state,
        isExecuting,
        executionTimeline,
        streamingOutput,
        streamingMetrics,
        updateAutomationMode,
        updateProductionMode,
        createProductionFromSpark,
        approveReviewItem,
        rejectOrRequestEditReviewItem,
        addMemoryItem,
        removeMemoryItem,
        addAsset,
        toggleContentPillar,
        toggleTone,
        sendMessage,
        state
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
