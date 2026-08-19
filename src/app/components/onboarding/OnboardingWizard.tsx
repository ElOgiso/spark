import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  User,
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
  Maximize2,
  AlertCircle,
  HelpCircle,
  X,
} from "lucide-react";
import { Button } from "../ds";
import { SparkLogo } from "../SparkLogo";
import { CharacterSheetLightbox } from "./CharacterSheetLightbox";
import { socialConnectorFramework, getOAuthAuthorizationUrl } from "../../services/socialIntegrationService";
import {
  getElevenLabsVoices,
  previewElevenLabsVoice,
  generateElevenLabsVoice,
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
  genre?: string;
  skinTone?: string;
  hairStyle?: string;
  wardrobe?: string;
  personality?: string;
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

const HAIR_STYLE_OPTIONS = [
  "Short Crop",
  "Textured Curls",
  "Braids/Locs",
  "Sleek Bob",
  "Long Waves",
  "Buzz Cut",
  "Fade",
];

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

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [customNicheInput, setCustomNicheInput] = useState("");
  const [showSparkHelp, setShowSparkHelp] = useState(false);

  const [formData, setFormData] = useState<BrandGenesisData>({
    brandName: "",
    creatorName: "",
    niche: "AI & Technology",
    audience: "Creators & Founders",
    goal: "Viral Reach & Growth",
    platforms: ["YouTube Shorts"],
    tone: "Energetic & Relatable",
    vision: "Next-generation autonomous AI media brand",
    visualStyle: "Realistic / Live-Action",
    productionMode: "hybrid",
    automationMode: "balanced",
    reviewRequired: true,
    characterChoice: "describe",
    characterDescription: "Executive AI presenter with sharp focus and modern framing",
    characterSheetUrl: undefined,
    characterImageUrl: undefined,
    genre: "Realistic",
    skinTone: "Rich Brown",
    hairStyle: "Short Crop",
    wardrobe: "Executive Tailored Suit",
    personality: "Confident",
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

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  // Research Sources state & Live Sync Tracking
  const [researchSourceInput, setResearchSourceInput] = useState("");
  const [seededSources, setSeededSources] = useState<string[]>([]);
  const [sourceSyncStatuses, setSourceSyncStatuses] = useState<Record<string, "syncing" | "ready" | "failed">>({});

  // Load ElevenLabs Voices on mount & Restore OAuth Resume State if returning
  useEffect(() => {
    getElevenLabsVoices().then((res) => {
      setVoices(res.voices);
      setIsLiveVoices(res.isLiveApi);
    });

    if (typeof localStorage !== "undefined") {
      const savedState = localStorage.getItem("spark_onboarding_resume_state");
      const storedTokens = socialConnectorFramework.getStoredTokens();

      const connectedAccountsMap: Record<string, { handle: string; connected: boolean }> = {};
      let hydratedBrandName = "";
      let hydratedCreatorName = "";

      if (storedTokens && typeof storedTokens === "object") {
        Object.values(storedTokens).forEach((tok: any) => {
          if (tok && tok.platform) {
            let realHandle = (tok.handle || tok.accountHandle || "").trim();
            if (realHandle === "@connected" || realHandle === "connected") {
              realHandle = "";
            }
            if (!realHandle && tok.displayName) {
              realHandle = `@${tok.displayName.replace(/\s+/g, "").toLowerCase()}`;
            }
            if (realHandle && !realHandle.startsWith("@")) {
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

      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          setFormData((prev) => ({
            ...prev,
            ...parsed,
            brandName: parsed.brandName || hydratedBrandName || prev.brandName,
            creatorName: parsed.creatorName || hydratedCreatorName || prev.creatorName,
            connectedAccounts: { ...(parsed.connectedAccounts || {}), ...connectedAccountsMap },
            platforms: Array.from(new Set([...(parsed.platforms || []), ...Object.keys(connectedAccountsMap)])),
          }));
          // If returning from OAuth on Step 1, advance to Step 2 (Brand + Niche)
          setCurrentStep(2);
        } catch (e) {
          console.warn("[Onboarding] Resume state restore notice:", e);
        } finally {
          localStorage.removeItem("spark_onboarding_resume_state");
        }
      } else if (Object.keys(connectedAccountsMap).length > 0) {
        setFormData((prev) => ({
          ...prev,
          brandName: prev.brandName || hydratedBrandName,
          creatorName: prev.creatorName || hydratedCreatorName,
          connectedAccounts: { ...(prev.connectedAccounts || {}), ...connectedAccountsMap },
          platforms: Array.from(new Set([...prev.platforms, ...Object.keys(connectedAccountsMap)])),
        }));
      }
    }
  }, []);

  // Handle Character Sheet Reference Upload
  const handleCharacterSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEv) => {
      const dataUri = uploadEv.target?.result as string;
      if (dataUri) {
        setFormData((prev) => ({
          ...prev,
          characterSheetUrl: dataUri,
          characterImageUrl: dataUri,
          characterChoice: "upload",
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Generate Character Reference Bible Sheet
  const handleGeneratePortrait = async () => {
    setIsGeneratingPortrait(true);
    setPortraitError(null);

    const prompt = `Production Character Design Bible Reference Sheet for "${formData.creatorName || "Lead Host"}" representing brand "${formData.brandName || "SPARK"}", niche: "${formData.niche}".
Visual Style / Genre: ${formData.genre || "Realistic"}.
Skin Tone: ${formData.skinTone || "Rich Brown"}.
Hair Style: ${formData.hairStyle || "Short Crop"}.
Signature Wardrobe: ${formData.wardrobe || "Executive Tailored Suit"}.
Personality & Emotion: ${formData.personality || "Confident"}.
Director Notes & Persona: ${formData.characterDescription || "Executive host in modern high-contrast studio setting"}.

LAYOUT & COMPOSITION (One unified master model sheet / production bible grid):
1. TOP TITLE BLOCK: "${formData.creatorName || "Lead Host"}" - Production Model Bible, Style: ${formData.genre || "Realistic"}, Core Aesthetic Guidelines.
2. FULL-BODY TURNAROUND MODEL ROW: 4 distinct full-body views (Full Front Standing Pose, 3/4 Dynamic Angle, Side Profile, and Back View) in matching signature wardrobe (${formData.wardrobe || "Executive Tailored Suit"}) under neutral key studio lighting.
3. EXPRESSION PALETTE GRID: 4 to 6 facial emotion crops (${formData.personality || "Confident"}: Confident, Explaining/Directing, Warm/Smiling, Inquisitive/Thoughtful, Intense Hook).
4. COLOR PALETTE SWATCH STRIP: 5 exact hex color swatches defining wardrobe accents, skin tone, hair tint, and set tone.
5. DETAILS & PROPS: Detailed close-up of signature microphone / accessory / wristwear and fabric texture.

AESTHETICS: Masterclass character turnaround sheet, ultra-crisp studio lighting, high consistency, professional animation and visual development standard, photorealistic 8k detail, clear reference layout.`;

    try {
      const { ModelRouter } = await import("../../services/runtime/modelRouter");
      const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
        prompt,
        capability: "Image Generation",
      });
      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        setFormData((prev) => ({
          ...prev,
          characterSheetUrl: imgUrl,
          characterImageUrl: imgUrl,
          characterChoice: "describe",
        }));
      } else {
        setPortraitError("Character bible sheet generation returned no image. Please retry.");
      }
    } catch (err) {
      console.warn("Character sheet generation notice:", err);
      setPortraitError("Character generation failed. You can retry or upload a reference image.");
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  // Play ElevenLabs audio sample
  const handlePlayVoice = async (voiceId: string) => {
    if (previewAudioElement) {
      try {
        previewAudioElement.pause();
        previewAudioElement.currentTime = 0;
      } catch {}
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voiceId);

    try {
      const voiceObj = (voices as any[]).find((v: any) => v.voiceId === voiceId);
      const voiceName = voiceObj?.name || "Rachel";
      const sampleText = `Welcome to SPARK. I'm ${voiceName}, your brand narrator for high-retention content.`;

      let audioUrl = await previewElevenLabsVoice(voiceId, sampleText);
      if (!audioUrl && voiceObj?.previewUrl) {
        audioUrl = voiceObj.previewUrl;
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        setPreviewAudioElement(audio);

        audio.onended = () => {
          setPlayingVoiceId(null);
        };
        audio.onerror = async () => {
          console.warn("[OnboardingWizard] Audio URL load error, attempting live TTS synthesis fallback");
          const fallback = await generateElevenLabsVoice(sampleText, voiceId);
          if (fallback) {
            const fallbackAudio = new Audio(fallback);
            setPreviewAudioElement(fallbackAudio);
            fallbackAudio.onended = () => { setPlayingVoiceId(null); setPreviewAudioElement(null); };
            fallbackAudio.onerror = () => { setPlayingVoiceId(null); setPreviewAudioElement(null); };
            await fallbackAudio.play().catch(() => setPlayingVoiceId(null));
          } else {
            console.warn("[OnboardingWizard] ElevenLabs API key not configured or preview unavailable for voice ID:", voiceId);
            setPlayingVoiceId(null);
            setPreviewAudioElement(null);
          }
        };

        await audio.play().catch((playErr) => {
          console.warn("[OnboardingWizard] Audio autoplay policy notice:", playErr);
          setPlayingVoiceId(null);
        });
      } else {
        console.warn("[OnboardingWizard] ElevenLabs preview audio unavailable for voice ID:", voiceId);
        setPlayingVoiceId(null);
      }
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

    audio.onended = () => {
      setPlayingVoiceId(null);
    };
    audio.onerror = () => {
      setPlayingVoiceId(null);
    };

    audio.play().catch(() => {
      setPlayingVoiceId(null);
    });
  };

  // Select Catalog Voice
  const handleSelectVoice = (v: ElevenLabsVoiceSummary) => {
    const profile: VoiceProfile = {
      id: v.voiceId,
      name: v.name,
      accent: v.category || "Professional",
      language: "English",
      duration: "Sample",
      sampleText: "Welcome to SPARK. Let's produce high-retention stories.",
      description: v.description,
    };
    setFormData((prev) => ({
      ...prev,
      voiceProfile: profile,
      voiceId: v.voiceId,
    }));
  };

  // Design ElevenLabs Voice via Prompt
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
        setVoiceDesignError("Voice design did not return audio previews. Please check your API key or use the curated catalog.");
      }
    } catch (err: any) {
      console.warn("Voice design notice:", err);
      setVoiceDesignError(err?.message || "Voice design failed. Please choose a curated narrator voice.");
    } finally {
      setIsDesigningVoice(false);
    }
  };

  // Confirm Designed Voice
  const handleCreateDesignedVoice = async (generatedVoiceId: string) => {
    try {
      const voiceName = `${formData.brandName || "Host"} Voice`;
      const res = await createDesignedElevenLabsVoice({
        voiceName,
        voiceDescription: voiceDescription || "Executive custom voice",
        generatedVoiceId,
      });

      const actualVoiceId = res?.voice_id || generatedVoiceId;
      const profile: VoiceProfile = {
        id: actualVoiceId,
        name: `${voiceName} (Custom)`,
        accent: "Custom Designed",
        language: "English",
        duration: "Sample",
        sampleText: "Custom calibrated voice for SPARK production.",
        description: voiceDescription,
      };

      setFormData((prev) => ({
        ...prev,
        voiceProfile: profile,
        voiceId: actualVoiceId,
      }));
    } catch (err) {
      console.warn("Failed to create designed voice:", err);
      setVoiceDesignError("Failed to save custom voice; falling back to curated list.");
    }
  };

  // Handle Research Source Addition & Instant Background Sync
  const handleAddResearchSource = async () => {
    const raw = researchSourceInput.trim();
    if (!raw) return;

    if (!seededSources.includes(raw)) {
      const updated = [...seededSources, raw];
      setSeededSources(updated);
      setFormData((prev) => ({
        ...prev,
        researchSources: updated,
      }));
      setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "syncing" }));

      // Trigger immediate background sync & pattern extraction
      try {
        const { ResearchSourceService } = await import("../../services/research/researchSourceService");
        const res = await ResearchSourceService.registerAndExtract(raw);
        if (res && res.source) {
          setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "ready" }));
        } else {
          setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "ready" }));
        }
      } catch (err) {
        console.warn("[Onboarding] Background research sync notice:", err);
        setSourceSyncStatuses((prev) => ({ ...prev, [raw]: "failed" }));
      }
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

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("spark_onboarding_resume_state", JSON.stringify(formData));
      localStorage.setItem("spark_onboarding_step", String(currentStep));
      localStorage.setItem("spark_oauth_trigger_source", "onboarding");
    }

    // 10s connection timeout safeguard
    const timeoutTimer = setTimeout(() => {
      setConnectingPlatform(null);
      setPlatformConnectError("Connection didn't complete. Try again or set up without connecting.");
    }, 10000);

    socialConnectorFramework
      .loadClientConfig()
      .then(() => {
        const url = getOAuthAuthorizationUrl(platformName);
        if (url && url !== "#") {
          window.location.href = url;
        } else {
          clearTimeout(timeoutTimer);
          setPlatformConnectError(`Client credentials for ${platform} are not configured on this environment. You can continue without connecting.`);
          setConnectingPlatform(null);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutTimer);
        console.error("Failed to connect platform:", err);
        setPlatformConnectError("Connection didn't complete. Try again or continue without connecting.");
        setConnectingPlatform(null);
      });
  };

  const handleFinish = () => {
    onComplete(formData);
  };

  const connectedAccountsList = Object.keys(formData.connectedAccounts || {}).filter(
    (k) => formData.connectedAccounts?.[k]?.connected
  );

  const stepTitles = [
    "Connect Publishing Account",
    "Brand & Domain Niche",
    "Host Character Design Bible",
    "Narrator Voice & Audio Cadence",
    "Inspiration & Benchmark Feeds",
    "Production Depth & Autonomy",
    "Ready & Launch",
  ];

  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#0B0F17] flex flex-col justify-between overflow-hidden sm:relative sm:min-h-screen sm:p-6 sm:items-center sm:justify-center select-none antialiased">
      {/* Background ambient light */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[300px] bg-purple-600/15 rounded-full blur-[140px]" />
        <div className="w-[350px] h-[200px] bg-cyan-500/10 rounded-full blur-[120px] -translate-y-12" />
      </div>

      {/* Header Container — Flat SPARK Mark & Step Tracker */}
      <header className="w-full max-w-2xl px-4 pt-4 sm:pt-0 sm:px-0 mb-2 sm:mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <SparkLogo className="w-5 h-5" variant="superspark" />
          <div>
            <span className="font-bold text-xs sm:text-sm tracking-wider text-foreground uppercase block">
              SPARK Genesis
            </span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-mono">
              {currentStep <= 6 ? `Phase ${currentStep} of 6 • ${stepTitles[currentStep - 1]}` : "Calibration Complete"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Lightweight Ask Super Spark Trigger */}
          <button
            type="button"
            onClick={() => setShowSparkHelp(true)}
            className="text-[11px] font-mono text-purple-400 hover:text-purple-300 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-500/25 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Ask Super Spark</span>
          </button>

          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === currentStep
                    ? "w-6 sm:w-8 bg-purple-500 shadow-sm shadow-purple-500/50"
                    : s < currentStep
                    ? "w-2.5 sm:w-3 bg-purple-400/60"
                    : "w-2.5 sm:w-3 bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Main Executive Card Container */}
      <main className="w-full max-w-2xl flex-1 sm:h-[680px] sm:flex-none flex flex-col bg-card/60 backdrop-blur-xl border-t sm:border border-white/10 sm:rounded-2xl overflow-hidden relative shadow-2xl">
        {/* Scrollable middle workspace */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-4">
          {/* Executive Director Guidance Note */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/25 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs sm:text-sm leading-relaxed">
              {currentStep === 1 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Publishing Channel:</strong> Connect YouTube or Twitter/X to automatically hydrate your channel identity and enable auto-publishing.
                </p>
              )}
              {currentStep === 2 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Brand & Domain Niche:</strong> Confirm your brand name, creator handle, target audience, and primary growth goal.
                </p>
              )}
              {currentStep === 3 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Character Bible:</strong> Lock multi-angle visual identity, genre, skin tone, hair, and wardrobe for consistent AI video rendering.
                </p>
              )}
              {currentStep === 4 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Voice & Audio:</strong> Select your ElevenLabs narrator voice or describe a custom voice tone for story audio pacing.
                </p>
              )}
              {currentStep === 5 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Inspiration Feeds:</strong> Add benchmark channels or creator links to extract viral patterns before entering production.
                </p>
              )}
              {currentStep === 6 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Operating Modes:</strong> Configure your default production pipeline depth and autonomous review governance.
                </p>
              )}
              {currentStep === 7 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">SPARK Calibrated:</strong> All core media engines verified. Enter your executive dashboard to begin production.
                </p>
              )}
            </div>
          </div>

          {/* STEP 1: Connect Account (First Step) */}
          {currentStep === 1 && (
            <div className="space-y-4 pt-1">
              {platformConnectError && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div className="flex-1">
                    <p>{platformConnectError}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* YouTube Shorts Card */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-xs">
                        YT
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">YouTube Shorts</h4>
                        <p className="text-[11px] text-muted-foreground">9:16 Shorts & Audience Sync</p>
                      </div>
                    </div>
                    {formData.connectedAccounts?.["YouTube Shorts"]?.connected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Authorizes real-time upload and automatic channel title/handle hydration.
                  </p>

                  <div className="pt-1">
                    {formData.connectedAccounts?.["YouTube Shorts"]?.connected ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
                        <span>Connected as {formData.connectedAccounts?.["YouTube Shorts"]?.handle || "@channel"}</span>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={connectingPlatform === "YouTube Shorts"}
                        onClick={() => handleConnectPlatform("YouTube Shorts")}
                        className="w-full py-2.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
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
                </div>

                {/* Twitter / X Card */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xs">
                        𝕏
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">Twitter / 𝕏</h4>
                        <p className="text-[11px] text-muted-foreground">Threads & Video Distribution</p>
                      </div>
                    </div>
                    {formData.connectedAccounts?.["Twitter/X"]?.connected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    OAuth 2.0 PKCE authentication for video snippets and viral thread publishing.
                  </p>

                  <div className="pt-1">
                    {formData.connectedAccounts?.["Twitter/X"]?.connected ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
                        <span>Connected as {formData.connectedAccounts?.["Twitter/X"]?.handle || "@handle"}</span>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={connectingPlatform === "Twitter/X"}
                        onClick={() => handleConnectPlatform("Twitter/X")}
                        className="w-full py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/10"
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
                </div>
              </div>

              {/* Other Platforms Notice */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                <span>TikTok, Instagram Reels, and LinkedIn</span>
                <span className="text-[11px] font-mono text-purple-300">Connect later in Accounts</span>
              </div>

              {/* Skip Escape Link */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
                >
                  Set up brand without connecting an account →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Brand & Domain Niche */}
          {currentStep === 2 && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Brand / Channel Name *</label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    placeholder="e.g. Apex Media, ElOgiso Labs"
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Creator Name / Founder</label>
                  <input
                    type="text"
                    value={formData.creatorName}
                    onChange={(e) => setFormData({ ...formData, creatorName: e.target.value })}
                    placeholder="e.g. Maurice Otabor"
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              {/* Primary Content Niche */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Primary Content Niche *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    "AI & Technology",
                    "Business & Startups",
                    "Creator Economy",
                    "Personal Finance",
                    "Lifestyle & Culture",
                    "Art & Design",
                    "Health & Fitness",
                    "Education & Science",
                  ].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, niche: n });
                        setCustomNicheInput("");
                      }}
                      className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all cursor-pointer ${
                        formData.niche === n
                          ? "bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="pt-2 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Or custom domain niche:</label>
                  <input
                    type="text"
                    value={customNicheInput}
                    onChange={(e) => {
                      setCustomNicheInput(e.target.value);
                      setFormData({ ...formData, niche: e.target.value });
                    }}
                    placeholder="e.g. Deeptech Robotics, Autonomous Systems..."
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              {/* Target Audience Chips */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Target Audience</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Creators & Founders",
                    "Tech Operators & Engineers",
                    "Mainstream Consumers",
                    "B2B Decision Makers",
                    "Lifelong Learners",
                  ].map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setFormData({ ...formData, audience: aud })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        formData.audience === aud
                          ? "bg-purple-600/40 border-purple-400 text-purple-200 shadow-sm"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Channel Goal Chips */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Primary Growth Goal</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Viral Reach & Growth",
                    "Brand Authority",
                    "Lead Generation",
                    "Community Building",
                  ].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setFormData({ ...formData, goal: g })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        formData.goal === g
                          ? "bg-purple-600/40 border-purple-400 text-purple-200 shadow-sm"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Character Reference Sheet Bible */}
          {currentStep === 3 && (
            <div className="space-y-4 pt-1">
              {/* Genre / Visual Medium */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Visual Genre / Medium</label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setFormData({ ...formData, genre: g })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        formData.genre === g
                          ? "bg-purple-600/40 border-purple-400 text-purple-200"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone & Hair Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Skin Tone Preset</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SKIN_TONE_OPTIONS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFormData({ ...formData, skinTone: st })}
                        className={`px-2 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                          formData.skinTone === st
                            ? "bg-purple-600/40 border-purple-400 text-purple-200 font-semibold"
                            : "bg-white/5 border-white/10 text-muted-foreground"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Hair Style</label>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIR_STYLE_OPTIONS.map((hs) => (
                      <button
                        key={hs}
                        type="button"
                        onClick={() => setFormData({ ...formData, hairStyle: hs })}
                        className={`px-2 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                          formData.hairStyle === hs
                            ? "bg-purple-600/40 border-purple-400 text-purple-200 font-semibold"
                            : "bg-white/5 border-white/10 text-muted-foreground"
                        }`}
                      >
                        {hs}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Signature Wardrobe */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Signature Wardrobe Style</label>
                <div className="flex flex-wrap gap-1.5">
                  {WARDROBE_OPTIONS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setFormData({ ...formData, wardrobe: w })}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                        formData.wardrobe === w
                          ? "bg-purple-600/40 border-purple-400 text-purple-200 font-semibold"
                          : "bg-white/5 border-white/10 text-muted-foreground"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personality */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Host Personality</label>
                <div className="flex flex-wrap gap-1.5">
                  {PERSONALITY_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData({ ...formData, personality: p })}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                        formData.personality === p
                          ? "bg-purple-600/40 border-purple-400 text-purple-200 font-semibold"
                          : "bg-white/5 border-white/10 text-muted-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Director Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Director Notes & Persona Details</label>
                <textarea
                  rows={2}
                  value={formData.characterDescription}
                  onChange={(e) => setFormData({ ...formData, characterDescription: e.target.value })}
                  placeholder="Describe posture, studio backdrop, lighting, or specific wardrobe accents..."
                  className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs focus:outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>

              {/* Generation Controls & Model Reference Sheet Preview */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-foreground">Production Reference Bible</span>
                  </div>
                  {formData.characterSheetUrl && (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 cursor-pointer font-mono"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Fullscreen Lightbox</span>
                    </button>
                  )}
                </div>

                {portraitError && (
                  <p className="text-xs text-rose-400 bg-rose-950/30 p-2.5 rounded-lg border border-rose-500/20">
                    {portraitError}
                  </p>
                )}

                {/* Character Reference Sheet Display */}
                {formData.characterSheetUrl || formData.characterImageUrl ? (
                  <div
                    onClick={() => setLightboxOpen(true)}
                    className="relative group rounded-xl overflow-hidden border border-purple-500/40 bg-black/40 cursor-pointer aspect-video max-h-56 flex items-center justify-center"
                  >
                    <img
                      src={formData.characterSheetUrl || formData.characterImageUrl}
                      alt="Character Reference Bible Sheet"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold">
                      <Maximize2 className="w-4 h-4" />
                      <span>Tap for Fullscreen Model Sheet</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 border border-dashed border-white/15 rounded-xl text-center space-y-1 text-muted-foreground text-xs">
                    <p>No model sheet generated yet.</p>
                    <p className="text-[11px] opacity-70">Click Generate to build a multi-angle reference sheet.</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingPortrait}
                    onClick={handleGeneratePortrait}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-600/25"
                  >
                    {isGeneratingPortrait ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Rendering Reference Bible Grid...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{formData.characterSheetUrl ? "Regenerate Sheet" : "Generate Character Sheet"}</span>
                      </>
                    )}
                  </button>

                  <label className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-foreground text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-white/10 transition-colors shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleCharacterSheetUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Voice & Audio */}
          {currentStep === 4 && (
            <div className="space-y-4 pt-1">
              {/* Audio Energy */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Narrator Audio Energy</label>
                <div className="flex gap-2">
                  {[
                    { id: "calm" as const, label: "Calm & Grounded", desc: "Steady documentary pacing" },
                    { id: "energetic" as const, label: "Energetic & Viral", desc: "Fast-cut hook delivery" },
                    { id: "bold" as const, label: "Bold Authority", desc: "Executive punchy delivery" },
                  ].map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, audioEnergy: e.id })}
                      className={`flex-1 p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        formData.audioEnergy === e.id
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs font-bold block">{e.label}</span>
                      <span className="text-[10px] opacity-70 block">{e.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ElevenLabs Catalog */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Narrator Voice Catalog</label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {isLiveVoices ? "● ElevenLabs Live API" : "○ Curated Catalog"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {voices.map((v) => {
                    const isSelected = formData.voiceId === v.voiceId;
                    const isPlaying = playingVoiceId === v.voiceId;
                    return (
                      <div
                        key={v.voiceId}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          isSelected
                            ? "bg-purple-600/25 border-purple-400 text-purple-200"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold block truncate text-foreground">{v.name}</span>
                          <span className="text-[10px] opacity-70 block truncate">{v.category || "Professional"}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePlayVoice(v.voiceId)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-foreground transition-colors cursor-pointer"
                          >
                            {isPlaying ? <Square className="w-3.5 h-3.5 text-purple-400" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectVoice(v)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              isSelected ? "bg-purple-500 text-white" : "bg-white/10 hover:bg-white/20 text-foreground"
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
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-foreground">Design Custom Voice Tone</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voiceDescription}
                    onChange={(e) => setVoiceDescription(e.target.value)}
                    placeholder="e.g. Deep baritone tech commentator with confident cadence"
                    className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    type="button"
                    disabled={isDesigningVoice || !voiceDescription.trim()}
                    onClick={handleDesignVoice}
                    className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    {isDesigningVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    <span>Design</span>
                  </button>
                </div>

                {voiceDesignError && (
                  <p className="text-[11px] text-rose-400 bg-rose-950/30 p-2 rounded-lg border border-rose-500/20">
                    {voiceDesignError}
                  </p>
                )}

                {designedPreviews.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground block">Designed Previews:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {designedPreviews.map((p, idx) => (
                        <div key={p.generated_voice_id} className="p-2 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handlePlayDesignedPreview(p.previewUrl, p.generated_voice_id)}
                            className="p-1 rounded bg-white/10 text-foreground"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                          <span className="text-[10px] text-muted-foreground font-mono">Sample {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleCreateDesignedVoice(p.generated_voice_id)}
                            className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-semibold"
                          >
                            Use Voice
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Inspiration & Research Sources */}
          {currentStep === 5 && (
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Inspiration & Competitor Benchmark URLs</label>
                <p className="text-[11px] text-muted-foreground">
                  Paste YouTube or social channels to analyze patterns. Analysis syncs live in the background before launch.
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    type="url"
                    value={researchSourceInput}
                    onChange={(e) => setResearchSourceInput(e.target.value)}
                    placeholder="https://youtube.com/@mkbhd, https://x.com/paulg"
                    className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddResearchSource}
                    disabled={!researchSourceInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add & Sync</span>
                  </button>
                </div>
              </div>

              {/* Seeded Sources List with Live Status */}
              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground block">Active Research Feeds ({seededSources.length})</label>
                {seededSources.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-white/15 text-center text-xs text-muted-foreground">
                    No research sources added yet. You can paste reference channels or continue to skip.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {seededSources.map((s) => {
                      const status = sourceSyncStatuses[s] || "ready";
                      return (
                        <div
                          key={s}
                          className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="text-xs font-mono truncate text-foreground">{s}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {status === "syncing" && (
                              <span className="text-[10px] text-purple-300 flex items-center gap-1 font-mono">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Syncing...
                              </span>
                            )}
                            {status === "ready" && (
                              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                                <Check className="w-3 h-3" />
                                Ready
                              </span>
                            )}
                            {status === "failed" && (
                              <span className="text-[10px] text-amber-400 font-mono">
                                Queued
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveResearchSource(s)}
                              className="p-1 rounded text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Production Depth & Autonomy */}
          {currentStep === 6 && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Production Pipeline Depth</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "narrator" as const, label: "Narrator", desc: "Images + voice narration + motion subtitles" },
                    { id: "hybrid" as const, label: "Hybrid", desc: "AI video hook + multi-layer narrator engine" },
                    { id: "cinematic" as const, label: "Cinematic", desc: "Full multi-scene video generation + master audio" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, productionMode: pm.id })}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        formData.productionMode === pm.id
                          ? "bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs font-bold block">{pm.label}</span>
                      <span className="text-[11px] opacity-70 block leading-tight mt-1">{pm.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Automation Autonomy Level</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "manual" as const, label: "Manual", desc: "All script, assets, and posts require approval" },
                    { id: "balanced" as const, label: "Balanced", desc: "Autonomous synthesis; you approve final release" },
                    { id: "autonomous" as const, label: "Autonomous", desc: "SPARK researches, generates, and publishes continuously" },
                  ].map((am) => (
                    <button
                      key={am.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, automationMode: am.id })}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        formData.automationMode === am.id
                          ? "bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs font-bold block">{am.label}</span>
                      <span className="text-[11px] opacity-70 block leading-tight mt-1">{am.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Ready / Final Summary Review */}
          {currentStep === 7 && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Brand & Niche */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-foreground font-semibold block truncate">Brand & Niche</span>
                    <span className="text-muted-foreground text-[11px] block truncate">{formData.brandName || "Brand"} · {formData.niche || "Niche"}</span>
                  </div>
                </div>

                {/* Character & Style (Tappable thumbnail for fullscreen view) */}
                <div
                  onClick={() => {
                    if (formData.characterSheetUrl || formData.characterImageUrl) {
                      setLightboxOpen(true);
                    }
                  }}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  {formData.characterSheetUrl || formData.characterImageUrl ? (
                    <img
                      src={formData.characterSheetUrl || formData.characterImageUrl}
                      alt="Host Preview"
                      className="w-7 h-7 rounded-lg object-cover border border-purple-400 shrink-0"
                    />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground font-semibold block truncate">Character Design Bible</span>
                    <span className="text-purple-300 text-[11px] block truncate">
                      {formData.genre || "Realistic"} • {formData.personality || "Confident"} (Tap to view sheet)
                    </span>
                  </div>
                </div>

                {/* Narrator Voice */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-foreground font-semibold block truncate">Narrator Voice</span>
                    <span className="text-muted-foreground text-[11px] block truncate">{formData.voiceProfile?.name || "ElevenLabs Voice"}</span>
                  </div>
                </div>

                {/* Research Sources */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-foreground font-semibold block truncate">Research Inspiration</span>
                    <span className="text-muted-foreground text-[11px] block truncate">
                      {seededSources.length > 0 ? `${seededSources.length} Seed Sources Synced` : "Configured in MY SPARK"}
                    </span>
                  </div>
                </div>

                {/* Production & Autonomy */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-foreground font-semibold block truncate">Production & Autonomy</span>
                    <span className="text-muted-foreground text-[11px] block truncate capitalize">{formData.productionMode} · {formData.automationMode}</span>
                  </div>
                </div>

                {/* Publishing Accounts */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  {connectedAccountsList.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[10px] text-muted-foreground">○</div>
                  )}
                  <div className="min-w-0">
                    <span className="text-foreground font-semibold block truncate">Publishing Channels</span>
                    <span className="text-muted-foreground text-[11px] block truncate">
                      {connectedAccountsList.length > 0 ? `${connectedAccountsList.length} Connected` : "Active in Accounts"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STICKY FOOTER ACTION BAR — Always on screen, never hidden */}
        <footer className="p-3.5 sm:p-4 bg-[#0B0F17]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-3 sticky bottom-0 pb-safe z-10 flex-shrink-0">
          {currentStep > 1 && currentStep < 7 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex-1 flex justify-end">
            {currentStep === 1 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                onClick={() => {
                  setFormData((prev) => {
                    let nextBrand = prev.brandName;
                    let nextCreator = prev.creatorName;
                    const firstConnected = Object.values(prev.connectedAccounts || {})[0];
                    if (firstConnected && firstConnected.handle) {
                      const cleanHandle = firstConnected.handle.replace(/^@/, "");
                      if (!nextCreator) nextCreator = cleanHandle;
                      if (!nextBrand) nextBrand = cleanHandle.toLowerCase().endsWith("media") ? cleanHandle : `${cleanHandle} Media`;
                    }
                    return {
                      ...prev,
                      brandName: nextBrand,
                      creatorName: nextCreator,
                    };
                  });
                  setCurrentStep(2);
                }}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                {connectedAccountsList.length > 0 ? "Continue to Brand & Niche →" : "Continue to Brand Setup →"}
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                disabled={!formData.brandName.trim() || !formData.niche.trim()}
                onClick={() => setCurrentStep(3)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Character Bible →
              </Button>
            )}

            {currentStep === 3 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                onClick={() => setCurrentStep(4)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Narrator Voice →
              </Button>
            )}

            {currentStep === 4 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                onClick={() => setCurrentStep(5)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Inspiration Feeds →
              </Button>
            )}

            {currentStep === 5 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                onClick={() => setCurrentStep(6)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                {seededSources.length > 0 ? "Confirm Sources & Continue →" : "Skip Sources & Continue →"}
              </Button>
            )}

            {currentStep === 6 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                onClick={() => setCurrentStep(7)}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Review & Launch →
              </Button>
            )}

            {currentStep === 7 && (
              <Button
                variant="accent"
                size="lg"
                fullWidth
                onClick={handleFinish}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Enter SPARK Dashboard →
              </Button>
            )}
          </div>
        </footer>
      </main>

      {/* Lightweight Ask Super Spark Help Modal */}
      {showSparkHelp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F141F] border border-purple-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SparkLogo className="w-5 h-5" variant="superspark" />
                <h3 className="text-sm font-bold text-foreground">Super Spark Executive Guidance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSparkHelp(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-purple-300">Phase 1: Connect Account</strong> unlocks automatic publishing to YouTube Shorts and Twitter/X.
              </p>
              <p>
                <strong className="text-purple-300">Phase 2: Brand & Niche</strong> defines the target audience and viral growth velocity.
              </p>
              <p>
                <strong className="text-purple-300">Phase 3: Character Bible</strong> creates a persistent model sheet ensuring your host looks identical across all generated video scenes.
              </p>
              <p>
                <strong className="text-purple-300">Phase 4 & 5: Audio & Feeds</strong> calibrate ElevenLabs voice cadence and extracts winning patterns from your reference channels.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSparkHelp(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Got it, continue onboarding
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Character Sheet Lightbox Modal */}
      <CharacterSheetLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={formData.characterSheetUrl || formData.characterImageUrl}
        characterName={formData.creatorName || "Lead Host"}
        brandName={formData.brandName || "SPARK"}
        metadata={{
          genre: formData.genre,
          personality: formData.personality,
          wardrobe: formData.wardrobe,
          skinTone: formData.skinTone,
          hairStyle: formData.hairStyle,
        }}
      />
    </div>
  );
};
