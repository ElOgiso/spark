import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SparkGuide, type SparkGuideState } from "./SparkGuide";
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
} from "lucide-react";
import type { BrandGenesisData, VoiceProfile } from "../../onboarding/OnboardingWizard";
import { SparkLogo } from "../../SparkLogo";
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
  onComplete: () => void;
};

export function MobileConversationalFlow({ onComplete }: MobileConversationalFlowProps) {
  const auth = useAuth();
  const { initializeBrandGenesis, addChatMessage } = useSpark();

  const [step, setStep] = useState<FlowStep>("awakens");
  const [guideState, setGuideState] = useState<SparkGuideState>("speaking");

  // Selection states
  const [creatorName, setCreatorName] = useState(() => auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || "");
  const [brandName, setBrandName] = useState("");
  const [niche, setNicheSelection] = useState("");
  const [customNiche, setCustomNiche] = useState("");

  // Character states
  const [characterDescription, setCharacterDescription] = useState("Executive AI presenter with sharp focus and modern framing");
  const [characterSheetUrl, setCharacterSheetUrl] = useState<string | undefined>(undefined);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [visualStyle, setVisualStyle] = useState<"Realistic / Live-Action" | "Cinematic 3D" | "Anime / Stylized Studio">("Realistic / Live-Action");

  // Voice states
  const [voices, setVoices] = useState<ElevenLabsVoiceSummary[]>(FALLBACK_CURATED_ELEVENLABS_VOICES);
  const [selectedVoiceId, setSelectedVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [selectedVoiceName, setSelectedVoiceName] = useState("Rachel (Calm & Professional)");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceDescription, setVoiceDescription] = useState("");
  const [isDesigningVoice, setIsDesigningVoice] = useState(false);
  const [audioEnergy, setAudioEnergy] = useState<"calm" | "energetic" | "bold">("energetic");

  // Research sources state
  const [researchSourceInput, setResearchSourceInput] = useState("");
  const [seededSources, setSeededSources] = useState<string[]>([]);

  // Accounts & Governance states
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
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
    addChatMessage({ sender: "user", text: `Creator: ${creatorName}, Brand: ${brandName}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Great to meet you, ${creatorName}. Let's configure ${brandName}.`, timestamp: new Date() });
    setStep("niche");
  };

  // Handle Niche Selection
  const handleNicheChoice = (choice: string) => {
    const finalNiche = choice.trim();
    if (!finalNiche) return;
    setNicheSelection(finalNiche);
    addChatMessage({ sender: "user", text: `Niche: ${finalNiche}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Perfect. I'll build around your ${finalNiche} niche.`, timestamp: new Date() });
    setStep("character");
  };

  // Generate Character Portrait
  const handleGeneratePortrait = async () => {
    setIsGeneratingPortrait(true);
    const prompt = `Professional 9:16 vertical character sheet portrait of ${creatorName || "lead host"} for brand "${brandName || "SPARK"}". Presentation aesthetic: ${visualStyle}. Character traits: ${characterDescription}. Crisp studio lighting, high resolution production reference.`;

    try {
      const { ModelRouter } = await import("../../../services/runtime/modelRouter");
      const resultImg = await ModelRouter.executeCategoryRequest("storyboardImages", { prompt });
      if (resultImg && (resultImg.startsWith("data:") || resultImg.startsWith("http"))) {
        setCharacterSheetUrl(resultImg);
      }
    } catch (err) {
      console.warn("Mobile portrait generation notice:", err);
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  const handleCharacterPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEv) => {
      const dataUri = uploadEv.target?.result as string;
      setCharacterSheetUrl(dataUri);
    };
    reader.readAsDataURL(file);
  };

  // Confirm Character
  const handleConfirmCharacter = () => {
    addChatMessage({ sender: "user", text: `Character: ${characterDescription} (${visualStyle})`, timestamp: new Date() });
    addChatMessage({
      sender: "spark",
      text: `Host character configured (${visualStyle}). Let's select your brand voice.`,
      timestamp: new Date(),
    });
    setStep("voice");
  };

  // Voice Preview
  const handlePlayVoicePreview = async (v: ElevenLabsVoiceSummary) => {
    if (playingVoiceId === v.voiceId) {
      setPlayingVoiceId(null);
      return;
    }
    setPlayingVoiceId(v.voiceId);
    try {
      const url = await previewElevenLabsVoice(v.voiceId);
      if (url) {
        const audio = new Audio(url);
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

  // Design Voice from text
  const handleDesignVoice = async () => {
    if (!voiceDescription.trim() || isDesigningVoice) return;
    setIsDesigningVoice(true);
    try {
      const res = await designElevenLabsVoice({ description: voiceDescription });
      if (res?.previews?.[0]) {
        const topPrev = res.previews[0];
        const created = await createDesignedElevenLabsVoice({
          voiceName: `${brandName || "Brand"} Voice`,
          voiceDescription: voiceDescription,
          generatedVoiceId: topPrev.generated_voice_id,
        });
        const vId = created?.voice_id || topPrev.generated_voice_id;
        setSelectedVoiceId(vId);
        setSelectedVoiceName(`${brandName || "Custom"} Designed Voice`);
      }
    } catch (err) {
      console.warn("Mobile voice design notice:", err);
    } finally {
      setIsDesigningVoice(false);
    }
  };

  const handleVoiceChoice = (v: ElevenLabsVoiceSummary) => {
    setSelectedVoiceId(v.voiceId);
    setSelectedVoiceName(v.name);
    addChatMessage({ sender: "user", text: `Voice: ${v.name}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Configured narrator voice as ${v.name}.`, timestamp: new Date() });
    setStep("audio");
  };

  // Handle Audio Energy
  const handleAudioChoice = (energy: "calm" | "energetic" | "bold") => {
    setAudioEnergy(energy);
    addChatMessage({ sender: "user", text: `Audio energy: ${energy}`, timestamp: new Date() });
    setStep("research-sources");
  };

  // Add Research Source
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

  const handleConfirmResearchSources = () => {
    addChatMessage({
      sender: "user",
      text: `Research Sources: ${seededSources.length > 0 ? `${seededSources.length} added` : "Deferred"}`,
      timestamp: new Date(),
    });
    setStep("publishing");
  };

  // Toggle Social Account
  const toggleAccount = (acc: string) => {
    setSelectedAccounts((prev: string[]) =>
      prev.includes(acc) ? prev.filter((a: string) => a !== acc) : [...prev, acc]
    );
  };

  // Handle Production Mode
  const handleProductionModeChoice = (mode: "narrator" | "hybrid" | "cinematic") => {
    setProductionModeSelection(mode);
    addChatMessage({ sender: "user", text: `Production mode: ${mode}`, timestamp: new Date() });
    setStep("automation");
  };

  // Handle Automation Choice
  const handleAutomationChoice = (mode: "manual" | "balanced" | "autonomous") => {
    setAutomationModeSelection(mode);
    addChatMessage({ sender: "user", text: `Automation mode: ${mode}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Operating autonomy configured as ${mode}. Calibrating SPARK...`, timestamp: new Date() });
    setStep("initialization");
    setGuideState("thinking");
  };

  // Calibration Progress
  useEffect(() => {
    if (step === "initialization") {
      const interval = setInterval(() => {
        setInitProgress((prev: number) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setStep("ready");
              setGuideState("speaking");
            }, 800);
            return 100;
          }
          return prev + 15;
        });
      }, 250);
      return () => clearInterval(interval);
    }
  }, [step]);

  // Complete Genesis
  const handleFinalCompletion = () => {
    const genesisData: BrandGenesisData = {
      brandName: brandName || "My Brand",
      creatorName: creatorName || "Creator",
      niche: niche || "Content Creation",
      audience: "General Audience",
      goal: "Growth & Authority",
      platforms: selectedAccounts,
      tone: "Energetic & Relatable",
      vision: "",
      visualStyle: visualStyle,
      productionMode: productionMode,
      automationMode: automationMode,
      reviewRequired: true,
      characterChoice: "describe",
      characterDescription: characterDescription,
      characterSheetUrl: characterSheetUrl,
      characterImageUrl: characterSheetUrl,
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
    auth.markOnboardingComplete();
    onComplete();
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-background text-foreground flex flex-col justify-between relative z-50 overflow-y-auto select-none antialiased">
      {/* Background Soft Mesh Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Top Banner Navigation */}
      <div className="p-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <SparkLogo className="w-3.5 h-3.5" variant="superspark" />
          </div>
          <span className="text-xs font-bold tracking-wider uppercase text-foreground">SPARK Genesis</span>
        </div>

        {step !== "awakens" && step !== "initialization" && step !== "ready" && (
          <button
            type="button"
            onClick={handleFinalCompletion}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center space-x-1 p-1"
          >
            <span>Skip</span>
            <SkipForward className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Soft Verification Prompt */}
      {step === "awakens" && (
        <div className="px-4 pb-2">
          <SoftVerificationBanner />
        </div>
      )}

      {/* Dynamic Conversational Content Area */}
      <div className="flex-1 flex flex-col justify-center px-4 max-w-sm mx-auto w-full z-10 py-4">
        <AnimatePresence mode="wait">
          {/* SCREEN 1: Spark Awakens */}
          {step === "awakens" && (
            <motion.div
              key="awakens"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="space-y-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 mx-auto flex items-center justify-center text-white shadow-lg shadow-purple-900/40">
                <SparkLogo className="w-8 h-8" variant="superspark" />
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">SPARK Media OS</h1>
                <p className="text-xs text-muted-foreground leading-relaxed px-4">
                  I am Super Spark, your Executive Creative Director. Let's calibrate your autonomous media company.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep("identity")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-2"
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
              className="space-y-5"
            >
              <SparkGuide
                state={guideState}
                message="What should we name your brand and creator persona?"
                subtitle="This configures your brand identity across all media generation."
              />

              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Your Name / Creator Persona</label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="e.g. Maurice Otabor"
                    className="w-full p-3 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Brand or Channel Name</label>
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
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-2"
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
              className="space-y-5"
            >
              <SparkGuide
                state="speaking"
                message="What content niche will you focus on?"
                subtitle="Select a suggested niche or enter your custom domain."
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                {["AI & Technology", "Business & Startups", "Creator Economy", "Personal Finance", "Lifestyle & Culture", "Art & Design"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleNicheChoice(item)}
                    className="p-3 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98]"
                  >
                    <span className="text-xs font-semibold text-foreground block">{item}</span>
                  </button>
                ))}
              </div>

              <div className="pt-2">
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
                  className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all flex items-center justify-center space-x-2"
                >
                  <span>Confirm "{customNiche}" →</span>
                </button>
              )}
            </motion.div>
          )}

          {/* SCREEN 4: Character & Visual Look (PART B: Portrait Generation) */}
          {step === "character" && (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <SparkGuide
                state="speaking"
                message="Host Character & Visual Style"
                subtitle="Generate a character portrait or upload a reference."
              />

              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Character Persona</label>
                  <input
                    type="text"
                    value={characterDescription}
                    onChange={(e) => setCharacterDescription(e.target.value)}
                    placeholder="e.g. Modern executive presenter with crisp lighting..."
                    className="w-full p-2.5 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(["Realistic / Live-Action", "Cinematic 3D", "Anime / Stylized Studio"] as const).map((vs) => (
                    <button
                      key={vs}
                      type="button"
                      onClick={() => setVisualStyle(vs)}
                      className={`p-2 rounded-lg text-[10px] font-semibold border text-center transition-all ${
                        visualStyle === vs
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {vs.split(" ")[0]}
                    </button>
                  ))}
                </div>

                {/* Portrait Generation Preview Card */}
                <div className="p-3 rounded-xl bg-card border border-border">
                  {characterSheetUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={characterSheetUrl}
                        alt="Portrait"
                        className="w-12 h-12 rounded-lg object-cover border border-purple-400 shrink-0"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-purple-200 block">Character Portrait Ready</span>
                        <span className="text-[10px] text-muted-foreground">Will appear in MY SPARK.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleGeneratePortrait}
                        disabled={isGeneratingPortrait}
                        className="p-1.5 rounded-lg bg-white/5 text-purple-300 hover:bg-purple-500/20"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPortrait ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Generate portrait sheet</span>
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

                <label className="text-[11px] text-purple-300 hover:underline cursor-pointer flex items-center justify-center gap-1.5 p-2 rounded-xl bg-card border border-border">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{characterSheetUrl ? "Change Reference Image" : "Upload Reference Image Instead"}</span>
                  <input type="file" accept="image/*" onChange={handleCharacterPhotoUpload} className="hidden" />
                </label>
              </div>

              <button
                type="button"
                onClick={handleConfirmCharacter}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-2"
              >
                <span>Confirm Character →</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* SCREEN 5: Voice (PART C: ElevenLabs Live Voices & Design) */}
          {step === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <SparkGuide
                state="speaking"
                message="Brand Narrator Voice"
                subtitle="Select an ElevenLabs voice for video production."
              />

              <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
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
              </div>

              <button
                type="button"
                onClick={() => setStep("audio")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2"
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
              className="space-y-5"
            >
              <SparkGuide
                state="speaking"
                message="What soundtrack cadence fits your brand?"
                subtitle="SPARK synchronizes pacing to your audio energy."
              />

              <div className="space-y-2.5 pt-1">
                {[
                  { id: "calm" as const, label: "Calm & Measured", desc: "Reassuring, informative, thoughtful" },
                  { id: "energetic" as const, label: "Energetic & Fast", desc: "High-impact hooks and rapid pacing" },
                  { id: "bold" as const, label: "Bold & Cinematic", desc: "Deep bass, driving rhythm, authority" },
                ].map((ae) => (
                  <button
                    key={ae.id}
                    type="button"
                    onClick={() => handleAudioChoice(ae.id)}
                    className="w-full p-3.5 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98] flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">{ae.label}</p>
                      <p className="text-[11px] text-muted-foreground">{ae.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 7: Research Source / Inspiration Account (PART D) */}
          {step === "research-sources" && (
            <motion.div
              key="research-sources"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <SparkGuide
                state="speaking"
                message="Inspiration Accounts / Research Sources"
                subtitle="Paste YouTube, TikTok, or Instagram URLs to seed Viral Sparks."
              />

              <div className="space-y-2.5 pt-1">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={researchSourceInput}
                    onChange={(e) => setResearchSourceInput(e.target.value)}
                    placeholder="https://youtube.com/@channel..."
                    className="flex-1 p-2.5 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddResearchSource}
                    disabled={!researchSourceInput.trim()}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                {seededSources.length > 0 && (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {seededSources.map((sUrl) => (
                      <div key={sUrl} className="p-2 rounded-lg bg-card border border-purple-500/30 flex items-center justify-between text-xs">
                        <span className="text-purple-200 truncate flex-1 pr-2">{sUrl}</span>
                        <button type="button" onClick={() => handleRemoveResearchSource(sUrl)} className="text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmResearchSources}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-2"
              >
                <span>{seededSources.length > 0 ? "Confirm Sources →" : "Skip for now →"}</span>
              </button>
            </motion.div>
          )}

          {/* SCREEN 8: Channels & Accounts */}
          {step === "publishing" && (
            <motion.div
              key="publishing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              <SparkGuide
                state="speaking"
                message="Where do you distribute content?"
                subtitle="Select target channels. Connect now or later."
              />

              <p className="text-[11px] text-muted-foreground p-2.5 rounded-xl bg-card border border-border">
                💡 <em>Research works now. Publishing needs a connected account.</em>
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {["YouTube Shorts", "TikTok", "Instagram Reels", "Twitter/X", "LinkedIn"].map((acc) => {
                  const isSel = selectedAccounts.includes(acc);
                  return (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => toggleAccount(acc)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSel
                          ? "bg-purple-950/40 border-purple-500/60 text-purple-300"
                          : "bg-card border-border text-foreground hover:bg-card/80"
                      }`}
                    >
                      <span className="text-xs font-medium">{acc}</span>
                      {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setStep("production-mode")}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-xs flex items-center justify-center space-x-2"
              >
                <span>Continue to Production Mode</span>
                <ArrowRight className="w-4 h-4" />
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
              className="space-y-5"
            >
              <SparkGuide
                state="speaking"
                message="Choose your default production mode."
                subtitle="Controls asset synthesis depth and rendering pipeline."
              />

              <div className="space-y-2.5 pt-1">
                {[
                  {
                    id: "narrator" as const,
                    title: "Narrator",
                    desc: "Images + voice + captions + motion pipeline.",
                    icon: Volume2,
                  },
                  {
                    id: "hybrid" as const,
                    title: "Hybrid",
                    desc: "Animated hook + narrator pipeline.",
                    icon: Zap,
                  },
                  {
                    id: "cinematic" as const,
                    title: "Cinematic",
                    desc: "Storyboard + video gen + consistency + audio.",
                    icon: Film,
                  },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleProductionModeChoice(m.id)}
                      className="w-full p-3.5 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98] flex items-start space-x-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{m.title}</p>
                        <p className="text-[11px] text-muted-foreground pt-0.5 leading-relaxed">{m.desc}</p>
                      </div>
                    </button>
                  );
                })}
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
              className="space-y-5"
            >
              <SparkGuide
                state="speaking"
                message="How involved do you want to be?"
                subtitle="Choose your operating autonomy level."
              />

              <div className="space-y-2.5 pt-1">
                {[
                  {
                    id: "manual" as const,
                    title: "Manual",
                    desc: "All decisions require your explicit sign-off.",
                    icon: Sliders,
                  },
                  {
                    id: "balanced" as const,
                    title: "Balanced",
                    desc: "AI handles routine actions, you approve strategy.",
                    icon: Shield,
                  },
                  {
                    id: "autonomous" as const,
                    title: "Autonomous",
                    desc: "AI operates independently across all loops.",
                    icon: Layers,
                  },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleAutomationChoice(mode.id)}
                      className="w-full p-3.5 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98] flex items-start space-x-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{mode.title}</p>
                        <p className="text-[11px] text-muted-foreground pt-0.5 leading-relaxed">{mode.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* SCREEN 11: Calibration */}
          {step === "initialization" && (
            <motion.div
              key="initialization"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="space-y-6 text-center"
            >
              <SparkGuide
                state="thinking"
                message="Building Your Creative OS..."
                subtitle="Initializing Executive Director, Brand Memory & Pipelines..."
              />

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
                <p className="text-[11px] font-mono text-muted-foreground">
                  {initProgress}% Calibrated
                </p>
              </div>
            </motion.div>
          )}

          {/* SCREEN 12: Ready */}
          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-5 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 mx-auto flex items-center justify-center text-white shadow-lg shadow-purple-900/30">
                <SparkLogo className="w-7 h-7" variant="superspark" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-foreground">Your SPARK is ready.</h2>
                <p className="text-xs text-muted-foreground mt-1">Ready to create, research, and produce.</p>
              </div>

              <div className="bg-card border border-border p-3.5 rounded-2xl text-left space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-foreground">Brand: <strong>{brandName}</strong> ({niche})</span>
                </div>
                <div className="flex items-center gap-2">
                  {characterSheetUrl ? (
                    <img src={characterSheetUrl} alt="Host" className="w-4 h-4 rounded-full object-cover border border-emerald-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-foreground">Character: <strong>{creatorName}</strong> ({visualStyle})</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-foreground">Narrator: <strong>{selectedVoiceName}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-foreground">Mode: <strong className="capitalize">{productionMode}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-foreground">Automation: <strong className="capitalize">{automationMode}</strong></span>
                </div>
                {seededSources.length > 0 && (
                  <div className="flex items-center gap-2 text-purple-300 text-[11px] pt-1 border-t border-border/40">
                    <span>✓ {seededSources.length} Research Sources Seeded</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleFinalCompletion}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all text-sm flex items-center justify-center space-x-2"
              >
                <span>Enter SPARK Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <div className="pb-6 text-center text-[11px] text-muted-foreground/50 z-10">
        SPARK Media OS • Executive Director
      </div>
    </div>
  );
}
