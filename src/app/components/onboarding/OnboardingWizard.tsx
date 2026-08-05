import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  ArrowRight,
  User,
  Send,
  Loader2,
  CheckCircle2,
  Upload,
  Play,
  Square,
  Volume2,
  Youtube,
  Tv,
  Check,
  Shield,
  Layers,
  Image as ImageIcon,
  Radio,
  ExternalLink
} from "lucide-react";
import { Button, GlassCard } from "../ds";
import { SparkLogo } from "../SparkLogo";
import { generateSuperSparkResponse } from "../../services/geminiService";
import { socialConnectorFramework, getStoredAccountTokens, getOAuthAuthorizationUrl } from "../../services/socialIntegrationService";

export interface VoiceProfile {
  id: string;
  name: string;
  accent: string;
  language: string;
  duration: string;
  sampleText: string;
}

export interface BrandGenesisData {
  brandName: string;
  creatorName: string;
  niche: string;
  audience: string;
  goal: string;
  platforms: string[];
  tone: string;
  vision: string;
  visualStyle: "Realistic / Live-Action" | "Cinematic 3D" | "Anime / Stylized Studio";
  automationMode: "manual" | "balanced" | "autonomous";
  reviewRequired: boolean;
  characterSheetUrl?: string;
  voiceProfile?: VoiceProfile;
  connectedAccounts?: Record<string, { handle: string; connected: boolean }>;
  chatHistory?: { id: string; sender: "user" | "spark"; text: string; timestamp: Date }[];
}

interface OnboardingWizardProps {
  onComplete: (data: BrandGenesisData) => void;
}

interface ChatTurn {
  id: string;
  sender: "spark" | "user";
  text: string;
  stepIdx?: number;
  timestamp?: Date;
}

const PRESET_CHARACTER_SHEETS = [
  {
    id: "cs-executive",
    label: "Executive Founder",
    desc: "4K Live-Action Studio Lighting",
    previewUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "cs-cinematic",
    label: "Cinematic 3D Avatar",
    desc: "Unreal Engine 5 Render Bible",
    previewUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "cs-stylized",
    label: "Anime Studio Host",
    desc: "Hand-Drawn Vector Style Sheet",
    previewUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  },
];

