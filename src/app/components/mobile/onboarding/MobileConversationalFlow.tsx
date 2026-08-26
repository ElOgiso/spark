import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpark } from "../../../state/SparkContext";
import { useAuth } from "../../../state/AuthContext";
import {
  Sparkles,
  Camera,
  Upload,
  User,
  SkipForward,
  CheckCircle2,
  Sliders,
  Shield,
  Layers,
  ArrowRight,
  ArrowLeft,
  Volume2,
  Music,
  Film,
  Zap,
  Globe,
  Plus,
  Trash2,
  Wand2,
  RefreshCw,
  Play,
  Square,
  Loader2,
  Maximize2,
  ExternalLink,
  Check,
  AlertCircle,
  HelpCircle,
  X,
} from "lucide-react";
import type { BrandGenesisData, VoiceProfile } from "../../onboarding/OnboardingWizard";
import { SparkLogo } from "../../SparkLogo";
import { CharacterSheetLightbox } from "../../onboarding/CharacterSheetLightbox";
import { socialConnectorFramework, getOAuthAuthorizationUrl } from "../../../services/socialIntegrationService";
import {
  getElevenLabsVoices,
  previewElevenLabsVoice,
  designElevenLabsVoice,
  createDesignedElevenLabsVoice,
  FALLBACK_CURATED_ELEVENLABS_VOICES,
  type ElevenLabsVoiceSummary,
} from "../../../services/runtime/providers/elevenLabsTTS";

type FlowStep =
  | "connect"
  | "brand"
  | "character"
  | "voice"
  | "research"
  | "modes"
  | "ready";

type MobileConversationalFlowProps = {
  onComplete: (data?: BrandGenesisData) => void;
};

const GENRE_OPTIONS = [
  "Realistic",
  "Cinematic",
  "3D",
  "Anime",
  "Cartoon",
  "Illustration",
  "Comic",
  "Art / Stylized",
  "Clay",
  "Pixel",
];

const SKIN_TONE_OPTIONS = ["Fair", "Medium", "Olive", "Rich Brown", "Deep Dark"];
const HAIR_STYLE_OPTIONS = ["Short Crop", "Textured Curls", "Braids/Locs", "Sleek Bob", "Long Waves", "Buzz Cut", "Fade"];
const WARDROBE_OPTIONS = [
  "Executive Tailored Suit",
  "Smart Casual Blazer",
  "Minimal Techwear",
  "Luxury Streetwear",
  "Studio Denim",
  "High-Contrast Monochromatic",
];
const PERSONALITY_OPTIONS = [
  "Confident",
  "Warm & Engaging",
  "High Authority",
  "Energetic & Viral",
  "Playful & Witty",
  "Inquisitive & Analytical",
];

