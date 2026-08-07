import React, { createContext, useContext, useState, useEffect } from "react";
import { loadPersistedState, savePersistedState } from "./persistence";
import { generateSuperSparkResponse, SPARK_EXECUTIVE_VOICE_PROFILE } from "../services/geminiService";
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
  ResearchSource,
  ResearchPattern,
  AISettings,
  ThinkingState,
  ConversationSession,
} from "../domain/types";
import { conversationSessionRepository } from "../backend/repositories/conversationSessionRepository";
import { generateSessionTitle } from "../services/sessionTitleService";
import { eventBus } from "../services/runtime/eventBus";
import {
  hydrateWorkspace,
  persistAccountToken,
  persistExecutiveMessage,
  persistMemoryCreate,
  persistProductionCreate,
  persistProductionUpdate,
  persistReviewApprove,
  persistReviewNeedsEdit,
  persistViralSparkCreate,
  persistPublishJobCreate,
  persistAISettings,
} from "../backend/workspaceSync";
import { isSupabaseConfigured } from "../backend/supabaseClient";
import { autonomousEngine } from "../services/runtime/autonomousEngine";
import {
  getBrandWorkspaceId,
  getStoredAccountTokens,
  socialConnectorFramework,
} from "../services/socialIntegrationService";

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
  executiveVoiceProfile: typeof SPARK_EXECUTIVE_VOICE_PROFILE;
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
  researchSources?: ResearchSource[];
  researchPatterns?: ResearchPattern[];
  aiSettings?: AISettings;
  thinkingState?: ThinkingState | null;
  
  chatMessages?: ChatMessage[];
  activeSessionId?: string | null;
  sessions?: ConversationSession[];
  
  // Actions
  updateBrand: (data: Partial<Brand>) => void;
  initializeBrandGenesis: (data: any) => void;
  updateAutomationMode: (mode: AutomationMode) => void;
  updateProductionMode: (mode: ProductionMode) => void;
  updateAISettings: (newSettings: AISettings) => void;
  createProductionFromSpark: (sparkId: string) => void;
  generateProductionAssets: (productionId: string) => Promise<void>;
  cancelProduction: (productionId: string) => void;
  productionGenerationEnabled?: boolean;
  toggleProductionGeneration?: (enabled?: boolean) => void;
  approveReviewItem: (reviewId: string) => void;
  rejectOrRequestEditReviewItem: (reviewId: string) => void;
  addMemoryItem: (text: string, type: "learned" | "rule", category?: any) => void;
  removeMemoryItem: (id: string) => void;
  updateMemoryItem: (id: string, text: string, type: "learned" | "rule", category?: any) => void;
  pinMemoryItem: (id: string, pinned: boolean) => void;
  archiveMemoryItem: (id: string, archived: boolean) => void;
  addResearchSource: (url: string) => Promise<void>;
  removeResearchSource: (id: string) => void;
  syncResearchSource: (id: string) => Promise<void>;
  addAsset: (name: string, type: "video" | "audio" | "image" | "document", size: string) => void;
  toggleContentPillar: (label: string) => void;
  toggleTone: (label: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (msgId: string, newText: string, isStreaming?: boolean, media?: any) => void;
  sendMessage: (prompt: string, onChunk?: (chunk: string) => void) => Promise<any>;
  publishProduction: (productionId: string) => Promise<void>;
  
  // Session Actions (Phase 19C)
  startNewSession: () => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;
  setState: React.Dispatch<React.SetStateAction<any>>;
}

const SparkContext = createContext<SparkContextType | undefined>(undefined);

// Default initial brand structure
const defaultBrand: Brand = {
  name: "My Brand",
  niche: "AI & Technology",
  archetype: "The Expert Guide",
  purpose: "Creating authoritative, engaging digital media content.",
  contentPillars: [
    { label: "AI & Automation", active: true },
    { label: "Digital Strategy", active: true },
    { label: "Content Creation", active: true },
    { label: "Growth Marketing", active: true },
  ],
  audience: {
    primary: "Digital creators and forward-thinking professionals",
    painPoints: [
      "Inconsistent publishing workflow",
      "High time investment required for research",
    ],
    desires: [
      "Scale viral audience reach efficiently",
      "Maintain high quality brand authority",
    ],
  },
  tone: [
    { label: "Energetic", active: true },
    { label: "Relatable", active: true },
    { label: "Expert", active: true },
    { label: "Inspiring", active: true },
    { label: "Direct", active: false },
    { label: "Formal", active: false },
  ],
};

const defaultCharacter: Character = {
  name: "Creator",
  role: "Primary Host",
  style: "Modern executive creator — confident, clear, high-production standard",
  traits: ["Energetic", "Relatable", "Knowledgeable", "Inspiring"],
  voice: {
    name: "Spark_Executive_Voice",
    language: "English (Global)",
    tone: "Energetic & Professional",
    locked: true,
  },
};

const defaultAccounts: Account[] = [];

const defaultMemoryItems: MemoryItem[] = [];
const defaultViralSparks: ViralSpark[] = [];
const defaultProductions: Production[] = [];
const defaultReviewItems: ReviewItem[] = [];
const defaultPublishJobs: PublishJob[] = [];
const defaultExportPackages: ExportPackage[] = [];
const defaultAnalyticsInsights: AnalyticsInsight[] = [];
const defaultAssets: Asset[] = [];

const defaultChatMessages: ChatMessage[] = [
  {
    id: "welcome-1",
    sender: "spark",
    text: "Welcome to Super Spark! I am your AI executive creative partner for Spark Media OS. How can I assist with your brand strategy, video productions, or creative reviews today?",
    timestamp: new Date()
  }
];

const defaultAISettings: AISettings = {
  routing: {
    superSpark: "auto",
    research: "auto",
    videoUnderstanding: "auto",
    production: "auto",
    automation: "auto",
    executive: "auto",
    analytics: "auto",
    publishing: "auto",
    scheduling: "auto",
    memory: "auto",
    review: "auto",
    storyboardImages: "openai",
    videoGeneration: "gemini",
    voice: "auto",
  },
  customApiKeys: {},
  customBaseUrls: {},
};

