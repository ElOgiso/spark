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
  Music,
  Check,
  Shield,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  Sliders,
  Camera,
  Film
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
  productionMode: "narrator" | "hybrid" | "cinematic";
  automationMode: "manual" | "balanced" | "autonomous";
  reviewRequired: boolean;
  characterChoice?: "self" | "upload" | "describe" | "skip";
  characterDescription?: string;
  characterSheetUrl?: string;
  voiceProfile?: VoiceProfile;
  audioEnergy?: "calm" | "energetic" | "bold";
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

const PRESET_VOICES: VoiceProfile[] = [
  {
    id: "v-executive-male",
    name: "Spark Executive Male",
    accent: "Global Executive",
    language: "English (US)",
    duration: "0:15",
    sampleText: "Welcome to SPARK. I am ready to scale your media brand.",
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
  const [customNicheInput, setCustomNicheInput] = useState("");

  const [formData, setFormData] = useState<BrandGenesisData>({
    brandName: "",
    creatorName: "",
    niche: "",
    audience: "",
    goal: "Viral Reach & Growth",
    platforms: [],
    tone: "Energetic & Relatable",
    vision: "",
    visualStyle: "Realistic / Live-Action",
    productionMode: "hybrid",
    automationMode: "balanced",
    reviewRequired: true,
    characterChoice: "self",
    characterDescription: "",
    characterSheetUrl: undefined,
    voiceProfile: undefined,
    audioEnergy: "energetic",
    connectedAccounts: {},
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: "genesis-init",
      sender: "spark",
      text: "### Welcome to SPARK Brand Genesis\n\nI am **Super Spark**, your Executive Creative Director. Let's construct your media brand workspace.\n\nFirst, what is your name and the name of your brand?",
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

  // Restore state if returning from an OAuth callback
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

  // Audio Voice Preview
  const playVoicePreview = (voice: VoiceProfile) => {
    if (playingVoiceId === voice.id) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setPlayingVoiceId(null);
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voice.sampleText);
      utterance.rate = 0.98;
      utterance.pitch = voice.id.includes("female") ? 1.1 : voice.id.includes("bold") ? 0.85 : 1.0;
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
            characterChoice: "upload",
            characterSheetUrl: event.target?.result as string,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Connect Platform OAuth Flow
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

  const advanceToStep = (nextStep: number, updatedData: BrandGenesisData, userText: string) => {
    const userMsg: ChatTurn = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date(),
    };

    let sparkReplyText = "";
    if (nextStep === 2) {
      sparkReplyText = `### Content Niche & Category\n\nNice to meet you, **${updatedData.creatorName}**! We'll build **"${updatedData.brandName}"** together.\n\nWhat content niche or domain will this brand focus on?`;
    } else if (nextStep === 3) {
      sparkReplyText = `### Host Character & Visual Look\n\nFocusing on **${updatedData.niche}**.\n\nNext, how should the host character appear across your videos, and what visual aesthetic should we use?`;
    } else if (nextStep === 4) {
      sparkReplyText = `### Voice & Audio Profile\n\nVisual style set to **${updatedData.visualStyle}**.\n\nChoose an executive voice profile and audio energy for your video narration, or set it later in MY SPARK.`;
    } else if (nextStep === 5) {
      sparkReplyText = `### Distribution Channels\n\nVoice & Audio configured.\n\nWhere do you want to publish? You can connect accounts now or skip—research works immediately either way.`;
    } else if (nextStep === 6) {
      sparkReplyText = `### Production Mode & Automation\n\nSelect your default production pipeline depth and governance autonomy level.`;
    } else if (nextStep === 7) {
      sparkReplyText = `### Your SPARK is Ready!\n\nAll parameters have been configured. Review your setup below and enter your workspace.`;
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
        if (lower.includes("production mode")) {
          answer = "**Production Modes** control your rendering depth: **Narrator** (images + voice + captions), **Hybrid** (animated hook + narrator), and **Cinematic** (full storyboard + video generation + voice).";
        } else if (lower.includes("automation")) {
          answer = "**Automation Mode** controls autonomy: **Manual** (all actions need approval), **Balanced** (routine actions handled, strategy approved), **Autonomous** (full autonomous pipeline).";
        } else {
          answer = "I've logged your question. You can modify all brand settings inside **MY SPARK** at any time!";
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
      advanceToStep(2, updated, `Creator: **${creatorName}**, Brand: **${brandName}**`);
    } else if (currentStep === 2) {
      const updated = { ...formData, niche: userText };
      advanceToStep(3, updated, `Niche: **${userText}**`);
    } else if (currentStep === 3) {
      const updated = { ...formData, characterDescription: userText };
      advanceToStep(4, updated, `Character notes: **${userText}**`);
    } else if (currentStep === 4) {
      advanceToStep(5, formData, `Voice & Audio configured`);
    } else if (currentStep === 5) {
      advanceToStep(6, formData, `Channels confirmed`);
    } else if (currentStep === 6) {
      advanceToStep(7, formData, `Production & Automation confirmed`);
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

  const handleFinish = () => {
    onComplete({
      ...formData,
      chatHistory: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp || new Date(),
      })),
    });
  };

  const connectedAccountsList = Object.keys(formData.connectedAccounts || {}).filter(
    (k) => formData.connectedAccounts?.[k]?.connected
  );

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
            <span className="font-bold text-xs sm:text-sm tracking-wide text-foreground uppercase block">SPARK Brand Genesis</span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-mono">
              {currentStep <= 6 ? `Phase ${currentStep} of 6` : "Ready"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
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
                Super Spark is thinking...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Step 1: Identity */}
        {currentStep === 1 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Your Name / Creator Alias</label>
                <input
                  type="text"
                  value={formData.creatorName}
                  onChange={(e) => setFormData({ ...formData, creatorName: e.target.value })}
                  placeholder="e.g. Alex"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Brand Name</label>
                <input
                  type="text"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  placeholder="e.g. Next Wave Media"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500"
                />
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
                  `Name: **${formData.creatorName}**, Brand: **${formData.brandName}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Niche →
            </Button>
          </div>
        )}

        {/* Step 2: Niche */}
        {currentStep === 2 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Select Niche or Enter Custom</label>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {["AI & Technology", "Business & Startups", "Creator Economy", "Personal Finance", "Lifestyle & Culture", "Art & Design", "Health & Fitness", "Education"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, niche: n });
                      setCustomNicheInput("");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                      formData.niche === n
                        ? "bg-purple-600/40 border border-purple-400 text-purple-200 font-semibold"
                        : "bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customNicheInput}
                onChange={(e) => {
                  setCustomNicheInput(e.target.value);
                  setFormData({ ...formData, niche: e.target.value });
                }}
                placeholder="Or type custom niche (e.g. Sustainable Architecture)..."
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            <Button
              variant="accent"
              size="md"
              fullWidth
              disabled={!formData.niche.trim()}
              onClick={() =>
                advanceToStep(
                  3,
                  formData,
                  `Niche: **${formData.niche}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Confirm Niche →
            </Button>
          </div>
        )}

        {/* Step 3: Character & Visual Look */}
        {currentStep === 3 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Host Character Presentation</label>
              <div className="grid grid-cols-3 gap-2 mb-2.5">
                {[
                  { id: "self" as const, label: "I'll appear myself", desc: "Direct video creator", icon: User },
                  { id: "upload" as const, label: "Upload Image", desc: "Custom reference", icon: Upload },
                  { id: "describe" as const, label: "Describe Character", desc: "Text-based bible", icon: ImageIcon },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const isSel = formData.characterChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, characterChoice: opt.id })}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1 text-purple-300" />
                      <span className="text-xs font-bold block">{opt.label}</span>
                      <span className="text-[10px] opacity-70 block">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {formData.characterChoice === "upload" && (
                <div className="mb-2.5">
                  <label className="text-[11px] text-purple-300 hover:underline cursor-pointer flex items-center gap-1.5 p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 justify-center">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{formData.characterSheetUrl ? "Image Uploaded ✓" : "Upload Character Reference Image"}</span>
                    <input type="file" accept="image/*" onChange={handleCharacterSheetUpload} className="hidden" />
                  </label>
                </div>
              )}

              {formData.characterChoice === "describe" && (
                <input
                  type="text"
                  value={formData.characterDescription || ""}
                  onChange={(e) => setFormData({ ...formData, characterDescription: e.target.value })}
                  placeholder="Describe host persona (e.g. 30yo studio tech host with glasses)..."
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500 mb-2.5"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Visual Rendering Style</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "Realistic / Live-Action" as const, label: "Realistic / Live-Action" },
                  { id: "Cinematic 3D" as const, label: "Cinematic 3D" },
                  { id: "Anime / Stylized Studio" as const, label: "Anime / Stylized Studio" },
                ].map((vs) => (
                  <button
                    key={vs.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, visualStyle: vs.id })}
                    className={`p-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                      formData.visualStyle === vs.id
                        ? "bg-purple-600/40 border-purple-400 text-purple-200"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {vs.label}
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
                  4,
                  formData,
                  `Character: **${formData.characterChoice}**, Style: **${formData.visualStyle}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Voice & Audio →
            </Button>
          </div>
        )}

        {/* Step 4: Voice & Audio */}
        {currentStep === 4 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  Executive Voice Profile
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, voiceProfile: undefined })}
                  className="text-[10px] text-muted-foreground hover:text-purple-300"
                >
                  Set in MY SPARK later
                </button>
              </div>

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
                        <span className="text-[10px] opacity-75 block">{v.accent}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => playVoicePreview(v)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-purple-500/30 text-purple-300 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
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

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-purple-400" />
                Audio Energy & Soundtrack Cadence
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "calm" as const, label: "Calm", desc: "Measured & reassuring" },
                  { id: "energetic" as const, label: "Energetic", desc: "High-impact viral pacing" },
                  { id: "bold" as const, label: "Bold", desc: "Cinematic depth & drive" },
                ].map((ae) => (
                  <button
                    key={ae.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, audioEnergy: ae.id })}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      formData.audioEnergy === ae.id
                        ? "bg-purple-600/30 border-purple-400 text-purple-200"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs font-bold block">{ae.label}</span>
                    <span className="text-[10px] opacity-70 block">{ae.desc}</span>
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
                  5,
                  formData,
                  `Voice: **${formData.voiceProfile?.name || "Deferred"}**, Audio: **${formData.audioEnergy}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Accounts →
            </Button>
          </div>
        )}

        {/* Step 5: Accounts */}
        {currentStep === 5 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-muted-foreground font-medium">Distribution Channels & Accounts</label>
                <span className="text-[10px] text-cyan-300/80">Connect optional</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/10">
                💡 <em>Research works now. Publishing needs a connected account.</em>
              </p>

              <div className="space-y-1.5">
                {["YouTube Shorts", "TikTok", "Instagram Reels", "Twitter/X", "LinkedIn"].map((plat) => {
                  const isSelected = formData.platforms.includes(plat);
                  const conn = formData.connectedAccounts?.[plat];
                  const isConnecting = connectingPlatform === plat;

                  return (
                    <div
                      key={plat}
                      className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-purple-600/20 border-purple-500/40"
                          : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => togglePlatform(plat)}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${isSelected ? "bg-purple-500 border-purple-400 text-white" : "border-white/30"}`}>
                          {isSelected && "✓"}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{plat}</span>
                      </div>

                      <div>
                        {conn?.connected ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {conn.handle} Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isConnecting}
                            onClick={() => handleConnectPlatform(plat)}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-500/40 text-cyan-200 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-3 h-3" />
                                Connect
                              </>
                            )}
                          </button>
                        )}
                      </div>
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
                  6,
                  formData,
                  `Channels: **${formData.platforms.length > 0 ? formData.platforms.join(", ") : "Configured later"}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Production Modes →
            </Button>
          </div>
        )}

        {/* Step 6: Production Mode & Automation (REQUIRED) */}
        {currentStep === 6 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Production Mode (Required)</label>
              <div className="grid grid-cols-3 gap-2 mb-2.5">
                {[
                  { id: "narrator" as const, label: "Narrator", desc: "Images + voice + captions / motion" },
                  { id: "hybrid" as const, label: "Hybrid", desc: "Animated hook + narrator pipeline" },
                  { id: "cinematic" as const, label: "Cinematic", desc: "Storyboard + video gen + voice + audio" },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, productionMode: pm.id })}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      formData.productionMode === pm.id
                        ? "bg-purple-600/30 border-purple-400 text-purple-200"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs font-bold block">{pm.label}</span>
                    <span className="text-[10px] opacity-70 block leading-tight mt-0.5">{pm.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Automation Level (Required)</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "manual" as const, label: "Manual", desc: "All decisions require approval" },
                  { id: "balanced" as const, label: "Balanced", desc: "AI routine, you approve strategic" },
                  { id: "autonomous" as const, label: "Autonomous", desc: "AI operates independently" },
                ].map((am) => (
                  <button
                    key={am.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, automationMode: am.id })}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      formData.automationMode === am.id
                        ? "bg-purple-600/30 border-purple-400 text-purple-200"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs font-bold block">{am.label}</span>
                    <span className="text-[10px] opacity-70 block leading-tight mt-0.5">{am.desc}</span>
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
                  7,
                  formData,
                  `Production: **${formData.productionMode.toUpperCase()}**, Automation: **${formData.automationMode.toUpperCase()}**`
                )
              }
              icon={<Sparkles className="w-4 h-4" />}
            >
              Complete Setup →
            </Button>
          </div>
        )}

        {/* Step 7: Ready Screen ("Your SPARK is ready.") */}
        {currentStep === 7 && (
          <div className="p-4 sm:p-6 bg-[#0B0F17]/95 backdrop-blur-md flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <SparkLogo className="w-6 h-6" variant="superspark" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Your SPARK is ready.</h3>
                  <p className="text-xs text-muted-foreground">All core systems calibrated and verified.</p>
                </div>
              </div>

              {/* Verified Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-foreground font-semibold block">Brand & Niche</span>
                    <span className="text-muted-foreground text-[11px]">{formData.brandName} · {formData.niche}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-foreground font-semibold block">Character & Visual</span>
                    <span className="text-muted-foreground text-[11px]">{formData.visualStyle}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-foreground font-semibold block">Production Mode</span>
                    <span className="text-muted-foreground text-[11px] capitalize">{formData.productionMode} Pipeline</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-foreground font-semibold block">Automation</span>
                    <span className="text-muted-foreground text-[11px] capitalize">{formData.automationMode} Mode</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[10px] text-muted-foreground">○</div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Accounts</span>
                    <span className="text-muted-foreground/70 text-[11px]">
                      {connectedAccountsList.length > 0 ? `${connectedAccountsList.length} Connected` : "Optional — connect in Accounts"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[10px] text-muted-foreground">○</div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Billing</span>
                    <span className="text-muted-foreground/70 text-[11px]">Configure later in More</span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="accent"
              size="lg"
              fullWidth
              onClick={handleFinish}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Enter SPARK Dashboard →
            </Button>
          </div>
        )}

        {/* General Question Input Row */}
        {currentStep <= 6 && (
          <form onSubmit={handleTextSubmit} className="relative flex items-center p-2.5 bg-[#0B0F17] border-t border-white/10">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask Super Spark a question or type custom direction..."
              className="w-full bg-black/60 border border-white/15 rounded-xl pl-3.5 pr-9 py-2 text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isThinking}
              className="absolute right-4 p-1.5 rounded-lg text-purple-400 hover:text-purple-200 disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
