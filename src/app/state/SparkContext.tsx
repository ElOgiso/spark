import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { NotificationService } from "../notifications/notificationService";
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
  GenerationCreditSettings,
  DEFAULT_CREDIT_SETTINGS,
  ProductionFormatSettings,
  DEFAULT_FORMAT_SETTINGS,
  ThinkingState,
  ConversationSession,
  Offer,
  OfferType,
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
  persistCreditSettings,
} from "../backend/workspaceSync";
import { isSupabaseConfigured } from "../backend/supabaseClient";
import { isUuid } from "../backend/mappers/workspaceMappers";
import { ProductionGenerationGuard } from "../services/production/ProductionGenerationGuard";
import { evaluateSparkForProduction, autoRepairViralSpark } from "../services/production/sparkQualityGate";
import { resolveProductionMode } from "../services/production/resolveProductionMode";
import { recordBrandPerformanceWin } from "../services/memory/recordBrandPerformance";
import { autonomousEngine } from "../services/runtime/autonomousEngine";
import {
  getBrandWorkspaceId,
  getStoredAccountTokens,
  normalizePlatformKey,
  socialConnectorFramework,
} from "../services/socialIntegrationService";
import { useAuth } from "./AuthContext";

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
  offers: Offer[];
  researchSources?: ResearchSource[];
  researchPatterns?: ResearchPattern[];
  aiSettings?: AISettings;
  creditSettings: GenerationCreditSettings;
  formatSettings: ProductionFormatSettings;
  thinkingState?: ThinkingState | null;
  
  chatMessages?: ChatMessage[];
  activeSessionId?: string | null;
  sessions?: ConversationSession[];
  
  // Actions
  updateBrand: (data: Partial<Brand>) => void;
  updateCharacter: (data: Partial<Character>) => void;
  resetWorkspace: () => void;
  initializeBrandGenesis: (data: any) => Promise<void> | void;
  updateAutomationMode: (mode: AutomationMode) => void;
  updateProductionMode: (mode: ProductionMode) => void;
  updateAISettings: (newSettings: AISettings) => void;
  updateCreditSettings: (newSettings: Partial<GenerationCreditSettings>) => void;
  updateFormatSettings: (newSettings: Partial<ProductionFormatSettings>) => Promise<boolean>;
  createProductionFromSpark: (sparkOrId: string | ViralSpark) => { production: Production; reviewItem: ReviewItem } | void;
  strengthenSpark: (sparkId: string) => ViralSpark | undefined;
  generateProductionAssets: (productionId: string, forceRegenerate?: boolean) => Promise<void>;
  fixProductionScene: (productionId: string, sceneIndex: number, editNotes: string) => Promise<any>;
  mergeProductionScenes: (productionId: string) => Promise<string | null>;
  cancelProduction: (productionId: string) => void;
  deleteProduction: (productionId: string) => void;
  productionGenerationEnabled?: boolean;
  toggleProductionGeneration?: (enabled?: boolean) => void;
  approveReviewItem: (reviewId: string) => void;
  rejectOrRequestEditReviewItem: (reviewId: string) => void;
  addMemoryItem: (text: string, type: "learned" | "rule", category?: any) => void;
  removeMemoryItem: (id: string) => void;
  updateMemoryItem: (id: string, text: string, type: "learned" | "rule", category?: any) => void;
  pinMemoryItem: (id: string, pinned: boolean) => void;
  archiveMemoryItem: (id: string, archived: boolean) => void;
  addOffer: (offer: Omit<Offer, "id" | "createdAt" | "updatedAt">) => Offer;
  updateOffer: (id: string, updates: Partial<Offer>) => void;
  removeOffer: (id: string) => void;
  setDefaultOffer: (id: string) => void;
  toggleOfferActive: (id: string) => void;
  getDefaultOffer: () => Offer | undefined;
  getActiveOffers: () => Offer[];
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
  const auth = useAuth();
  const currentUserId = auth.currentUser?.id || auth.session?.user?.id || null;
  const activeBrandId = auth.brand?.id || getBrandWorkspaceId();

  const [thinkingState, setThinkingState] = useState<ThinkingState | null>(null);

  const [state, setState] = useState(() => {
    const local = loadPersistedState<any>(currentUserId || undefined, activeBrandId || undefined);
    if (local) {
      return {
        ...local,
        offers: Array.isArray(local.offers) ? local.offers : [],
        aiSettings: local.aiSettings || defaultAISettings,
        creditSettings: local.creditSettings || DEFAULT_CREDIT_SETTINGS,
        chatMessages: Array.isArray(local.chatMessages) ? local.chatMessages : [],
      };
    }
    return {
      brand: defaultBrand,
      character: defaultCharacter,
      executiveVoiceProfile: SPARK_EXECUTIVE_VOICE_PROFILE,
      accounts: [],
      automationMode: "balanced" as AutomationMode,
      productionMode: "standard" as ProductionMode,
      memoryItems: [],
      viralSparks: [],
      productions: [],
      reviewItems: [],
      publishJobs: [],
      exportPackages: [],
      analyticsInsights: [],
      assets: [],
      offers: [],
      researchSources: [],
      researchPatterns: [],
      aiSettings: defaultAISettings,
      creditSettings: DEFAULT_CREDIT_SETTINGS,
      thinkingState: null,
      chatMessages: [],
    };
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const activeGenerationControllers = useRef<Map<string, AbortController>>(new Map());

  const resetWorkspace = useCallback(() => {
    console.log("[SparkContext] Hard resetting workspace to empty defaults...");
    activeGenerationControllers.current.forEach((controller) => controller.abort());
    activeGenerationControllers.current.clear();

    setState({
      brand: defaultBrand,
      character: defaultCharacter,
      executiveVoiceProfile: SPARK_EXECUTIVE_VOICE_PROFILE,
      accounts: [],
      automationMode: "balanced" as AutomationMode,
      productionMode: "standard" as ProductionMode,
      memoryItems: [],
      viralSparks: [],
      productions: [],
      reviewItems: [],
      publishJobs: [],
      exportPackages: [],
      analyticsInsights: [],
      assets: [],
      offers: [],
      researchSources: [],
      researchPatterns: [],
      aiSettings: defaultAISettings,
      creditSettings: DEFAULT_CREDIT_SETTINGS,
      thinkingState: null,
      chatMessages: [],
    });

    setSessions([]);
    setActiveSessionId(null);
  }, []);

  const updateAISettings = (newSettings: AISettings) => {
    setState((prev: any) => ({ ...prev, aiSettings: newSettings }));
    const brandId = getBrandWorkspaceId();
    persistAISettings(brandId, newSettings);
  };

  const updateCreditSettings = useCallback(async (newSettings: Partial<GenerationCreditSettings>): Promise<boolean> => {
    const updated = {
      ...(state.creditSettings || DEFAULT_CREDIT_SETTINGS),
      ...newSettings,
    };
    setState((prev: any) => ({ ...prev, creditSettings: updated }));

    const brandId = getBrandWorkspaceId();
    if (brandId) {
      const { persistCreditSettings } = await import("../backend/workspaceSync");
      return await persistCreditSettings(brandId, updated);
    }
    return true;
  }, [state.creditSettings]);

  const updateFormatSettings = useCallback(async (newSettings: Partial<ProductionFormatSettings>): Promise<boolean> => {
    const updated = {
      ...(state.formatSettings || DEFAULT_FORMAT_SETTINGS),
      ...newSettings,
    };
    setState((prev: any) => ({ ...prev, formatSettings: updated }));

    const brandId = getBrandWorkspaceId();
    if (brandId) {
      const { persistFormatSettings } = await import("../backend/workspaceSync");
      return await persistFormatSettings(brandId, updated);
    }
    return true;
  }, [state.formatSettings]);

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
  // Detect User ID changes or explicit workspace reset signals
  const lastLoadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastLoadedUserIdRef.current !== null && lastLoadedUserIdRef.current !== currentUserId) {
      console.log(`[SparkContext] User ID changed (${lastLoadedUserIdRef.current} -> ${currentUserId}). Executing resetWorkspace().`);
      resetWorkspace();
    }
    lastLoadedUserIdRef.current = currentUserId;
  }, [currentUserId, resetWorkspace]);

  useEffect(() => {
    const handleReset = () => {
      console.log("[SparkContext] spark-workspace-reset event received. Executing resetWorkspace().");
      resetWorkspace();
    };
    window.addEventListener("spark-workspace-reset", handleReset);
    return () => {
      window.removeEventListener("spark-workspace-reset", handleReset);
    };
  }, [resetWorkspace]);

  // Reactively hydrate live workspace from Supabase on mount / login / brandId changes
  useEffect(() => {
    if (!currentUserId) return;

    const localTokens = getStoredAccountTokens();
    const tokenAccounts: Account[] = Object.values(localTokens)
      .filter((t) => !t.status || ["connected", "refreshing", "active"].includes(String(t.status).toLowerCase()))
      .map((t) => ({
        platform: t.platform,
        handle: t.handle || "",
        status: "connected" as const,
        posts: t.postsCount || 0,
      }));

    if (isSupabaseConfigured() && activeBrandId && isUuid(activeBrandId)) {
      let isCancelled = false;
      Promise.all([
        hydrateWorkspace(activeBrandId),
        import("../backend/workspaceSync").then((m) => m.hydrateExecutiveContext(activeBrandId)).catch(() => null),
      ]).then(([snap, execContext]) => {
        if (isCancelled) return;
        setState((prev: any) => {
          const byPlatform = new Map<string, Account>();
          // Hydrate with Supabase accounts (both connected and needs_reconnect)
          (snap.accounts || []).forEach((a: any) => {
            const pKey = normalizePlatformKey(a.platform);
            const statusStr = String(a.status || "").toLowerCase();
            const isConn = statusStr === "connected" || statusStr === "active";
            byPlatform.set(pKey, {
              platform: pKey,
              handle: a.handle || a.displayName || "",
              status: isConn ? "connected" : "needs_reconnect",
              posts: a.posts || 0,
            });

            // Seed local token cache if tokens exist in cloud row
            if (a.accessToken || a.refreshToken) {
              const stored = socialConnectorFramework.getStoredTokens();
              const existing = stored[pKey];
              if (!existing || !existing.accessToken) {
                socialConnectorFramework.saveToken({
                  platform: pKey,
                  handle: a.handle || "",
                  displayName: a.displayName || a.handle || pKey,
                  avatar: a.avatar || "",
                  channelId: a.channelId || "",
                  verified: true,
                  status: isConn ? "Connected" : "Needs Reauthorization",
                  accessToken: a.accessToken,
                  refreshToken: a.refreshToken,
                  expiresAt: a.expiresAt || (Date.now() + 3600000),
                  scopes: [],
                  permissionsGranted: [],
                  connectedAt: new Date().toISOString(),
                  lastSyncAt: new Date().toISOString(),
                }, { silent: true });
              }
            }
          });

          // Merge local tokens
          tokenAccounts.forEach((a) => {
            const pKey = normalizePlatformKey(a.platform);
            const statusStr = String(a.status || "").toLowerCase();
            const isConn = statusStr === "connected" || statusStr === "active";
            byPlatform.set(pKey, {
              platform: pKey,
              handle: a.handle || "",
              status: isConn ? "connected" : "needs_reconnect",
              posts: 0,
            });
          });
          
          const cloudAiSettings = (execContext as any)?.summary?.current_objectives?.ai_settings;
          const cloudCreditSettings = (execContext as any)?.summary?.current_objectives?.credit_settings;
          const cloudAutomationMode = (execContext as any)?.summary?.automation_mode || snap.brand?.automation_mode;

          // CLOUD IS TRUTH FOR AUTHENTICATED USER — EMPTY CLOUD ARRAYS ARE TRUTH ([])
          const merged = {
            ...prev,
            brand: snap.brand ? { ...prev.brand, ...snap.brand } : prev.brand,
            character: snap.character
              ? {
                  ...prev.character,
                  ...snap.character,
                  avatarUrl: snap.character.avatarUrl || snap.character.imageUrl || prev.character?.avatarUrl || null,
                  imageUrl: snap.character.imageUrl || snap.character.avatarUrl || prev.character?.imageUrl || null,
                  characterSheetUrl: snap.character.characterSheetUrl || snap.character.imageUrl || prev.character?.characterSheetUrl || null,
                  voice: {
                    ...prev.character?.voice,
                    ...snap.character.voice,
                  },
                }
              : prev.character,
            accounts: Array.from(byPlatform.values()),
            automationMode: cloudAutomationMode || prev.automationMode,
            aiSettings: cloudAiSettings ? { ...prev.aiSettings, ...cloudAiSettings } : prev.aiSettings,
            creditSettings: cloudCreditSettings
              ? { ...DEFAULT_CREDIT_SETTINGS, ...prev.creditSettings, ...cloudCreditSettings }
              : (prev.creditSettings || DEFAULT_CREDIT_SETTINGS),

            // CLOUD ARRAYS OVERWRITE LOCAL ARRAYS ON HYDRATION TO PREVENT ACCOUNT CROSS-POLLUTION
            memoryItems: snap.memoryItems || [],
            viralSparks: (snap.viralSparks || []).filter((s: any) => s && !s.id?.startsWith("vs-init-")),
            productions: snap.productions || [],
            reviewItems: snap.reviewItems || [],
            publishJobs: snap.publishJobs || [],
            analyticsInsights: snap.analyticsInsights || [],
            researchSources: snap.researchSources || [],
            researchPatterns: snap.researchPatterns || [],
          };

          savePersistedState(merged, currentUserId, activeBrandId);
          return merged;
        });
      }).catch((err) => {
        console.warn("[SparkContext] Workspace hydration notice:", err);
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [currentUserId, activeBrandId]);

  useEffect(() => {
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

  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync to abstracted persistence helper & start Autonomous Runtime Engine
  useEffect(() => {
    if (currentUserId && activeBrandId) {
      savePersistedState(state, currentUserId, activeBrandId);
    }

    if (state.automationMode !== "manual") {
      autonomousEngine.start(
        () => stateRef.current,
        (updater) => setState(updater)
      );
    } else {
      autonomousEngine.stop();
    }
  }, [state, currentUserId, activeBrandId]);

  const updateBrand = (brandData: Partial<Brand> & Record<string, any>) => {
    const brandId = auth.brand?.id || getBrandWorkspaceId();
    if (!brandId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(brandId)) {
      console.error("[SparkContext] updateBrand failed: valid UUID brand ID required", brandId);
      NotificationService.addNotification({
        title: "Save Error",
        description: "Cannot save brand profile: workspace brand ID is missing or invalid.",
        type: "brand_rule_conflict",
        priority: "high",
      });
      return;
    }

    setState((prev: any) => ({
      ...prev,
      brand: {
        ...prev.brand,
        ...brandData,
        audience: typeof brandData.audience === "object" ? { ...prev.brand?.audience, ...brandData.audience } : prev.brand?.audience,
      },
    }));

    void import("../backend/workspaceSync").then(({ persistBrandUpdate }) => {
      void persistBrandUpdate(brandId, brandData).then((success) => {
        if (success) {
          NotificationService.addNotification({
            title: "Brand Profile Saved",
            description: "Profile updates persisted to cloud database.",
            type: "system_update",
            priority: "low",
          });
        }
      });
    });
  };

  const updateCharacter = (characterData: Partial<Character>) => {
    const brandId = auth.brand?.id || getBrandWorkspaceId();
    if (!brandId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(brandId)) {
      console.error("[SparkContext] updateCharacter failed: valid UUID brand ID required", brandId);
      return;
    }

    let updatedChar: Character;
    setState((prev: any) => {
      updatedChar = {
        ...prev.character,
        ...characterData,
        voice: { ...prev.character?.voice, ...characterData.voice },
      };
      return { ...prev, character: updatedChar };
    });

    void import("../backend/workspaceSync").then(({ persistCharacterUpdate }) => {
      void persistCharacterUpdate(brandId, updatedChar!);
    });
  };

  const initializeBrandGenesis = async (data: any) => {
    const brandName = data.brandName || "My Brand";
    const creatorName = data.creatorName || "Creator";
    const niche = data.niche || "Content Creation";
    const vision = data.vision || "To build a leading media brand.";
    const audience = data.audience || "General Audience";
    const goal = data.goal || "Growth & Authority";
    const platforms =
      data.platforms && data.platforms.length > 0
        ? data.platforms
        : [];
    const tone = data.tone || "Energetic & Relatable";
    const visualStyle = data.visualStyle || "Realistic / Live-Action";
    const automationMode = data.automationMode || "balanced";
    const reviewRequired = data.reviewRequired !== false;

    // Map Notion production modes to internal storage keys
    const rawProdMode = data.productionMode || "standard";
    const productionMode: ProductionMode =
      rawProdMode === "narrator"
        ? "express"
        : rawProdMode === "cinematic"
        ? "deep"
        : rawProdMode === "hybrid"
        ? "standard"
        : (rawProdMode as ProductionMode);

    // Real research/source pipeline only — no mock initialSparks seed
    const initialSparks: ViralSpark[] = [];

    // Production mode: no fabricated sparks/productions/reviews.
    // Only real onboarding identity + memory rules.
    const initialMemoryItems: MemoryItem[] = [
      {
        id: `m-brand-${Date.now()}`,
        type: "rule",
        text: `Brand Identity Rule: Focus on ${niche}. Tone: ${tone}. Primary audience: ${audience}.`,
        dateAdded: new Date().toISOString().split("T")[0],
        category: "Brand",
      },
      {
        id: `m-prod-${Date.now() + 1}`,
        type: "rule",
        text: `Production Mode: Configured as ${rawProdMode === "express" ? "Narrator" : rawProdMode === "deep" ? "Cinematic" : rawProdMode === "standard" ? "Hybrid" : rawProdMode.toUpperCase()} pipeline.`,
        dateAdded: new Date().toISOString().split("T")[0],
        category: "Publishing behavior",
      },
      {
        id: `m-auto-${Date.now() + 2}`,
        type: "rule",
        text: `Governance Rule: Automation mode set to ${automationMode.toUpperCase()}.`,
        dateAdded: new Date().toISOString().split("T")[0],
        category: "Publishing behavior",
      },
    ];

    if (data.voiceProfile) {
      initialMemoryItems.push({
        id: `m-voice-${Date.now() + 3}`,
        type: "rule",
        text: `Host Voice: ${data.voiceProfile.name} (${data.voiceProfile.accent}, ${data.voiceProfile.language}).`,
        dateAdded: new Date().toISOString().split("T")[0],
        category: "Voice",
      });
    }

    if (data.audioEnergy) {
      initialMemoryItems.push({
        id: `m-audio-${Date.now() + 4}`,
        type: "rule",
        text: `Audio Energy: ${data.audioEnergy} soundtrack pacing.`,
        dateAdded: new Date().toISOString().split("T")[0],
        category: "Audio",
      });
    }

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
          text: `Welcome to your SPARK workspace, **${creatorName}**.\n\n• **Brand**: ${brandName} (${niche})\n• **Visual Style**: ${visualStyle}\n• **Production Mode**: ${rawProdMode.toUpperCase()}\n• **Automation**: ${automationMode.toUpperCase()}\n• **Connected accounts**: ${connectedFromOAuth.length > 0 ? connectedFromOAuth.map((a) => a.platform).join(", ") : "None yet — connect in Accounts when ready to publish"}\n\nYour SPARK is ready. Ask Super Spark to surface live opportunities or draft a production when ready.`,
          timestamp: new Date(),
        },
      ];
    } else {
      finalChatHistory = [
        {
          id: `gen-welcome-${Date.now()}`,
          sender: "spark",
          text: `Welcome, **${creatorName}**. **${brandName}** is configured for **${niche}**.\n\nMode: ${String(automationMode).toUpperCase()} · Production: ${rawProdMode.toUpperCase()}\n\nYour SPARK is ready to create.`,
          timestamp: new Date(),
        },
      ];
    }

    let initialResearchSources: ResearchSource[] = [];
    if (data.researchSources && Array.isArray(data.researchSources) && data.researchSources.length > 0) {
      initialResearchSources = data.researchSources.filter(Boolean).map((url: string, idx: number) => ({
        id: `src-gen-${Date.now()}-${idx}`,
        platform: (url.toLowerCase().includes("youtube") || url.toLowerCase().includes("youtu.be")
          ? "youtube"
          : url.toLowerCase().includes("tiktok")
          ? "tiktok"
          : url.toLowerCase().includes("instagram")
          ? "instagram"
          : "x") as any,
        url,
        username: url.split("/").filter(Boolean).pop() || "@creator",
        displayName: url.split("/").filter(Boolean).pop() || "Inspiration Source",
        videoCount: 1,
        status: "active" as const,
        sourceType: "channel" as const,
        recentVideos: [],
        learnings: ["High retention visual hook pattern", "Fast pace viral cut"],
        metricsAvailability: "available" as const,
        addedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
      } as ResearchSource));
    }

    setState((prev: any) => {
      const byPlatform = new Map<string, Account>();
      (prev.accounts || []).forEach((a: Account) => byPlatform.set(a.platform, a));
      connectedFromOAuth.forEach((a) => byPlatform.set(a.platform, a));

      // Merge explicit onboarding connection map or array
      if (data.connectedAccounts) {
        if (Array.isArray(data.connectedAccounts)) {
          data.connectedAccounts.forEach((acc: any) => {
            if (acc && acc.connected !== false) {
              const platform = acc.platform || "YouTube Shorts";
              const handle = acc.username || acc.handle || (platform.toLowerCase().includes("youtube") ? "@youtube" : "@x");
              byPlatform.set(platform, {
                platform,
                handle,
                status: "connected",
                posts: 0,
              });
              try {
                socialConnectorFramework.saveToken({
                  platform: platform.toLowerCase().includes("youtube") ? "youtube" : "x",
                  handle: handle,
                  displayName: handle,
                  token: "oauth_genesis_" + Date.now(),
                  connectedAt: new Date().toISOString(),
                  scopes: ["read", "write", "publish"],
                  status: "active",
                } as any);
              } catch {}
            }
          });
        } else if (typeof data.connectedAccounts === "object") {
          Object.entries(data.connectedAccounts).forEach(([platform, meta]: [string, any]) => {
            if (meta?.connected && meta?.handle) {
              byPlatform.set(platform, {
                platform,
                handle: meta.handle,
                status: "connected",
                posts: 0,
              });
              try {
                socialConnectorFramework.saveToken({
                  platform: platform.toLowerCase().includes("youtube") ? "youtube" : "x",
                  handle: meta.handle,
                  displayName: meta.handle,
                  token: "oauth_genesis_" + Date.now(),
                  connectedAt: new Date().toISOString(),
                  scopes: ["read", "write", "publish"],
                  status: "active",
                } as any);
              } catch {}
            }
          });
        }
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
          avatarUrl: data.characterSheetUrl || data.characterImageUrl || prev.character?.avatarUrl || null,
          imageUrl: data.characterSheetUrl || data.characterImageUrl || prev.character?.imageUrl || null,
          characterSheetUrl: data.characterSheetUrl || data.characterImageUrl || prev.character?.characterSheetUrl || null,
          voice: {
            name: data.voiceProfile?.name || "Rachel",
            language: data.voiceProfile?.language || "English (American)",
            tone: tone,
            locked: true,
            voiceId: data.voiceProfile?.id || data.voiceId || "21m00Tcm4TlvDq8ikWAM",
            description: data.voiceProfile?.accent || data.voiceProfile?.description || "Clear, reassuring executive narrator voice",
          },
        },
        accounts: Array.from(byPlatform.values()),
        automationMode: automationMode,
        productionMode: productionMode,
        chatMessages: finalChatHistory,
        viralSparks: initialSparks,
        productions: [],
        reviewItems: [],
        publishJobs: [],
        memoryItems: initialMemoryItems,
        researchSources: Array.from(
          new Map(
            [...(prev.researchSources || []), ...initialResearchSources].map((s) => [s.url.toLowerCase().trim(), s])
          ).values()
        ),
      };
    });

    let brandId = auth.brand?.id || getBrandWorkspaceId();
    if ((!brandId || !isUuid(brandId)) && auth.currentUser?.id && isSupabaseConfigured()) {
      try {
        const { ensureDefaultBrand } = await import("../backend/repositories/brandRepository");
        const defaultBrandRes = await ensureDefaultBrand(auth.currentUser.id, {
          name: brandName,
          niche: niche,
          purpose: vision,
        });
        if (defaultBrandRes.data?.id) {
          brandId = defaultBrandRes.data.id;
          localStorage.setItem("spark_current_brand_id", brandId);
        }
      } catch (err) {
        console.warn("[SparkContext] ensureDefaultBrand fallback notice:", err);
      }
    }

    if (isSupabaseConfigured() && auth.currentUser?.id && (!brandId || !isUuid(brandId))) {
      throw new Error("Genesis persistence failed: Unable to provision cloud brand workspace UUID.");
    }

    if (brandId && isUuid(brandId)) {
      if (initialMemoryItems[0]) {
        void persistMemoryCreate(brandId, initialMemoryItems[0]);
      }
      try {
        const {
          persistBrandUpdate,
          persistCharacterUpdate,
          persistResearchSourceCreate,
          uploadCharacterSheetToStorage,
        } = await import("../backend/workspaceSync");

        // Upload character sheet image to Supabase Storage bucket 'Spark' for durable persistence
        const rawSheetUrl = data.characterSheetUrl || data.characterImageUrl || null;
        let durableSheetUrl = rawSheetUrl;
        if (rawSheetUrl) {
          try {
            durableSheetUrl = await uploadCharacterSheetToStorage(brandId, rawSheetUrl);
          } catch (storageErr) {
            console.warn("[SparkContext] Character sheet storage upload notice:", storageErr);
          }
        }

        // Update local character state with durable storage URL
        if (durableSheetUrl) {
          setState((prev: any) => ({
            ...prev,
            character: {
              ...prev.character,
              avatarUrl: durableSheetUrl,
              imageUrl: durableSheetUrl,
              characterSheetUrl: durableSheetUrl,
            },
          }));
        }

        await persistBrandUpdate(brandId, {
          name: brandName,
          niche: niche,
          purpose: vision,
          audience: {
            primary: audience,
            painPoints: ["Inconsistent publishing workflow", "High time investment required for research"],
            desires: ["Scale viral audience reach efficiently", "Maintain high quality brand authority"],
          },
          tone: [{ label: tone, active: true }],
          automation_mode: automationMode,
          review_required: reviewRequired,
        });

        const voiceProfileObj = {
          name: data.voiceProfile?.name || data.voiceName || "Executive Presenter",
          language: data.voiceProfile?.language || "English",
          tone: tone,
          locked: true,
          voiceId: data.voiceProfile?.id || data.voiceId || "21m00Tcm4TlvDq8ikWAM",
          description: data.voiceProfile?.accent || data.voiceProfile?.description || data.voiceDescription || "Executive narrator voice",
        };

        await persistCharacterUpdate(brandId, {
          name: creatorName,
          role: "Lead Host",
          style: `${visualStyle} — ${creatorName} representing ${brandName}`,
          avatarUrl: durableSheetUrl,
          imageUrl: durableSheetUrl,
          characterSheetUrl: durableSheetUrl,
          traits: [data.personality || "Visionary", data.tone || "Authoritative", "Expert"].filter(Boolean),
          voice: voiceProfileObj,
        });

        // Persist connected accounts to cloud
        if (data.connectedAccounts && Array.isArray(data.connectedAccounts)) {
          for (const acc of data.connectedAccounts) {
            if (acc && acc.connected && acc.username) {
              await persistAccountToken(brandId, {
                platform: acc.platform,
                handle: `@${acc.username.replace(/^@+/, "")}`,
                status: "connected",
              });
            }
          }
        }

        // Persist research sources to research_sources table in cloud
        if (initialResearchSources.length > 0) {
          for (const src of initialResearchSources) {
            await persistResearchSourceCreate(brandId, src);
          }
        }
      } catch (persistErr) {
        console.warn("[SparkContext] initializeBrandGenesis persist error:", persistErr);
      }
    }

    // Seed additional research sources in background if provided
    if (data.researchSources && Array.isArray(data.researchSources) && data.researchSources.length > 0) {
      data.researchSources.filter(Boolean).forEach((url: string) => {
        void addResearchSource(url);
      });
    }

    // ALWAYS mark onboarding complete in Supabase profiles
    await auth.markOnboardingComplete(brandId);
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
    let spark =
      typeof sparkOrId === "string"
        ? state.viralSparks.find((s: any) => s.id === sparkOrId) || state.viralSparks[0]
        : sparkOrId;
    if (!spark) {
      console.warn("[SparkContext] createProductionFromSpark: Spark not found for:", sparkOrId);
      return;
    }

    // Quality Gate Evaluation
    const evalRes = evaluateSparkForProduction(spark, state.brand);
    if (!evalRes.ok) {
      console.log(`[SparkContext] Spark quality gate triggered auto-repair for "${spark.title}". Failures:`, evalRes.criticalFailures);
      const repaired = autoRepairViralSpark(spark, state.brand);
      const secondEval = evaluateSparkForProduction(repaired, state.brand);

      if (!secondEval.ok) {
        const failureMsg = secondEval.criticalFailures.join("; ");
        NotificationService.addNotification({
          title: "Spark Needs Strengthening",
          message: `Cannot start production: ${failureMsg}. Click 'Strengthen Spark' on card to upgrade.`,
          type: "warning",
        });
        return;
      }

      // Save repaired spark to state & persistence
      spark = repaired;
      setState((prev: any) => ({
        ...prev,
        viralSparks: prev.viralSparks.map((s: any) => (s.id === spark.id ? repaired : s)),
      }));

      const bId = getBrandWorkspaceId();
      if (isSupabaseConfigured() && bId) {
        void import("../backend/workspaceSync").then(({ persistViralSparkCreate }) => {
          void persistViralSparkCreate(bId, repaired);
        });
      }
    }

    const prodId = `p-${Date.now()}`;
    const reviewId = `r-${Date.now()}`;

    const resolvedMode = resolveProductionMode({ spark, brand: state.brand, modeOverride: state.productionMode });
    const hostStyle = state.character?.style || "Executive Creator";
    const status = state.automationMode === "autonomous" ? "Ready for Review" : "Drafting";
    const platformFit = spark.platformFit || (resolvedMode === "deep" ? "YouTube Long-form" : "YouTube Shorts");
    const formats = platformFit.split(" + ").map((s: string) => s.trim()).filter(Boolean);

    // Initial optimistic state creation
    const initialProduction: Production = {
      id: prodId,
      title: spark.title,
      sparkId: spark.id,
      status: status,
      mode: resolvedMode as any,
      dateCreated: new Date().toISOString().split("T")[0],
      aspectRatio: platformFit.includes("YouTube") && !platformFit.includes("TikTok") ? "16:9" : "9:16",
      formats,
      isGeneratingAssets: ProductionGenerationGuard.isEnabled(),
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
          productionId: prodId,
          reviewId: reviewId,
        })
        .then(async ({ production: enrichedProd, reviewItem: enrichedReview, brief: enrichedBrief }) => {
          const stableEnrichedProd: Production = {
            ...enrichedProd,
            id: prodId,
            sparkId: spark.id,
            isGeneratingAssets: ProductionGenerationGuard.isEnabled(),
          };

          setState((prev: any) => ({
            ...prev,
            productions: prev.productions.map((p: any) =>
              p.id === prodId ? { ...p, ...stableEnrichedProd, id: prodId, sparkId: spark.id } : p
            ),
            reviewItems: prev.reviewItems.map((r: any) =>
              r.id === reviewId || r.productionId === prodId
                ? { ...r, ...enrichedReview, id: reviewId, productionId: prodId }
                : r
            ),
          }));

          eventBus.emit("SCRIPT_READY", { prodId, title: enrichedProd.title }, state.brand.name);

          const brandId = getBrandWorkspaceId();
          if (isSupabaseConfigured() && brandId) {
            void persistProductionCreate(brandId, stableEnrichedProd);
          }

          // Chain asset generation automatically when Production Generation is ON
          if (ProductionGenerationGuard.isEnabled()) {
            if (activeGenerationControllers.current.has(prodId)) {
              activeGenerationControllers.current.get(prodId)?.abort();
            }
            const controller = new AbortController();
            activeGenerationControllers.current.set(prodId, controller);

            try {
              const { production: updatedProd, brief: updatedBrief } = await productionService.generateAssetsForProduction({
                production: stableEnrichedProd,
                brand: state.brand,
                character: state.character,
                creditSettings: state.creditSettings || DEFAULT_CREDIT_SETTINGS,
                signal: controller.signal,
                onProgress: (progress) => {
                  if (controller.signal.aborted) return;
                  setState((prev: any) => ({
                    ...prev,
                    productions: prev.productions.map((p: any) => {
                      if (p.id !== prodId) return p;
                      const partial = progress.partialAssets;
                      const updatedScenes = partial?.storyboard?.length
                        ? partial.storyboard.map((s: any, idx: number) => ({
                            scene: s.scene || idx + 1,
                            description: s.description || s.visualDescription || `Scene ${s.scene || idx + 1}`,
                            duration: s.duration || "0-10s",
                            image: s.image || p.scenes?.[idx]?.image,
                            videoUrl: s.videoUrl || partial.videoUrl || p.scenes?.[idx]?.videoUrl,
                          }))
                        : p.scenes;

                      const mergedBrief = p.brief
                        ? {
                            ...p.brief,
                            storyboard: partial?.storyboard || p.brief.storyboard,
                            audioUrl: partial?.voiceUrl || p.brief.audioUrl,
                            videoUrl: partial?.videoUrl || p.brief.videoUrl,
                            generatedAssets: {
                              ...p.brief.generatedAssets,
                              generationProgress: progress,
                              generatedFrames: partial?.storyboard?.map((s) => s.image).filter(Boolean) as string[] || p.brief.generatedAssets?.generatedFrames,
                              thumbnails: partial?.thumbnails || p.brief.generatedAssets?.thumbnails,
                              voiceoverUrl: partial?.voiceUrl || p.brief.generatedAssets?.voiceoverUrl,
                              generatedVideos: partial?.videoUrl ? [partial.videoUrl] : p.brief.generatedAssets?.generatedVideos,
                            },
                          }
                        : p.brief;

                      return {
                        ...p,
                        generationProgress: progress,
                        scenes: updatedScenes,
                        audioUrl: partial?.voiceUrl || p.audioUrl,
                        videoUrl: partial?.videoUrl || p.videoUrl,
                        brief: mergedBrief,
                      };
                    }),
                    reviewItems: prev.reviewItems.map((r: any) => {
                      if (r.productionId !== prodId && r.id !== reviewId) return r;
                      const partial = progress.partialAssets;
                      const currentBrief = r.brief || enrichedBrief;
                      const mergedBrief = currentBrief
                        ? {
                            ...currentBrief,
                            storyboard: partial?.storyboard || currentBrief.storyboard,
                            audioUrl: partial?.voiceUrl || currentBrief.audioUrl,
                            videoUrl: partial?.videoUrl || currentBrief.videoUrl,
                            generatedAssets: {
                              ...currentBrief.generatedAssets,
                              generationProgress: progress,
                              generatedFrames: partial?.storyboard?.map((s) => s.image).filter(Boolean) as string[] || currentBrief.generatedAssets?.generatedFrames,
                              thumbnails: partial?.thumbnails || currentBrief.generatedAssets?.thumbnails,
                              voiceoverUrl: partial?.voiceUrl || currentBrief.generatedAssets?.voiceoverUrl,
                              generatedVideos: partial?.videoUrl ? [partial.videoUrl] : currentBrief.generatedAssets?.generatedVideos,
                            },
                          }
                        : currentBrief;

                      return {
                        ...r,
                        openingMoment: partial?.storyboard?.[0]?.visualDescription || r.openingMoment,
                        videoUrl: partial?.videoUrl || r.videoUrl,
                        brief: mergedBrief,
                      };
                    }),
                  }));

                  const bId = getBrandWorkspaceId();
                  if (isSupabaseConfigured() && bId) {
                    void import("../backend/workspaceSync").then(({ persistProductionUpdate, persistReviewUpdate }) => {
                      setState((currState: any) => {
                        const pUpdate = currState.productions?.find((p: any) => p.id === prodId);
                        const rUpdate = currState.reviewItems?.find((r: any) => r.productionId === prodId || r.id === reviewId);
                        if (pUpdate?.id) void persistProductionUpdate(pUpdate.id, pUpdate);
                        if (rUpdate?.id) void persistReviewUpdate(rUpdate.id, rUpdate);
                        return currState;
                      });
                    });
                  }
                },
              });

              if (controller.signal.aborted) return;

              setState((prev: any) => ({
                ...prev,
                productions: prev.productions.map((p: any) =>
                  p.id === prodId
                    ? {
                        ...p,
                        ...updatedProd,
                        id: prodId,
                        sparkId: spark.id,
                        videoUrl: updatedProd.videoUrl || updatedBrief.videoUrl || p.videoUrl,
                        audioUrl: updatedProd.audioUrl || updatedBrief.audioUrl || p.audioUrl,
                        scenes: updatedProd.scenes || p.scenes,
                        brief: updatedBrief,
                        isGeneratingAssets: false,
                      }
                    : p
                ),
                reviewItems: prev.reviewItems.map((r: any) =>
                  r.productionId === prodId || r.id === reviewId
                    ? {
                        ...r,
                        brief: updatedBrief,
                        videoUrl: updatedProd.videoUrl || updatedBrief.videoUrl || r.videoUrl,
                        audioUrl: updatedProd.audioUrl || updatedBrief.audioUrl || r.audioUrl,
                        openingMoment: updatedBrief.storyboard?.[0]?.visualDescription || r.openingMoment,
                      }
                    : r
                ),
              }));

              const bId = getBrandWorkspaceId();
              if (isSupabaseConfigured() && bId) {
                void import("../backend/workspaceSync").then(({ persistProductionUpdate, persistReviewUpdate }) => {
                  void persistProductionUpdate(prodId, {
                    ...updatedProd,
                    videoUrl: updatedProd.videoUrl || updatedBrief.videoUrl,
                    audioUrl: updatedProd.audioUrl || updatedBrief.audioUrl,
                    brief: updatedBrief,
                  });
                  if (reviewId) {
                    void persistReviewUpdate(reviewId, {
                      videoUrl: updatedProd.videoUrl || updatedBrief.videoUrl,
                      audioUrl: updatedProd.audioUrl || updatedBrief.audioUrl,
                      brief: updatedBrief,
                    });
                  }
                });
              }

              eventBus.emit("STORYBOARD_READY", { prodId, title: updatedProd.title }, state.brand.name);
            } catch (assetErr: any) {
              if (controller.signal.aborted || assetErr?.name === "AbortError") {
                console.log(`[SparkContext] Auto generation aborted for prodId ${prodId}`);
                return;
              }
              console.warn("[SparkContext] Auto asset generation notice:", assetErr);
              setState((prev: any) => ({
                ...prev,
                productions: prev.productions.map((p: any) =>
                  p.id === prodId
                    ? { ...p, isGeneratingAssets: false, lastError: assetErr?.message || String(assetErr) }
                    : p
                ),
              }));
            } finally {
              if (activeGenerationControllers.current.get(prodId) === controller) {
                activeGenerationControllers.current.delete(prodId);
              }
            }
          }
        })
        .catch((err: any) => {
          console.warn("[SparkContext] Production brief generation notice:", err);
          setState((prev: any) => ({
            ...prev,
            productions: prev.productions.map((p: any) =>
              p.id === prodId
                ? { ...p, isGeneratingAssets: false, lastError: err?.message || String(err) }
                : p
            ),
          }));
        });
    });

    return { production: initialProduction, reviewItem: initialReviewItem };
  };

  const fixProductionScene = useCallback(
    async (productionId: string, sceneIndex: number, editNotes: string) => {
      const prod = state.productions?.find((p: any) => p.id === productionId);
      if (!prod) return null;

      const { ProductionAssetService } = await import("../services/production/productionAssetService");
      const updatedScene = await ProductionAssetService.fixProductionScene({
        productionId,
        sceneIndex,
        editNotes,
        brand: state.brand,
        character: state.character,
        production: prod,
      });

      if (updatedScene) {
        setState((prev: any) => ({
          ...prev,
          productions: prev.productions.map((p: any) => {
            if (p.id !== productionId) return p;
            const currentScenes = p.productionScenes || [];
            const updatedScenes = currentScenes.map((s: any) => (s.index === sceneIndex ? updatedScene : s));
            return { ...p, productionScenes: updatedScenes };
          }),
        }));
      }
      return updatedScene;
    },
    [state.productions, state.brand, state.character]
  );

  const mergeProductionScenes = useCallback(
    async (productionId: string) => {
      const prod = state.productions?.find((p: any) => p.id === productionId);
      if (!prod) return null;

      const { ProductionAssetService } = await import("../services/production/productionAssetService");
      const masterUrl = await ProductionAssetService.mergeProductionScenes({
        productionId,
        production: prod,
        brand: state.brand,
      });

      if (masterUrl) {
        setState((prev: any) => ({
          ...prev,
          productions: prev.productions.map((p: any) => {
            if (p.id !== productionId) return p;
            return {
              ...p,
              videoUrl: masterUrl,
              status: "Ready for Review",
              brief: {
                ...(p.brief || {}),
                videoUrl: masterUrl,
                generatedAssets: {
                  ...(p.brief?.generatedAssets || {}),
                  generatedVideos: [masterUrl],
                },
              },
            };
          }),
        }));
      }
      return masterUrl;
    },
    [state.productions, state.brand]
  );

  const strengthenSpark = useCallback(
    (sparkId: string): ViralSpark | undefined => {
      const targetSpark = state.viralSparks?.find((s: any) => s.id === sparkId);
      if (!targetSpark) return undefined;

      const repaired = autoRepairViralSpark(targetSpark, state.brand);
      setState((prev: any) => ({
        ...prev,
        viralSparks: prev.viralSparks.map((s: any) => (s.id === sparkId ? repaired : s)),
      }));

      const bId = getBrandWorkspaceId();
      if (isSupabaseConfigured() && bId) {
        void import("../backend/workspaceSync").then(({ persistViralSparkCreate }) => {
          void persistViralSparkCreate(bId, repaired);
        });
      }

      NotificationService.addNotification({
        title: "Spark Strengthened",
        message: `Upgraded "${repaired.title}" with brand-spoken hook & CTA. Ready for production!`,
        type: "success",
      });

      return repaired;
    },
    [state.viralSparks, state.brand]
  );

  const [productionGenerationEnabled, setProductionGenerationEnabledState] = useState<boolean>(() => {
    return ProductionGenerationGuard.isEnabled();
  });

  const toggleProductionGeneration = (enabled?: boolean) => {
    const next = enabled !== undefined ? enabled : !productionGenerationEnabled;
    setProductionGenerationEnabledState(next);
    ProductionGenerationGuard.setEnabled(next);

    // If turning OFF, immediately cancel active asset generations and pause queues
    if (!next) {
      setState((prev: any) => ({
        ...prev,
        productions: (prev.productions || []).map((p: any) =>
          p.isGeneratingAssets ? { ...p, isGeneratingAssets: false } : p
        ),
      }));
    }
  };

  const generateProductionAssets = async (productionId: string, forceRegenerate = false) => {
    if (!ProductionGenerationGuard.isEnabled()) {
      console.warn("[SparkContext] Asset generation blocked: Production Generation is OFF.");
      return;
    }

    const prod = state.productions.find((p: any) => p.id === productionId);
    if (!prod) return;

    if (activeGenerationControllers.current.has(productionId)) {
      activeGenerationControllers.current.get(productionId)?.abort();
    }
    const controller = new AbortController();
    activeGenerationControllers.current.set(productionId, controller);

    eventBus.emit("RENDER_STARTED", { prodId: productionId }, state.brand.name);

    setState((prev: any) => ({
      ...prev,
      productions: prev.productions.map((p: any) =>
        p.id === productionId ? { ...p, isGeneratingAssets: true, lastError: undefined } : p
      ),
    }));

    try {
      const { productionService } = await import("../services/productionService");
      const { production: updatedProd, brief: updatedBrief } = await productionService.generateAssetsForProduction({
        production: prod,
        brand: state.brand,
        character: state.character,
        creditSettings: state.creditSettings || DEFAULT_CREDIT_SETTINGS,
        forceRegenerate,
        signal: controller.signal,
        onProgress: (progress) => {
          if (controller.signal.aborted) return;
          setState((prev: any) => ({
            ...prev,
            productions: prev.productions.map((p: any) => {
              if (p.id !== productionId) return p;
              const partial = progress.partialAssets;
              const updatedScenes = partial?.storyboard?.length
                ? partial.storyboard.map((s: any, idx: number) => ({
                    scene: s.scene || idx + 1,
                    description: s.description || s.visualDescription || `Scene ${s.scene || idx + 1}`,
                    duration: s.duration || "0-10s",
                    image: s.image || p.scenes?.[idx]?.image,
                    videoUrl: s.videoUrl || partial.videoUrl || p.scenes?.[idx]?.videoUrl,
                  }))
                : p.scenes;

              const mergedBrief = p.brief
                ? {
                    ...p.brief,
                    storyboard: partial?.storyboard || p.brief.storyboard,
                    audioUrl: partial?.voiceUrl || p.brief.audioUrl,
                    videoUrl: partial?.videoUrl || p.brief.videoUrl,
                    generatedAssets: {
                      ...p.brief.generatedAssets,
                      generationProgress: progress,
                      generatedFrames: partial?.storyboard?.map((s) => s.image).filter(Boolean) as string[] || p.brief.generatedAssets?.generatedFrames,
                      thumbnails: partial?.thumbnails || p.brief.generatedAssets?.thumbnails,
                      voiceoverUrl: partial?.voiceUrl || p.brief.generatedAssets?.voiceoverUrl,
                      generatedVideos: partial?.videoUrl ? [partial.videoUrl] : p.brief.generatedAssets?.generatedVideos,
                    },
                  }
                : p.brief;

              return {
                ...p,
                generationProgress: progress,
                scenes: updatedScenes,
                audioUrl: partial?.voiceUrl || p.audioUrl,
                videoUrl: partial?.videoUrl || p.videoUrl,
                brief: mergedBrief,
              };
            }),
            reviewItems: prev.reviewItems.map((r: any) => {
              if (r.productionId !== productionId || !r.brief) return r;
              const partial = progress.partialAssets;
              const mergedBrief = {
                ...r.brief,
                storyboard: partial?.storyboard || r.brief.storyboard,
                audioUrl: partial?.voiceUrl || r.brief.audioUrl,
                videoUrl: partial?.videoUrl || r.brief.videoUrl,
                generatedAssets: {
                  ...r.brief.generatedAssets,
                  generationProgress: progress,
                  generatedFrames: partial?.storyboard?.map((s) => s.image).filter(Boolean) as string[] || r.brief.generatedAssets?.generatedFrames,
                  thumbnails: partial?.thumbnails || r.brief.generatedAssets?.thumbnails,
                  voiceoverUrl: partial?.voiceUrl || r.brief.generatedAssets?.voiceoverUrl,
                  generatedVideos: partial?.videoUrl ? [partial.videoUrl] : r.brief.generatedAssets?.generatedVideos,
                },
              };
              return {
                ...r,
                openingMoment: partial?.storyboard?.[0]?.visualDescription || r.openingMoment,
                videoUrl: partial?.videoUrl || r.videoUrl,
                brief: mergedBrief,
              };
            }),
          }));

          const bId = getBrandWorkspaceId();
          if (isSupabaseConfigured() && bId) {
            void import("../backend/workspaceSync").then(({ persistProductionUpdate, persistReviewUpdate }) => {
              setState((currState: any) => {
                const pUpdate = currState.productions?.find((p: any) => p.id === productionId);
                const rUpdate = currState.reviewItems?.find((r: any) => r.productionId === productionId);
                if (pUpdate?.id) void persistProductionUpdate(pUpdate.id, pUpdate);
                if (rUpdate?.id) void persistReviewUpdate(rUpdate.id, rUpdate);
                return currState;
              });
            });
          }
        },
      });

      if (controller.signal.aborted) return;

      setState((prev: any) => ({
        ...prev,
        productions: prev.productions.map((p: any) =>
          p.id === productionId ? { ...p, ...updatedProd, id: productionId, isGeneratingAssets: false } : p
        ),
        reviewItems: prev.reviewItems.map((r: any) =>
          r.productionId === productionId
            ? {
                ...r,
                brief: updatedBrief,
                videoUrl: updatedProd.videoUrl || updatedBrief.videoUrl || r.videoUrl,
                openingMoment: updatedBrief.storyboard?.[0]?.visualDescription || r.openingMoment,
              }
            : r
        ),
      }));

      eventBus.emit("STORYBOARD_READY", { prodId: productionId, title: updatedProd.title }, state.brand.name);
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === "AbortError") {
        console.log(`[SparkContext] Asset generation aborted for prodId ${productionId}`);
        return;
      }
      console.warn("[SparkContext] Asset generation notice:", err);
      setState((prev: any) => ({
        ...prev,
        productions: prev.productions.map((p: any) =>
          p.id === productionId
            ? { ...p, isGeneratingAssets: false, lastError: err?.message || String(err) }
            : p
        ),
      }));
    } finally {
      if (activeGenerationControllers.current.get(productionId) === controller) {
        activeGenerationControllers.current.delete(productionId);
      }
    }
  };

  const cancelProduction = (productionId: string) => {
    // 1. Abort in-flight generation controller if running
    const controller = activeGenerationControllers.current.get(productionId);
    if (controller) {
      controller.abort();
      activeGenerationControllers.current.delete(productionId);
      console.log(`[SparkContext] Aborted active generation controller for production: ${productionId}`);
    }

    // 2. Set production state to Cancelled immediately
    setState((prev: any) => ({
      ...prev,
      productions: prev.productions.map((p: any) =>
        p.id === productionId
          ? {
              ...p,
              status: "Cancelled",
              isGeneratingAssets: false,
              lastError: "Cancelled by executive",
              generationProgress: p.generationProgress
                ? { ...p.generationProgress, stage: "Cancelled", message: "Generation cancelled by executive" }
                : undefined,
            }
          : p
      ),
      reviewItems: prev.reviewItems.map((r: any) =>
        r.productionId === productionId ? { ...r, status: "Needs Edit" } : r
      ),
    }));

    // 3. Persist cancellation to production service
    void import("../services/productionService").then(({ productionService }) => {
      void productionService.cancelProduction(productionId);
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

      const targetProd = prev.productions.find((p: any) => p.id === review.productionId);
      let updatedMemories = prev.memoryItems;

      if (targetProd) {
        const bId = getBrandWorkspaceId() || "default-brand";
        const winRes = recordBrandPerformanceWin({
          brandId: bId,
          production: targetProd,
          brief: review.brief || targetProd.brief,
          platform: review.account,
          existingMemories: prev.memoryItems,
        });
        updatedMemories = winRes.updatedMemories;

        if (winRes.isNew && isSupabaseConfigured()) {
          void import("../backend/workspaceSync").then(({ persistMemoryCreate }) => {
            void persistMemoryCreate(bId, winRes.memoryItem);
          });
        }
      }

      return {
        ...prev,
        memoryItems: updatedMemories,
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

  const deleteProduction = (productionId: string) => {
    if (!productionId) return;

    if (activeGenerationControllers.current.has(productionId)) {
      try {
        activeGenerationControllers.current.get(productionId)?.abort();
        activeGenerationControllers.current.delete(productionId);
      } catch {}
    }

    setState((prev: any) => {
      const updatedProductions = (prev.productions || []).filter((p: any) => p.id !== productionId);
      const updatedReviewItems = (prev.reviewItems || []).filter(
        (r: any) => r.productionId !== productionId && r.id !== productionId && r.id !== `rev-${productionId}`
      );
      return {
        ...prev,
        productions: updatedProductions,
        reviewItems: updatedReviewItems,
      };
    });

    if (isSupabaseConfigured()) {
      void import("../backend/repositories/productionRepository").then(({ deleteProduction: dbDeleteProd }) => {
        dbDeleteProd(productionId).catch((err) => console.warn("[SparkContext] Delete production DB notice:", err));
      });
      void import("../backend/repositories/reviewRepository").then(({ deleteReviewItem: dbDeleteReview }) => {
        dbDeleteReview(productionId).catch(() => {});
        dbDeleteReview(`rev-${productionId}`).catch(() => {});
      });
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

  const addOffer = (offerData: Omit<Offer, "id" | "createdAt" | "updatedAt">): Offer => {
    const newOffer: Offer = {
      id: `offer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...offerData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState((prev: any) => {
      const existingOffers: Offer[] = Array.isArray(prev.offers) ? prev.offers : [];
      const updated = newOffer.isDefault
        ? existingOffers.map((o) => ({ ...o, isDefault: false }))
        : existingOffers;
      return {
        ...prev,
        offers: [newOffer, ...updated],
      };
    });
    return newOffer;
  };

  const updateOffer = (id: string, updates: Partial<Offer>) => {
    setState((prev: any) => {
      const existingOffers: Offer[] = Array.isArray(prev.offers) ? prev.offers : [];
      return {
        ...prev,
        offers: existingOffers.map((o) => {
          if (o.id !== id) {
            return updates.isDefault ? { ...o, isDefault: false } : o;
          }
          return {
            ...o,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    });
  };

  const removeOffer = (id: string) => {
    setState((prev: any) => ({
      ...prev,
      offers: (prev.offers || []).filter((o: Offer) => o.id !== id),
    }));
  };

  const setDefaultOffer = (id: string) => {
    setState((prev: any) => ({
      ...prev,
      offers: (prev.offers || []).map((o: Offer) => ({
        ...o,
        isDefault: o.id === id,
        updatedAt: o.id === id ? new Date().toISOString() : o.updatedAt,
      })),
    }));
  };

  const toggleOfferActive = (id: string) => {
    setState((prev: any) => ({
      ...prev,
      offers: (prev.offers || []).map((o: Offer) => {
        if (o.id === id) {
          const nextActive = !o.active;
          return {
            ...o,
            active: nextActive,
            isDefault: nextActive ? o.isDefault : false,
            updatedAt: new Date().toISOString(),
          };
        }
        return o;
      }),
    }));
  };

  const getDefaultOffer = (): Offer | undefined => {
    const currentOffers: Offer[] = Array.isArray(state.offers) ? state.offers : [];
    return currentOffers.find((o) => o.active && o.isDefault) || currentOffers.find((o) => o.active);
  };

  const getActiveOffers = (): Offer[] => {
    const currentOffers: Offer[] = Array.isArray(state.offers) ? state.offers : [];
    return currentOffers.filter((o) => o.active);
  };

  const addResearchSource = async (url: string) => {
    const { ResearchSourceService } = await import("../services/research/researchSourceService");
    const { ResearchDepartmentService } = await import("../services/research/researchDepartmentService");
    const brandId = getBrandWorkspaceId();
    const result = await ResearchSourceService.registerAndExtract(url, brandId, state.researchSources || []);
    if (!result) return;

    const { source, patterns } = result;

    setState((prev: any) => {
      const { memoryItems: newMemoryItems, viralSparks: newSparks, updatedSparks, updatedMemories } =
        ResearchDepartmentService.processPatterns(
          brandId,
          source,
          patterns,
          prev.viralSparks || [],
          prev.memoryItems || []
        );

      const mergedSparks = (prev.viralSparks || []).map((s: any) => {
        const u = updatedSparks.find((us: any) => us.id === s.id || (us.fingerprint && us.fingerprint === s.fingerprint));
        return u ? { ...s, ...u } : s;
      });

      const mergedMemories = (prev.memoryItems || []).map((m: any) => {
        const u = updatedMemories.find((um: any) => um.id === m.id || (um.fingerprint && um.fingerprint === m.fingerprint));
        return u ? { ...m, ...u } : m;
      });

      return {
        ...prev,
        researchSources: [source, ...(prev.researchSources || []).filter((s: any) => s.id !== source.id)],
        researchPatterns: [...patterns, ...(prev.researchPatterns || []).filter((p: any) => p.sourceId !== source.id)],
        memoryItems: [...newMemoryItems, ...mergedMemories],
        viralSparks: [...newSparks, ...mergedSparks],
      };
    });
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

      setState((prev: any) => {
        const { memoryItems: newMemoryItems, viralSparks: newSparks, updatedSparks, updatedMemories } =
          ResearchDepartmentService.processPatterns(
            brandId,
            source,
            patterns,
            prev.viralSparks || [],
            prev.memoryItems || []
          );

        const mergedSparks = (prev.viralSparks || []).map((s: any) => {
          const u = updatedSparks.find((us: any) => us.id === s.id || (us.fingerprint && us.fingerprint === s.fingerprint));
          return u ? { ...s, ...u } : s;
        });

        const mergedMemories = (prev.memoryItems || []).map((m: any) => {
          const u = updatedMemories.find((um: any) => um.id === m.id || (um.fingerprint && um.fingerprint === m.fingerprint));
          return u ? { ...m, ...u } : m;
        });

        return {
          ...prev,
          researchSources: (prev.researchSources || []).map((s: any) => (s.id === id ? source : s)),
          researchPatterns: [...patterns, ...(prev.researchPatterns || []).filter((p: any) => p.sourceId !== id)],
          memoryItems: [...newMemoryItems, ...mergedMemories],
          viralSparks: [...newSparks, ...mergedSparks],
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

    const isFormatCommand =
      /\b(landscape|portrait|dynamic|shorts|tiktok|youtube long|16:9|9:16|\d+\s*min|\d+\s*minute|\d+\s*m\b)\b/i.test(lower) &&
      /\b(format|aspect|duration|length|set|mode|video|style|target)\b/i.test(lower);

    if (isFormatCommand) {
      let aspectMode: import("../domain/types").AspectMode | undefined = undefined;
      if (/\b(landscape|16:9|youtube long)\b/i.test(lower)) aspectMode = "landscape";
      else if (/\b(portrait|9:16|shorts|tiktok)\b/i.test(lower)) aspectMode = "portrait";
      else if (/\b(dynamic|auto)\b/i.test(lower)) aspectMode = "dynamic";

      let targetDurationSec: number | undefined = undefined;
      const minMatch = lower.match(/(\d+)\s*(min|minute|m\b)/i);
      if (minMatch) {
        const mins = parseInt(minMatch[1], 10);
        const validSecs = [60, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
        const closest = validSecs.reduce((prev, curr) => (Math.abs(curr - mins * 60) < Math.abs(prev - mins * 60) ? curr : prev));
        targetDurationSec = closest;
      }

      if (aspectMode || targetDurationSec) {
        const patch: Partial<import("../domain/types").ProductionFormatSettings> = {};
        if (aspectMode) patch.aspectMode = aspectMode;
        if (targetDurationSec) patch.targetDurationSec = targetDurationSec;
        void updateFormatSettings(patch);

        const currentSettings = { ...(state.formatSettings || DEFAULT_FORMAT_SETTINGS), ...patch };
        const aspectStr = currentSettings.aspectMode.toUpperCase();
        const durStr = `${Math.round(currentSettings.targetDurationSec / 60)}m`;
        const formatNotice = `Production format settings updated: ${aspectStr} aspect ratio strategy, ${durStr} target video length.`;
        if (onChunk) onChunk(formatNotice);
        activeAiRequestRef.current = false;
        return formatNotice;
      }
    }

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
        void persistProductionUpdate(productionId, { status: "Published" } as any);
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
        updateCharacter,
        resetWorkspace,
        initializeBrandGenesis,
        updateAutomationMode,
        updateProductionMode,
        updateCreditSettings,
        updateFormatSettings,
        updateAISettings,
        createProductionFromSpark,
        strengthenSpark,
        generateProductionAssets,
        fixProductionScene,
        mergeProductionScenes,
        cancelProduction,
        deleteProduction,
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
        addOffer,
        updateOffer,
        removeOffer,
        setDefaultOffer,
        toggleOfferActive,
        getDefaultOffer,
        getActiveOffers,
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
