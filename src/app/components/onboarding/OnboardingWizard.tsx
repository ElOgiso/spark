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
  Film,
  Globe,
  Plus,
  Trash2,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { Button, GlassCard } from "../ds";
import { SparkLogo } from "../SparkLogo";
import { generateSuperSparkResponse } from "../../services/geminiService";
import { socialConnectorFramework, getStoredAccountTokens, getOAuthAuthorizationUrl } from "../../services/socialIntegrationService";
import {
  getElevenLabsVoices,
  previewElevenLabsVoice,
  designElevenLabsVoice,
  createDesignedElevenLabsVoice,
  FALLBACK_CURATED_ELEVENLABS_VOICES,
  type ElevenLabsVoiceSummary,
} from "../../services/runtime/providers/elevenLabsTTS";

export interface VoiceProfile {
  id: string;
  name: string;
  accent: string;
  language: string;
  duration: string;
  sampleText: string;
  description?: string;
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
  characterImageUrl?: string;
  voiceProfile?: VoiceProfile;
  voiceId?: string;
  audioEnergy?: "calm" | "energetic" | "bold";
  researchSources?: string[];
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
    characterChoice: "describe",
    characterDescription: "Executive AI presenter with sharp focus and modern framing",
    characterSheetUrl: undefined,
    characterImageUrl: undefined,
    voiceProfile: {
      id: "21m00Tcm4TlvDq8ikWAM",
      name: "Rachel (Calm & Professional)",
      accent: "American",
      language: "English (US)",
      duration: "Sample",
      sampleText: "Welcome to SPARK. I am ready to scale your media brand.",
    },
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    audioEnergy: "energetic",
    researchSources: [],
    connectedAccounts: {},
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Character Image Generation state
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [portraitError, setPortraitError] = useState<string | null>(null);

  // ElevenLabs Voice state
  const [voices, setVoices] = useState<ElevenLabsVoiceSummary[]>(FALLBACK_CURATED_ELEVENLABS_VOICES);
  const [isLiveVoices, setIsLiveVoices] = useState(false);
  const [voiceDescription, setVoiceDescription] = useState("");
  const [isDesigningVoice, setIsDesigningVoice] = useState(false);
  const [voiceDesignError, setVoiceDesignError] = useState<string | null>(null);
  const [platformConnectError, setPlatformConnectError] = useState<string | null>(null);
  const [designedPreviews, setDesignedPreviews] = useState<{ generated_voice_id: string; audio_base_64: string; previewUrl: string }[]>([]);
  const [previewAudioElement, setPreviewAudioElement] = useState<HTMLAudioElement | null>(null);

