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
} from "lucide-react";
import { Button } from "../ds";
import { SparkLogo } from "../SparkLogo";
import { CharacterSheetLightbox } from "./CharacterSheetLightbox";
import { socialConnectorFramework, getOAuthAuthorizationUrl } from "../../services/socialIntegrationService";
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

  const [formData, setFormData] = useState<BrandGenesisData>({
    brandName: "",
    creatorName: "",
    niche: "",
    audience: "Creators, Tech Founders & Modern Media Operators",
    goal: "Viral Reach & Growth",
    platforms: ["YouTube Shorts", "Twitter/X"],
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

  // Research Sources state
  const [researchSourceInput, setResearchSourceInput] = useState("");
  const [seededSources, setSeededSources] = useState<string[]>([]);

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

  // Generate Character Production Bible Reference Sheet via ModelRouter ("storyboardImages")
  const handleGeneratePortrait = async () => {
    setIsGeneratingPortrait(true);
    setPortraitError(null);

    const genre = formData.genre || "Realistic";
    const skin = formData.skinTone || "Rich Brown";
    const hair = formData.hairStyle || "Short Crop";
    const wardrobe = formData.wardrobe || "Executive Tailored Suit";
    const personality = formData.personality || "Confident";
    const charDesc = formData.characterDescription || "Executive host in modern high-contrast studio setting";

    const prompt = `Production Character Design Bible Reference Sheet for "${formData.creatorName || "Lead Host"}" representing brand "${formData.brandName || "SPARK"}", niche: "${formData.niche || "Content"}".
Visual Style / Genre: ${genre}.
Skin Tone: ${skin}.
Hair Style: ${hair}.
Signature Wardrobe: ${wardrobe}.
Personality & Emotion: ${personality}.
Director Notes & Persona: ${charDesc}.

LAYOUT & COMPOSITION (One unified master model sheet / production bible grid):
1. TOP TITLE BLOCK: "${formData.creatorName || "Lead Host"}" - Production Model Bible, Style: ${genre}, Core Aesthetic Guidelines.
2. FULL-BODY TURNAROUND MODEL ROW: 4 distinct full-body views (Full Front Standing Pose, 3/4 Dynamic Angle, Side Profile, and Back View) in matching signature wardrobe (${wardrobe}) under neutral key studio lighting.
3. EXPRESSION PALETTE GRID: 4 to 6 facial emotion crops (${personality}: Confident, Explaining/Directing, Warm/Smiling, Inquisitive/Thoughtful, Intense Hook).
4. COLOR SWATCH PALETTE STRIP: Swatches of skin tone (${skin}), primary wardrobe tone (${wardrobe}), accent trim, and lighting rim colors.
5. WARDROBE & ACCESSORY VIGNETTES: Texture details, signature accessories, and clean studio backdrop.

Hyper-consistent master reference bible, razor-sharp focus, uniform art direction, 8k resolution production sheet.`;

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
        setPortraitError("Could not render character sheet image. You can continue with configured attributes.");
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
          setPlatformConnectError(`Client credentials for ${platform} are not configured on this environment. You can skip for now.`);
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
    onComplete(formData);
  };

  const connectedAccountsList = Object.keys(formData.connectedAccounts || {}).filter(
    (k) => formData.connectedAccounts?.[k]?.connected
  );

  const stepTitles = [
    "Identity & Brand",
    "Content Domain & Niche",
    "Host Character Design Bible",
    "Narrator Voice & Audio Cadence",
    "Research & Viral Sparks Feeds",
    "Publishing Distribution",
    "Production Depth & Autonomy",
    "Ready & Launch",
  ];

  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#0B0F17] flex flex-col justify-between overflow-hidden sm:relative sm:min-h-screen sm:p-6 sm:items-center sm:justify-center select-none">
      {/* Background ambient light */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[300px] bg-purple-600/15 rounded-full blur-[140px]" />
        <div className="w-[350px] h-[200px] bg-cyan-500/10 rounded-full blur-[120px] -translate-y-12" />
      </div>

      {/* Header Container */}
      <header className="w-full max-w-2xl px-4 pt-4 sm:pt-0 sm:px-0 mb-2 sm:mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <SparkLogo className="w-5 h-5" variant="superspark" />
          <div>
            <span className="font-bold text-xs sm:text-sm tracking-wider text-foreground uppercase block">
              SPARK Genesis
            </span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-mono">
              {currentStep <= 7 ? `Phase ${currentStep} of 7 • ${stepTitles[currentStep - 1]}` : "Calibration Complete"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
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
                  <strong className="text-purple-300">Executive Identity:</strong> Define the creator behind the brand and the primary media channel name.
                </p>
              )}
              {currentStep === 2 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Content Domain:</strong> Choose the core subject area SPARK will research, optimize, and generate stories around.
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
                  <strong className="text-purple-300">Inspiration Feeds:</strong> Add benchmark channels or creator links to immediately seed high-velocity Viral Sparks.
                </p>
              )}
              {currentStep === 6 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Distribution Channels:</strong> Authorize social pipelines for automated multi-channel publishing.
                </p>
              )}
              {currentStep === 7 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">Operating System:</strong> Configure default production pipeline depth and autonomous review governance.
                </p>
              )}
              {currentStep === 8 && (
                <p className="text-foreground">
                  <strong className="text-purple-300">SPARK Calibrated:</strong> All core media engines verified. Enter your executive dashboard to begin production.
                </p>
              )}
            </div>
          </div>

          {/* STEP 1: Creator & Brand Name */}
          {currentStep === 1 && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Brand / Studio Name</label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    placeholder="e.g. ElOgiso Media"
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Brand Vision / Core Objective</label>
                <input
                  type="text"
                  value={formData.vision}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                  placeholder="e.g. Autonomous AI media company scaling high-retention cinematic shorts"
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Content Niche */}
          {currentStep === 2 && (
            <div className="space-y-3 pt-1">
              <label className="text-xs font-semibold text-foreground">Select Primary Content Niche</label>
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

              <div className="pt-2 space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Or custom domain niche:</label>
                <input
                  type="text"
                  value={customNicheInput}
                  onChange={(e) => {
                    setCustomNicheInput(e.target.value);
                    setFormData({ ...formData, niche: e.target.value });
                  }}
                  placeholder="e.g. Deeptech Robotics, Autonomous Systems..."
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
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

              {/* Wardrobe & Personality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Signature Wardrobe</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WARDROBE_OPTIONS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setFormData({ ...formData, wardrobe: w })}
                        className={`px-2 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
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

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Host Personality</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PERSONALITY_OPTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, personality: p })}
                        className={`px-2 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
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
              </div>

              {/* Director Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Director Notes / Host Concept</label>
                <input
                  type="text"
                  value={formData.characterDescription || ""}
                  onChange={(e) => setFormData({ ...formData, characterDescription: e.target.value })}
                  placeholder="e.g. Sharp executive leader in dark high-contrast studio setting..."
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Reference Bible Model Sheet Preview Card */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-purple-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                    Host Model Sheet Reference Bible
                  </span>
                  <label className="text-[11px] text-purple-300 hover:underline cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleCharacterSheetUpload} className="hidden" />
                  </label>
                </div>

                {formData.characterSheetUrl || formData.characterImageUrl ? (
                  <div className="space-y-2">
                    <div
                      onClick={() => setLightboxOpen(true)}
                      className="w-full h-44 rounded-xl bg-black/70 border border-purple-500/40 flex items-center justify-center overflow-hidden relative cursor-pointer group"
                    >
                      <img
                        src={formData.characterSheetUrl || formData.characterImageUrl}
                        alt="Character Design Bible Sheet"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                        <Maximize2 className="w-4 h-4" />
                        <span>Tap to View Full Screen</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-purple-200 block">Character Model Sheet Locked</span>
                        <span className="text-[10px] text-muted-foreground">Multi-angle turnaround & identity palette ready.</span>
                      </div>
                      <button
                        type="button"
                        disabled={isGeneratingPortrait}
                        onClick={handleGeneratePortrait}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-purple-500/20 text-purple-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGeneratingPortrait ? "animate-spin" : ""}`} />
                        Regenerate Sheet
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Generate a full turnaround bible sheet with your locked attributes.</p>
                    <button
                      type="button"
                      disabled={isGeneratingPortrait}
                      onClick={handleGeneratePortrait}
                      className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingPortrait ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Rendering Bible...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          Generate Character Sheet
                        </>
                      )}
                    </button>
                  </div>
                )}

                {portraitError && (
                  <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">{portraitError}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Voice & Audio */}
          {currentStep === 4 && (
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    Narrator Voice Selection (ElevenLabs)
                  </label>
                  <span className="text-[10px] text-purple-300">
                    {isLiveVoices ? "ElevenLabs API Active" : "Curated Public Catalog"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto mb-3">
                  {voices.map((v) => {
                    const isSelected = formData.voiceId === v.voiceId;
                    const isPlaying = playingVoiceId === v.voiceId;

                    return (
                      <div
                        key={v.voiceId}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
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
                            <span className="text-xs font-bold text-foreground block truncate">{v.name}</span>
                          </div>
                          <span className="text-[10px] opacity-75 block truncate">{v.accent || v.description}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => playVoicePreview(v)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-purple-500/30 text-purple-300 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
                          title="Preview Voice Sample"
                        >
                          {isPlaying ? (
                            <Square className="w-3 h-3 text-cyan-300 fill-cyan-300 animate-pulse" />
                          ) : (
                            <Play className="w-3 h-3 fill-purple-300" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Voice Design */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-3 space-y-2">
                  <label className="text-xs font-bold text-foreground block">Or Design a Custom Voice Tone</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voiceDescription}
                      onChange={(e) => setVoiceDescription(e.target.value)}
                      placeholder="e.g. Deep charismatic African executive narrator with quiet confidence..."
                      className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      disabled={!voiceDescription.trim() || isDesigningVoice}
                      onClick={handleDesignVoice}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isDesigningVoice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      Design
                    </button>
                  </div>

                  {designedPreviews.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-purple-300 font-medium block">Generated Voice Options:</span>
                      {designedPreviews.map((prev, pIdx) => {
                        const isSelected = formData.voiceId === prev.generated_voice_id;
                        return (
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
                                className={`text-[10px] px-2.5 py-1 rounded-lg cursor-pointer font-semibold ${
                                  isSelected ? "bg-emerald-600 text-white" : "bg-purple-600 text-white hover:bg-purple-500"
                                }`}
                              >
                                {isSelected ? "Selected ✓" : "Use Voice"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {voiceDesignError && (
                    <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                      {voiceDesignError}
                    </p>
                  )}
                </div>
              </div>

              {/* Audio Energy */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-purple-400" />
                  Soundtrack Cadence & Audio Energy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "calm" as const, label: "Calm", desc: "Measured & reassuring authority" },
                    { id: "energetic" as const, label: "Energetic", desc: "High-impact viral pacing" },
                    { id: "bold" as const, label: "Bold", desc: "Cinematic depth & drive" },
                  ].map((ae) => (
                    <button
                      key={ae.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, audioEnergy: ae.id })}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        formData.audioEnergy === ae.id
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs font-bold block">{ae.label}</span>
                      <span className="text-[10px] opacity-70 block leading-tight mt-0.5">{ae.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Research Sources */}
          {currentStep === 5 && (
            <div className="space-y-3.5 pt-1">
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <Globe className="w-4 h-4 text-purple-400" />
                  Inspiration Accounts & Research Benchmarks
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Paste URLs of creator channels (YouTube, TikTok, Instagram) or leave empty. SPARK analyzes viral hooks automatically.
                </p>

                <div className="flex gap-2 mb-3">
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
                    placeholder="https://youtube.com/@channel or creator URL..."
                    className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddResearchSource}
                    disabled={!researchSourceInput.trim()}
                    className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                {seededSources.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {seededSources.map((srcUrl) => (
                      <div
                        key={srcUrl}
                        className="p-2.5 rounded-xl bg-white/5 border border-purple-500/30 flex items-center justify-between text-xs"
                      >
                        <span className="text-purple-200 truncate flex-1 pr-2">{srcUrl}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveResearchSource(srcUrl)}
                          className="p-1 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/70 italic p-3 bg-white/[0.02] rounded-xl border border-white/5">
                    No sources added yet. You can paste one now or manage inspiration sources anytime in MY SPARK.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Distribution Channels */}
          {currentStep === 6 && (
            <div className="space-y-3.5 pt-1">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Publishing Channels</label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select target channels. Connect accounts now for 1-click publishing or complete later in Accounts.
                </p>

                {platformConnectError && (
                  <p className="mb-3 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl leading-snug">
                    {platformConnectError}
                  </p>
                )}

                <div className="space-y-2">
                  {["YouTube Shorts", "Twitter/X", "TikTok", "Instagram Reels", "LinkedIn"].map((plat) => {
                    const isSelected = formData.platforms.includes(plat);
                    const conn = formData.connectedAccounts?.[plat];
                    const isConnecting = connectingPlatform === plat;
                    const isOAuthSupported = plat === "YouTube Shorts" || plat === "Twitter/X" || plat === "YouTube" || plat === "X";

                    return (
                      <div
                        key={plat}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-purple-600/20 border-purple-500/40"
                            : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => togglePlatform(plat)}>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${
                              isSelected ? "bg-purple-500 border-purple-400 text-white font-bold" : "border-white/30"
                            }`}
                          >
                            {isSelected && "✓"}
                          </div>
                          <span className="text-xs font-semibold text-foreground">{plat}</span>
                        </div>

                        <div>
                          {conn?.connected ? (
                            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {conn.handle} Connected
                            </span>
                          ) : isOAuthSupported ? (
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
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground/70 font-mono">
                              Connect later in Accounts
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Production & Autonomy */}
          {currentStep === 7 && (
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

          {/* STEP 8: Ready / Final Summary Review */}
          {currentStep === 8 && (
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
                      {seededSources.length > 0 ? `${seededSources.length} Seed Sources` : "Configured in MY SPARK"}
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
                  <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[10px] text-muted-foreground">○</div>
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
          {currentStep > 1 && currentStep < 8 ? (
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
                disabled={!formData.brandName.trim() || !formData.creatorName.trim()}
                onClick={() => setCurrentStep(2)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Niche →
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                disabled={!formData.niche.trim()}
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
                Continue to Voice & Audio →
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
                Continue to Research Sources →
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
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Production Modes →
              </Button>
            )}

            {currentStep === 7 && (
              <Button
                variant="accent"
                size="md"
                fullWidth
                onClick={() => setCurrentStep(8)}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Review & Launch →
              </Button>
            )}

            {currentStep === 8 && (
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