const PRESET_VOICES: VoiceProfile[] = [
  {
    id: "v-executive-male",
    name: "Spark Executive Male",
    accent: "Global Executive",
    language: "English (US)",
    duration: "0:15",
    sampleText: "Welcome to Executive OS. I am ready to scale your media empire.",
  },
  {
    id: "v-african-storyteller",
    name: "Spark African Storyteller",
    accent: "West African English",
    language: "English (NG)",
    duration: "0:18",
    sampleText: "Here is how we turn local market insights into global viral stories.",
  },
  {
    id: "v-energetic-female",
    name: "Spark Energetic Female",
    accent: "Dynamic Creator",
    language: "English (UK)",
    duration: "0:12",
    sampleText: "Stop creating videos manually. Let's automate your viral strategy.",
  },
  {
    id: "v-cinematic-bold",
    name: "Spark Cinematic Voice",
    accent: "Deep Cinematic",
    language: "English (Global)",
    duration: "0:20",
    sampleText: "In a world of noise, authority is the only metric that matters.",
  },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<BrandGenesisData>({
    brandName: "",
    creatorName: "",
    niche: "AI & Technology",
    audience: "Tech Enthusiasts & Founders",
    goal: "Viral Reach & Growth",
    platforms: ["YouTube Shorts", "TikTok"],
    tone: "Energetic & Relatable",
    vision: "To build a leading media brand in our category.",
    visualStyle: "Realistic / Live-Action",
    automationMode: "balanced",
    reviewRequired: true,
    characterSheetUrl: PRESET_CHARACTER_SHEETS[0].previewUrl,
    voiceProfile: PRESET_VOICES[0],
    connectedAccounts: {},
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const [assemblyProgress, setAssemblyProgress] = useState(0);
  const [assemblyPhase, setAssemblyPhase] = useState("Assigning 6 Specialized AI Executive Directors...");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: "genesis-init",
      sender: "spark",
      text: "### Welcome to Brand Genesis!\n\nI am **Super Spark**, your Executive Creative Director. Let's construct your media brand workspace.\n\nFirst, what is your name and the official name of your brand?",
      stepIdx: 1,
      timestamp: new Date(),
    }
  ]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isThinking, currentStep]);

  // Restore state if we are coming back from an OAuth flow
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const savedStateStr = localStorage.getItem("spark_onboarding_resume_state");
      const savedStepStr = localStorage.getItem("spark_onboarding_step");
      
      if (savedStateStr && savedStepStr) {
        try {
          const savedState = JSON.parse(savedStateStr);
          const savedStep = parseInt(savedStepStr, 10);
          
          const tokens = getStoredAccountTokens();
          const connectedAccounts: Record<string, { handle: string; connected: boolean }> = {};
          
          Object.keys(tokens).forEach((plat) => {
            connectedAccounts[plat] = { handle: tokens[plat].handle, connected: true };
          });

          setFormData({
            ...savedState,
            connectedAccounts: {
              ...savedState.connectedAccounts,
              ...connectedAccounts
            }
          });
          setCurrentStep(savedStep);
          
          // Clean up resume trigger state
          localStorage.removeItem("spark_onboarding_resume_state");
          localStorage.removeItem("spark_onboarding_step");
          localStorage.removeItem("spark_oauth_trigger_source");
        } catch (err) {
          console.error("Failed to restore onboarding state:", err);
        }
      } else {
        const tokens = getStoredAccountTokens();
        const connectedAccounts: Record<string, { handle: string; connected: boolean }> = {};
        Object.keys(tokens).forEach((plat) => {
          connectedAccounts[plat] = { handle: tokens[plat].handle, connected: true };
        });
        setFormData((prev) => ({
          ...prev,
          connectedAccounts: {
            ...prev.connectedAccounts,
            ...connectedAccounts
          }
        }));
      }
    }
  }, []);

  // Audio Voice Preview using SpeechSynthesis
  const playVoicePreview = (voice: VoiceProfile) => {
    if (playingVoiceId === voice.id) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setPlayingVoiceId(null);
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voice.sampleText);
      utterance.rate = 1.0;
      utterance.pitch = voice.id.includes("female") ? 1.2 : voice.id.includes("bold") ? 0.8 : 1.0;
      utterance.onend = () => setPlayingVoiceId(null);
      utterance.onerror = () => setPlayingVoiceId(null);
      setPlayingVoiceId(voice.id);
      window.speechSynthesis.speak(utterance);
    } else {
      setPlayingVoiceId(voice.id);
      setTimeout(() => setPlayingVoiceId(null), 2500);
    }
  };

  // Handle Character Sheet Image Upload
  const handleCharacterSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData((prev) => ({
            ...prev,
            characterSheetUrl: event.target?.result as string,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Connect Real Platform OAuth Flow
  const handleConnectPlatform = (platform: string) => {
    setConnectingPlatform(platform);
    const platformName = platform === "YouTube Shorts" || platform === "YouTube" ? "YouTube Shorts" : platform === "Twitter/X" || platform === "X" ? "Twitter/X" : platform;
    
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("spark_onboarding_resume_state", JSON.stringify(formData));
      localStorage.setItem("spark_onboarding_step", String(currentStep));
      localStorage.setItem("spark_oauth_trigger_source", "onboarding");
    }

    socialConnectorFramework.loadClientConfig().then(() => {
      const url = getOAuthAuthorizationUrl(platformName);
      if (url && url !== "#") {
        window.location.href = url;
      } else {
        alert(`Failed to connect ${platform}: Client credentials not configured on Vercel environment.`);
        setConnectingPlatform(null);
      }
    }).catch((err) => {
      console.error("Failed to connect platform:", err);
      setConnectingPlatform(null);
    });
  };

  // Step 5 Assembly Animation
  useEffect(() => {
    if (currentStep === 5) {
      const phases = [
        { pct: 20, text: "Structuring Brand Schema & Host Character Bible..." },
        { pct: 50, text: "Hydrating Executive Intelligence & Working Memory..." },
        { pct: 80, text: "Populating Initial Viral Sparks & Storyboard Drafts..." },
        { pct: 100, text: "Workspace Assembly Complete. Launching Executive OS..." },
      ];

      let idx = 0;
      const interval = setInterval(() => {
        if (idx < phases.length) {
          setAssemblyProgress(phases[idx].pct);
          setAssemblyPhase(phases[idx].text);
          idx++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            onComplete({
              ...formData,
              chatHistory: messages.map((m) => ({
                id: m.id,
                sender: m.sender,
                text: m.text,
                timestamp: m.timestamp || new Date(),
              })),
            });
          }, 800);
        }
      }, 700);

      return () => clearInterval(interval);
    }
  }, [currentStep, formData, messages, onComplete]);

  const advanceToStep = (nextStep: number, updatedData: BrandGenesisData, userText: string) => {
    const userMsg: ChatTurn = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date(),
    };

    let sparkReplyText = "";
    if (nextStep === 2) {
      sparkReplyText = `### Target Audience & Core Metric\n\nUnderstood! Brand **"${updatedData.brandName}"** hosted by **${updatedData.creatorName}**.\n\nNext, who is your primary target audience, and what is our primary growth objective?`;
    } else if (nextStep === 3) {
      sparkReplyText = `### Host Character Bible & Voice Profile\n\nTargeting **${updatedData.audience}** to optimize for **${updatedData.goal}**.\n\nNow, select or upload your host character sheet and choose your executive voice profile.`;
    } else if (nextStep === 4) {
      sparkReplyText = `### Channels & Executive Governance\n\nCharacter Bible & Voice Profile saved for **${updatedData.creatorName}**.\n\nFinally, select your primary distribution channels, connect your social accounts, and choose how much publishing autonomy I receive.`;
    } else if (nextStep === 5) {
      sparkReplyText = `### Genesis Complete! Assembling Workspace...\n\nAll parameters captured. I am now creating your brand schema, hydrating executive memory, and generating your first viral draft.`;
    }

    const sparkMsg: ChatTurn = {
      id: `spk-${Date.now()}`,
      sender: "spark",
      text: sparkReplyText,
      stepIdx: nextStep,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, sparkMsg]);
    setFormData(updatedData);
    setCurrentStep(nextStep);
  };

  const handleTextSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isThinking) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    const lower = userText.toLowerCase();
    const isQuestion =
      lower.includes("what") ||
      lower.includes("explain") ||
      lower.includes("how") ||
      lower.includes("why") ||
      lower.includes("can i") ||
      lower.includes("which") ||
      userText.endsWith("?");

    if (isQuestion) {
      const userMsg: ChatTurn = { id: `usr-${Date.now()}`, sender: "user", text: userText, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      const history = messages.map((m) => ({ sender: m.sender, text: m.text }));
      let answer = await generateSuperSparkResponse(userText, history);

      if (!answer) {
        if (lower.includes("governance")) {
          answer = "Executive Governance Mode controls how much publishing authority you grant me. In **Manual** mode, every asset requires your sign-off. In **Balanced** mode, I prepare drafts and queue schedules, but wait for your click. In **Autonomous** mode, I auto-publish approved cuts.";
        } else if (lower.includes("visual style")) {
          answer = "Visual Style determines the visual rendering pipeline for your video assets — from **Realistic / Live-Action** avatars to **Cinematic 3D** or **Anime Studio** animations.";
        } else {
          answer = "I've logged your question. You can adjust all brand settings at any time inside **My Spark > Brand & Memory** after we open your workspace!";
        }
      }

      answer += `\n\nShall we continue with **Step ${currentStep}**?`;

      const sparkMsg: ChatTurn = { id: `spk-${Date.now()}`, sender: "spark", text: answer, stepIdx: currentStep, timestamp: new Date() };
      setIsThinking(false);
      setMessages((prev) => [...prev, sparkMsg]);
      return;
    }

    if (currentStep === 1) {
      const brandName = formData.brandName || userText;
      const creatorName = formData.creatorName || "Creator";
      const updated = { ...formData, brandName, creatorName };
      advanceToStep(2, updated, `Brand: **${brandName}** (Host: **${creatorName}**)`);
    } else if (currentStep === 2) {
      const updated = { ...formData, audience: userText };
      advanceToStep(3, updated, `Audience & Goal: **${userText}**`);
    } else if (currentStep === 3) {
      const updated = { ...formData, tone: userText };
      advanceToStep(4, updated, `Voice & Tone: **${userText}**`);
    } else if (currentStep === 4) {
      advanceToStep(5, formData, `Channels & Governance confirmed`);
    }
  };

  const togglePlatform = (p: string) => {
    setFormData((prev) => {
      const exists = prev.platforms.includes(p);
      const updatedPlatforms = exists
        ? prev.platforms.filter((item) => item !== p)
        : [...prev.platforms, p];
      return {
        ...prev,
        platforms: updatedPlatforms,
      };
    });
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#0B0F17] flex flex-col justify-between overflow-x-hidden sm:relative sm:min-h-screen sm:p-6 sm:items-center sm:justify-center select-none">
      {/* Background ambient light */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[300px] bg-purple-600/15 rounded-full blur-[140px]" />
        <div className="w-[350px] h-[200px] bg-cyan-500/10 rounded-full blur-[120px] -translate-y-12" />
      </div>

      {/* Header Container */}
      <div className="w-full max-w-2xl px-4 pt-4 sm:pt-0 sm:px-0 mb-2 sm:mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
            <SparkLogo className="w-5 h-5" variant="superspark" />
          </div>
          <div>
            <span className="font-bold text-xs sm:text-sm tracking-wide text-foreground uppercase block">Spark Brand Genesis</span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-mono">Executive OS Initialization</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === currentStep
                  ? "w-6 sm:w-8 bg-purple-500"
                  : s < currentStep
                  ? "w-2.5 sm:w-3 bg-purple-400/50"
                  : "w-2.5 sm:w-3 bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Conversation Glass Card */}
      <div className="w-full max-w-2xl flex-1 sm:h-[620px] sm:flex-none flex flex-col bg-white/5 border-t sm:border border-purple-500/30 sm:rounded-2xl overflow-hidden relative shadow-2xl">
        {/* Messages Stream */}
        <div ref={chatContainerRef} className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 overflow-x-hidden">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 sm:gap-3 ${m.sender === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Super Spark Branding Avatar */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  m.sender === "spark"
                    ? "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40"
                    : "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                }`}
              >
                {m.sender === "spark" ? <SparkLogo className="w-4 h-4" variant="superspark" /> : <User className="w-4 h-4 text-cyan-300" />}
              </div>

              <div
                className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed break-words ${
                  m.sender === "spark"
                    ? "bg-white/5 border border-white/10 text-foreground"
                    : "bg-purple-600/20 border border-purple-500/30 text-purple-100"
                }`}
              >
                {m.text.split("\n").map((line, idx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <div key={idx} className="h-1" />;
                  if (trimmed.startsWith("###")) {
                    return (
                      <h4 key={idx} className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        {trimmed.replace(/^###\s*/, "")}
                      </h4>
                    );
                  }
                  return (
                    <p key={idx} className="mb-1">
                      {trimmed.replace(/\*\*(.*?)\*\*/g, "$1")}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-purple-600/40 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-purple-300 animate-spin" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-xs text-muted-foreground italic">
                Super Spark is formulating response...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Interactive Step Input Controls */}
        {currentStep < 5 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            {/* Step 1 Interactive Controls */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Your Name / Creator Persona</label>
                    <input
                      type="text"
                      value={formData.creatorName}
                      onChange={(e) => setFormData({ ...formData, creatorName: e.target.value })}
                      placeholder="e.g. Maurice"
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Brand Name</label>
                    <input
                      type="text"
                      value={formData.brandName}
                      onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                      placeholder="e.g. Tech Insights Nigeria"
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Niche / Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["AI & Technology", "Business & Startups", "Creator Economy", "Personal Finance", "Lifestyle & Culture"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFormData({ ...formData, niche: n })}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                          formData.niche === n
                            ? "bg-purple-600/40 border border-purple-400 text-purple-200 font-semibold"
                            : "bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="accent"
                  size="md"
                  fullWidth
                  disabled={!formData.brandName.trim() || !formData.creatorName.trim()}
                  onClick={() =>
                    advanceToStep(
                      2,
                      formData,
                      `Name: **${formData.creatorName}**, Brand: **${formData.brandName}** (${formData.niche})`
                    )
                  }
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Confirm Brand Identity →
                </Button>
              </div>
            )}

            {/* Step 2 Interactive Controls */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Target Audience</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Tech Enthusiasts & Founders",
                      "Gen Z & Digital Creators",
                      "Working Professionals & Executives",
                      "African Entrepreneurs & Business Owners"
                    ].map((aud) => (
                      <button
                        key={aud}
                        type="button"
                        onClick={() => setFormData({ ...formData, audience: aud })}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                          formData.audience === aud
                            ? "bg-purple-600/40 border border-purple-400 text-purple-200 font-semibold"
                            : "bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {aud}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Primary Growth Objective</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["Viral Reach & Growth", "Brand Authority & Trust", "High Monetization", "Content Consistency"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFormData({ ...formData, goal: g })}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                          formData.goal === g
                            ? "bg-purple-600/40 border border-purple-400 text-purple-200 font-semibold"
                            : "bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="accent"
                  size="md"
                  fullWidth
                  onClick={() =>
                    advanceToStep(
                      3,
                      formData,
                      `Audience: **${formData.audience}**, Goal: **${formData.goal}**`
                    )
                  }
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Set Audience & Growth Goal →
                </Button>
              </div>
            )}

            {/* Step 3 Asset Collection Controls (Character Bible & Voice Preview) */}
            {currentStep === 3 && (
              <div className="space-y-3">
                {/* Character Sheet Asset Picker / Uploader */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                      Character Sheet Asset
                    </label>
                    <label className="text-[10px] text-purple-300 hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      Upload Custom
                      <input type="file" accept="image/*" onChange={handleCharacterSheetUpload} className="hidden" />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_CHARACTER_SHEETS.map((cs) => {
                      const isSelected = formData.characterSheetUrl === cs.previewUrl;
                      return (
                        <button
                          key={cs.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, characterSheetUrl: cs.previewUrl })}
                          className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all relative overflow-hidden ${
                            isSelected
                              ? "bg-purple-600/30 border-purple-400 ring-1 ring-purple-400"
                              : "bg-white/5 border-white/10 opacity-75 hover:opacity-100"
                          }`}
                        >
                          <img src={cs.previewUrl} alt={cs.label} className="w-full h-12 object-cover rounded-lg mb-1.5" />
                          <span className="text-[11px] font-bold block truncate text-foreground">{cs.label}</span>
                          <span className="text-[9px] text-muted-foreground truncate">{cs.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Executive Voice Profile Picker with Preview */}
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    Executive Voice Profile (Listen Before Selecting)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRESET_VOICES.map((v) => {
                      const isSelected = formData.voiceProfile?.id === v.id;
                      const isPlaying = playingVoiceId === v.id;

                      return (
                        <div
                          key={v.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            isSelected
                              ? "bg-purple-600/30 border-purple-400 text-purple-200"
                              : "bg-white/5 border-white/10 text-muted-foreground"
                          }`}
                        >
                          <div
                            className="flex-1 cursor-pointer pr-2"
                            onClick={() => setFormData({ ...formData, voiceProfile: v })}
                          >
                            <div className="flex items-center gap-1.5">
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                              <span className="text-xs font-bold text-foreground block">{v.name}</span>
                            </div>
                            <span className="text-[10px] opacity-75 block">{v.accent} • {v.language}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => playVoicePreview(v)}
                            className="p-2 rounded-lg bg-white/10 hover:bg-purple-500/30 text-purple-300 transition-all flex items-center justify-center flex-shrink-0"
                            title="Preview Voice Sample"
                          >
                            {isPlaying ? (
                              <Square className="w-3.5 h-3.5 text-cyan-300 fill-cyan-300 animate-pulse" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-purple-300" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  variant="accent"
                  size="md"
                  fullWidth
                  onClick={() =>
                    advanceToStep(
                      4,
                      formData,
                      `Character Sheet & Voice (**${formData.voiceProfile?.name}**) confirmed`
                    )
                  }
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Save Character & Voice Bible →
                </Button>
              </div>
            )}

            {/* Step 4 Distribution Channels & Real Platform OAuth Connections */}
            {currentStep === 4 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Distribution Channels & Accounts</label>
                  <div className="space-y-1.5">
                    {["YouTube Shorts", "TikTok", "Instagram Reels", "LinkedIn", "Twitter/X"].map((plat) => {
                      const isSelected = formData.platforms.includes(plat);
                      const conn = formData.connectedAccounts?.[plat];
                      const isConnecting = connectingPlatform === plat;

                      return (
                        <div
                          key={plat}
                          className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                            isSelected
                              ? "bg-purple-600/20 border-purple-500/40"
                              : "bg-white/5 border-white/10 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => togglePlatform(plat)}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${isSelected ? "bg-purple-500 border-purple-400 text-white" : "border-white/30"}`}>
                              {isSelected && "✓"}
                            </div>
                            <span className="text-xs font-semibold text-foreground">{plat}</span>
                          </div>

                          {isSelected && (
                            <div>
                              {conn?.connected ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  {conn.handle} Verified
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isConnecting}
                                  onClick={() => handleConnectPlatform(plat)}
                                  className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-500/40 text-cyan-200 font-semibold flex items-center gap-1"
                                >
                                  {isConnecting ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Connecting...
                                    </>
                                  ) : (
                                    <>
                                      <ExternalLink className="w-3 h-3" />
                                      Connect Account
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Executive Governance Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "manual", label: "Manual Review", desc: "You approve all cuts" },
                      { id: "balanced", label: "Balanced", desc: "Smart AI queueing" },
                      { id: "autonomous", label: "Autonomous", desc: "Auto-publishing" }
                    ].map((gov) => (
                      <button
                        key={gov.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, automationMode: gov.id as any })}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          formData.automationMode === gov.id
                            ? "bg-purple-600/30 border-purple-400 text-purple-200"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-xs font-bold block">{gov.label}</span>
                        <span className="text-[10px] opacity-70 block">{gov.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="accent"
                  size="md"
                  fullWidth
                  disabled={formData.platforms.length === 0}
                  onClick={() => advanceToStep(5, formData, `Governance: **${formData.automationMode.toUpperCase()}** on **${formData.platforms.join(", ")}**`)}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Assemble Executive Workspace →
                </Button>
              </div>
            )}

            {/* General Question Input Row */}
            <form onSubmit={handleTextSubmit} className="relative flex items-center pt-1 border-t border-white/10">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask Super Spark 'Explain governance' or type a custom answer..."
                className="w-full bg-black/60 border border-white/15 rounded-xl pl-3.5 pr-9 py-2 text-xs focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isThinking}
                className="absolute right-2 p-1.5 rounded-lg text-purple-400 hover:text-purple-200 disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Step 5 Assembly Overlay */}
        {currentStep === 5 && (
          <div className="absolute inset-0 bg-[#0B0F17]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 z-50">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 p-[1px] mb-5 animate-pulse">
              <div className="w-full h-full bg-[#0B0F17] rounded-[15px] flex items-center justify-center">
                <SparkLogo className="w-7 h-7" variant="superspark" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1.5">Assembling Executive OS</h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-5">{assemblyPhase}</p>

            <div className="w-full max-w-xs bg-white/10 h-2 rounded-full overflow-hidden mb-5">
              <div
                className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all duration-500"
                style={{ width: `${assemblyProgress}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-left w-full max-w-xs">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-muted-foreground truncate">{formData.brandName} Schema</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-muted-foreground truncate">{formData.creatorName} Bible</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
