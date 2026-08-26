import React, { useState } from "react";
import { ArrowLeft, Sparkles, Check, ChevronRight, RotateCcw, X, Info, ShieldCheck } from "lucide-react";
import { ModelRouter } from "../../services/runtime/modelRouter";
import { getModelsForProviderAndCapability, getModelLabel } from "../../services/runtime/modelCatalog";
import type { AIRoutingCategory, AIProviderId } from "../../domain/types";
import { useSpark } from "../../state/SparkContext";
import { getProviderLogo } from "./AIProviderLogos";
import { PROVIDER_VIDEO_CAPABILITIES } from "../../services/runtime/providerCapabilities";

interface AIPreferencesPanelProps {
  onNavigate: (path: string) => void;
}

export interface TaskDefinition {
  key: AIRoutingCategory;
  name: string;
  shortLabel: string;
  category: "Intelligence" | "Creative" | "Operations";
  desc: string;
  allowedProviders: { id: AIProviderId | "auto"; name: string; desc?: string; logoId: string }[];
}

export const AI_PREFERENCES_TASKS: TaskDefinition[] = [
  {
    key: "superSpark",
    name: "Super Spark Chat",
    shortLabel: "Chat & Strategy",
    category: "Intelligence",
    desc: "Primary conversational intelligence, creative strategy & executive decisions",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK dynamically routes to highest-reasoning model", logoId: "auto" },
      { id: "openai", name: "OpenAI", desc: "GPT-5.6 & flagship reasoning models", logoId: "openai" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude Sonnet 5 & Opus 5", logoId: "claude" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash & 2.0 Pro", logoId: "gemini" },
      { id: "grok", name: "xAI Grok", desc: "Grok 4.5 & Grok 3", logoId: "grok" },
    ],
  },
  {
    key: "research",
    name: "Research Department",
    shortLabel: "Research & Radar",
    category: "Intelligence",
    desc: "Breakout trend discovery, pattern recognition, and viral hook scoring",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects optimal web-augmented research engine", logoId: "auto" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash with deep research context", logoId: "gemini" },
      { id: "grok", name: "xAI Grok", desc: "Grok 4.5 realtime cultural radar", logoId: "grok" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude Sonnet 5 trend analysis", logoId: "claude" },
      { id: "openai", name: "OpenAI", desc: "GPT-5.6 Search & pattern matching", logoId: "openai" },
    ],
  },
  {
    key: "videoUnderstanding",
    name: "Video Understanding",
    shortLabel: "Multimodal Vision",
    category: "Intelligence",
    desc: "Visual keyframe analysis, frame extraction, and multimodal transcript parsing",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects optimal multimodal vision engine", logoId: "auto" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 1M-token multimodal vision", logoId: "gemini" },
      { id: "grok", name: "xAI Grok", desc: "Grok 4.5 Vision frame analysis", logoId: "grok" },
      { id: "openai", name: "OpenAI", desc: "GPT-5.6 Multimodal Vision", logoId: "openai" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude Sonnet 5 Multimodal Vision", logoId: "claude" },
    ],
  },
  {
    key: "production",
    name: "Production Compiler",
    shortLabel: "Briefs & Scripts",
    category: "Creative",
    desc: "Production Brief generation, duration-sized beat sheets, and scriptwriting",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best production scripting compiler", logoId: "auto" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude Sonnet 5 high-density scripting", logoId: "claude" },
      { id: "openai", name: "OpenAI", desc: "GPT-5.6 Production Brief writer", logoId: "openai" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash scriptwriter", logoId: "gemini" },
      { id: "grok", name: "xAI Grok", desc: "Grok 4.5 high-velocity script drafting", logoId: "grok" },
    ],
  },
  {
    key: "storyboardImages",
    name: "Storyboard Keyframes",
    shortLabel: "9:16 Keyframe Stills",
    category: "Creative",
    desc: "Renders 9:16 vertical keyframe images with strict character visual lock",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects optimal image generation model", logoId: "auto" },
      { id: "gemini", name: "Google Imagen 3 / Gemini", desc: "Google Imagen 3 UHD keyframes with visual lock", logoId: "gemini" },
      { id: "openai", name: "OpenAI", desc: "GPT-Image-1.5 / DALL-E 3 high-contrast stills", logoId: "openai" },
      { id: "grok", name: "xAI Grok", desc: "Grok Imagine concept rendering", logoId: "grok" },
    ],
  },
  {
    key: "videoGeneration",
    name: "Video Generation",
    shortLabel: "Motion & Clips",
    category: "Creative",
    desc: "Renders 9:16 vertical continuous video clips adhering to official native limits",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects optimal video engine (Google Veo preferred)", logoId: "auto" },
      { id: "gemini", name: PROVIDER_VIDEO_CAPABILITIES.gemini.displayName, desc: "Google Veo (4s, 6s, 8s native clips with synchronized audio)", logoId: "gemini" },
      { id: "grok", name: PROVIDER_VIDEO_CAPABILITIES.grok.displayName, desc: "xAI Grok Imagine Video (1–15s motion preview)", logoId: "grok" },
      { id: "kling", name: PROVIDER_VIDEO_CAPABILITIES.kling.displayName, desc: "Kling 1.5 high-coherence motion (5s or 10s)", logoId: "kling" },
      { id: "runway", name: PROVIDER_VIDEO_CAPABILITIES.runway.displayName, desc: "Runway Gen-3 Alpha cinematic motion (5s or 10s)", logoId: "runway" },
      { id: "luma", name: PROVIDER_VIDEO_CAPABILITIES.luma.displayName, desc: "Luma Ray 2 keyframe motion (5s or 9s)", logoId: "luma" },
      { id: "higgsfield", name: PROVIDER_VIDEO_CAPABILITIES.higgsfield.displayName, desc: "Higgsfield Pop / Cinema vertical motion (4s or 8s)", logoId: "higgsfield" },
    ],
  },
  {
    key: "voice",
    name: "Voiceover Narration",
    shortLabel: "Voice & Speech",
    category: "Creative",
    desc: "Synthesizes studio-grade voiceover narration locked to the brand's identity",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK routes to ElevenLabs for narrator voiceover", logoId: "auto" },
      { id: "elevenlabs", name: "ElevenLabs", desc: "Production Voice Library & Custom Clones", logoId: "elevenlabs" },
      { id: "gemini", name: "Google Gemini TTS", desc: "Natural multi-voice speech synthesis", logoId: "gemini" },
      { id: "openai", name: "OpenAI Voice", desc: "Super Spark conversational speech audio", logoId: "openai" },
      { id: "grok", name: "xAI Grok TTS", desc: "xAI Grok speech synthesis (Eve Voice)", logoId: "grok" },
    ],
  },
  {
    key: "automation",
    name: "Autonomous Engine",
    shortLabel: "Operations & Queue",
    category: "Operations",
    desc: "Background trend monitoring, publishing queue, and autonomous memory formation",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects best background model", logoId: "auto" },
      { id: "openai", name: "OpenAI", desc: "GPT-5.6 Mini efficient background execution", logoId: "openai" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 Flash high-throughput operations", logoId: "gemini" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude Sonnet 5 autonomous execution", logoId: "claude" },
      { id: "grok", name: "xAI Grok", desc: "Grok 4.5 background radar", logoId: "grok" },
    ],
  },
  {
    key: "analytics",
    name: "Analytics & Attribution",
    shortLabel: "Virality & Metrics",
    category: "Operations",
    desc: "Performance attribution, retention decay analysis, and virality diagnostics",
    allowedProviders: [
      { id: "auto", name: "Best Available (Auto)", desc: "SPARK selects optimal analytics intelligence model", logoId: "auto" },
      { id: "gemini", name: "Google Gemini", desc: "Gemini 2.5 deep statistical analysis", logoId: "gemini" },
      { id: "openai", name: "OpenAI", desc: "GPT-5.6 performance intelligence", logoId: "openai" },
      { id: "claude", name: "Anthropic Claude", desc: "Claude Sonnet 5 attribution synthesis", logoId: "claude" },
      { id: "grok", name: "xAI Grok", desc: "Grok 4.5 real-time metrics modeling", logoId: "grok" },
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
    setActiveTaskModal(null);
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
      {/* Ambient background bloom matching SPARK design tokens */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full opacity-[0.12]"
          style={{
            width: 500,
            height: 500,
            background: "radial-gradient(circle, #9333EA 0%, #4F46E5 50%, transparent 75%)",
            top: -120,
            right: -100,
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto w-full px-6 pt-8 space-y-6">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate("/more")}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-white transition-colors py-2 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 backdrop-blur-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to More
          </button>

          {!isAllAuto && (
            <button
              onClick={handleResetAllToAuto}
              className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white font-semibold py-2 px-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 hover:bg-purple-500/20 transition-all cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All to Best Available
            </button>
          )}
        </div>

        {/* Title & Subline */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-purple-400 shrink-0" />
            AI Preferences
          </h1>
          <p className="text-xs text-muted-foreground">
            Best Available lets SPARK choose. Turn off to pin a provider per task.
          </p>
        </div>

        {/* Master Card (Onboard Glass Card) */}
        <div
          onClick={handleResetAllToAuto}
          className={`rounded-2xl border p-5 transition-all cursor-pointer backdrop-blur-md ${
            isAllAuto
              ? "bg-purple-950/25 border-purple-500/40 shadow-xl shadow-purple-950/20"
              : "bg-white/[0.03] border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm font-bold text-white">Best Available (Recommended)</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Automatic Routing
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-10.5">
                SPARK dynamically routes each creative and intelligence task to its quality peak (Google Veo for vertical video, Claude/GPT for reasoning, ElevenLabs for narrator VO).
              </p>
            </div>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                isAllAuto
                  ? "bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30"
                  : "border-white/20 bg-white/5 text-transparent"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">
              {isAllAuto ? "All 9 tasks dynamically optimized" : `${customOverrideCount} task(s) pinned`}
            </span>
            <span className="text-purple-300 font-semibold">
              {isAllAuto ? "Peak Quality & Zero Config" : "Custom Provider Overrides Active"}
            </span>
          </div>
        </div>

        {/* Task List (Generous, Scannable Desktop Rows) */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Tasks & Provider Routing
            </h2>
            <span className="text-[11px] text-muted-foreground">Click any row to change provider</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/5 overflow-hidden backdrop-blur-md shadow-sm">
            {AI_PREFERENCES_TASKS.map((task) => {
              const categoryKey = task.key;
              const configuredProvider = aiRoutingConfig[categoryKey] || "auto";
              const capability = ModelRouter.mapCategoryToCapability(categoryKey);
              const effectiveProvider = ModelRouter.resolveProvider(categoryKey, aiRoutingConfig);
              const effectiveModelId = ModelRouter.resolveModel(categoryKey, effectiveProvider, capability, aiModelSelectionConfig);
              const effectiveLabel = getModelLabel(effectiveProvider, effectiveModelId);

              const isAuto = configuredProvider === "auto";
              const activeProviderId = isAuto ? effectiveProvider : configuredProvider;

              return (
                <div
                  key={task.key}
                  onClick={() => setActiveTaskModal(task)}
                  className={`w-full p-4.5 flex items-center justify-between gap-4 text-left transition-all cursor-pointer group hover:bg-white/[0.04] ${
                    !isAuto ? "bg-purple-950/15" : ""
                  }`}
                >
                  {/* Left: Real Logo + Task Information */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-card border border-white/15 flex items-center justify-center shrink-0 shadow-sm group-hover:border-purple-500/50 transition-colors">
                      {getProviderLogo(activeProviderId, 28)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white group-hover:text-purple-200 transition-colors">
                          {task.name}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.2 rounded-md">
                          {task.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.desc}
                      </p>
                    </div>
                  </div>

                  {/* Right: Selected Provider Pill & Change Button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                        isAuto
                          ? "bg-purple-500/10 text-purple-300 border-purple-500/25"
                          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-semibold"
                      }`}
                    >
                      <span>
                        {isAuto ? (
                          <>
                            <span className="text-muted-foreground mr-1 font-mono">Auto:</span>
                            {effectiveProvider.toUpperCase()}
                          </>
                        ) : (
                          configuredProvider.toUpperCase()
                        )}
                      </span>
                    </div>

                    <button className="px-3 py-1.5 rounded-xl bg-white/5 group-hover:bg-purple-600 group-hover:text-white border border-white/10 group-hover:border-purple-500 text-xs font-semibold text-muted-foreground transition-all flex items-center gap-1">
                      <span>Change</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Failover & Reliability Note */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3 text-xs text-muted-foreground backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-foreground">Zero-Disruption Architecture:</strong> If a chosen provider experiences an upstream rate-limit or API key absence, SPARK smoothly falls back to Best Available to guarantee uninterrupted pipeline execution.
          </p>
        </div>
      </div>

      {/* Task Customization Modal (Desktop Popover Dialog) */}
      {activeTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setActiveTaskModal(null)}
        >
          <div
            className="w-full max-w-lg bg-[#0E131F] border border-white/15 rounded-2xl shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {activeTaskModal.category}
                </span>
                <h3 className="text-lg font-bold text-white mt-1.5">{activeTaskModal.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{activeTaskModal.desc}</p>
              </div>
              <button
                onClick={() => setActiveTaskModal(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Provider Options List with Real Logos */}
            <div className="space-y-2.5">
              <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Select Provider
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
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-950/20"
                          : "bg-white/[0.03] border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2">
                        <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 shadow-sm">
                          {getProviderLogo(prov.logoId, 26)}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{prov.name}</div>
                          {prov.desc && <div className="text-xs text-muted-foreground truncate">{prov.desc}</div>}
                        </div>
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

            {/* Modal Actions */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTaskModal(null)}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-purple-600/25"
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