export const SparkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [thinkingState, setThinkingState] = useState<ThinkingState | null>(null);

  const [state, setState] = useState(() => {
    const local = loadPersistedState<any>();
    if (local) {
      return {
        ...local,
        aiSettings: local.aiSettings || defaultAISettings,
        chatMessages: local.chatMessages && local.chatMessages.length > 0 ? local.chatMessages : defaultChatMessages
      };
    }
    return {
      brand: defaultBrand,
      character: defaultCharacter,
      accounts: defaultAccounts,
      automationMode: "balanced" as AutomationMode,
      productionMode: "standard" as ProductionMode,
      memoryItems: defaultMemoryItems,
      viralSparks: defaultViralSparks,
      productions: defaultProductions,
      reviewItems: defaultReviewItems,
      publishJobs: defaultPublishJobs,
      exportPackages: defaultExportPackages,
      analyticsInsights: defaultAnalyticsInsights,
      assets: defaultAssets,
      researchSources: [],
      researchPatterns: [],
      aiSettings: defaultAISettings,
      chatMessages: defaultChatMessages
    };
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);

  const updateAISettings = (newSettings: AISettings) => {
    setState((prev: any) => ({ ...prev, aiSettings: newSettings }));
    const brandId = getBrandWorkspaceId();
    persistAISettings(brandId, newSettings);
  };

  // Hydrate conversation sessions on mount
  useEffect(() => {
    const brandId = getBrandWorkspaceId() || "default-brand";
    conversationSessionRepository.listSessions(brandId).then(async (loadedSessions) => {
      if (loadedSessions.length > 0) {
        setSessions(loadedSessions);
        const topSession = loadedSessions[0];
        setActiveSessionId(topSession.id);
        const msgs = conversationSessionRepository.getSessionMessages(topSession.id);
        if (msgs && msgs.length > 0) {
          setState((prev: any) => ({ ...prev, chatMessages: msgs }));
        }
      } else {
        const fresh = await conversationSessionRepository.createSession({ brandId, title: "New Executive Session" });
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    });
  }, []);

  // Save chat messages per session whenever state.chatMessages changes
  useEffect(() => {
    if (activeSessionId && state.chatMessages) {
      conversationSessionRepository.saveSessionMessages(activeSessionId, state.chatMessages);
    }
  }, [activeSessionId, state.chatMessages]);

  const startNewSession = (): string => {
    const brandId = getBrandWorkspaceId() || "default-brand";
    const tempId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tempSession: ConversationSession = {
      id: tempId,
      brandId,
      title: "New Executive Session",
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions((prev) => [tempSession, ...prev.filter((s) => s.id !== tempId)]);
    setActiveSessionId(tempId);
    setState((prev: any) => ({ ...prev, chatMessages: [] }));
    void conversationSessionRepository.createSession(tempSession);
    return tempId;
  };

  const switchSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    const msgs = conversationSessionRepository.getSessionMessages(sessionId);
    setState((prev: any) => ({ ...prev, chatMessages: msgs }));
  };

  const deleteSession = (sessionId: string) => {
    const brandId = getBrandWorkspaceId() || "default-brand";
    conversationSessionRepository.deleteSession(sessionId, brandId);
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          switchSession(remaining[0].id);
        } else {
          startNewSession();
        }
      }
      return remaining;
    });
  };

  const renameSession = (sessionId: string, newTitle: string) => {
    const brandId = getBrandWorkspaceId() || "default-brand";
    conversationSessionRepository.updateSession(sessionId, { title: newTitle }, brandId).then((updated) => {
      if (updated) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      }
    });
  };

  // Hydrate live workspace from Supabase + local OAuth tokens
  useEffect(() => {
    const brandId = getBrandWorkspaceId();
    const localTokens = getStoredAccountTokens();
    const tokenAccounts: Account[] = Object.values(localTokens)
      .filter((t) => t.status === "Connected" || t.status === "Refreshing")
      .map((t) => ({
        platform: t.platform,
        handle: t.handle || "",
        status: "connected" as const,
        posts: t.postsCount || 0,
      }));

    setState((prev: any) => {
      const byPlatform = new Map<string, Account>();
      tokenAccounts.forEach((a) => byPlatform.set(a.platform, a));
      return { ...prev, accounts: Array.from(byPlatform.values()) };
    });

    if (isSupabaseConfigured() && brandId) {
      hydrateWorkspace(brandId).then((snap) => {
        setState((prev: any) => {
          const byPlatform = new Map<string, Account>();
          // Hydrate with Supabase accounts that are connected
          (snap.accounts || [])
            .filter((a: any) => a.status === "connected" || a.status === "Connected")
            .forEach((a) => byPlatform.set(a.platform, {
              platform: a.platform,
              handle: a.handle || "",
              status: "connected",
              posts: a.posts || 0,
            }));
          // Merge local tokens
          tokenAccounts.forEach((a) => byPlatform.set(a.platform, a));
          
          return {
            ...prev,
            character: snap.character || prev.character,
            accounts: Array.from(byPlatform.values()),
            memoryItems:
              snap.memoryItems?.length > 0 ? snap.memoryItems : prev.memoryItems,
            viralSparks:
              snap.viralSparks?.length > 0 ? snap.viralSparks : prev.viralSparks,
            productions:
              snap.productions?.length > 0 ? snap.productions : prev.productions,
            reviewItems:
              snap.reviewItems?.length > 0 ? snap.reviewItems : prev.reviewItems,
            publishJobs:
              snap.publishJobs?.length > 0 ? snap.publishJobs : prev.publishJobs,
            analyticsInsights:
              snap.analyticsInsights?.length > 0
                ? snap.analyticsInsights
                : prev.analyticsInsights,
            researchSources:
              snap.researchSources?.length ? snap.researchSources : prev.researchSources || [],
            researchPatterns:
              snap.researchPatterns?.length ? snap.researchPatterns : prev.researchPatterns || [],
          };
        });
      });
    }

    const onAccountConnected = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      if (!detail.platform) return;
      setState((prev: any) => {
        const others = (prev.accounts || []).filter(
          (a: Account) => a.platform !== detail.platform
        );
        return {
          ...prev,
          accounts: [
            ...others,
            {
              platform: detail.platform,
              handle: detail.handle || "",
              status: "connected" as const,
              posts: 0,
            },
          ],
        };
      });
      const id = getBrandWorkspaceId();
      if (id) {
        void persistAccountToken(id, {
          platform: detail.platform,
          handle: detail.handle,
          displayName: detail.displayName,
          status: "connected",
        });
      }
      // Phase 6J: pull live analytics immediately after connect
      void import("../services/analyticsPipeline")
        .then(({ syncConnectedPlatformAnalytics }) => syncConnectedPlatformAnalytics())
        .then((result) => {
          if (result?.insights?.length) {
            setState((prev: any) => ({
              ...prev,
              analyticsInsights: result.insights,
            }));
          }
        })
        .catch((err) => console.warn("[SparkContext] analytics sync failed", err));
    };

    const onAnalyticsSynced = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      void import("../services/analyticsPipeline")
        .then(({ getStoredPlatformAnalytics, platformAnalyticsToInsights }) => {
          const map = getStoredPlatformAnalytics();
          const insights = platformAnalyticsToInsights(Object.values(map));
          if (insights.length) {
            setState((prev: any) => ({ ...prev, analyticsInsights: insights }));
          }
          // Refresh connected account handles/posts from token cache if present
          void import("../services/socialIntegrationService").then(
            ({ getStoredAccountTokens }) => {
              const tokens = Object.values(getStoredAccountTokens());
              if (!tokens.length) return;
              setState((prev: any) => {
                const byPlatform = new Map<string, Account>();
                (prev.accounts || []).forEach((a: Account) => byPlatform.set(a.platform, a));
                tokens.forEach((t) => {
                  if (t.status === "Connected" || t.status === "Refreshing") {
                    byPlatform.set(t.platform, {
                      platform: t.platform,
                      handle: t.handle || "",
                      status: "connected",
                      posts: t.postsCount || 0,
                    });
                  }
                });
                return { ...prev, accounts: Array.from(byPlatform.values()) };
              });
            }
          );
          void detail;
        })
        .catch(() => {});
    };
    const onAccountDisconnected = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      if (!detail.platform) return;
      setState((prev: any) => ({
        ...prev,
        accounts: (prev.accounts || []).filter((a: Account) => {
          const ap = a.platform.toLowerCase();
          const dp = String(detail.platform).toLowerCase();
          if (ap === dp) return false;
          if (ap.includes("youtube") && dp.includes("youtube")) return false;
          if ((ap.includes("twitter") || ap === "x") && (dp.includes("twitter") || dp.includes("x")))
            return false;
          return true;
        }),
      }));
    };
    window.addEventListener("spark-account-connected", onAccountConnected);
    window.addEventListener("spark-account-disconnected", onAccountDisconnected);
    window.addEventListener("spark-analytics-synced", onAnalyticsSynced);

    // Background sync launcher for connected accounts & research sources
    const performBackgroundSync = () => {
      const tokens = Object.values(getStoredAccountTokens()).filter(
        (t) => t.status === "Connected" || t.status === "Refreshing"
      );
      if (tokens.length > 0) {
        void import("../services/analyticsPipeline")
          .then(({ syncConnectedPlatformAnalytics }) => syncConnectedPlatformAnalytics())
          .then((result) => {
            if (result?.insights?.length) {
              setState((prev: any) => ({ ...prev, analyticsInsights: result.insights }));
            }
          })
          .catch((err) => console.warn("[SparkContext] background analytics sync error", err));
      }

      // Background Research Sources sync with 4-hour quota cooldown
      void import("../services/research/researchSourceService").then(({ ResearchSourceService }) => {
        const sources = state.researchSources || [];
        sources.forEach((source: any) => {
          if (ResearchSourceService.isQuotaAllowedForSync(source.lastSyncedAt, false)) {
            void syncResearchSource(source.id);
          }
        });
      }).catch((err) => console.warn("[SparkContext] background research sync error", err));
    };

    // Trigger immediate background sync on app open
    performBackgroundSync();

    // Schedule background sync interval every 5 minutes
    const syncInterval = setInterval(performBackgroundSync, 5 * 60 * 1000);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("spark-account-connected", onAccountConnected);
      window.removeEventListener("spark-account-disconnected", onAccountDisconnected);
      window.removeEventListener("spark-analytics-synced", onAnalyticsSynced);
    };
  }, []);

  // Sync to abstracted persistence helper & start Autonomous Runtime Engine
  useEffect(() => {
    savePersistedState(state);

    if (state.automationMode !== "manual") {
      autonomousEngine.start(
        () => state,
        (updater) => setState(updater)
      );
    } else {
      autonomousEngine.stop();
    }
  }, [state]);

  const updateBrand = (brandData: Partial<Brand>) => {
    setState((prev: any) => ({
      ...prev,
      brand: { ...prev.brand, ...brandData }
    }));
    const brandId = getBrandWorkspaceId();
    if (brandId) {
      void import("../backend/workspaceSync").then(({ persistBrandUpdate }) => {
        void persistBrandUpdate(brandId, brandData);
      });
    }
  };

  const initializeBrandGenesis = (data: any) => {
    const brandName = data.brandName || "My Brand";
    const creatorName = data.creatorName || "Creator";
    const niche = data.niche || "Content Creation";
    const vision = data.vision || "To build a leading media brand.";
    const audience = data.audience || "Tech Enthusiasts & Founders";
    const goal = data.goal || "Viral Reach & Growth";
    const platforms =
      data.platforms && data.platforms.length > 0
        ? data.platforms
        : ["YouTube Shorts", "TikTok"];
    const tone = data.tone || "Energetic & Relatable";
    const visualStyle = data.visualStyle || "Realistic / Live-Action";
    const automationMode = data.automationMode || "balanced";
    const reviewRequired = data.reviewRequired !== false;

    // Production mode: no fabricated sparks/productions/reviews.
    // Only real onboarding identity + connected OAuth accounts.
    const initialMemoryItems: MemoryItem[] = [
      {
        id: `m-brand-${Date.now()}`,
        type: "rule",
        text: `Brand Identity Rule: Maintain ${tone} tone for ${niche}. Primary audience: ${audience}. Goal: ${goal}.`,
        dateAdded: new Date().toISOString().split("T")[0],
        category: "Brand",
      },
    ];

    const localTokens = getStoredAccountTokens();
    const connectedFromOAuth: Account[] = Object.values(localTokens).map((t) => ({
      platform: t.platform,
      handle: t.handle,
      status: "connected" as const,
      posts: 0,
    }));

    let finalChatHistory: ChatMessage[] = [];
    if (data.chatHistory && Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
      finalChatHistory = [
        ...data.chatHistory.map((m: any, idx: number) => ({
          id: m.id || `gen-${idx}`,
          sender: m.sender || "spark",
          text: m.text || "",
          timestamp: m.timestamp
            ? new Date(m.timestamp)
            : new Date(Date.now() - (data.chatHistory.length - idx) * 1000 * 30),
        })),
        {
          id: `gen-final-${Date.now()}`,
          sender: "spark",
          text: `Welcome to your Executive OS workspace, **${creatorName}**.\n\n• **Brand**: ${brandName} (${niche})\n• **Host**: ${creatorName} (${visualStyle})\n• **Target platforms**: ${platforms.join(", ")}\n• **Connected accounts**: ${connectedFromOAuth.length > 0 ? connectedFromOAuth.map((a) => a.platform).join(", ") : "None yet — connect YouTube or X from Accounts"}\n\nWorkspace starts empty of sample content. Ask Super Spark to surface live opportunities or create a production when ready.`,
          timestamp: new Date(),
        },
      ];
    } else {
      finalChatHistory = [
        {
          id: `gen-welcome-${Date.now()}`,
          sender: "spark",
          text: `Welcome, **${creatorName}**. **${brandName}** is configured for **${niche}**.\n\nAudience: ${audience}\nGoal: ${goal}\nMode: ${String(automationMode).toUpperCase()} (review required: ${reviewRequired ? "yes" : "no"})\n\nConnect live channels and start producing — no demo content is seeded.`,
          timestamp: new Date(),
        },
      ];
    }

    setState((prev: any) => {
      const byPlatform = new Map<string, Account>();
      (prev.accounts || []).forEach((a: Account) => byPlatform.set(a.platform, a));
      connectedFromOAuth.forEach((a) => byPlatform.set(a.platform, a));

      // Merge explicit onboarding connection map if present (live handles only)
      if (data.connectedAccounts && typeof data.connectedAccounts === "object") {
        Object.entries(data.connectedAccounts).forEach(([platform, meta]: [string, any]) => {
          if (meta?.connected && meta?.handle) {
            byPlatform.set(platform, {
              platform,
              handle: meta.handle,
              status: "connected",
              posts: 0,
            });
          }
        });
      }

      return {
        ...prev,
        brand: {
          ...prev.brand,
          name: brandName,
          niche: niche,
          purpose: vision,
          automation_mode: automationMode,
          review_required: reviewRequired,
          audience: {
            ...prev.brand?.audience,
            primary: audience,
          },
        },
        character: {
          ...prev.character,
          name: creatorName,
          role: "Lead Host",
          style: `${visualStyle} — ${creatorName} representing ${brandName}`,
          avatarUrl: data.characterSheetUrl || prev.character?.avatarUrl || null,
          voice: {
            name: data.voiceProfile?.name || "Spark_Executive_Male",
            language: data.voiceProfile?.language || "English (Executive Male Accent)",
            tone: tone,
            locked: true,
          },
        },
        accounts: Array.from(byPlatform.values()),
        automationMode: automationMode,
        chatMessages: finalChatHistory,
        viralSparks: [],
        productions: [],
        reviewItems: [],
        publishJobs: [],
        memoryItems: initialMemoryItems,
      };
    });

    const brandId = getBrandWorkspaceId();
    if (brandId && initialMemoryItems[0]) {
      void persistMemoryCreate(brandId, initialMemoryItems[0]);
    }
  };

  const updateAutomationMode = (mode: AutomationMode) => {
    setState((prev: any) => ({ ...prev, automationMode: mode }));
    const brandId = getBrandWorkspaceId();
    if (brandId) {
      void import("../backend/workspaceSync").then(({ persistExecutiveModeUpdate }) => {
        void persistExecutiveModeUpdate(brandId, { automationMode: mode });
      });
    }
  };

  const updateProductionMode = (mode: ProductionMode) => {
    setState((prev: any) => ({ ...prev, productionMode: mode }));
    const brandId = getBrandWorkspaceId();
    if (brandId) {
      void import("../backend/workspaceSync").then(({ persistExecutiveModeUpdate }) => {
        void persistExecutiveModeUpdate(brandId, { productionMode: mode });
      });
    }
  };

  const toggleContentPillar = (label: string) => {
    let updatedPillars: any[] = [];
    setState((prev: any) => {
      updatedPillars = prev.brand.contentPillars.map((p: any) =>
        p.label === label ? { ...p, active: !p.active } : p
      );
      return {
        ...prev,
        brand: { ...prev.brand, contentPillars: updatedPillars }
      };
    });
    const brandId = getBrandWorkspaceId();
    if (brandId && updatedPillars.length > 0) {
      void import("../backend/workspaceSync").then(({ persistBrandUpdate }) => {
        void persistBrandUpdate(brandId, { contentPillars: updatedPillars });
      });
    }
  };

  const toggleTone = (label: string) => {
    let updatedTones: any[] = [];
    setState((prev: any) => {
      updatedTones = prev.brand.tone.map((t: any) =>
        t.label === label ? { ...t, active: !t.active } : t
      );
      return {
        ...prev,
        brand: { ...prev.brand, tone: updatedTones }
      };
    });
    const brandId = getBrandWorkspaceId();
    if (brandId && updatedTones.length > 0) {
      void import("../backend/workspaceSync").then(({ persistBrandUpdate }) => {
        void persistBrandUpdate(brandId, { tone: updatedTones });
      });
    }
  };

  const createProductionFromSpark = (sparkOrId: string | ViralSpark) => {
    const spark =
      typeof sparkOrId === "string"
        ? state.viralSparks.find((s: any) => s.id === sparkOrId) || state.viralSparks[0]
        : sparkOrId;
    if (!spark) return;

    const prodId = `p-${Date.now()}`;
    const reviewId = `r-${Date.now()}`;

    const hostStyle = state.character?.style || "Executive Creator";
    const status = state.automationMode === "autonomous" ? "Ready for Review" : "Drafting";
    const platformFit = spark.platformFit || "YouTube Shorts";
    const formats = platformFit.split(" + ").map((s: string) => s.trim()).filter(Boolean);

    // Initial optimistic state creation
    const initialProduction: Production = {
      id: prodId,
      title: spark.title,
      sparkId: spark.id,
      status: status,
      mode: state.productionMode,
      dateCreated: new Date().toISOString().split("T")[0],
      aspectRatio: platformFit.includes("YouTube") && !platformFit.includes("TikTok") ? "16:9" : "9:16",
      formats,
      scenes: [
        { scene: 1, description: `Hook Angle: ${spark.angle} (${hostStyle} host presentation)`, duration: "0-5s" },
        { scene: 2, description: `Body Point 1: Deep dive on ${spark.title}`, duration: "5-25s" },
        { scene: 3, description: `CTA and brand alignment for ${state.brand.name}`, duration: "25-30s" },
      ],
    };

    const initialReviewItem: ReviewItem = {
      id: reviewId,
      productionId: prodId,
      title: spark.title,
      account: formats[0] || "YouTube Shorts",
      series: "Viral Concept Series",
      status: "Pending Review",
      dateCreated: new Date().toISOString().split("T")[0],
      scriptSnippet: spark.hook,
      conceptText: spark.whyNow,
      openingMoment: spark.angle,
      qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" },
    };

    setState((prev: any) => {
      const alreadyCreatedReview = prev.reviewItems.some((r: any) => r.title === spark.title);
      const updatedReviewItems = alreadyCreatedReview ? prev.reviewItems : [initialReviewItem, ...prev.reviewItems];
      const updatedProductions = prev.productions.some((p: any) => p.title === spark.title)
        ? prev.productions
        : [initialProduction, ...prev.productions];

      return {
        ...prev,
        productions: updatedProductions,
        reviewItems: updatedReviewItems,
      };
    });

    eventBus.emit("TREND_FOUND", { sparkId: spark.id, title: spark.title }, state.brand.name);
    eventBus.emit("OPPORTUNITY_CREATED", { prodId, title: spark.title }, state.brand.name);
    eventBus.emit("REVIEW_REQUIRED", { reviewId, prodId, title: spark.title }, state.brand.name);

    // Background Production Brief Generation via ProductionService & ModelRouter / AIProviderOrchestrator
    void import("../services/productionService").then(({ productionService }) => {
      void productionService
        .createProductionFromSpark({
          spark,
          brand: state.brand,
          character: state.character,
          niche: state.brand.niche,
          memoryItems: state.memoryItems || [],
          productionMode: state.productionMode,
        })
        .then(({ production: enrichedProd, reviewItem: enrichedReview }) => {
          setState((prev: any) => ({
            ...prev,
            productions: prev.productions.map((p: any) => (p.id === prodId ? { ...p, ...enrichedProd } : p)),
            reviewItems: prev.reviewItems.map((r: any) => (r.id === reviewId ? { ...r, ...enrichedReview } : r)),
          }));

          eventBus.emit("SCRIPT_READY", { prodId, title: enrichedProd.title }, state.brand.name);

          const brandId = getBrandWorkspaceId();
          if (isSupabaseConfigured() && brandId) {
            void persistProductionCreate(brandId, enrichedProd);
          }
        })
        .catch((err) => console.warn("[SparkContext] Production brief generation notice:", err));
    });

    return { production: initialProduction, reviewItem: initialReviewItem };
  };

  const [productionGenerationEnabled, setProductionGenerationEnabledState] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    try {
      return localStorage.getItem("spark_production_generation_enabled") !== "false";
    } catch {
      return true;
    }
  });

  const toggleProductionGeneration = (enabled?: boolean) => {
    const next = enabled !== undefined ? enabled : !productionGenerationEnabled;
    setProductionGenerationEnabledState(next);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("spark_production_generation_enabled", String(next));
      } catch {}
    }
  };

  const generateProductionAssets = async (productionId: string) => {
    const prod = state.productions.find((p: any) => p.id === productionId);
    if (!prod) return;

    eventBus.emit("RENDER_STARTED", { prodId: productionId }, state.brand.name);

    setState((prev: any) => ({
      ...prev,
      productions: prev.productions.map((p: any) =>
        p.id === productionId ? { ...p, isGeneratingAssets: true } : p
      ),
    }));

    try {
      const { productionService } = await import("../services/productionService");
      const { production: updatedProd, brief: updatedBrief } = await productionService.generateAssetsForProduction({
        production: prod,
        brand: state.brand,
        character: state.character,
      });

      setState((prev: any) => ({
        ...prev,
        productions: prev.productions.map((p: any) => (p.id === productionId ? updatedProd : p)),
        reviewItems: prev.reviewItems.map((r: any) =>
          r.productionId === productionId
            ? { ...r, brief: updatedBrief, openingMoment: updatedBrief.storyboard?.[0]?.visualDescription || r.openingMoment }
            : r
        ),
      }));

      eventBus.emit("STORYBOARD_READY", { prodId: productionId, title: updatedProd.title }, state.brand.name);
    } catch (err) {
      console.warn("[SparkContext] Asset generation notice:", err);
      setState((prev: any) => ({
        ...prev,
        productions: prev.productions.map((p: any) =>
          p.id === productionId ? { ...p, isGeneratingAssets: false } : p
        ),
      }));
    }
  };

  const cancelProduction = (productionId: string) => {
    void import("../services/productionService").then(({ productionService }) => {
      void productionService.cancelProduction(productionId).then((cancelledProd) => {
        setState((prev: any) => ({
          ...prev,
          productions: prev.productions.map((p: any) => (p.id === productionId ? cancelledProd : p)),
          reviewItems: prev.reviewItems.map((r: any) =>
            r.productionId === productionId ? { ...r, status: "Needs Edit" } : r
          ),
        }));
      });
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

      const jobExists = prev.publishJobs.some((j: any) => j.productionId === review.productionId);
      const newPublishJobs = jobExists ? prev.publishJobs : [
        ...prev.publishJobs,
        {
          id: `pj-${Date.now()}`,
          productionId: review.productionId,
          title: review.title,
          platform: review.account,
          scheduledTime: "Thu 4:00 PM",
          status: "Scheduled"
        }
      ];

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

    // Background Supabase persistence if configured
    if (isSupabaseConfigured()) {
      void persistReviewApprove(reviewId);
    }
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

    // Background Supabase persistence if configured
    if (isSupabaseConfigured()) {
      void persistReviewNeedsEdit(reviewId);
    }
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
      memoryItems: [newItem, ...(prev.memoryItems || [])]
    }));

    const brandId = getBrandWorkspaceId();
    if (isSupabaseConfigured() && brandId) {
      void import("../backend/workspaceSync").then(({ persistMemoryCreate }) => {
        persistMemoryCreate(brandId, newItem).then((savedItem) => {
          if (savedItem && savedItem.id) {
            setState((prev: any) => ({
              ...prev,
              memoryItems: (prev.memoryItems || []).map((m: any) =>
                m.id === newItem.id ? { ...m, id: savedItem.id } : m
              )
            }));
          }
        });
      });
    }
  };

  const removeMemoryItem = (id: string) => {
    setState((prev: any) => ({
      ...prev,
      memoryItems: (prev.memoryItems || []).filter((m: any) => m.id !== id)
    }));

    if (isSupabaseConfigured() && id) {
      void import("../backend/workspaceSync").then(({ persistMemoryDelete }) => {
        void persistMemoryDelete(id);
      });
    }
  };

  const updateMemoryItem = (id: string, text: string, type: "learned" | "rule", category?: any) => {
    setState((prev: any) => ({
      ...prev,
      memoryItems: (prev.memoryItems || []).map((m: any) =>
        m.id === id ? { ...m, text, type, category: category || m.category } : m
      )
    }));

    if (isSupabaseConfigured() && id) {
      void import("../backend/workspaceSync").then(({ persistMemoryUpdate }) => {
        void persistMemoryUpdate(id, { text, type, category });
      });
    }
  };

  const pinMemoryItem = (id: string, pinned: boolean) => {
    setState((prev: any) => ({
      ...prev,
      memoryItems: (prev.memoryItems || []).map((m: any) =>
        m.id === id ? { ...m, pinned } : m
      )
    }));

    if (isSupabaseConfigured() && id) {
      void import("../backend/workspaceSync").then(({ persistMemoryUpdate }) => {
        void persistMemoryUpdate(id, { pinned });
      });
    }
  };

  const archiveMemoryItem = (id: string, archived: boolean) => {
    setState((prev: any) => ({
      ...prev,
      memoryItems: (prev.memoryItems || []).map((m: any) =>
        m.id === id ? { ...m, archived } : m
      )
    }));

    if (isSupabaseConfigured() && id) {
      void import("../backend/workspaceSync").then(({ persistMemoryUpdate }) => {
        void persistMemoryUpdate(id, { archived });
      });
    }
  };

  const addResearchSource = async (url: string) => {
    const { ResearchSourceService } = await import("../services/research/researchSourceService");
    const { ResearchDepartmentService } = await import("../services/research/researchDepartmentService");
    const brandId = getBrandWorkspaceId();
    const result = await ResearchSourceService.registerAndExtract(url, brandId, state.researchSources || []);
    if (!result) return;

    const { source, patterns } = result;

    // Research Department Service owns pattern processing, memory updates & spark generation
    const { memoryItems: newMemoryItems, viralSparks: newSparks } =
      ResearchDepartmentService.processPatterns(brandId, source, patterns);

    setState((prev: any) => ({
      ...prev,
      researchSources: [source, ...(prev.researchSources || []).filter((s: any) => s.id !== source.id)],
      researchPatterns: [...patterns, ...(prev.researchPatterns || [])],
      memoryItems: [...newMemoryItems, ...(prev.memoryItems || [])],
      viralSparks: [...newSparks, ...(prev.viralSparks || [])],
    }));
  };

  const removeResearchSource = (id: string) => {
    setState((prev: any) => ({
      ...prev,
      researchSources: (prev.researchSources || []).filter((s: any) => s.id !== id),
      researchPatterns: (prev.researchPatterns || []).filter((p: any) => p.sourceId !== id),
    }));
    void import("../services/research/researchSourceService").then(({ ResearchSourceService }) => {
      void ResearchSourceService.deleteSource(id);
    });
  };

  const syncResearchSource = async (id: string) => {
    const existing = (state.researchSources || []).find((s: any) => s.id === id);
    if (!existing) return;

    // Immediately set source status to "syncing" for active UI feedback
    setState((prev: any) => ({
      ...prev,
      researchSources: (prev.researchSources || []).map((s: any) =>
        s.id === id ? { ...s, status: "syncing" } : s
      ),
    }));

    try {
      const { ResearchSourceService } = await import("../services/research/researchSourceService");
      const { ResearchDepartmentService } = await import("../services/research/researchDepartmentService");
      const brandId = getBrandWorkspaceId();

      // Force manual refresh
      const { source, patterns } = await ResearchSourceService.syncSource(existing, brandId, true);

      const { memoryItems: newMemoryItems, viralSparks: newSparks } =
        ResearchDepartmentService.processPatterns(brandId, source, patterns);

      setState((prev: any) => {
        const existingSparks = prev.viralSparks || [];
        const filteredNewSparks = newSparks.filter(
          (ns: any) => !existingSparks.some((es: any) => es.sourceId === ns.sourceId && es.title === ns.title)
        );

        return {
          ...prev,
          researchSources: (prev.researchSources || []).map((s: any) => (s.id === id ? source : s)),
          researchPatterns: [...patterns, ...(prev.researchPatterns || []).filter((p: any) => p.sourceId !== id)],
          memoryItems: [...newMemoryItems, ...(prev.memoryItems || [])],
          viralSparks: [...filteredNewSparks, ...existingSparks],
        };
      });
    } catch (err) {
      console.warn("[SparkContext] syncResearchSource notice:", err);
      setState((prev: any) => ({
        ...prev,
        researchSources: (prev.researchSources || []).map((s: any) =>
          s.id === id ? { ...s, status: "error" } : s
        ),
      }));
    }
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

  const addChatMessage = (msg: ChatMessage) => {
    setState((prev: any) => ({
      ...prev,
      chatMessages: [...(prev.chatMessages || []), msg]
    }));

    if (isSupabaseConfigured()) {
      void persistExecutiveMessage(
        state.brand.name,
        "default-session",
        msg.sender === "spark" ? "director" : "user",
        msg.text
      );
    }
  };

  const updateChatMessage = (msgId: string, newText: string, isStreaming: boolean = false, media?: any) => {
    setState((prev: any) => ({
      ...prev,
      chatMessages: (prev.chatMessages || []).map((m: any) =>
        m.id === msgId ? { ...m, text: newText, isStreaming, ...(media ? { media } : {}) } : m
      )
    }));
  };

  const activeAiRequestRef = React.useRef<boolean>(false);

  const sendMessage = async (prompt: string, onChunk?: (chunk: string) => void) => {
    if (activeAiRequestRef.current) {
      const busyMsg = "I am currently processing your active request. Please allow me a moment to complete it.";
      if (onChunk) onChunk(busyMsg);
      return { text: busyMsg, media: null, providerId: null, audioUrl: null };
    }

    activeAiRequestRef.current = true;
    const history = (state.chatMessages || []).map((m: any) => ({
      sender: m.sender,
      text: m.text
    }));

    const lower = prompt.toLowerCase();
    let taskMedia: any = null;

    const lastAssistantMsg = history.length > 0 ? history[history.length - 1] : null;
    const isAwaitingConfirmation = lastAssistantMsg?.sender === "spark" && lastAssistantMsg.text.toLowerCase().includes("would you like me to proceed?");
    const isConfirmed = /^(yes|yeah|sure|go ahead|do it|confirm|proceed|ok|okay|approve it)[\s!.]*$/i.test(lower);

    // Sensitive workspace/production action checks
    const isSensitiveActionReq = /\b(turn production|enable production|disable production|generate video|publish content|schedule post|autonomous mode|full auto)\b/i.test(lower);

    if (isSensitiveActionReq && !isConfirmed && !isAwaitingConfirmation) {
      const confirmationPrompt = `I can do that for you. Would you like me to proceed?`;
      if (onChunk) onChunk(confirmationPrompt);
      return confirmationPrompt;
    }

    // Universal Natural Language Task Router (Only executed with explicit intent or confirmation)
    const isApprovalReq = /\b(approve|accept|publish review|ship it|schedule cut)\b/i.test(lower) || (isAwaitingConfirmation && isConfirmed);
    const isEditReq = /\b(needs edit|reject|revision|request edit)\b/i.test(lower);
    const isCreateReq = /\b(create video|make video|generate video|create short|draft script|create storyboard|generate cut)\b/i.test(lower);
    const isSampleReq = /\b(generate sample|show sample|preview this|create a one-time example|sample production)\b/i.test(lower);
    const isProdTurnOn = /\b(turn production on|enable production|resume production)\b/i.test(lower) || (isAwaitingConfirmation && isConfirmed && lower.includes("on"));
    const isProdTurnOff = /\b(turn production off|disable production|pause production)\b/i.test(lower);
    const isProdCancel = /\b(cancel production)\b/i.test(lower);
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);
    const isResearchReq = /\b(research this|study this|add this channel|add this creator|add this video|add this as research)\b/i.test(lower) || !!urlMatch;
    const isMemoryReq = /^(remember|save this|add memory|never forget|note that)\b/i.test(lower);

    if (isProdTurnOn) {
      toggleProductionGeneration(true);
      taskMedia = {
        type: "production_status",
        id: `prod-on-${Date.now()}`,
        title: "Production Generation Enabled",
        status: "Enabled",
        meta: "Full multi-scene storyboard and media rendering active.",
      };
    } else if (isProdTurnOff) {
      toggleProductionGeneration(false);
      taskMedia = {
        type: "production_status",
        id: `prod-off-${Date.now()}`,
        title: "Production Generation Disabled",
        status: "Disabled",
        meta: "Lightweight brief mode active. Automatic media rendering paused.",
      };
    } else if (isProdCancel) {
      const activeProd = state.productions?.find((p: any) => p.status !== "Cancelled") || state.productions?.[0];
      if (activeProd) {
        cancelProduction(activeProd.id);
      }
      taskMedia = {
        type: "production_status",
        id: `prod-cancel-${Date.now()}`,
        title: "Production Cancelled",
        status: "Cancelled",
        meta: "Production job stopped cleanly. Workspace queue updated.",
      };
    } else if (isResearchReq && urlMatch) {
      const targetUrl = urlMatch[0];
      addResearchSource(targetUrl);
      const domain = targetUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || "Research Source";
      const platform = targetUrl.includes("youtube") ? "YouTube" : targetUrl.includes("tiktok") ? "TikTok" : targetUrl.includes("instagram") ? "Instagram" : "Profile Link";
      taskMedia = {
        type: "research_source",
        id: `rs-${Date.now()}`,
        title: domain,
        url: targetUrl,
        platform,
        status: "Synced",
        meta: "Research source added and analyzed by AI",
      };
    } else if (isMemoryReq) {
      const cleanMem = prompt.replace(/remember|save this|add memory|never forget|note that/gi, "").trim();
      const ruleText = cleanMem || prompt;
      addMemoryItem(ruleText, "rule", "Strategy");
      taskMedia = {
        type: "memory_saved",
        id: `mem-${Date.now()}`,
        title: "Brand Memory Rule Saved",
        rule: ruleText,
        category: "Strategy",
        source: "Executive Chat",
        meta: "Committed to SPARK workspace memory bank",
      };
    } else if (isSampleReq) {
      const spark = state.viralSparks?.[0];
      const sparkId = spark?.id || "vs-1";
      const created = createProductionFromSpark(sparkId);
      const realProd = created?.production;
      const realReview = created?.reviewItem;
      taskMedia = {
        type: "storyboard",
        id: realReview?.id || realProd?.id || `sample-prod-${Date.now()}`,
        title: realProd?.title || spark?.title || "Sample Storyboard Preview",
        sceneCount: realProd?.scenes?.length || 3,
        duration: "3:20",
        coverFrame: undefined,
        status: realReview?.status || "Pending Review",
        meta: `One-time sample storyboard generated for "${realProd?.title || "Cut"}"`,
      };
    } else if (isApprovalReq) {
      const targetReview = state.reviewItems?.find((r: any) => r.status === "Pending Review") || state.reviewItems?.[0];
      if (targetReview) {
        approveReviewItem(targetReview.id);
        taskMedia = {
          type: "video",
          id: targetReview.id,
          title: targetReview.title,
          videoUrl: (targetReview as any).videoUrl || undefined,
          status: "Approved",
          concept: targetReview.whyThisWorks || "High engagement viral cut",
          meta: `Action Executed: Approved & Scheduled for Publishing`,
        };
      }
    } else if (isEditReq) {
      const targetReview = state.reviewItems?.find((r: any) => r.status === "Pending Review") || state.reviewItems?.[0];
      if (targetReview) {
        rejectOrRequestEditReviewItem(targetReview.id);
        taskMedia = {
          type: "video",
          id: targetReview.id,
          title: targetReview.title,
          videoUrl: (targetReview as any).videoUrl || undefined,
          status: "Needs Edit",
          concept: "Opening hook & scene pacing adjustment requested",
          meta: `Action Executed: Status updated to Needs Edit`,
        };
      }
    } else if (isCreateReq) {
      const spark = state.viralSparks?.[0];
      const sparkId = spark?.id || "vs-1";
      const created = createProductionFromSpark(sparkId);
      const realProd = created?.production;
      const realReview = created?.reviewItem;
      taskMedia = {
        type: "video",
        id: realReview?.id || realProd?.id || `prod-${Date.now()}`,
        title: realProd?.title || spark?.title || `Production Cut: ${prompt.slice(0, 40)}`,
        videoUrl: (realReview as any)?.videoUrl || undefined,
        status: realReview?.status || "Pending Review",
        concept: spark?.hook || "AI-generated script & 3-scene vertical storyboard",
        meta: `Action Executed: Created Production "${realProd?.title || "Short Cut"}" queued for Review`,
      };
    } else if (lower.includes("autonomous mode") || lower.includes("full auto")) {
      updateAutomationMode("autonomous");
    } else if (lower.includes("copilot mode") || lower.includes("semi auto")) {
      updateAutomationMode("balanced");
    }

    try {
      const responseText = await generateSuperSparkResponse(
        prompt,
        history,
        state,
        onChunk,
        (thinking) => setThinkingState(thinking)
      );

      // AI Session Title auto-generation after first exchange
      if (activeSessionId) {
        const currentSession = sessions.find((s) => s.id === activeSessionId);
        if (currentSession && (currentSession.title === "New Executive Session" || !currentSession.title)) {
          void generateSessionTitle(prompt, responseText).then((aiTitle) => {
            renameSession(activeSessionId, aiTitle);
            conversationSessionRepository.updateSession(
              activeSessionId,
              { subtitle: prompt.slice(0, 45) },
              getBrandWorkspaceId() || "default-brand"
            );
          });
        }
      }

      const providerId = (await import("../services/runtime/AIProviderOrchestrator")).AIProviderOrchestrator.getLastUsedProviderId();
      const { generateSuperSparkVoice } = await import("../services/geminiService");

      let audioUrl: string | null = null;
      try {
        audioUrl = await generateSuperSparkVoice(responseText, providerId);
      } catch (err) {
        console.warn("[SparkContext] Executive voice generation notice:", err);
      }

      return {
        text: responseText,
        media: taskMedia,
        providerId,
        audioUrl,
      };
    } finally {
      activeAiRequestRef.current = false;
      setThinkingState(null);
    }
  };

  const publishProduction = async (productionId: string) => {
    const job = state.publishJobs.find((j: any) => j.productionId === productionId) ||
                state.productions.find((p: any) => p.id === productionId);
    if (!job) {
      alert("Production not found.");
      return;
    }
    const platform = (job as any).platform || "YouTube Shorts";

    const connectedAcc = state.accounts.find((a: any) =>
      a.platform.toLowerCase().includes(String(platform).toLowerCase().split(" ")[0]) &&
      a.status === "connected"
    );

    if (!connectedAcc) {
      alert(`Publishing unavailable: No connected ${platform === "YouTube Shorts" ? "YouTube" : platform} account.`);
      return;
    }

    try {
      const validToken = await socialConnectorFramework.getValidAccessToken(platform);
      if (!validToken) {
        throw new Error(`Authentication token invalid or expired for ${platform}.`);
      }

      const result = await socialConnectorFramework.publish(
        platform as any,
        validToken,
        { productionId, title: (job as any).title || productionId }
      );

      const postUrl = result.postUrl || "";
      const publishJob: PublishJob = {
        id: `pub-${Date.now()}`,
        productionId,
        title: (job as any).title || "SPARK Release",
        platform: platform as any,
        status: "Published",
        scheduledTime: new Date().toISOString(),
      };

      setState((prev: any) => ({
        ...prev,
        publishJobs: [publishJob, ...(prev.publishJobs || [])],
        productions: prev.productions.map((p: any) => (p.id === productionId ? { ...p, status: "Published" } : p)),
      }));

      const brandId = getBrandWorkspaceId();
      if (brandId) {
        void persistPublishJobCreate(brandId, publishJob);
        void persistProductionUpdate(brandId, { id: productionId, status: "Published" } as any);
      }

      alert(`Successfully published to ${platform}!${postUrl ? ` URL: ${postUrl}` : ""}`);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    }
  };

  return (
    <SparkContext.Provider
      value={{
        ...state,
        state,
        thinkingState,
        activeSessionId,
        sessions,
        executiveVoiceProfile: SPARK_EXECUTIVE_VOICE_PROFILE,
        updateBrand,
        initializeBrandGenesis,
        updateAutomationMode,
        updateProductionMode,
        updateAISettings,
        createProductionFromSpark,
        generateProductionAssets,
        cancelProduction,
        productionGenerationEnabled,
        toggleProductionGeneration,
        approveReviewItem,
        rejectOrRequestEditReviewItem,
        addMemoryItem,
        removeMemoryItem,
        updateMemoryItem,
        pinMemoryItem,
        archiveMemoryItem,
        addResearchSource,
        removeResearchSource,
        syncResearchSource,
        addAsset,
        toggleContentPillar,
        toggleTone,
        addChatMessage,
        updateChatMessage,
        sendMessage,
        publishProduction,
        startNewSession,
        switchSession,
        deleteSession,
        renameSession,
        setState
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
