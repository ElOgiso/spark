import React, { useState } from "react";
import { ArrowLeft, Sparkles, Check, ChevronRight, Sliders, RotateCcw, X, Info } from "lucide-react";
import { ModelRouter } from "../../services/runtime/modelRouter";
import { getModelsForProviderAndCapability, getModelLabel } from "../../services/runtime/modelCatalog";
import type { AIRoutingCategory, AIProviderId } from "../../domain/types";
import { useSpark } from "../../state/SparkContext";

interface AIPreferencesPanelProps {
  onNavigate: (path: string) => void;
}

export interface TaskDefinition {
  key: AIRoutingCategory;
  name: string;
  shortLabel: string;
  category: "Chat" | "Research" | "Vision" | "Production" | "Media" | "Engine";
  desc: string;
  allowedProviders: { id: AIProviderId | "auto"; name: string; desc?: string }[];
}

export const AI_PREFERENCES_TASKS: TaskDefinition[] = [
  {
    key: "superSpark",
    name: "Super Spark Chat",
    shortLabel: "Executive Assistant",
    category: "Chat",
    desc: "Primary conversational intelligence, creative strategy & brand guidance",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK chooses optimal reasoning engine" },
      { id: "openai", name: "OpenAI", desc: "GPT-4o & o3-mini models" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude 3.5 Sonnet & 3.7 Sonnet" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash & 2.0 Pro" },
      { id: "grok", name: "xAI Grok", desc: "Grok 3 & Grok 2" },
    ],
  },
  {
    key: "research",
    name: "Research & Trend Discovery",
    shortLabel: "Radar & Hooks",
    category: "Research",
    desc: "Breakout trend discovery, pattern recognition, and viral hook scoring",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best research model" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude 3.5 Sonnet" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash & Deep Research" },
      { id: "grok", name: "xAI Grok", desc: "Grok 3 Realtime Web" },
      { id: "openai", name: "OpenAI", desc: "GPT-4o Search" },
    ],
  },
  {
    key: "videoUnderstanding",
    name: "Multimodal Video & Visual Analysis",
    shortLabel: "Video Vision",
    category: "Vision",
    desc: "Visual keyframe analysis, frame extraction, and transcript parsing",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best vision model" },
      { id: "grok", name: "xAI Grok", desc: "Grok 2 Vision" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash Vision" },
      { id: "openai", name: "OpenAI", desc: "GPT-4o Vision" },
    ],
  },
  {
    key: "production",
    name: "Production & Scripting Engine",
    shortLabel: "Briefs & Storyboards",
    category: "Production",
    desc: "Production Brief generation, 3-scene storyboarding, and caption formatting",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best scriptwriting engine" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude 3.5 Sonnet" },
      { id: "openai", name: "OpenAI", desc: "GPT-4o Scriptwriter" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash" },
    ],
  },
  {
    key: "storyboardImages",
    name: "Keyframe Image Generation",
    shortLabel: "Scene Stills",
    category: "Media",
    desc: "Generates high-contrast vertical 9:16 keyframe images per scene",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best image generator" },
      { id: "openai", name: "OpenAI", desc: "GPT-Image-1.5 / DALL-E 3" },
      { id: "gemini", name: "Google Gemini", desc: "Imagen 4.0 Studio" },
      { id: "grok", name: "xAI Grok", desc: "Grok Image Generator" },
    ],
  },
  {
    key: "videoGeneration",
    name: "Video Generation & Motion Clips",
    shortLabel: "Motion Clips",
    category: "Media",
    desc: "Renders 9:16 vertical MP4 video preview clips per scene",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best video engine" },
      { id: "gemini", name: "Google Gemini", desc: "Google Veo 3.1 Predict" },
      { id: "grok", name: "xAI Grok", desc: "Grok Video Generator" },
    ],
  },
  {
    key: "voice",
    name: "Voiceover Narration (TTS)",
    shortLabel: "Brand Voice",
    category: "Media",
    desc: "Synthesizes executive audio voiceover narration",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best voice engine" },
      { id: "elevenlabs", name: "ElevenLabs", desc: "Executive Voice Library & Custom Voices" },
      { id: "openai", name: "OpenAI", desc: "OpenAI TTS HD" },
      { id: "grok", name: "xAI Grok", desc: "Grok Audio Speech" },
    ],
  },
  {
    key: "automation",
    name: "Autonomous Engine & Memory",
    shortLabel: "Background OS",
    category: "Engine",
    desc: "Background trend monitoring, publishing queue, and memory formation",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best background model" },
      { id: "openai", name: "OpenAI", desc: "GPT-4o Mini" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash" },
    ],
  },
  {
    key: "executive",
    name: "Executive Briefings & Summaries",
    shortLabel: "Briefings",
    category: "Engine",
    desc: "Offline summaries, return briefings, and strategic directives",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best briefing model" },
      { id: "openai", name: "OpenAI", desc: "GPT-4o" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.0 Pro" },
    ],
  },
  {
    key: "analytics",
    name: "Analytics & Virality Predictor",
    shortLabel: "Attribution",
    category: "Engine",
    desc: "Audience reach estimation, engagement scoring, and performance attribution",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best analytics model" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash" },
      { id: "openai", name: "OpenAI", desc: "GPT-4o" },
    ],
  },
];