export function MobileConversationalFlow({ onComplete }: MobileConversationalFlowProps) {
  const auth = useAuth();
  const { initializeBrandGenesis } = useSpark();

  const [step, setStep] = useState<FlowStep>("connect");
  const [showSparkHelp, setShowSparkHelp] = useState(false);

  // Selection states
  const [creatorName, setCreatorName] = useState(() => auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || "");
  const [brandName, setBrandName] = useState("");
  const [niche, setNicheSelection] = useState("AI & Technology");
  const [customNiche, setCustomNiche] = useState("");
  const [audience, setAudience] = useState("Creators & Founders");
  const [goal, setGoal] = useState("Viral Reach & Growth");

  // Character states
  const [characterDescription, setCharacterDescription] = useState("Executive AI presenter with sharp focus and modern framing");
  const [characterSheetUrl, setCharacterSheetUrl] = useState<string | undefined>(undefined);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [genre, setGenre] = useState("Realistic");
  const [skinTone, setSkinTone] = useState("Rich Brown");
  const [hairStyle, setHairStyle] = useState("Short Crop");
  const [wardrobe, setWardrobe] = useState("Executive Tailored Suit");
  const [personality, setPersonality] = useState("Confident");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Voice states
  const [voices, setVoices] = useState<ElevenLabsVoiceSummary[]>(FALLBACK_CURATED_ELEVENLABS_VOICES);
  const [selectedVoiceId, setSelectedVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [selectedVoiceName, setSelectedVoiceName] = useState("Rachel (Calm & Professional)");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [previewAudioElement, setPreviewAudioElement] = useState<HTMLAudioElement | null>(null);
  const [voiceDescription, setVoiceDescription] = useState("");
  const [isDesigningVoice, setIsDesigningVoice] = useState(false);
  const [voiceDesignError, setVoiceDesignError] = useState<string | null>(null);
  const [designedPreviews, setDesignedPreviews] = useState<{ generated_voice_id: string; audio_base_64: string; previewUrl: string }[]>([]);
  const [audioEnergy, setAudioEnergy] = useState<"calm" | "energetic" | "bold">("energetic");

  // Research Sources & Live Background Sync
  const [researchSourceInput, setResearchSourceInput] = useState("");
  const [seededSources, setSeededSources] = useState<string[]>([]);
  const [sourceSyncStatuses, setSourceSyncStatuses] = useState<Record<string, "syncing" | "ready" | "failed">>({});

  // Production & Automation modes
  const [productionMode, setProductionMode] = useState<"narrator" | "hybrid" | "cinematic">("hybrid");
  const [automationMode, setAutomationMode] = useState<"manual" | "balanced" | "autonomous">("balanced");

  // Connected accounts
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, { handle: string; connected: boolean }>>({});
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [platformConnectError, setPlatformConnectError] = useState<string | null>(null);

  // Load voices & restore OAuth resume state on mount
  useEffect(() => {
    getElevenLabsVoices().then((res) => {
      setVoices(res.voices);
    });

    if (typeof localStorage !== "undefined") {
      const storedTokens = socialConnectorFramework.getStoredTokens();
      const connectedAccountsMap: Record<string, { handle: string; connected: boolean }> = {};
      let hydratedBrandName = "";
      let hydratedCreatorName = "";

      if (storedTokens && typeof storedTokens === "object") {
        Object.values(storedTokens).forEach((tok: any) => {
          if (tok && tok.platform) {
            let realHandle = (tok.handle || tok.accountHandle || "").trim().replace(/^@+/, "");
            if (realHandle === "connected") {
              realHandle = "";
            }
            if (!realHandle && tok.displayName) {
              realHandle = tok.displayName.replace(/\s+/g, "").toLowerCase().replace(/^@+/, "");
            }
            if (realHandle) {
              realHandle = `@${realHandle}`;
            }

            connectedAccountsMap[tok.platform] = {
              handle: realHandle || (tok.platform.toLowerCase().includes("youtube") ? "@youtube" : "@x"),
              connected: true,
            };
            if (!hydratedCreatorName && (tok.displayName || realHandle)) {
              hydratedCreatorName = tok.displayName || realHandle.replace(/^@/, "");
            }
            if (!hydratedBrandName && (tok.displayName || realHandle)) {
              const base = tok.displayName || realHandle.replace(/^@/, "");
              hydratedBrandName = base.toLowerCase().endsWith("media") ? base : `${base} Media`;
            }
          }
        });
      }

      const savedState = localStorage.getItem("spark_onboarding_resume_state");
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.brandName || hydratedBrandName) setBrandName(parsed.brandName || hydratedBrandName);
          if (parsed.creatorName || hydratedCreatorName) setCreatorName(parsed.creatorName || hydratedCreatorName);
          if (parsed.niche) setNicheSelection(parsed.niche);
          if (parsed.characterSheetUrl) setCharacterSheetUrl(parsed.characterSheetUrl);
          if (parsed.voiceId) setSelectedVoiceId(parsed.voiceId);
          if (parsed.productionMode) setProductionMode(parsed.productionMode);
          if (parsed.automationMode) setAutomationMode(parsed.automationMode);
          setConnectedAccounts({ ...(parsed.connectedAccounts || {}), ...connectedAccountsMap });
          // Advance to Brand step after OAuth return
          setStep("brand");
        } catch (e) {
          console.warn("[MobileOnboarding] Resume state restore notice:", e);
        } finally {
          localStorage.removeItem("spark_onboarding_resume_state");
        }
      } else if (Object.keys(connectedAccountsMap).length > 0) {
        setConnectedAccounts(connectedAccountsMap);
        if (hydratedBrandName && !brandName) setBrandName(hydratedBrandName);
        if (hydratedCreatorName && !creatorName) setCreatorName(hydratedCreatorName);
      }
    }
  }, []);

  // Handle Character Sheet Upload
  const handleCharacterSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEv) => {
      const dataUri = uploadEv.target?.result as string;
      if (dataUri) {
        setCharacterSheetUrl(dataUri);
      }
    };
    reader.readAsDataURL(file);
  };

  // Generate Character Bible Sheet
  const handleGeneratePortrait = async () => {
    setIsGeneratingPortrait(true);
    setPortraitError(null);

    const activeNiche = customNiche.trim() || niche || "AI & Technology";
    const { buildProductionCharacterSheetPrompt } = await import("../../../services/production/characterSheetPrompt");
    const prompt = buildProductionCharacterSheetPrompt({
      creatorName,
      role: "Brand Host & Lead Presenter",
      brandName,
      niche: activeNiche,
      purpose: undefined,
      genre,
      personality,
      skinTone,
      hairStyle,
      wardrobe,
      directorNotes: characterDescription,
    });

    try {
      const { ModelRouter } = await import("../../../services/runtime/modelRouter");
      const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
        prompt,
        referenceImageUrl: characterSheetUrl || undefined,
        referenceImageUrls: characterSheetUrl ? [characterSheetUrl] : undefined,
        capability: "Image Generation",
      });
      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        setCharacterSheetUrl(imgUrl);
      } else {
        setPortraitError("Character bible sheet generation returned no image. Please retry.");
      }
    } catch (err) {
      console.warn("Character sheet generation notice:", err);
      setPortraitError("Character generation failed. You can retry or upload an image.");
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  // Play Catalog Voice
  const handlePlayVoice = async (voiceId: string) => {
    if (previewAudioElement) {
      previewAudioElement.pause();
      previewAudioElement.currentTime = 0;
    }

    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }

    try {
      const audioUrl = await previewElevenLabsVoice(voiceId);
      if (!audioUrl) {
        setPlayingVoiceId(null);
        return;
      }
      const audio = new Audio(audioUrl);
      setPreviewAudioElement(audio);
      setPlayingVoiceId(voiceId);

      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      audio.play().catch(() => setPlayingVoiceId(null));
    } catch {
      setPlayingVoiceId(null);
    }
  };

  // Play Designed Base64 Voice Sample
  const handlePlayDesignedPreview = (previewUrl: string, id: string) => {
    if (previewAudioElement) {
      previewAudioElement.pause();
      previewAudioElement.currentTime = 0;
    }

    if (playingVoiceId === id) {
      setPlayingVoiceId(null);
      return;
    }

    const audio = new Audio(previewUrl);
    setPreviewAudioElement(audio);
    setPlayingVoiceId(id);

    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
    audio.play().catch(() => setPlayingVoiceId(null));
  };

  // Design Voice
  const handleDesignVoice = async () => {
    if (!voiceDescription.trim()) return;
    setIsDesigningVoice(true);
    setVoiceDesignError(null);

    try {
      const res = await designElevenLabsVoice({
        description: voiceDescription,
        sampleText: "Welcome to SPARK. I will narrate your high-impact video productions with authority and clarity.",
      });

      if (res && res.previews && res.previews.length > 0) {
        setDesignedPreviews(res.previews);
      } else {
        setVoiceDesignError("Voice design did not return audio previews. Please select a curated voice.");
      }
    } catch (err: any) {
      console.warn("Voice design notice:", err);
      setVoiceDesignError(err?.message || "Voice design failed. Please select a curated narrator voice.");
    } finally {
      setIsDesigningVoice(false);
    }
  };

  // Confirm Designed Voice
  const handleCreateDesignedVoice = async (generatedVoiceId: string) => {
    try {
      const voiceName = `${brandName || "Host"} Voice`;
      const res = await createDesignedElevenLabsVoice({
        voiceName,
        voiceDescription: voiceDescription || "Executive custom voice",
        generatedVoiceId,
      });

      const actualVoiceId = res?.voice_id || generatedVoiceId;
      setSelectedVoiceId(actualVoiceId);
      setSelectedVoiceName(`${voiceName} (Custom)`);
    } catch (err) {
      console.warn("Failed to create designed voice:", err);
      setVoiceDesignError("Failed to save custom voice; falling back to curated list.");
    }
  };

  // Add Research Source & Trigger Instant Sync
  const handleAddResearchSource = async () => {
    const raw = researchSourceInput.trim();
    if (!raw) return;

    if (!seededSources.includes(raw)) {
      const updated = [...seededSources, raw];
      setSeededSources(updated);
      setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "syncing" }));

      // Trigger immediate background sync
      try {
        const { ResearchSourceService } = await import("../../../services/research/researchSourceService");
        const res = await ResearchSourceService.registerAndExtract(raw);
        if (res && res.source) {
          setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "ready" }));
        } else {
          setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "ready" }));
        }
      } catch (err) {
        console.warn("[MobileOnboarding] Background research sync notice:", err);
        setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "failed" }));
      }
    }
    setResearchSourceInput("");
  };

  const handleRemoveResearchSource = (url: string) => {
    setSeededSources((prev) => prev.filter((s) => s !== url));
  };

  // OAuth Connect with 10s Timeout Safeguard
  const handleConnectPlatform = (platform: string) => {
    const isOAuthSupported = platform === "YouTube Shorts" || platform === "Twitter/X" || platform === "YouTube" || platform === "X";
    if (!isOAuthSupported) {
      setPlatformConnectError(`${platform} can be connected later in the Accounts center.`);
      return;
    }

    setConnectingPlatform(platform);
    setPlatformConnectError(null);
    const platformName = platform === "YouTube Shorts" || platform === "YouTube" ? "YouTube Shorts" : "Twitter/X";

    const currentGenesisState: Partial<BrandGenesisData> = {
      brandName,
      creatorName,
      niche: customNiche.trim() || niche,
      audience,
      goal,
      characterSheetUrl,
      voiceId: selectedVoiceId,
      productionMode,
      automationMode,
      connectedAccounts,
      researchSources: seededSources,
    };

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("spark_onboarding_resume_state", JSON.stringify(currentGenesisState));
      localStorage.setItem("spark_onboarding_step", "1");
      localStorage.setItem("spark_oauth_trigger_source", "onboarding");
    }

    const timeoutTimer = setTimeout(() => {
      setConnectingPlatform(null);
      setPlatformConnectError("Connection didn't complete. Try again or skip.");
    }, 10000);

    socialConnectorFramework
      .loadClientConfig()
      .then(() => {
        const url = getOAuthAuthorizationUrl(platformName);
        if (url && url !== "#") {
          window.location.href = url;
        } else {
          clearTimeout(timeoutTimer);
          setPlatformConnectError(`Client credentials for ${platform} are not configured. You can skip.`);
          setConnectingPlatform(null);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutTimer);
        console.error("Failed to connect platform:", err);
        setPlatformConnectError("Connection didn't complete. Try again or skip.");
        setConnectingPlatform(null);
      });
  };

  // Final Completion Handler
  const handleFinalCompletion = () => {
    const activeNiche = customNiche.trim() || niche || "AI & Technology";
    const selectedVoiceObj = voices.find((v) => v.voiceId === selectedVoiceId);

    const voiceProfile: VoiceProfile = {
      id: selectedVoiceId,
      name: selectedVoiceName,
      accent: selectedVoiceObj?.category || "Professional",
      language: "English (US)",
      duration: "Sample",
      sampleText: "Welcome to SPARK. Let's produce high-retention stories.",
    };

    const genesisData: BrandGenesisData = {
      brandName: brandName || "SPARK Brand",
      creatorName: creatorName || "Executive Creator",
      niche: activeNiche,
      audience,
      goal,
      platforms: Object.keys(connectedAccounts).length > 0 ? Object.keys(connectedAccounts) : ["YouTube Shorts"],
      tone: "Energetic & Relatable",
      vision: "Autonomous AI media company",
      visualStyle: "Realistic / Live-Action",
      productionMode,
      automationMode,
      reviewRequired: automationMode !== "autonomous",
      characterChoice: characterSheetUrl ? "describe" : "skip",
      characterDescription,
      characterSheetUrl,
      characterImageUrl: characterSheetUrl,
      genre,
      skinTone,
      hairStyle,
      wardrobe,
      personality,
      voiceProfile,
      voiceId: selectedVoiceId,
      audioEnergy,
      researchSources: seededSources,
      connectedAccounts,
    };

    void initializeBrandGenesis(genesisData);
    void auth.markOnboardingComplete(auth.brand?.id);
    onComplete(genesisData);
  };

  const getStepNumber = () => {
    switch (step) {
      case "connect": return 1;
      case "brand": return 2;
      case "character": return 3;
      case "voice": return 4;
      case "research": return 5;
      case "modes": return 6;
      case "ready": return 7;
      default: return 1;
    }
  };

  const stepNumber = getStepNumber();

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#0B0F17] text-foreground flex flex-col justify-between relative z-50 overflow-hidden select-none antialiased">
      {/* Background Soft Mesh Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Top Header Bar — Flat SPARK Mark & Progress */}
      <header className="px-4 py-3 border-b border-white/10 bg-[#0B0F17]/90 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <SparkLogo className="w-4 h-4" variant="superspark" />
          <span className="text-xs font-bold tracking-wider uppercase text-foreground">SPARK Genesis</span>
          <span className="text-[10px] font-mono text-purple-300 ml-1">
            {stepNumber <= 6 ? `Phase ${stepNumber} of 6` : "Calibrated"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSparkHelp(true)}
            className="text-[10px] font-mono text-purple-400 p-1 flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Help</span>
          </button>

          {step !== "ready" && (
            <button
              type="button"
              onClick={handleFinalCompletion}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center space-x-1 p-1 cursor-pointer"
            >
              <span>Skip All</span>
              <SkipForward className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      {/* Scrollable Middle Container */}
      <main className="flex-1 overflow-y-auto px-4 py-3 max-w-sm mx-auto w-full z-10 space-y-4">
        {/* Executive Director Guidance Note */}
        <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs text-foreground leading-relaxed">
            {step === "connect" && (
              <p>
                <strong className="text-purple-300">Publishing Channel:</strong> Connect YouTube or Twitter/X to automatically hydrate your channel identity.
              </p>
            )}
            {step === "brand" && (
              <p>
                <strong className="text-purple-300">Brand & Domain Niche:</strong> Confirm your brand name, creator handle, target audience, and primary growth goal.
              </p>
            )}
            {step === "character" && (
              <p>
                <strong className="text-purple-300">Character Bible:</strong> Lock multi-angle visual identity, genre, skin tone, hair, and wardrobe for consistent AI video rendering.
              </p>
            )}
            {step === "voice" && (
              <p>
                <strong className="text-purple-300">Voice & Audio:</strong> Select your ElevenLabs narrator voice or design a custom tone for story pacing.
              </p>
            )}
            {step === "research" && (
              <p>
                <strong className="text-purple-300">Inspiration Feeds:</strong> Add benchmark channels or creator links to extract winning viral patterns.
              </p>
            )}
            {step === "modes" && (
              <p>
                <strong className="text-purple-300">Operating Modes:</strong> Configure your default production depth and review autonomy.
              </p>
            )}
            {step === "ready" && (
              <p>
                <strong className="text-purple-300">SPARK Calibrated:</strong> All core media engines verified. Enter your executive dashboard to begin production.
              </p>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Connect Account (First Step) */}
          {step === "connect" && (
            <motion.div
              key="connect"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              {platformConnectError && (
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-2 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p>{platformConnectError}</p>
                </div>
              )}

              {/* YouTube Shorts Card */}
              <div className="p-3.5 rounded-xl bg-card border border-border hover:border-purple-500/50 transition-all space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-xs">
                      YT
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">YouTube Shorts</h4>
                      <p className="text-[10px] text-muted-foreground">9:16 Shorts & Audience Sync</p>
                    </div>
                  </div>
                  {connectedAccounts["YouTube Shorts"]?.connected && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>

                {connectedAccounts["YouTube Shorts"]?.connected ? (
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                    <span>Connected as {connectedAccounts["YouTube Shorts"]?.handle || "@channel"}</span>
                    <Check className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={connectingPlatform === "YouTube Shorts"}
                    onClick={() => handleConnectPlatform("YouTube Shorts")}
                    className="w-full py-2.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {connectingPlatform === "YouTube Shorts" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Connect YouTube Channel
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Twitter / X Card */}
              <div className="p-3.5 rounded-xl bg-card border border-border hover:border-purple-500/50 transition-all space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xs">
                      𝕏
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Twitter / 𝕏</h4>
                      <p className="text-[10px] text-muted-foreground">Threads & Video Distribution</p>
                    </div>
                  </div>
                  {connectedAccounts["Twitter/X"]?.connected && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>

                {connectedAccounts["Twitter/X"]?.connected ? (
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                    <span>Connected as {connectedAccounts["Twitter/X"]?.handle || "@handle"}</span>
                    <Check className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={connectingPlatform === "Twitter/X"}
                    onClick={() => handleConnectPlatform("Twitter/X")}
                    className="w-full py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                  >
                    {connectingPlatform === "Twitter/X" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Connect 𝕏 Account
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Other Platforms Notice */}
              <div className="p-2.5 rounded-xl bg-card/60 border border-border text-[11px] text-muted-foreground flex items-center justify-between">
                <span>TikTok, Instagram & LinkedIn</span>
                <span className="text-purple-300">Connect in Accounts</span>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!brandName || !creatorName) {
                      const firstConnected = Object.values(connectedAccounts)[0];
                      if (firstConnected && firstConnected.handle) {
                        const cleanHandle = firstConnected.handle.replace(/^@/, "");
                        if (!creatorName) setCreatorName(cleanHandle);
                        if (!brandName) setBrandName(cleanHandle.toLowerCase().endsWith("media") ? cleanHandle : `${cleanHandle} Media`);
                      }
                    }
                    setStep("brand");
                  }}
                  className="text-xs text-muted-foreground underline underline-offset-4"
                >
                  Set up brand without connecting →
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Brand & Domain Niche */}
          {step === "brand" && (
            <motion.div
              key="brand"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Brand / Channel Name *</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Apex Media, ElOgiso Labs"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Creator Name / Handle</label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="e.g. Maurice Otabor"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-foreground">Primary Content Niche *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    "AI & Technology",
                    "Business & Startups",
                    "Creator Economy",
                    "Personal Finance",
                    "Lifestyle & Culture",
                    "Health & Fitness",
                  ].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setNicheSelection(n);
                        setCustomNiche("");
                      }}
                      className={`p-2 rounded-xl text-xs font-medium text-left border transition-all ${
                        niche === n && !customNiche
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  placeholder="Or custom domain niche..."
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500 mt-1"
                />
              </div>

              {/* Target Audience & Goal */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-foreground">Target Audience</label>
                <div className="flex flex-wrap gap-1">
                  {["Creators & Founders", "Tech Operators", "Mainstream", "B2B Decision Makers"].map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setAudience(aud)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border ${
                        audience === aud ? "bg-purple-600/40 border-purple-400 text-purple-200" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Character Reference Sheet Bible */}
          {step === "character" && (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              {/* Visual Genre Chips */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Visual Genre / Medium</label>
                <div className="flex flex-wrap gap-1">
                  {GENRE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className={`px-2 py-1 rounded-lg text-[11px] border ${
                        genre === g ? "bg-purple-600/40 border-purple-400 text-purple-200" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone & Hair */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Skin Tone</label>
                  <div className="flex flex-wrap gap-1">
                    {SKIN_TONE_OPTIONS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSkinTone(st)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] border ${
                          skinTone === st ? "bg-purple-600/40 border-purple-400 text-purple-200 font-semibold" : "bg-card border-border text-muted-foreground"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Hair Style</label>
                  <div className="flex flex-wrap gap-1">
                    {HAIR_STYLE_OPTIONS.slice(0, 4).map((hs) => (
                      <button
                        key={hs}
                        type="button"
                        onClick={() => setHairStyle(hs)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] border ${
                          hairStyle === hs ? "bg-purple-600/40 border-purple-400 text-purple-200 font-semibold" : "bg-card border-border text-muted-foreground"
                        }`}
                      >
                        {hs}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Wardrobe */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Signature Wardrobe</label>
                <div className="flex flex-wrap gap-1">
                  {WARDROBE_OPTIONS.slice(0, 4).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWardrobe(w)}
                      className={`px-2 py-1 rounded-lg text-[10px] border ${
                        wardrobe === w ? "bg-purple-600/40 border-purple-400 text-purple-200 font-semibold" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Character Sheet Display & Controls */}
              <div className="p-3 rounded-xl bg-card border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Reference Sheet Bible</span>
                  {characterSheetUrl && (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="text-[10px] text-purple-300 flex items-center gap-1 font-mono"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Fullscreen</span>
                    </button>
                  )}
                </div>

                {portraitError && (
                  <p className="text-[11px] text-rose-400 bg-rose-950/30 p-2 rounded-lg border border-rose-500/20">
                    {portraitError}
                  </p>
                )}

                {characterSheetUrl ? (
                  <div
                    onClick={() => setLightboxOpen(true)}
                    className="relative rounded-xl overflow-hidden border border-purple-500/40 bg-black/40 aspect-video max-h-44 flex items-center justify-center cursor-pointer"
                  >
                    <img src={characterSheetUrl} alt="Model Sheet" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[11px] font-semibold opacity-0 hover:opacity-100 transition-opacity">
                      Tap for Fullscreen Lightbox
                    </div>
                  </div>
                ) : (
                  <div className="py-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                    Click Generate to render a multi-angle model sheet.
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isGeneratingPortrait}
                    onClick={handleGeneratePortrait}
                    className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/25"
                  >
                    {isGeneratingPortrait ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Rendering Bible...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{characterSheetUrl ? "Regenerate Sheet" : "Generate Bible Sheet"}</span>
                      </>
                    )}
                  </button>

                  <label className="py-2 px-3 rounded-xl bg-card border border-border text-foreground text-xs font-medium flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleCharacterSheetUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Voice & Audio */}
          {step === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              {/* Audio Energy */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Audio Energy</label>
                <div className="flex gap-1.5">
                  {[
                    { id: "calm" as const, label: "Calm" },
                    { id: "energetic" as const, label: "Energetic" },
                    { id: "bold" as const, label: "Bold" },
                  ].map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setAudioEnergy(e.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                        audioEnergy === e.id ? "bg-purple-600/30 border-purple-400 text-purple-200" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Catalog */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Narrator Voice Catalog</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {voices.map((v) => {
                    const isSelected = selectedVoiceId === v.voiceId;
                    const isPlaying = playingVoiceId === v.voiceId;
                    return (
                      <div
                        key={v.voiceId}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                          isSelected ? "bg-purple-600/25 border-purple-400" : "bg-card border-border"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold block truncate text-foreground">{v.name}</span>
                          <span className="text-[10px] opacity-70 block truncate text-muted-foreground">{v.category || "Narrator"}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePlayVoice(v.voiceId)}
                            className="p-1 rounded bg-white/10 text-foreground"
                          >
                            {isPlaying ? <Square className="w-3 h-3 text-purple-400" /> : <Play className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVoiceId(v.voiceId);
                              setSelectedVoiceName(v.name);
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              isSelected ? "bg-purple-500 text-white" : "bg-white/10 text-foreground"
                            }`}
                          >
                            {isSelected ? "Selected ✓" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Voice Designer */}
              <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-bold text-foreground">Design Custom Voice</span>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={voiceDescription}
                    onChange={(e) => setVoiceDescription(e.target.value)}
                    placeholder="e.g. Deep tech commentator..."
                    className="flex-1 bg-black/40 border border-border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    disabled={isDesigningVoice || !voiceDescription.trim()}
                    onClick={handleDesignVoice}
                    className="py-1.5 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
                  >
                    {isDesigningVoice ? <Loader2 className="w-3 h-3 animate-spin" /> : "Design"}
                  </button>
                </div>

                {voiceDesignError && (
                  <p className="text-[11px] text-rose-400 bg-rose-950/30 p-1.5 rounded-lg border border-rose-500/20">
                    {voiceDesignError}
                  </p>
                )}

                {designedPreviews.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-muted-foreground block">Designed Previews:</span>
                    <div className="grid grid-cols-2 gap-1">
                      {designedPreviews.map((p, idx) => (
                        <div key={p.generated_voice_id} className="p-1.5 rounded-lg bg-black/40 border border-border flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handlePlayDesignedPreview(p.previewUrl, p.generated_voice_id)}
                            className="p-1 rounded bg-white/10 text-foreground"
                          >
                            <Play className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-[10px] text-muted-foreground">Sample {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleCreateDesignedVoice(p.generated_voice_id)}
                            className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-semibold"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 5: Inspiration & Research Sources */}
          {step === "research" && (
            <motion.div
              key="research"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Inspiration & Benchmark URLs</label>
                <p className="text-[11px] text-muted-foreground">
                  Paste YouTube or social channels to analyze patterns. Syncs live in the background.
                </p>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="url"
                    value={researchSourceInput}
                    onChange={(e) => setResearchSourceInput(e.target.value)}
                    placeholder="https://youtube.com/@mkbhd"
                    className="flex-1 bg-card border border-border rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddResearchSource}
                    disabled={!researchSourceInput.trim()}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Seeded Sources List */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground block">Active Feeds ({seededSources.length})</label>
                {seededSources.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    No inspiration sources added yet.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {seededSources.map((s) => {
                      const status = sourceSyncStatuses[s] || "ready";
                      return (
                        <div key={s} className="p-2 rounded-xl bg-card border border-border flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-mono truncate text-foreground flex-1">{s}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {status === "syncing" && (
                              <span className="text-[10px] text-purple-300 flex items-center gap-1 font-mono">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Syncing
                              </span>
                            )}
                            {status === "ready" && (
                              <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-mono">
                                <Check className="w-2.5 h-2.5" />
                                Ready
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveResearchSource(s)}
                              className="p-0.5 text-muted-foreground hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 6: Modes */}
          {step === "modes" && (
            <motion.div
              key="modes"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Production Depth</label>
                <div className="space-y-1.5">
                  {[
                    { id: "narrator" as const, title: "Narrator", desc: "Images + voice narration + motion captions" },
                    { id: "hybrid" as const, title: "Hybrid", desc: "AI video hook + multi-layer narrator sequence" },
                    { id: "cinematic" as const, title: "Cinematic", desc: "Multi-scene video generation + master audio" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setProductionMode(m.id)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                        productionMode === m.id ? "bg-purple-600/30 border-purple-400 text-purple-200" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      <p className="text-xs font-bold text-foreground">{m.title}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-foreground">Autonomy Governance</label>
                <div className="space-y-1.5">
                  {[
                    { id: "manual" as const, title: "Manual", desc: "All releases require your approval" },
                    { id: "balanced" as const, title: "Balanced", desc: "AI synthesizes; you approve final release" },
                    { id: "autonomous" as const, title: "Autonomous", desc: "SPARK operates continuously" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAutomationMode(m.id)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                        automationMode === m.id ? "bg-purple-600/30 border-purple-400 text-purple-200" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      <p className="text-xs font-bold text-foreground">{m.title}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 7: Ready Summary */}
          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-2.5 text-xs text-left"
            >
              <div className="bg-card border border-border p-2.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-foreground font-semibold block truncate">{brandName || "Brand"}</span>
                  <span className="text-[11px] text-muted-foreground block truncate">{customNiche || niche}</span>
                </div>
              </div>

              <div
                onClick={() => {
                  if (characterSheetUrl) setLightboxOpen(true);
                }}
                className="bg-card border border-border p-2.5 rounded-xl flex items-center gap-2 cursor-pointer hover:border-purple-400 transition-colors"
              >
                {characterSheetUrl ? (
                  <img src={characterSheetUrl} alt="Host" className="w-6 h-6 rounded-lg object-cover border border-purple-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-foreground font-semibold block truncate">Character Design Bible</span>
                  <span className="text-[11px] text-purple-300 block truncate">{genre} • {personality} (Tap to view)</span>
                </div>
              </div>

              <div className="bg-card border border-border p-2.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-foreground font-semibold block truncate">Narrator Voice</span>
                  <span className="text-[11px] text-muted-foreground block truncate">{selectedVoiceName}</span>
                </div>
              </div>

              <div className="bg-card border border-border p-2.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-foreground font-semibold block truncate">Pipeline & Autonomy</span>
                  <span className="text-[11px] text-muted-foreground block truncate capitalize">{productionMode} · {automationMode}</span>
                </div>
              </div>

              {seededSources.length > 0 && (
                <div className="bg-card border border-border p-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-foreground font-semibold block truncate">Research Feeds</span>
                    <span className="text-[11px] text-muted-foreground block truncate">{seededSources.length} Synced</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* STICKY FOOTER ACTION BAR — Always on screen, never hidden */}
      <footer className="p-3 bg-[#0B0F17]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 z-20 pb-safe flex-shrink-0">
        {step !== "connect" && step !== "ready" && (
          <button
            type="button"
            onClick={() => {
              if (step === "brand") setStep("connect");
              else if (step === "character") setStep("brand");
              else if (step === "voice") setStep("character");
              else if (step === "research") setStep("voice");
              else if (step === "modes") setStep("research");
            }}
            className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1 flex justify-end">
          {step === "connect" && (
            <button
              type="button"
              onClick={() => {
                if (!brandName || !creatorName) {
                  const firstConnected = Object.values(connectedAccounts)[0];
                  if (firstConnected && firstConnected.handle) {
                    const cleanHandle = firstConnected.handle.replace(/^@/, "");
                    if (!creatorName) setCreatorName(cleanHandle);
                    if (!brandName) setBrandName(cleanHandle.toLowerCase().endsWith("media") ? cleanHandle : `${cleanHandle} Media`);
                  }
                }
                setStep("brand");
              }}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>{Object.keys(connectedAccounts).length > 0 ? "Continue to Brand →" : "Continue without Connecting →"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === "brand" && (
            <button
              type="button"
              disabled={!brandName.trim()}
              onClick={() => setStep("character")}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>Continue to Character →</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === "character" && (
            <button
              type="button"
              onClick={() => setStep("voice")}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>Continue to Voice →</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === "voice" && (
            <button
              type="button"
              onClick={() => setStep("research")}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>Continue to Research →</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === "research" && (
            <button
              type="button"
              onClick={() => setStep("modes")}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>{seededSources.length > 0 ? "Confirm Sources →" : "Skip Sources →"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === "modes" && (
            <button
              type="button"
              onClick={() => setStep("ready")}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>Review & Launch →</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}

          {step === "ready" && (
            <button
              type="button"
              onClick={handleFinalCompletion}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-sm flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Enter SPARK Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* Lightweight Ask Super Spark Help Modal */}
      {showSparkHelp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0F141F] border border-purple-500/30 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SparkLogo className="w-4 h-4" variant="superspark" />
                <h3 className="text-xs font-bold text-foreground">Super Spark Executive Guidance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSparkHelp(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-purple-300">Phase 1: Connect Account</strong> unlocks automated YouTube Shorts & Twitter/X distribution.
              </p>
              <p>
                <strong className="text-purple-300">Phase 2 & 3: Brand & Character</strong> lock your identity and multi-angle model sheet.
              </p>
              <p>
                <strong className="text-purple-300">Phase 4 & 5: Voice & Feeds</strong> configure ElevenLabs narrator and instant pattern extraction.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSparkHelp(false)}
              className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Character Sheet Lightbox Modal */}
      <CharacterSheetLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={characterSheetUrl}
        characterName={creatorName || "Lead Host"}
        brandName={brandName || "SPARK"}
        metadata={{
          genre,
          personality,
          wardrobe,
          skinTone,
          hairStyle,
        }}
      />
    </div>
  );
}