  // Research Sources state
  const [researchSourceInput, setResearchSourceInput] = useState("");
  const [seededSources, setSeededSources] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load ElevenLabs Voices on mount & Restore OAuth Resume State if returning
  useEffect(() => {
    getElevenLabsVoices().then((res) => {
      setVoices(res.voices);
      setIsLiveVoices(res.isLiveApi);
    });

    if (typeof localStorage !== "undefined") {
      const savedState = localStorage.getItem("spark_onboarding_resume_state");
      const savedStep = localStorage.getItem("spark_onboarding_step");
      const storedTokens = socialConnectorFramework.getStoredTokens();

      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          const connectedAccountsMap = { ...(parsed.connectedAccounts || {}) };

          if (storedTokens && typeof storedTokens === "object") {
            Object.values(storedTokens).forEach((tok: any) => {
              if (tok && tok.platform) {
                connectedAccountsMap[tok.platform] = {
                  platform: tok.platform,
                  connected: true,
                  handle: tok.accountHandle || "@connected",
                  connectedAt: tok.connectedAt,
                };
              }
            });
          }

          setFormData((prev) => ({
            ...prev,
            ...parsed,
            connectedAccounts: connectedAccountsMap,
            platforms: Array.from(new Set([...(parsed.platforms || []), ...Object.keys(connectedAccountsMap)])),
          }));

          if (savedStep) {
            const stepNum = parseInt(savedStep, 10);
            if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= 8) {
              setCurrentStep(stepNum);
            }
          }
        } catch (e) {
          console.warn("[Onboarding] Resume state restore notice:", e);
        } finally {
          localStorage.removeItem("spark_onboarding_resume_state");
        }
      }
    }
  }, []);

  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: "genesis-init",
      sender: "spark",
      text: "### Welcome to SPARK Brand Genesis\n\nI am **Super Spark**, your Executive Creative Director. Let's construct your media brand workspace.\n\nFirst, what is your name and the name of your brand?",
      stepIdx: 1,
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentStep]);

  // Handle Character Sheet Reference Upload
  const handleCharacterSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEv) => {
      const dataUri = uploadEv.target?.result as string;
      setFormData((prev) => ({
        ...prev,
        characterSheetUrl: dataUri,
        characterImageUrl: dataUri,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Generate Character Bible Sheet Image via ModelRouter ("storyboardImages")
  const handleGeneratePortrait = async () => {
    setIsGeneratingPortrait(true);
    setPortraitError(null);

    const charDesc = formData.characterDescription || "Executive host in modern high-contrast studio setting";
    const prompt = `Comprehensive character reference sheet bible grid for ${formData.creatorName || "lead host"}, brand "${formData.brandName || "SPARK"}". Presentation aesthetic: ${formData.visualStyle}. Character traits: ${charDesc}. Layout: Multi-view turnaround (front standing pose, 3/4 turn view, side profile detail, close-up facial expressions palette, signature wardrobe costume detail). Neutral studio backdrop, hyper-consistent character design bible, 8k resolution production reference sheet.`;

    try {
      const { ModelRouter } = await import("../../services/runtime/modelRouter");
      const resultImg = await ModelRouter.executeCategoryRequest("storyboardImages", { prompt });

      if (resultImg && (resultImg.startsWith("data:") || resultImg.startsWith("http"))) {
        setFormData((prev) => ({
          ...prev,
          characterSheetUrl: resultImg,
          characterImageUrl: resultImg,
        }));
      } else {
        setPortraitError("Could not generate character sheet image. You can continue with text description.");
      }
    } catch (err: any) {
      console.warn("[Onboarding] Character sheet generation error:", err);
      setPortraitError("Character sheet generation timed out. You can retry or proceed with description.");
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  // Play voice sample
  const playVoicePreview = async (v: ElevenLabsVoiceSummary | VoiceProfile) => {
    if (previewAudioElement) {
      previewAudioElement.pause();
      setPreviewAudioElement(null);
    }

    const voiceId = "voiceId" in v ? v.voiceId : v.id;

    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voiceId);

    try {
      const audioUrl = await previewElevenLabsVoice(voiceId, ("sampleText" in v ? v.sampleText : undefined) || "Welcome to SPARK. I am ready to scale your media brand with automated high-retention content.");
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        setPreviewAudioElement(audio);
        audio.onended = () => {
          setPlayingVoiceId(null);
          setPreviewAudioElement(null);
        };
        audio.onerror = () => {
          setPlayingVoiceId(null);
          setPreviewAudioElement(null);
        };
        await audio.play();
      } else {
        setPlayingVoiceId(null);
      }
    } catch (err) {
      console.warn("Audio playback notice:", err);
      setPlayingVoiceId(null);
    }
  };

  // Design ElevenLabs Voice
  const handleDesignVoice = async () => {
    if (!voiceDescription.trim() || isDesigningVoice) return;
    setIsDesigningVoice(true);
    setVoiceDesignError(null);
    try {
      const res = await designElevenLabsVoice({ description: voiceDescription });
      if (res?.previews?.length) {
        setDesignedPreviews(res.previews);
      } else {
        setVoiceDesignError("Voice design requires a live ElevenLabs API key. You can select any voice from our curated catalog below.");
      }
    } catch (err: any) {
      console.warn("Voice design notice:", err);
      setVoiceDesignError("Voice design service unavailable. Please select from our curated catalog below.");
    } finally {
      setIsDesigningVoice(false);
    }
  };

  // Select Designed Voice Preview
  const handleSelectDesignedVoice = async (preview: { generated_voice_id: string; previewUrl: string }) => {
    try {
      const res = await createDesignedElevenLabsVoice({
        voiceName: `${formData.brandName || "Brand"} Narrator Voice`,
        voiceDescription: voiceDescription || "Custom AI Voice designed in SPARK onboarding",
        generatedVoiceId: preview.generated_voice_id,
      });

      const voiceId = res?.voice_id || preview.generated_voice_id;
      const profile: VoiceProfile = {
        id: voiceId,
        name: `${formData.brandName || "Custom"} Designed Voice`,
        accent: "Custom AI Voice",
        language: "English (ElevenLabs)",
        duration: "Sample",
        sampleText: voiceDescription,
        description: voiceDescription,
      };

      setFormData((prev) => ({
        ...prev,
        voiceProfile: profile,
        voiceId: voiceId,
      }));
    } catch (err) {
      console.warn("Failed to create designed voice:", err);
      setVoiceDesignError("Failed to save custom voice; falling back to curated list.");
    }
  };

  // Handle Research Source Addition
  const handleAddResearchSource = () => {
    const raw = researchSourceInput.trim();
    if (!raw) return;

    if (!seededSources.includes(raw)) {
      const updated = [...seededSources, raw];
      setSeededSources(updated);
      setFormData((prev) => ({
        ...prev,
        researchSources: updated,
      }));
    }
    setResearchSourceInput("");
  };

  const handleRemoveResearchSource = (url: string) => {
    const updated = seededSources.filter((s) => s !== url);
    setSeededSources(updated);
    setFormData((prev) => ({
      ...prev,
      researchSources: updated,
    }));
  };

  const handleConnectPlatform = (platform: string) => {
    setConnectingPlatform(platform);
    setPlatformConnectError(null);
    const platformName = platform === "YouTube Shorts" || platform === "YouTube" ? "YouTube Shorts" : platform === "Twitter/X" || platform === "X" ? "Twitter/X" : platform;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("spark_onboarding_resume_state", JSON.stringify(formData));
      localStorage.setItem("spark_onboarding_step", String(currentStep));
      localStorage.setItem("spark_oauth_trigger_source", "onboarding");
    }

    // 10s connection timeout safeguard
    const timeoutTimer = setTimeout(() => {
      setConnectingPlatform(null);
      setPlatformConnectError(`Connection request timed out for ${platform}. You can proceed and connect later in My Spark.`);
    }, 10000);

    socialConnectorFramework
      .loadClientConfig()
      .then(() => {
        const url = getOAuthAuthorizationUrl(platformName);
        if (url && url !== "#") {
          window.location.href = url;
        } else {
          clearTimeout(timeoutTimer);
          setPlatformConnectError(`Client credentials for ${platform} are not configured on this environment. You can skip for now.`);
          setConnectingPlatform(null);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutTimer);
        console.error("Failed to connect platform:", err);
        setPlatformConnectError(`Failed to initiate ${platform} connection. You can connect later.`);
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
      sparkReplyText = `### Host Character & Visual Aesthetic\n\nFocusing on **${updatedData.niche}**.\n\nLet's generate your host character portrait or define your visual presentation style.`;
    } else if (nextStep === 4) {
      sparkReplyText = `### Brand Narrator Voice & Audio Energy\n\nVisual style set to **${updatedData.visualStyle}**.\n\nChoose an executive ElevenLabs voice profile for video narration, or describe a custom voice.`;
    } else if (nextStep === 5) {
      sparkReplyText = `### Research Source / Inspiration Accounts\n\nVoice configured.\n\nPaste URLs of competitor channels or inspiration accounts (YouTube, TikTok, Instagram) so SPARK can extract viral hooks.`;
    } else if (nextStep === 6) {
      sparkReplyText = `### Distribution Channels\n\nResearch sources registered.\n\nWhere do you want to publish? You can connect accounts now or skip—research works immediately either way.`;
    } else if (nextStep === 7) {
      sparkReplyText = `### Production Mode & Automation\n\nSelect your default production pipeline depth and governance autonomy level.`;
    } else if (nextStep === 8) {
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
      advanceToStep(6, formData, `Research sources confirmed`);
    } else if (currentStep === 6) {
      advanceToStep(7, formData, `Channels confirmed`);
    } else if (currentStep === 7) {
      advanceToStep(8, formData, `Production & Automation confirmed`);
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
              {currentStep <= 7 ? `Phase ${currentStep} of 7` : "Ready"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
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
      <div className="w-full max-w-2xl flex-1 sm:h-[640px] sm:flex-none flex flex-col bg-white/5 border-t sm:border border-purple-500/30 sm:rounded-2xl overflow-hidden relative shadow-2xl">
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
                    ? "bg-purple-600/30 border border-purple-400/50 text-purple-300 shadow-sm"
                    : "bg-cyan-600/30 border border-cyan-400/50 text-cyan-200"
                }`}
              >
                {m.sender === "spark" ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div
                className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                  m.sender === "spark"
                    ? "bg-white/10 border border-white/15 text-foreground backdrop-blur-md rounded-tl-sm shadow-md"
                    : "bg-purple-600 text-white rounded-tr-sm shadow-md"
                }`}
              >
                <div
                  className="prose prose-invert prose-xs leading-normal"
                  dangerouslySetInnerHTML={{
                    __html: m.text
                      .replace(/### (.*)/g, '<h4 class="text-xs sm:text-sm font-bold text-purple-300 mt-0 mb-1">$1</h4>')
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\n\n/g, '<div class="h-2"></div>')
                      .replace(/• (.*)/g, '<li class="ml-2 list-disc">$1</li>'),
                  }}
                />
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-xs text-purple-300/80 p-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Super Spark is synthesizing strategy...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Step 1: Creator & Brand Name */}
        {currentStep === 1 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Your Name / Alias</label>
                <input
                  type="text"
                  value={formData.creatorName}
                  onChange={(e) => setFormData({ ...formData, creatorName: e.target.value })}
                  placeholder="Maurice Otabor"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Brand / Channel Name</label>
                <input
                  type="text"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  placeholder="ElOgiso Media"
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
                  `Creator: **${formData.creatorName}**, Brand: **${formData.brandName}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Niche →
            </Button>
          </div>
        )}

        {/* Step 2: Content Niche */}
        {currentStep === 2 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Select or Type Niche</label>
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
                placeholder="Or type custom niche (e.g. Autonomous AI Media Systems)..."
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

        {/* Step 3: Character & Visual Look (PART B: Generate -> Preview -> Approve) */}
        {currentStep === 3 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe max-h-[380px] overflow-y-auto">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Host Persona Description & Reference</label>
              <input
                type="text"
                value={formData.characterDescription || ""}
                onChange={(e) => setFormData({ ...formData, characterDescription: e.target.value })}
                placeholder="Describe host persona (e.g. Modern charismatic tech founder with studio lighting)..."
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500 mb-2"
              />

              <div className="grid grid-cols-3 gap-2 mb-2.5">
                {[
                  { id: "Realistic / Live-Action" as const, label: "Realistic" },
                  { id: "Cinematic 3D" as const, label: "Cinematic 3D" },
                  { id: "Anime / Stylized Studio" as const, label: "Stylized" },
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

              {/* Character Sheet Portrait Generation Card */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                    Host Character Sheet
                  </span>
                  <label className="text-[10px] text-purple-300 hover:underline cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleCharacterSheetUpload} className="hidden" />
                  </label>
                </div>

                {formData.characterSheetUrl || formData.characterImageUrl ? (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-purple-500/30">
                    <img
                      src={formData.characterSheetUrl || formData.characterImageUrl}
                      alt="Host Character Preview"
                      className="w-14 h-14 rounded-lg object-cover border border-purple-400/50"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-purple-200 block">Character Portrait Ready</span>
                      <span className="text-[10px] text-muted-foreground block">Will be displayed across MY SPARK and production assets.</span>
                    </div>
                    <button
                      type="button"
                      disabled={isGeneratingPortrait}
                      onClick={handleGeneratePortrait}
                      className="p-2 rounded-lg bg-white/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingPortrait ? "animate-spin" : ""}`} />
                      Regenerate
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Generate a visual portrait for your brand host.</p>
                    <button
                      type="button"
                      disabled={isGeneratingPortrait}
                      onClick={handleGeneratePortrait}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingPortrait ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Rendering...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3" />
                          Generate Portrait
                        </>
                      )}
                    </button>
                  </div>
                )}

                {portraitError && (
                  <p className="text-[10px] text-amber-400 mt-1.5">{portraitError}</p>
                )}
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
                  `Character: **${formData.characterDescription || "Host"}**, Style: **${formData.visualStyle}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Voice & Audio →
            </Button>
          </div>
        )}

        {/* Step 4: ElevenLabs Voices + Voice Design (PART C) */}
        {currentStep === 4 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe max-h-[380px] overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  Brand Narrator Voice (ElevenLabs)
                </label>
                <span className="text-[10px] text-purple-300">
                  {isLiveVoices ? "ElevenLabs API Active" : "Curated Public Voices"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {voices.slice(0, 6).map((v) => {
                  const isSelected = (formData.voiceProfile?.id || formData.voiceId) === v.voiceId;
                  const isPlaying = playingVoiceId === v.voiceId;

                  return (
                    <div
                      key={v.voiceId}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-white/5 border-white/10 text-muted-foreground"
                      }`}
                    >
                      <div
                        className="flex-1 cursor-pointer pr-2"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            voiceId: v.voiceId,
                            voiceProfile: {
                              id: v.voiceId,
                              name: v.name,
                              accent: v.accent || "Standard",
                              language: "English",
                              duration: "Sample",
                              sampleText: v.description || "Voice sample",
                              description: v.description,
                            },
                          })
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                          <span className="text-xs font-bold text-foreground block">{v.name}</span>
                        </div>
                        <span className="text-[10px] opacity-75 block truncate">{v.accent || v.description}</span>
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

              {/* ElevenLabs Voice Design Accordion / Input */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-2">
                <label className="text-xs font-bold text-foreground block mb-1">Describe a Custom Voice (Voice Design)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voiceDescription}
                    onChange={(e) => setVoiceDescription(e.target.value)}
                    placeholder="e.g. Deep African executive narrator with calm confidence..."
                    className="flex-1 bg-black/50 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    disabled={!voiceDescription.trim() || isDesigningVoice}
                    onClick={handleDesignVoice}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isDesigningVoice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Design
                  </button>
                </div>

                {designedPreviews.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    <span className="text-[10px] text-purple-300 font-medium block">Voice Previews:</span>
                    {designedPreviews.map((prev, pIdx) => (
                      <div key={prev.generated_voice_id} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-xs text-muted-foreground font-mono">Sample Option {pIdx + 1}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const audio = new Audio(prev.previewUrl);
                              audio.play();
                            }}
                            className="p-1.5 rounded bg-white/10 text-purple-300 hover:bg-purple-500/20 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectDesignedVoice(prev)}
                            className="text-[10px] px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-500 cursor-pointer font-semibold"
                          >
                            Use Voice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {voiceDesignError && (
                  <p className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg leading-snug">
                    {voiceDesignError}
                  </p>
                )}
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
                  `Voice: **${formData.voiceProfile?.name || "ElevenLabs"}**, Audio: **${formData.audioEnergy}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Research Sources →
            </Button>
          </div>
        )}

        {/* Step 5: Research Source / Inspiration Account (PART D) */}
        {currentStep === 5 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-purple-400" />
                  Research Source / Inspiration Account
                </label>
                <span className="text-[10px] text-cyan-300/80">Feeds Viral Sparks</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/10">
                💡 <em>Paste YouTube channel, TikTok profile, Instagram, or single video URLs. SPARK will analyze viral hooks to seed your Viral Sparks feed immediately.</em>
              </p>

              <div className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  value={researchSourceInput}
                  onChange={(e) => setResearchSourceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddResearchSource();
                    }
                  }}
                  placeholder="https://youtube.com/@channel or https://tiktok.com/@creator..."
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleAddResearchSource}
                  disabled={!researchSourceInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {seededSources.length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {seededSources.map((srcUrl) => (
                    <div
                      key={srcUrl}
                      className="p-2 rounded-xl bg-white/5 border border-purple-500/30 flex items-center justify-between text-xs"
                    >
                      <span className="text-purple-200 truncate flex-1 pr-2">{srcUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveResearchSource(srcUrl)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/70 italic">
                  No source added yet. You can paste one now or add sources later in MY SPARK.
                </p>
              )}
            </div>

            <Button
              variant="accent"
              size="md"
              fullWidth
              onClick={() =>
                advanceToStep(
                  6,
                  formData,
                  `Research Sources: **${seededSources.length > 0 ? `${seededSources.length} Seeded` : "Deferred to MY SPARK"}**`
                )
              }
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {seededSources.length > 0 ? "Confirm Sources & Continue →" : "Skip for now & Continue →"}
            </Button>
          </div>
        )}

        {/* Step 6: Accounts */}
        {currentStep === 6 && (
          <div className="p-3.5 sm:p-4 bg-[#0B0F17]/90 backdrop-blur-md border-t border-white/10 space-y-3 sticky bottom-0 pb-safe">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-muted-foreground font-medium">Distribution Channels & Accounts</label>
                <span className="text-[10px] text-cyan-300/80">Connect optional</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/10">
                💡 <em>Research works now. Publishing needs a connected account.</em>
              </p>

              {platformConnectError && (
                <p className="mb-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg leading-snug">
                  {platformConnectError}
                </p>
              )}

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
                  7,
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

        {/* Step 7: Production Mode & Automation */}
        {currentStep === 7 && (
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
                  8,
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

        {/* Step 8: Ready Screen */}
        {currentStep === 8 && (
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
                  {formData.characterSheetUrl || formData.characterImageUrl ? (
                    <img
                      src={formData.characterSheetUrl || formData.characterImageUrl}
                      alt="Host Preview"
                      className="w-5 h-5 rounded-full object-cover border border-emerald-400 shrink-0"
                    />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <span className="text-foreground font-semibold block">Character & Style</span>
                    <span className="text-muted-foreground text-[11px]">{formData.visualStyle}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-foreground font-semibold block">Narrator Voice</span>
                    <span className="text-muted-foreground text-[11px]">{formData.voiceProfile?.name || "ElevenLabs Voice"}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-foreground font-semibold block">Research Sources</span>
                    <span className="text-muted-foreground text-[11px]">
                      {seededSources.length > 0 ? `${seededSources.length} Sources Seeded` : "Add in MY SPARK"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-foreground font-semibold block">Production & Autonomy</span>
                    <span className="text-muted-foreground text-[11px] capitalize">{formData.productionMode} · {formData.automationMode}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[10px] text-muted-foreground">○</div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Publishing Accounts</span>
                    <span className="text-muted-foreground/70 text-[11px]">
                      {connectedAccountsList.length > 0 ? `${connectedAccountsList.length} Connected` : "Optional — connect in Accounts"}
                    </span>
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
        {currentStep <= 7 && (
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
