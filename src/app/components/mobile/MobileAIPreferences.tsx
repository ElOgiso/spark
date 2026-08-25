import React, { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { ModelRouter } from "../../services/runtime/modelRouter";
import type { AIProviderId, AICapabilityType, AIRoutingCategory } from "../../domain/types";
import { getProviderLogo } from "../ui/AIProviderLogos";
import { PROVIDER_VIDEO_CAPABILITIES } from "../../services/runtime/providerCapabilities";
import {
  Sparkles,
  ChevronRight,
  Check,
  X,
  Layers,
  ArrowLeft,
  Info,
  RotateCcw,
} from "lucide-react";

interface MobileAIPreferencesProps {
  onBack?: () => void;
  onNavigate?: (path: string) => void;
}

interface TaskItemConfig {
  id: AIRoutingCategory;
  name: string;
  desc: string;
  category: "Creative" | "Intelligence" | "Operations";
}

const MOBILE_AI_TASKS: TaskItemConfig[] = [
  {
    id: "superSpark",
    name: "Super Spark Chat",
    desc: "Executive assistant, directives & live strategy",
    category: "Intelligence",
  },
  {
    id: "research",
    name: "Research Department",
    desc: "Breakout trend discovery & hook scoring",
    category: "Intelligence",
  },
  {
    id: "videoUnderstanding",
    name: "Video Understanding",
    desc: "Multimodal frame analysis & visual parsing",
    category: "Intelligence",
  },
  {
    id: "production",
    name: "Production Briefs",
    desc: "Duration-sized beat sheets & scripts",
    category: "Creative",
  },
  {
    id: "storyboardImages",
    name: "Storyboard Keyframes",
    desc: "9:16 vertical scene stills & character lock",
    category: "Creative",
  },
  {
    id: "videoGeneration",
    name: "Video Generation",
    desc: "9:16 continuous vertical motion clips",
    category: "Creative",
  },
  {
    id: "voice",
    name: "Voiceover Narration",
    desc: "High-fidelity brand voice & speech synthesis",
    category: "Creative",
  },
  {
    id: "automation",
    name: "Autonomous Engine",
    desc: "Background trend monitoring & queue scheduling",
    category: "Operations",
  },
  {
    id: "analytics",
    name: "Analytics & Attribution",
    desc: "Virality scoring & performance intelligence",
    category: "Operations",
  },
];

export function MobileAIPreferences({ onBack, onNavigate }: MobileAIPreferencesProps) {
  const { aiSettings, updateAISettings, brand } = useSpark();
  const [selectedTaskKey, setSelectedTaskKey] = useState<AIRoutingCategory | null>(null);

  const currentRouting = aiSettings?.routing || ModelRouter.getUserRoutingConfig();
  const currentModels = aiSettings?.models || ModelRouter.getUserModelSelectionConfig();

  const customCount = Object.values(currentRouting).filter((p) => p && p !== "auto").length;
  const isMasterAuto = customCount === 0;

  const handleSetMasterAuto = async () => {
    const autoRouting = ModelRouter.getDefaultRoutingConfig();
    ModelRouter.setUserRoutingConfig(autoRouting);
    if (updateAISettings) {
      await updateAISettings({ routing: autoRouting });
    }
  };

  const handleSelectProvider = async (taskId: AIRoutingCategory, providerId: AIProviderId) => {
    const updated = { ...currentRouting, [taskId]: providerId };
    ModelRouter.setUserRoutingConfig(updated);
    if (updateAISettings) {
      await updateAISettings({ routing: updated });
    }
    setSelectedTaskKey(null);
  };

  const handleGoBack = () => {
    if (onBack) onBack();
    else if (onNavigate) onNavigate("more");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 1. Header (Onboard Visual DNA) */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3.5 flex items-center justify-between">
        <button
          onClick={handleGoBack}
          className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/10 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">AI Preferences</h1>
          <p className="text-[10px] text-muted-foreground">Model routing & provider limits</p>
        </div>
        <button
          onClick={handleSetMasterAuto}
          disabled={isMasterAuto}
          className={`p-2 -mr-2 rounded-xl text-xs flex items-center gap-1 transition-all ${
            isMasterAuto
              ? "opacity-0 pointer-events-none"
              : "text-purple-400 hover:text-purple-300 active:scale-95"
          }`}
          title="Reset to Best Available"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4 pb-20 max-w-lg mx-auto w-full">
        {/* 2. Master Control Card (Onboard Glass Card) */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/20 via-card to-card p-4 space-y-3 shadow-lg shadow-purple-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-foreground">Best Available (Recommended)</h2>
                <p className="text-[11px] text-muted-foreground">Dynamic peak-quality routing</p>
              </div>
            </div>

            <button
              onClick={handleSetMasterAuto}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isMasterAuto
                  ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {isMasterAuto ? "Active" : "Enable"}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isMasterAuto
              ? "SPARK automatically routes each creative task to its quality peak (Veo for vertical video, Claude/GPT for reasoning, ElevenLabs for VO)."
              : `${customCount} custom task override${customCount > 1 ? "s" : ""} active. Other tasks use Best Available.`}
          </p>
        </div>

        {/* 3. Task List (One Clear Row Per Task) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Tasks & Providers
            </h3>
            <span className="text-[10px] text-muted-foreground">Tap any row to change</span>
          </div>

          <div className="rounded-2xl border border-border bg-card divide-y divide-border/50 overflow-hidden shadow-sm">
            {MOBILE_AI_TASKS.map((task) => {
              const configuredProvider = (currentRouting as any)[task.id] || "auto";
              const effectiveProvider = ModelRouter.resolveProvider(task.id, currentRouting);
              const isAuto = configuredProvider === "auto";

              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskKey(task.id)}
                  className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-accent/5 active:bg-accent/10 transition-colors"
                >
                  {/* Left: Real Logo */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-background border border-border/80 flex items-center justify-center shrink-0 shadow-sm">
                      {getProviderLogo(isAuto ? effectiveProvider : configuredProvider, 24)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block truncate">
                        {task.name}
                      </span>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {task.desc}
                      </p>
                    </div>
                  </div>

                  {/* Right: Badge & Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium border flex items-center gap-1 ${
                        isAuto
                          ? "bg-purple-500/10 text-purple-300 border-purple-500/20 font-medium"
                          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-mono font-semibold"
                      }`}
                    >
                      <span>
                        {isAuto
                          ? `Auto (${effectiveProvider.toUpperCase()})`
                          : configuredProvider.toUpperCase()}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Help / Transparency Footer */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex items-start gap-2.5 text-[11px] text-muted-foreground">
          <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <p>
            When a pinned provider lacks an API key or encounters an upstream outage, SPARK smoothly fails over to Best Available without halting production.
          </p>
        </div>
      </div>

      {/* 5. Bottom Sheet Modal (Onboard DNA) */}
      {selectedTaskKey && (() => {
        const activeTask = MOBILE_AI_TASKS.find((t) => t.id === selectedTaskKey);
        if (!activeTask) return null;

        const configuredProvider = (currentRouting as any)[selectedTaskKey] || "auto";
        const capability = ModelRouter.mapCategoryToCapability(selectedTaskKey);

        const providerOptions: Array<{
          id: AIProviderId;
          name: string;
          note: string;
          logoId: string;
        }> = [
          {
            id: "auto",
            name: "Best Available (Auto)",
            note: "SPARK dynamically selects the optimal model for this task",
            logoId: "auto",
          },
        ];

        if (capability === "Video Generation") {
          providerOptions.push(
            {
              id: "gemini",
              name: PROVIDER_VIDEO_CAPABILITIES.gemini.displayName,
              note: "Google Veo (4s, 6s, 8s native clips with synchronized audio)",
              logoId: "gemini",
            },
            {
              id: "grok",
              name: PROVIDER_VIDEO_CAPABILITIES.grok.displayName,
              note: "xAI Grok Imagine Video (1–15s motion preview)",
              logoId: "grok",
            },
            {
              id: "kling",
              name: PROVIDER_VIDEO_CAPABILITIES.kling.displayName,
              note: "Kling 1.5 high-coherence motion (5s or 10s)",
              logoId: "kling",
            },
            {
              id: "runway",
              name: PROVIDER_VIDEO_CAPABILITIES.runway.displayName,
              note: "Runway Gen-3 Alpha cinematic motion (5s or 10s)",
              logoId: "runway",
            },
            {
              id: "luma",
              name: PROVIDER_VIDEO_CAPABILITIES.luma.displayName,
              note: "Luma Ray 2 keyframe motion (5s or 9s)",
              logoId: "luma",
            },
            {
              id: "higgsfield",
              name: PROVIDER_VIDEO_CAPABILITIES.higgsfield.displayName,
              note: "Higgsfield Pop / Cinema vertical motion (4s or 8s)",
              logoId: "higgsfield",
            }
          );
        } else if (capability === "Text To Speech") {
          providerOptions.push(
            {
              id: "elevenlabs",
              name: "ElevenLabs",
              note: "Dedicated production voiceover narration & brand voices",
              logoId: "elevenlabs",
            },
            {
              id: "gemini",
              name: "Google Gemini TTS",
              note: "Natural multi-voice speech synthesis",
              logoId: "gemini",
            },
            {
              id: "openai",
              name: "OpenAI Voice",
              note: "Super Spark conversational voice audio",
              logoId: "openai",
            }
          );
        } else if (capability === "Image Generation") {
          providerOptions.push(
            {
              id: "gemini",
              name: "Google Imagen 3 / Gemini",
              note: "8K UHD keyframes with visual lock conditioning",
              logoId: "gemini",
            },
            {
              id: "openai",
              name: "OpenAI GPT Image 1.5",
              note: "High-fidelity stills & stylized illustration",
              logoId: "openai",
            },
            {
              id: "grok",
              name: "xAI Grok Imagine",
              note: "Rapid concept rendering & high-contrast visuals",
              logoId: "grok",
            }
          );
        } else {
          // Reasoning / Chat / Vision / General Intelligence
          providerOptions.push(
            {
              id: "gemini",
              name: "Google Gemini 2.5 Pro / Flash",
              note: "Deep multimodal vision & fast structured reasoning",
              logoId: "gemini",
            },
            {
              id: "claude",
              name: "Anthropic Claude Sonnet & Opus",
              note: "Elite production compiling, scripting & critique",
              logoId: "claude",
            },
            {
              id: "openai",
              name: "OpenAI GPT-5.6",
              note: "Flagship intelligence & strategic decisions",
              logoId: "openai",
            },
            {
              id: "grok",
              name: "xAI Grok 4.5",
              note: "Real-time discovery & cultural radar analysis",
              logoId: "grok",
            }
          );
        }

        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            {/* Backdrop */}
            <div className="absolute inset-0" onClick={() => setSelectedTaskKey(null)} />

            {/* Bottom Sheet Panel */}
            <div className="relative w-full max-w-lg bg-card border-t border-border rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl z-10 animate-slide-up">
              {/* Drag Handle */}
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto" />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 pt-1">
                <div>
                  <h3 className="text-base font-bold text-foreground">{activeTask.name}</h3>
                  <p className="text-xs text-muted-foreground">{activeTask.desc}</p>
                </div>
                <button
                  onClick={() => setSelectedTaskKey(null)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Provider Options List */}
              <div className="space-y-2 pt-2">
                {providerOptions.map((opt) => {
                  const isSelected = configuredProvider === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectProvider(selectedTaskKey, opt.id)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-purple-600/20 border-purple-500/60 shadow-md shadow-purple-600/10"
                          : "bg-background border-border hover:border-accent/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-card border border-border/80 flex items-center justify-center shrink-0 shadow-sm">
                          {getProviderLogo(opt.logoId, 26)}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-xs font-semibold text-foreground block truncate">
                            {opt.name}
                          </span>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {opt.note}
                          </p>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0 text-white">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-border shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
