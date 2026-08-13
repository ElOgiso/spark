import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SoftVerificationBanner } from "./SoftVerificationBanner";
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
  | "awakens"
  | "identity"
  | "niche"
  | "character"
  | "voice"
  | "audio"
  | "research-sources"
  | "publishing"
  | "production-mode"
  | "automation"
  | "initialization"
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
  const { initializeBrandGenesis, addChatMessage } = useSpark();

  const [step, setStep] = useState<FlowStep>("awakens");

  // Selection states
  const [creatorName, setCreatorName] = useState(() => auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || "");
  const [brandName, setBrandName] = useState("");
  const [niche, setNicheSelection] = useState("");
  const [customNiche, setCustomNiche] = useState("");

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
  const [voiceDescription, setVoiceDescription] = useState("");
  const [isDesigningVoice, setIsDesigningVoice] = useState(false);
  const [voiceDesignError, setVoiceDesignError] = useState<string | null>(null);
  const [designedPreviews, setDesignedPreviews] = useState<{ generated_voice_id: string; audio_base_64: string; previewUrl: string }[]>([]);
  const [audioEnergy, setAudioEnergy] = useState<"calm" | "energetic" | "bold">("energetic");

  // Research sources state
  const [researchSourceInput, setResearchSourceInput] = useState("");
  const [seededSources, setSeededSources] = useState<string[]>([]);

  // Accounts & Governance states
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(["YouTube Shorts", "Twitter/X"]);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [platformConnectError, setPlatformConnectError] = useState<string | null>(null);
  const [productionMode, setProductionModeSelection] = useState<"narrator" | "hybrid" | "cinematic">("hybrid");
  const [automationMode, setAutomationModeSelection] = useState<"manual" | "balanced" | "autonomous">("balanced");

  // Initialization progress
  const [initProgress, setInitProgress] = useState(0);

  // Load ElevenLabs voices on mount
  useEffect(() => {
    getElevenLabsVoices().then((res) => {
      setVoices(res.voices);
    });
  }, []);

  // Auto-advance from "awakens" step
  useEffect(() => {
    if (step === "awakens") {
      const timer = setTimeout(() => {
        setStep("identity");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Handle Identity
  const handleIdentitySubmit = () => {
    if (!creatorName.trim() || !brandName.trim()) return;
    setStep("niche");
  };

  // Handle Niche Selection
  const handleNicheChoice = (choice: string) => {
    const finalNiche = choice.trim();
    if (!finalNiche) return;
    setNicheSelection(finalNiche);
    setStep("character");
  };

  // Generate Character Reference Sheet Image
  const handleGeneratePortrait = async () => {
    setIsGeneratingPortrait(true);
    setPortraitError(null);

    const prompt = `Production Character Design Bible Reference Sheet for "${creatorName || "Lead Host"}" representing brand "${brandName || "SPARK"}", niche: "${niche || "Content"}".
Visual Style / Genre: ${genre}.
Skin Tone: ${skinTone}.
Hair Style: ${hairStyle}.
Signature Wardrobe: ${wardrobe}.
Personality & Emotion: ${personality}.
Director Notes & Persona: ${characterDescription || "Executive host in modern high-contrast studio setting"}.

LAYOUT & COMPOSITION (One unified master model sheet / production bible grid):
1. TOP TITLE BLOCK: "${creatorName || "Lead Host"}" - Production Model Bible, Style: ${genre}, Core Aesthetic Guidelines.
2. FULL-BODY TURNAROUND MODEL ROW: 4 distinct full-body views (Full Front Standing Pose, 3/4 Dynamic Angle, Side Profile, and Back View) in matching signature wardrobe (${wardrobe}) under neutral key studio lighting.
3. EXPRESSION PALETTE GRID: 4 to 6 facial emotion crops (${personality}: Confident, Explaining/Directing, Warm/Smiling, Inquisitive/Thoughtful, Intense Hook).
4. COLOR SWATCH PALETTE STRIP: Swatches of skin tone (${skinTone}), primary wardrobe tone (${wardrobe}), accent trim, and lighting rim colors.
5. WARDROBE & ACCESSORY VIGNETTES: Signature accessories, props matching niche, and clean studio background.

Hyper-consistent master reference bible, razor-sharp focus, uniform art direction, 8k resolution production sheet.`;

    try {
      const { ModelRouter } = await import("../../../services/runtime/modelRouter");
      const result = await ModelRouter.executeCategoryRequest("storyboardImages", { prompt });
      if (result && (result.startsWith("http") || result.startsWith("data:"))) {
        setCharacterSheetUrl(result);
      } else {
        setPortraitError("Could not generate sheet. You can continue with configured attributes.");
      }
    } catch (err: any) {
      console.warn("Character generation notice:", err);
      setPortraitError("Character generation timed out. You can retry or proceed.");
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  const handleCharacterPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEv) => {
        const dataUri = uploadEv.target?.result as string;
        setCharacterSheetUrl(dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  // Voice playback
  const handlePlayVoicePreview = async (v: ElevenLabsVoiceSummary) => {
    if (playingVoiceId === v.voiceId) {
      setPlayingVoiceId(null);
      return;
    }
    setPlayingVoiceId(v.voiceId);
    try {
      const audioUrl = await previewElevenLabsVoice(v.voiceId, "Welcome to SPARK. Let's produce high-retention video content.");
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
        await audio.play();
      } else {
        setPlayingVoiceId(null);
      }
    } catch {
      setPlayingVoiceId(null);
    }
  };

  // Voice choice
  const handleVoiceChoice = (v: ElevenLabsVoiceSummary) => {
    setSelectedVoiceId(v.voiceId);
    setSelectedVoiceName(v.name);
  };

  // Design custom voice
  const handleDesignVoice = async () => {
    if (!voiceDescription.trim() || isDesigningVoice) return;
    setIsDesigningVoice(true);
    setVoiceDesignError(null);
    try {
      const res = await designElevenLabsVoice({ description: voiceDescription });
      if (res?.previews?.length) {
        setDesignedPreviews(res.previews);
      } else {
        setVoiceDesignError("Voice design requires an active ElevenLabs API key. You can select any voice from our curated catalog.");
      }
    } catch {
      setVoiceDesignError("Voice design unavailable. Please select from our curated catalog.");
    } finally {
      setIsDesigningVoice(false);
    }
  };

  const handleSelectDesignedVoicePreview = async (prev: { generated_voice_id: string; previewUrl: string }) => {
    try {
      const res = await createDesignedElevenLabsVoice({
        voiceName: `${brandName || "Brand"} Narrator Voice`,
        voiceDescription: voiceDescription || "Custom AI voice",
        generatedVoiceId: prev.generated_voice_id,
      });
      const finalId = res?.voice_id || prev.generated_voice_id;
      setSelectedVoiceId(finalId);
      setSelectedVoiceName(`${brandName || "Custom"} Designed Voice`);
    } catch {
      setVoiceDesignError("Failed to save voice; selected as active preview.");
      setSelectedVoiceId(prev.generated_voice_id);
    }
  };

  // Handle Research Sources
  const handleAddResearchSource = () => {
    const raw = researchSourceInput.trim();
    if (!raw) return;
    if (!seededSources.includes(raw)) {
      setSeededSources([...seededSources, raw]);
    }
    setResearchSourceInput("");
  };

  const handleRemoveResearchSource = (url: string) => {
    setSeededSources(seededSources.filter((s) => s !== url));
  };

  // Handle Connect Platform
  const handleConnectPlatform = (platform: string) => {
    const isOAuthSupported = platform === "YouTube Shorts" || platform === "Twitter/X";
    if (!isOAuthSupported) {
      setPlatformConnectError(`${platform} can be connected later in the Accounts center.`);
      return;
    }

    setConnectingPlatform(platform);
    setPlatformConnectError(null);

    const timeoutTimer = setTimeout(() => {
      setConnectingPlatform(null);
      setPlatformConnectError("Connection didn't complete. Try again or skip.");
    }, 10000);

    socialConnectorFramework
      .loadClientConfig()
      .then(() => {
        const url = getOAuthAuthorizationUrl(platform);
        if (url && url !== "#") {
          window.location.href = url;
        } else {
          clearTimeout(timeoutTimer);
          setPlatformConnectError(`Client credentials for ${platform} are not configured. You can skip for now.`);
          setConnectingPlatform(null);
        }
      })
      .catch(() => {
        clearTimeout(timeoutTimer);
        setPlatformConnectError("Connection didn't complete. Try again or skip.");
        setConnectingPlatform(null);
      });
  };

  const toggleAccount = (acc: string) => {
    setSelectedAccounts((prev) => (prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]));
  };

  // Handle Production Mode Choice
  const handleProductionChoice = (mode: "narrator" | "hybrid" | "cinematic") => {
    setProductionModeSelection(mode);
    setStep("automation");
  };

  // Handle Automation Choice -> Start Calibration
  const handleAutomationChoice = (mode: "manual" | "balanced" | "autonomous") => {
    setAutomationModeSelection(mode);
    setStep("initialization");
    startInitialization();
  };

  // Progress Bar for Calibration
  const startInitialization = () => {
    let current = 0;
    const interval = setInterval(() => {
      current += 25;
      setInitProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setStep("ready");
        }, 500);
      }
    }, 450);
  };

  // Final Dashboard Entry
  const handleFinalCompletion = () => {
    const genesisData: BrandGenesisData = {
      brandName: brandName || "SPARK Brand",
      creatorName: creatorName || "Creator",
      niche: niche || "AI & Technology",
      audience: "Creators, Tech Founders & Modern Media Operators",
      goal: "Viral Reach & Growth",
      platforms: selectedAccounts,
      tone: "Energetic & Relatable",
      vision: "Autonomous AI media company scaling high-retention cinematic shorts",
      visualStyle: genre === "Anime" ? "Anime / Stylized Studio" : genre === "3D" ? "Cinematic 3D" : "Realistic / Live-Action",
      productionMode: productionMode,
      automationMode: automationMode,
      reviewRequired: automationMode !== "autonomous",
      characterChoice: "describe",
      characterDescription: characterDescription,
      characterSheetUrl: characterSheetUrl,
      characterImageUrl: characterSheetUrl,
      genre: genre,
      skinTone: skinTone,
      hairStyle: hairStyle,
      wardrobe: wardrobe,
      personality: personality,
      voiceProfile: {
        id: selectedVoiceId,
        name: selectedVoiceName,
        accent: "Executive",
        language: "English",
        duration: "Sample",
        sampleText: "Voice profile sample",
      },
      voiceId: selectedVoiceId,
      audioEnergy: audioEnergy,
      researchSources: seededSources,
    };

    initializeBrandGenesis(genesisData);
    void auth.markOnboardingComplete();
    onComplete(genesisData);
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#0B0F17] text-foreground flex flex-col justify-between relative z-50 overflow-hidden select-none antialiased">
      {/* Background Soft Mesh Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Top Header Bar */}
      <header className="px-4 py-3 border-b border-white/10 bg-[#0B0F17]/80 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <SparkLogo className="w-4 h-4" variant="superspark" />
          <span className="text-xs font-bold tracking-wider uppercase text-foreground">SPARK Genesis</span>
        </div>

        {step !== "awakens" && step !== "initialization" && step !== "ready" && (
          <button
            type="button"
            onClick={handleFinalCompletion}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center space-x-1 p-1 cursor-pointer"
          >
            <span>Skip</span>
            <SkipForward className="w-3 h-3" />
          </button>
        )}
      </header>

      {/* Soft Verification Prompt */}
      {step === "awakens" && (
        <div className="px-4 pt-2 flex-shrink-0">
          <SoftVerificationBanner />
        </div>
      )}

      {/* Scrollable Middle Container */}
      <main className="flex-1 overflow-y-auto px-4 py-3 max-w-sm mx-auto w-full z-10 space-y-4">
        <AnimatePresence mode="wait">
          {/* SCREEN 1: Spark Awakens */}
          {step === "awakens" && (
            <motion.div
              key="awakens"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="space-y-6 text-center pt-8"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 mx-auto flex items-center justify-center text-white shadow-lg shadow-purple-900/40">
                <SparkLogo className="w-8 h-8" variant="superspark" />
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">SPARK Media OS</h1>
                <p className="text-xs text-muted-foreground leading-relaxed px-2">
                  Executive Creative Director initialized. Let's calibrate your autonomous media workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep("identity")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Initialize Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* SCREEN 2: Identity Setup */}
          {step === "identity" && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Identity:</strong> Enter your creator persona and brand channel name.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">Your Name / Creator Persona</label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="e.g. Maurice Otabor"
                    className="w-full p-3 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">Brand or Channel Name</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. ElOgiso Media"
                    className="w-full p-3 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!creatorName.trim() || !brandName.trim()}
                onClick={handleIdentitySubmit}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Continue to Niche</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* SCREEN 3: Content Niche */}
          {step === "niche" && (
            <motion.div
              key="niche"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Content Domain:</strong> Select the primary focus of your media channel.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {["AI & Technology", "Business & Startups", "Creator Economy", "Personal Finance", "Lifestyle & Culture", "Art & Design"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleNicheChoice(item)}
                    className="p-3 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-foreground block">{item}</span>
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <input
                  type="text"
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  placeholder="Or type custom niche..."
                  className="w-full p-3 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                />
              </div>

              {customNiche.trim() && (
                <button
                  type="button"
                  onClick={() => handleNicheChoice(customNiche)}
                  className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Confirm "{customNiche}" →</span>
                </button>
              )}
            </motion.div>
          )}

          {/* SCREEN 4: Character & Visual Look */}
          {step === "character" && (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3.5"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Character Bible:</strong> Lock genre, appearance, wardrobe, and personality attributes.
                </p>
              </div>

              {/* Genre Chips */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground block">Visual Genre</label>
                <div className="flex flex-wrap gap-1">
                  {GENRE_OPTIONS.slice(0, 6).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                        genre === g
                          ? "bg-purple-600/40 border-purple-400 text-purple-200"
                          : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone & Wardrobe */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground block">Skin Tone</label>
                  <select
                    value={skinTone}
                    onChange={(e) => setSkinTone(e.target.value)}
                    className="w-full p-2 rounded-lg bg-card border border-border text-xs text-foreground"
                  >
                    {SKIN_TONE_OPTIONS.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground block">Personality</label>
                  <select
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    className="w-full p-2 rounded-lg bg-card border border-border text-xs text-foreground"
                  >
                    {PERSONALITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Wardrobe */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground block">Signature Wardrobe</label>
                <select
                  value={wardrobe}
                  onChange={(e) => setWardrobe(e.target.value)}
                  className="w-full p-2 rounded-lg bg-card border border-border text-xs text-foreground"
                >
                  {WARDROBE_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              {/* Character Sheet Generation Preview Card */}
              <div className="p-3 rounded-xl bg-card border border-border">
                {characterSheetUrl ? (
                  <div className="space-y-2">
                    <div
                      onClick={() => setLightboxOpen(true)}
                      className="w-full h-36 rounded-lg bg-black/60 border border-purple-400/40 flex items-center justify-center overflow-hidden relative cursor-pointer group"
                    >
                      <img
                        src={characterSheetUrl}
                        alt="Character Reference Bible Sheet"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-semibold">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Tap for Full Screen</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-purple-200 block">Reference Sheet Ready</span>
                        <span className="text-[10px] text-muted-foreground">Multi-angle turnaround locked.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleGeneratePortrait}
                        disabled={isGeneratingPortrait}
                        className="px-2 py-1 rounded-lg bg-white/5 text-purple-300 hover:bg-purple-500/20 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGeneratingPortrait ? "animate-spin" : ""}`} />
                        Regenerate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Generate model bible sheet</span>
                    <button
                      type="button"
                      onClick={handleGeneratePortrait}
                      disabled={isGeneratingPortrait}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingPortrait ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      Generate
                    </button>
                  </div>
                )}
              </div>

              {portraitError && (
                <p className="text-[10px] text-amber-400">{portraitError}</p>
              )}

              <label className="text-[11px] text-purple-300 hover:underline cursor-pointer flex items-center justify-center gap-1.5 p-2 rounded-xl bg-card border border-border">
                <Upload className="w-3.5 h-3.5" />
                <span>{characterSheetUrl ? "Change Reference Image" : "Upload Reference Image Instead"}</span>
                <input type="file" accept="image/*" onChange={handleCharacterPhotoUpload} className="hidden" />
              </label>

              <button
                type="button"
                onClick={() => setStep("voice")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Continue to Narrator Voice →</span>
              </button>
            </motion.div>
          )}

          {/* SCREEN 5: Voice Selection */}
          {step === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3.5"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Narrator Voice:</strong> Choose an ElevenLabs voice for video production.
                </p>
              </div>

              <div className="space-y-2 pt-1 max-h-48 overflow-y-auto">
                {voices.slice(0, 5).map((v) => {
                  const isSel = selectedVoiceId === v.voiceId;
                  const isPlaying = playingVoiceId === v.voiceId;

                  return (
                    <div
                      key={v.voiceId}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        isSel
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      <div className="flex-1 cursor-pointer" onClick={() => handleVoiceChoice(v)}>
                        <div className="flex items-center gap-1.5">
                          {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                          <span className="text-xs font-bold text-foreground block">{v.name}</span>
                        </div>
                        <span className="text-[10px] opacity-75 block truncate">{v.accent || v.description}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePlayVoicePreview(v)}
                        className="p-1.5 rounded-lg bg-white/10 text-purple-300 flex items-center justify-center cursor-pointer"
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

              {/* Describe Custom Voice */}
              <div className="p-2.5 rounded-xl bg-card border border-border space-y-2">
                <span className="text-[11px] font-bold text-foreground block">Or Design a Custom Voice</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={voiceDescription}
                    onChange={(e) => setVoiceDescription(e.target.value)}
                    placeholder="e.g. Deep confident founder voice..."
                    className="flex-1 p-2 rounded-lg bg-black/40 border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleDesignVoice}
                    disabled={!voiceDescription.trim() || isDesigningVoice}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {isDesigningVoice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Design
                  </button>
                </div>

                {voiceDesignError && (
                  <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg leading-snug">
                    {voiceDesignError}
                  </p>
                )}

                {designedPreviews.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-purple-300 font-medium block">Voice Previews:</span>
                    {designedPreviews.map((prev, pIdx) => (
                      <div key={prev.generated_voice_id} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[11px] text-muted-foreground font-mono">Sample {pIdx + 1}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const audio = new Audio(prev.previewUrl);
                              audio.play();
                            }}
                            className="p-1 rounded bg-white/10 text-purple-300 hover:bg-purple-500/20 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectDesignedVoicePreview(prev)}
                            className={`text-[10px] px-2 py-1 rounded font-semibold cursor-pointer ${
                              selectedVoiceId === prev.generated_voice_id
                                ? "bg-emerald-600 text-white"
                                : "bg-purple-600 text-white hover:bg-purple-500"
                            }`}
                          >
                            {selectedVoiceId === prev.generated_voice_id ? "Selected ✓" : "Use Voice"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep("audio")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Continue to Audio Energy →</span>
              </button>
            </motion.div>
          )}

          {/* SCREEN 6: Audio Energy */}
          {step === "audio" && (
            <motion.div
              key="audio"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Audio Cadence:</strong> Select your preferred soundtrack rhythm.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {[
                  { id: "calm" as const, title: "Calm & Focused", desc: "Ambient textures and measured tones." },
                  { id: "energetic" as const, title: "High-Energy Modern", desc: "Upbeat electronic beats and rhythmic drive." },
                  { id: "bold" as const, title: "Bold & Dramatic", desc: "Orchestral hybrid and deep sub-bass." },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAudioEnergy(item.id);
                      setStep("research-sources");
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                      audioEnergy === item.id ? "bg-purple-600/30 border-purple-400 text-purple-200" : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    <span className="text-xs font-semibold text-foreground block">{item.title}</span>
                    <span className="text-[11px] opacity-75 block pt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 7: Research Sources */}
          {step === "research-sources" && (
            <motion.div
              key="research-sources"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Inspiration Feeds:</strong> Seed benchmark channels for viral spark intelligence.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={researchSourceInput}
                    onChange={(e) => setResearchSourceInput(e.target.value)}
                    placeholder="https://youtube.com/@channel or creator URL"
                    className="flex-1 p-2.5 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddResearchSource}
                    disabled={!researchSourceInput.trim()}
                    className="px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                {seededSources.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {seededSources.map((url) => (
                      <div key={url} className="p-2 rounded-lg bg-card border border-border flex items-center justify-between text-[11px]">
                        <span className="text-foreground truncate flex-1 pr-2">{url}</span>
                        <button type="button" onClick={() => handleRemoveResearchSource(url)} className="text-muted-foreground hover:text-red-400 p-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic p-2 rounded-lg bg-white/[0.02]">
                    Optional — you can add research feeds later in MY SPARK.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep("publishing")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Continue to Distribution →</span>
              </button>
            </motion.div>
          )}

          {/* SCREEN 8: Publishing Channels */}
          {step === "publishing" && (
            <motion.div
              key="publishing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3.5"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Distribution:</strong> Authorize publishing channels for automated distribution.
                </p>
              </div>

              {platformConnectError && (
                <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                  {platformConnectError}
                </p>
              )}

              <div className="space-y-2 pt-1">
                {["YouTube Shorts", "Twitter/X", "TikTok", "Instagram Reels", "LinkedIn"].map((platform) => {
                  const isSel = selectedAccounts.includes(platform);
                  const isOAuthSupported = platform === "YouTube Shorts" || platform === "Twitter/X";
                  const isConnecting = connectingPlatform === platform;

                  return (
                    <div
                      key={platform}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        isSel ? "bg-card border-purple-500/40" : "bg-card/50 border-border"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => toggleAccount(platform)}>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            isSel ? "bg-purple-600 border-purple-500 text-white font-bold" : "border-muted-foreground/40"
                          }`}
                        >
                          {isSel && "✓"}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{platform}</span>
                      </div>

                      {isOAuthSupported ? (
                        <button
                          type="button"
                          disabled={isConnecting}
                          onClick={() => handleConnectPlatform(platform)}
                          className="text-[10px] px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-500/40 text-cyan-200 font-semibold flex items-center gap-1 cursor-pointer"
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
                          Connect in Accounts
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setStep("production-mode")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Continue to Production Mode →</span>
              </button>
            </motion.div>
          )}

          {/* SCREEN 9: Production Mode */}
          {step === "production-mode" && (
            <motion.div
              key="production-mode"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Production Engine:</strong> Select default video generation pipeline depth.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { id: "narrator" as const, title: "Narrator Pipeline", desc: "Images + voice narration + dynamic captions." },
                  { id: "hybrid" as const, title: "Hybrid Engine", desc: "AI video hook + multi-layer narrator sequence." },
                  { id: "cinematic" as const, title: "Cinematic Mode", desc: "Multi-scene video generation + master audio." },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleProductionChoice(mode.id)}
                    className="w-full p-3.5 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-foreground">{mode.title}</p>
                    <p className="text-[11px] text-muted-foreground pt-0.5 leading-relaxed">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 10: Automation Settings */}
          {step === "automation" && (
            <motion.div
              key="automation"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25">
                <p className="text-xs text-foreground">
                  <strong className="text-purple-300">Governance:</strong> Select your autonomy and review level.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { id: "manual" as const, title: "Manual", desc: "All decisions require your sign-off." },
                  { id: "balanced" as const, title: "Balanced", desc: "AI synthesizes; you approve final releases." },
                  { id: "autonomous" as const, title: "Autonomous", desc: "AI operates independently across all loops." },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleAutomationChoice(mode.id)}
                    className="w-full p-3.5 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-foreground">{mode.title}</p>
                    <p className="text-[11px] text-muted-foreground pt-0.5 leading-relaxed">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 11: Calibration Progress */}
          {step === "initialization" && (
            <motion.div
              key="initialization"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="space-y-6 text-center pt-8"
            >
              <div className="space-y-2">
                <h3 className="text-base font-bold text-foreground">Calibrating Creative OS...</h3>
                <p className="text-xs text-muted-foreground">Initializing Executive Director, Brand Memory & Pipelines</p>
              </div>

              <div className="bg-card border border-border p-4 rounded-2xl space-y-2 w-full text-left text-xs">
                {[
                  { name: "Brand & Character Bible", done: initProgress >= 25 },
                  { name: "Production Pipeline", done: initProgress >= 50 },
                  { name: "Publishing Channels", done: initProgress >= 75 },
                  { name: "Executive Calibration", done: initProgress >= 100 },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className={item.done ? "text-foreground font-medium" : "text-muted-foreground/60"}>
                      {item.name}
                    </span>
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-purple-500/40 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>

              <div className="w-full space-y-1.5">
                <div className="h-1.5 w-full bg-card rounded-full overflow-hidden border border-border">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-emerald-400"
                    style={{ width: `${initProgress}%` }}
                  />
                </div>
                <p className="text-[11px] font-mono text-muted-foreground">{initProgress}% Calibrated</p>
              </div>
            </motion.div>
          )}

          {/* SCREEN 12: Ready (Compact Summary Cards) */}
          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2.5 pb-1">
                <SparkLogo className="w-5 h-5" variant="superspark" />
                <div className="text-left">
                  <h2 className="text-sm font-bold text-foreground">Your SPARK is Ready</h2>
                  <p className="text-[11px] text-muted-foreground">All systems calibrated and verified.</p>
                </div>
              </div>

              {/* Compact 2-Line Summary Cards */}
              <div className="space-y-2 text-xs text-left">
                <div className="bg-card border border-border p-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-foreground font-semibold block truncate">{brandName || "Brand"}</span>
                    <span className="text-[11px] text-muted-foreground block truncate">{niche || "Content"}</span>
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
                      <span className="text-[11px] text-muted-foreground block truncate">{seededSources.length} Seeded</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* STICKY FOOTER ON READY STEP — Always on screen, never below the fold */}
      {step === "ready" && (
        <footer className="p-4 bg-[#0B0F17]/95 backdrop-blur-md border-t border-white/10 z-20 pb-safe flex-shrink-0">
          <button
            type="button"
            onClick={handleFinalCompletion}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-sm flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Enter SPARK Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </footer>
      )}

      {/* Fullscreen Character Sheet Lightbox Modal */}
      <CharacterSheetLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={characterSheetUrl}
        characterName={creatorName || "Lead Host"}
        brandName={brandName || "SPARK"}
        metadata={{
          genre: genre,
          personality: personality,
          wardrobe: wardrobe,
          skinTone: skinTone,
          hairStyle: hairStyle,
        }}
      />
    </div>
  );
}