export function AIPreferencesPanel({ onNavigate }: AIPreferencesPanelProps) {
  const spark = useSpark() as any;
  const { aiSettings, updateAISettings } = spark || {};

  const [aiRoutingConfig, setAiRoutingConfig] = useState<Record<AIRoutingCategory, AIProviderId | "auto">>(() => {
    return aiSettings?.routing || ModelRouter.getUserRoutingConfig();
  });

  const [aiModelSelectionConfig, setAiModelSelectionConfig] = useState<Record<AIRoutingCategory, string>>(() => {
    return aiSettings?.modelSelection || ModelRouter.getUserModelSelectionConfig();
  });

  // Modal / Sheet for selecting Provider & Model for a specific task
  const [activeTaskModal, setActiveTaskModal] = useState<TaskDefinition | null>(null);

  const handleUpdateProvider = (categoryKey: AIRoutingCategory, providerId: AIProviderId | "auto") => {
    const updatedRouting = ModelRouter.setUserRoutingConfig({ [categoryKey]: providerId });
    setAiRoutingConfig(updatedRouting);

    // If changing to auto, clear custom model selection for this task
    if (providerId === "auto") {
      const updatedModels = ModelRouter.setUserModelSelectionConfig({ [categoryKey]: "" });
      setAiModelSelectionConfig(updatedModels);
    } else {
      // Pick first recommended model for chosen provider
      const capability = ModelRouter.mapCategoryToCapability(categoryKey);
      const available = getModelsForProviderAndCapability(providerId, capability);
      const recommended = available.find((m) => m.recommended) || available[0];
      if (recommended) {
        const updatedModels = ModelRouter.setUserModelSelectionConfig({ [categoryKey]: recommended.id });
        setAiModelSelectionConfig(updatedModels);
      }
    }

    if (typeof updateAISettings === "function") {
      updateAISettings({
        routing: ModelRouter.getUserRoutingConfig(),
        modelSelection: ModelRouter.getUserModelSelectionConfig(),
      });
    }
  };

  const handleUpdateModel = (categoryKey: AIRoutingCategory, modelId: string) => {
    const updatedModels = ModelRouter.setUserModelSelectionConfig({ [categoryKey]: modelId });
    setAiModelSelectionConfig(updatedModels);

    if (typeof updateAISettings === "function") {
      updateAISettings({
        routing: ModelRouter.getUserRoutingConfig(),
        modelSelection: ModelRouter.getUserModelSelectionConfig(),
      });
    }
  };

  const handleResetAllToAuto = () => {
    const defaultRouting: Record<string, any> = {};
    const defaultModels: Record<string, any> = {};
    AI_PREFERENCES_TASKS.forEach((t) => {
      defaultRouting[t.key] = "auto";
      defaultModels[t.key] = "";
    });

    const updatedRouting = ModelRouter.setUserRoutingConfig(defaultRouting as any);
    const updatedModels = ModelRouter.setUserModelSelectionConfig(defaultModels as any);

    setAiRoutingConfig(updatedRouting);
    setAiModelSelectionConfig(updatedModels);

    if (typeof updateAISettings === "function") {
      updateAISettings({ routing: updatedRouting, modelSelection: updatedModels });
    }
  };

  // Calculate how many custom overrides exist
  const customOverrideCount = Object.values(aiRoutingConfig).filter((v) => v && v !== "auto").length;
  const isAllAuto = customOverrideCount === 0;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-foreground flex flex-col font-sans select-none relative pb-28">
      {/* Ambient background bloom matching AuthPanel */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <div
          className="absolute rounded-full opacity-[0.15]"
          style={{
            width: 420,
            height: 420,
            background: "radial-gradient(circle, #F018FF 0%, #a855f7 40%, transparent 70%)",
            top: -100,
            right: -100,
          }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto w-full px-4 pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate("/more")}
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg bg-card/60 border border-border/60 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to More
          </button>

          {!isAllAuto && (
            <button
              onClick={handleResetAllToAuto}
              className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium py-2 px-3 rounded-lg bg-purple-500/10 border border-purple-500/20 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Best Available
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">AI Preferences</h1>
          </div>
          <p className="text-sm text-purple-200/80 leading-relaxed">
            Leave on Best Available unless you want specific model control per job.
          </p>
        </div>

        {/* Master Card: Best Available (Recommended) */}
        <div
          className={`rounded-2xl border p-5 transition-all backdrop-blur-md ${
            isAllAuto
              ? "bg-purple-950/30 border-purple-500/40 shadow-lg shadow-purple-950/20"
              : "bg-card/70 border-border/70"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-white">Best Available Mode</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                SPARK automatically selects optimal models for every job (OpenAI, Claude, Gemini, Grok, ElevenLabs). Most creators never need to change this.
              </p>
            </div>
            <button
              onClick={handleResetAllToAuto}
              className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                isAllAuto
                  ? "bg-purple-600 border-purple-400 text-white"
                  : "border-border/80 bg-background/50 text-transparent"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 pt-3.5 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {isAllAuto ? "All 10 jobs managed automatically" : `${customOverrideCount} job(s) customized`}
            </span>
            <span className="text-purple-300 font-mono font-medium">
              {isAllAuto ? "Optimal Quality & Speed" : "Custom Model Configuration"}
            </span>
          </div>
        </div>

        {/* Per-Job List Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Configuration ({AI_PREFERENCES_TASKS.length} Jobs)
            </h2>
            <span className="text-[11px] text-muted-foreground">Tap any job to customize</span>
          </div>

          <div className="space-y-3">
            {AI_PREFERENCES_TASKS.map((task) => {
              const categoryKey = task.key;
              const configuredProvider = aiRoutingConfig[categoryKey] || "auto";
              const configuredModelId = aiModelSelectionConfig[categoryKey] || "";
              const capability = ModelRouter.mapCategoryToCapability(categoryKey);
              const effectiveProvider = ModelRouter.resolveProvider(categoryKey, aiRoutingConfig);
              const effectiveModelId = ModelRouter.resolveModel(categoryKey, effectiveProvider, capability, aiModelSelectionConfig);
              const effectiveLabel = getModelLabel(effectiveProvider, effectiveModelId);

              const isAuto = configuredProvider === "auto";

              return (
                <div
                  key={task.key}
                  onClick={() => setActiveTaskModal(task)}
                  className={`group rounded-xl border p-4 transition-all cursor-pointer backdrop-blur-md flex flex-col gap-3 active:scale-[0.99] ${
                    !isAuto
                      ? "bg-purple-950/20 border-purple-500/40 shadow-sm"
                      : "bg-card/70 border-border/70 hover:border-purple-500/30 hover:bg-card/90"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white tracking-tight">{task.name}</span>
                        <span className="text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-md">
                          {task.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{task.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                  </div>

                  {/* Provider & Model Display (No cut-off / no truncated text) */}
                  <div className="rounded-lg bg-background/60 border border-border/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                      <span className="text-muted-foreground font-medium">Provider:</span>
                      <span className="font-semibold text-white">
                        {isAuto ? (
                          <span className="text-emerald-400">Best Available (Auto: {effectiveProvider.toUpperCase()})</span>
                        ) : (
                          <span className="text-purple-300">
                            {task.allowedProviders.find((p) => p.id === configuredProvider)?.name || configuredProvider.toUpperCase()}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-start justify-between text-xs gap-2 pt-1 border-t border-border/30">
                      <span className="text-muted-foreground font-medium shrink-0">Model:</span>
                      <span className="font-mono text-purple-200 text-right text-[11px] break-words max-w-[75%] leading-relaxed">
                        {isAuto ? `Auto (${effectiveLabel})` : effectiveLabel || "Recommended Default"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Customization Modal / Sheet */}
      {activeTaskModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-[#0E131F] border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/50 pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                    {activeTaskModal.category}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">{activeTaskModal.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{activeTaskModal.desc}</p>
              </div>
              <button
                onClick={() => setActiveTaskModal(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-muted/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Provider Selection */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 1: Select AI Provider
              </label>

              <div className="space-y-2">
                {activeTaskModal.allowedProviders.map((prov) => {
                  const categoryKey = activeTaskModal.key;
                  const currentProvider = aiRoutingConfig[categoryKey] || "auto";
                  const isSelected = currentProvider === prov.id;

                  return (
                    <button
                      key={prov.id}
                      onClick={() => handleUpdateProvider(categoryKey, prov.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all min-h-[48px] ${
                        isSelected
                          ? "bg-purple-950/40 border-purple-500 text-white shadow-sm"
                          : "bg-card/60 border-border/60 text-muted-foreground hover:text-foreground hover:bg-card"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-white">{prov.name}</div>
                        {prov.desc && <div className="text-xs text-muted-foreground">{prov.desc}</div>}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-purple-600 border-purple-400 text-white" : "border-border/80 bg-background/40"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Model Selection (Only if provider is NOT auto) */}
            {aiRoutingConfig[activeTaskModal.key] && aiRoutingConfig[activeTaskModal.key] !== "auto" && (
              <div className="space-y-2.5 pt-2 border-t border-border/50">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 2: Select Specific Model
                </label>

                {(() => {
                  const categoryKey = activeTaskModal.key;
                  const selectedProvider = aiRoutingConfig[categoryKey] as AIProviderId;
                  const capability = ModelRouter.mapCategoryToCapability(categoryKey);
                  const availableModels = getModelsForProviderAndCapability(selectedProvider, capability);
                  const currentModelId = aiModelSelectionConfig[categoryKey] || "";

                  return (
                    <div className="space-y-2">
                      {availableModels.map((m) => {
                        const isSelected = currentModelId === m.id || (!currentModelId && m.recommended);

                        return (
                          <button
                            key={m.id}
                            onClick={() => handleUpdateModel(categoryKey, m.id)}
                            className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all min-h-[48px] ${
                              isSelected
                                ? "bg-purple-950/40 border-purple-500 text-white shadow-sm"
                                : "bg-card/60 border-border/60 text-muted-foreground hover:text-foreground hover:bg-card"
                            }`}
                          >
                            <div className="space-y-0.5 pr-2">
                              <div className="text-sm font-medium text-white flex items-center gap-1.5 flex-wrap">
                                <span>{m.label}</span>
                                {m.recommended && (
                                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                    Recommended ★
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground">{m.id}</div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? "bg-purple-600 border-purple-400 text-white" : "border-border/80 bg-background/40"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Done button */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTaskModal(null)}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
