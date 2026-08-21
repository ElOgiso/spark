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
    shortLabel: "Chat",
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
    name: "Research & Signal Discovery",
    shortLabel: "Research",
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
    key: "storyboardImages",
    name: "Keyframe Image Generation",
    shortLabel: "Images",
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
    shortLabel: "Video",
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
    shortLabel: "Voice",
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
    key: "videoUnderstanding",
    name: "Multimodal Video & Visual Analysis",
    shortLabel: "Vision",
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
    shortLabel: "Scripting",
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
    shortLabel: "Executive",
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
    shortLabel: "Analytics",
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

  const [activeTaskModal, setActiveTaskModal] = useState<TaskDefinition | null>(null);

  const handleUpdateProvider = (categoryKey: AIRoutingCategory, providerId: AIProviderId | "auto") => {
    const updatedRouting = ModelRouter.setUserRoutingConfig({ [categoryKey]: providerId });
    setAiRoutingConfig(updatedRouting as any);

    if (providerId === "auto") {
      const updatedModels = ModelRouter.setUserModelSelectionConfig({ [categoryKey]: "" });
      setAiModelSelectionConfig(updatedModels as any);
    } else {
      const capability = ModelRouter.mapCategoryToCapability(categoryKey);
      const available = getModelsForProviderAndCapability(providerId, capability);
      const recommended = available.find((m) => m.recommended) || available[0];
      if (recommended) {
        const updatedModels = ModelRouter.setUserModelSelectionConfig({ [categoryKey]: recommended.id });
        setAiModelSelectionConfig(updatedModels as any);
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
    setAiModelSelectionConfig(updatedModels as any);

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

    setAiRoutingConfig(updatedRouting as any);
    setAiModelSelectionConfig(updatedModels as any);

    if (typeof updateAISettings === "function") {
      updateAISettings({ routing: updatedRouting, modelSelection: updatedModels });
    }
  };

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

      <div className="relative z-10 max-w-2xl mx-auto w-full px-4 pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate("/more")}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-white transition-colors py-2 px-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to More
          </button>

          {!isAllAuto && (
            <button
              onClick={handleResetAllToAuto}
              className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white font-semibold py-2 px-3 rounded-xl bg-purple-500/10 border border-purple-500/20 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Best Available
            </button>
          )}
        </div>

        {/* Title & One-line helper */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
            AI Preferences
          </h1>
          <p className="text-xs text-muted-foreground">
            Leave on Best Available unless you want control.
          </p>
        </div>

        {/* Master Card: Best Available (Recommended) */}
        <div
          onClick={handleResetAllToAuto}
          className={`rounded-2xl border p-4.5 transition-all cursor-pointer backdrop-blur-md ${
            isAllAuto
              ? "bg-purple-950/30 border-purple-500/40 shadow-lg shadow-purple-950/20"
              : "bg-white/[0.03] border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">Best Available</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                SPARK automatically selects optimal models for speed and quality (OpenAI, Claude, Gemini, Grok, ElevenLabs).
              </p>
            </div>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                isAllAuto
                  ? "bg-purple-600 border-purple-400 text-white"
                  : "border-white/20 bg-white/5 text-transparent"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">
              {isAllAuto ? "All jobs auto-managed" : `${customOverrideCount} job(s) customized`}
            </span>
            <span className="text-purple-300 font-semibold">
              {isAllAuto ? "Optimal Speed & Quality" : "Custom Model Overrides"}
            </span>
          </div>
        </div>

        {/* Customize per-job Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Customize Per Job
            </h2>
            <span className="text-[11px] text-muted-foreground">Tap any card to change model</span>
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
                  className={`rounded-2xl border p-4 transition-all cursor-pointer backdrop-blur-md space-y-3 active:scale-[0.99] ${
                    !isAuto
                      ? "bg-purple-950/20 border-purple-500/40 shadow-sm"
                      : "bg-white/[0.03] border-white/10 hover:border-purple-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{task.shortLabel}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        {task.category}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>

                  {/* Provider & Model Display (Full names, wrapping allowed, no text cut-off) */}
                  <div className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-muted-foreground font-mono">Provider:</span>
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

                    <div className="flex items-start justify-between gap-2 pt-2 border-t border-white/10">
                      <span className="text-muted-foreground font-mono shrink-0">Model:</span>
                      <span className="font-mono text-purple-200 text-right text-xs break-words max-w-[75%] font-medium leading-relaxed">
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-[#0B0F17] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {activeTaskModal.category}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{activeTaskModal.shortLabel}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{activeTaskModal.desc}</p>
              </div>
              <button
                onClick={() => setActiveTaskModal(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Provider Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                1. Select Provider
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
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all min-h-[48px] cursor-pointer ${
                        isSelected
                          ? "bg-purple-950/40 border-purple-500 text-white shadow-sm"
                          : "bg-white/[0.03] border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-white">{prov.name}</div>
                        {prov.desc && <div className="text-xs text-muted-foreground">{prov.desc}</div>}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-purple-600 border-purple-400 text-white" : "border-white/20 bg-white/5"
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
              <div className="space-y-3 pt-3 border-t border-white/10">
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  2. Select Specific Model
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
                            className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all min-h-[48px] cursor-pointer ${
                              isSelected
                                ? "bg-purple-950/40 border-purple-500 text-white shadow-sm"
                                : "bg-white/[0.03] border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                            }`}
                          >
                            <div className="space-y-0.5 pr-2">
                              <div className="text-sm font-semibold text-white flex items-center gap-1.5 flex-wrap">
                                <span>{m.label}</span>
                                {m.recommended && (
                                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                                    Recommended ★
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground">{m.id}</div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? "bg-purple-600 border-purple-400 text-white" : "border-white/20 bg-white/5"
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

            {/* Done Button */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTaskModal(null)}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.3)]"
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

