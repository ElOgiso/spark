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
} from "lucide-react";
import type { BrandGenesisData } from "../../onboarding/OnboardingWizard";
import { SparkLogo } from "../../SparkLogo";

type FlowStep =
  | "awakens"
  | "identity"
  | "niche"
  | "character"
  | "voice"
  | "audio"
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
  const [characterOpt, setCharacterOpt] = useState("I'll appear myself");
  const [visualStyle, setVisualStyle] = useState<"Realistic / Live-Action" | "Cinematic 3D" | "Anime / Stylized Studio">("Realistic / Live-Action");
  const [voice, setVoiceSelection] = useState("Spark Executive Male");
  const [audioEnergy, setAudioEnergy] = useState<"calm" | "energetic" | "bold">("energetic");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [productionMode, setProductionModeSelection] = useState<"narrator" | "hybrid" | "cinematic">("hybrid");
  const [automationMode, setAutomationModeSelection] = useState<"manual" | "balanced" | "autonomous">("balanced");

  // Initialization progress
  const [initProgress, setInitProgress] = useState(0);

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

  // Character Choice
  const handleCharacterChoice = (choice: string) => {
    setCharacterOpt(choice);
    addChatMessage({ sender: "user", text: `Character choice: ${choice}`, timestamp: new Date() });
    addChatMessage({
      sender: "spark",
      text: `Host character configured as "${choice}" (${visualStyle}).`,
      timestamp: new Date()
    });
    setStep("voice");
  };

  // Handle Voice Selection
  const handleVoiceChoice = (choice: string) => {
    setVoiceSelection(choice);
    addChatMessage({ sender: "user", text: `Voice: ${choice}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Configured voice as ${choice}.`, timestamp: new Date() });
    setStep("audio");
  };

  // Handle Audio Energy
  const handleAudioChoice = (energy: "calm" | "energetic" | "bold") => {
    setAudioEnergy(energy);
    addChatMessage({ sender: "user", text: `Audio energy: ${energy}`, timestamp: new Date() });
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
      characterChoice: characterOpt === "Upload Image" ? "upload" : "self",
      audioEnergy: audioEnergy,
    };

    initializeBrandGenesis(genesisData);
    auth.markOnboardingComplete();
    onComplete();
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-background text-foreground flex flex-col justify-between relative z-50 overflow-y-auto select-none antialiased">
      {/* Background Soft Mesh Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      {/* Non-Blocking Background Email Verification Pill */}
      <SoftVerificationBanner />

      {/* Top Header Progress Indicator */}
      <div className="px-6 pt-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            SPARK Genesis
          </span>
        </div>
        <div className="text-[11px] font-mono text-purple-400/80">
          {step === "awakens" && "Phase 1 / 8"}
          {step === "identity" && "Phase 1 / 8"}
          {step === "niche" && "Phase 2 / 8"}
          {step === "character" && "Phase 3 / 8"}
          {step === "voice" && "Phase 4 / 8"}
          {step === "audio" && "Phase 5 / 8"}
          {step === "publishing" && "Phase 6 / 8"}
          {step === "production-mode" && "Phase 7 / 8"}
          {step === "automation" && "Phase 8 / 8"}
          {step === "initialization" && "Calibrating..."}
          {step === "ready" && "Ready"}
        </div>
      </div>

      {/* Main Conversational Area */}
      <div className="flex-1 flex flex-col justify-center px-6 py-6 z-10 w-full">
        <AnimatePresence mode="wait">
          {/* SCREEN 1: Spark Awakens */}
          {step === "awakens" && (
            <motion.div
              key="awakens"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6 }}
              className="space-y-6 text-center"
            >
              <SparkGuide
                state="speaking"
                message="Welcome. I'm Super Spark."
                subtitle="Let's configure your media brand operating system."
              />
              <p className="text-xs text-muted-foreground animate-pulse">
                Initializing Executive Director...
              </p>
            </motion.div>
          )}

          {/* SCREEN 2: Identity */}
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
                state="speaking"
                message="Let's set your brand identity."
                subtitle="What is your name and the name of your brand?"
              />

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Your Name / Creator Persona</label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full p-3 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Brand Name</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Next Wave Media"
                    className="w-full p-3 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!creatorName.trim() || !brandName.trim()}
                onClick={handleIdentitySubmit}
                className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <span>Continue to Niche</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* SCREEN 3: Niche */}
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

          {/* SCREEN 4: Character & Visual Look */}
          {step === "character" && (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              <SparkGuide
                state="speaking"
                message="How should the host character appear?"
                subtitle="Select host format and visual aesthetic."
              />

              <div className="space-y-2 pt-1">
                {[
                  { id: "self", label: "I'll appear myself", icon: User, desc: "Direct creator video" },
                  { id: "photo", label: "Take Photo / Camera", icon: Camera, desc: "Use device camera" },
                  { id: "upload", label: "Upload Reference Image", icon: Upload, desc: "Custom host photo" },
                  { id: "describe", label: "Describe Character", icon: Sparkles, desc: "Text persona bible" },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleCharacterChoice(opt.label)}
                      className="w-full p-3 rounded-xl bg-card border border-border hover:border-purple-500 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-border/40">
                <label className="text-[11px] text-muted-foreground mb-1.5 block">Visual Rendering Style</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["Realistic / Live-Action", "Cinematic 3D", "Anime / Stylized Studio"] as const).map((vs) => (
                    <button
                      key={vs}
                      type="button"
                      onClick={() => setVisualStyle(vs)}
                      className={`p-2 rounded-lg text-[11px] font-semibold border text-center transition-all ${
                        visualStyle === vs
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {vs.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN 5: Voice */}
          {step === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              <SparkGuide
                state="speaking"
                message="Choose a voice profile for your host."
                subtitle="Select a voice profile or configure later."
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { title: "Spark Executive Male", desc: "Global Executive" },
                  { title: "Spark African Storyteller", desc: "West African English" },
                  { title: "Spark Energetic Female", desc: "Dynamic Creator" },
                  { title: "Spark Cinematic Voice", desc: "Deep Cinematic" },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleVoiceChoice(item.title)}
                    className="p-3 rounded-xl bg-card border border-border hover:border-purple-500 text-left transition-all active:scale-[0.98]"
                  >
                    <span className="text-xs font-semibold text-foreground block">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleVoiceChoice("Deferred")}
                className="w-full py-2.5 text-xs text-muted-foreground hover:text-purple-300 transition-colors"
              >
                Set voice in MY SPARK later →
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

          {/* SCREEN 7: Channels & Accounts */}
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

          {/* SCREEN 8: Production Mode (REQUIRED) */}
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

          {/* SCREEN 9: Automation Settings (REQUIRED) */}
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

          {/* SCREEN 10: Calibration */}
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

          {/* SCREEN 11: Ready */}
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
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-foreground">Character: <strong>{characterOpt}</strong> ({visualStyle})</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-foreground">Mode: <strong className="capitalize">{productionMode}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-foreground">Automation: <strong className="capitalize">{automationMode}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-[11px] pt-1 border-t border-border/40">
                  <span>○ Accounts ({selectedAccounts.length > 0 ? `${selectedAccounts.length} selected` : "Optional — connect later"})</span>
                </div>
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
