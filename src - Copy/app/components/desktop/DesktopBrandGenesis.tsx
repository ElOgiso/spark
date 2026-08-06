import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SparkGuide, type SparkGuideState } from "../mobile/onboarding/SparkGuide";
import { SoftVerificationBanner } from "../mobile/onboarding/SoftVerificationBanner";
import { DesktopCanvas } from "./DesktopCanvas";
import { useSpark } from "../../state/SparkContext";
import { useAuth } from "../../state/AuthContext";
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
} from "lucide-react";

type FlowStep =
  | "awakens"
  | "niche"
  | "character"
  | "character-scanning"
  | "voice"
  | "publishing"
  | "automation"
  | "initialization"
  | "complete";

type DesktopBrandGenesisProps = {
  onComplete: () => void;
};

export function DesktopBrandGenesis({ onComplete }: DesktopBrandGenesisProps) {
  const auth = useAuth();
  const { updateBrand, updateAutomationMode, addMemoryItem, createProductionFromSpark, viralSparks, addChatMessage } = useSpark();

  const [step, setStep] = useState<FlowStep>("awakens");
  const [guideState, setGuideState] = useState<SparkGuideState>("speaking");

  const [niche, setNicheSelection] = useState("");
  const [characterOpt, setCharacterOpt] = useState("");
  const [voice, setVoiceSelection] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [automationMode, setAutomationModeSelection] = useState<"manual" | "balanced" | "autonomous">("balanced");
  const [initProgress, setInitProgress] = useState(0);

  // Auto-advance from awakens
  useEffect(() => {
    if (step === "awakens") {
      const timer = setTimeout(() => {
        setStep("niche");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Character scanning
  const handleCharacterChoice = (choice: string) => {
    setCharacterOpt(choice);
    setStep("character-scanning");
    setGuideState("scanning");

    addChatMessage({ sender: "user", text: `Character choice: ${choice}`, timestamp: new Date() });
    addChatMessage({
      sender: "spark",
      text: `Scanning character mesh for ${choice}... I'll remember this character across every future production.`,
      timestamp: new Date()
    });

    setTimeout(() => {
      addMemoryItem(
        `Visual reference option selected: ${choice}`,
        "rule",
        "character"
      );
      setGuideState("speaking");
      setStep("voice");
    }, 2500);
  };

  const handleNicheChoice = (choice: string) => {
    setNicheSelection(choice);
    updateBrand({ niche: choice });
    addChatMessage({ sender: "user", text: `Niche choice: ${choice}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Perfect. I'll build around your ${choice} niche.`, timestamp: new Date() });

    addMemoryItem(
      `Primary content domain set to ${choice}`,
      "rule",
      "niche"
    );
    setStep("character");
  };

  const handleVoiceChoice = (choice: string) => {
    setVoiceSelection(choice);
    updateBrand({ archetype: choice });
    addChatMessage({ sender: "user", text: `Voice archetype: ${choice}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Configured voice archetype as ${choice}.`, timestamp: new Date() });

    addMemoryItem(
      `Tone of voice archetype configured as ${choice}`,
      "rule",
      "voice"
    );
    setStep("publishing");
  };

  const toggleAccount = (acc: string) => {
    setSelectedAccounts((prev: string[]) =>
      prev.includes(acc) ? prev.filter((a: string) => a !== acc) : [...prev, acc]
    );
  };

  const handleAutomationChoice = (mode: "manual" | "balanced" | "autonomous") => {
    setAutomationModeSelection(mode);
    updateAutomationMode(mode);
    addChatMessage({ sender: "user", text: `Automation mode: ${mode}`, timestamp: new Date() });
    addChatMessage({ sender: "spark", text: `Operating autonomy configured as ${mode}. Initializing Creative OS...`, timestamp: new Date() });

    setStep("initialization");
    setGuideState("thinking");
  };


  // Screen 8 Calibration Progress
  useEffect(() => {
    if (step === "initialization") {
      const interval = setInterval(() => {
        setInitProgress((prev: number) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              addMemoryItem(
                `Automation Mode configured as ${automationMode}`,
                "rule",
                "brand"
              );

              if (viralSparks && viralSparks.length > 0) {
                createProductionFromSpark(viralSparks[0].id);
              }

              auth.markOnboardingComplete();
              onComplete();
            }, 1200);
            return 100;
          }
          return prev + 12;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [step, niche, automationMode, addMemoryItem, createProductionFromSpark, viralSparks, auth, onComplete]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden antialiased">
      <SoftVerificationBanner />

      {/* Top Header Progress Indicator */}
      <div className="px-8 pt-6 flex items-center justify-between z-10 border-b border-border/50 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Spark Media OS</span>
          <span className="text-xs text-muted-foreground border-l border-border pl-3">
            Desktop Studio Genesis
          </span>
        </div>
        <div className="text-xs font-mono text-blue-400">
          {step === "awakens" && "Phase 1 / 7"}
          {step === "niche" && "Phase 2 / 7"}
          {step === "character" && "Phase 3 / 7"}
          {step === "character-scanning" && "Phase 3 / 7"}
          {step === "voice" && "Phase 4 / 7"}
          {step === "publishing" && "Phase 5 / 7"}
          {step === "automation" && "Phase 6 / 7"}
          {step === "initialization" && "Calibrating..."}
        </div>
      </div>

      {/* Split Layout Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 max-w-7xl mx-auto w-full z-10 my-auto items-center">
        {/* Left Column: Conversational AI Creative Director */}
        <div className="flex flex-col justify-center space-y-6 max-w-lg mx-auto w-full">
          <AnimatePresence mode="wait">
            {step === "awakens" && (
              <motion.div
                key="awakens"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.5 }}
                className="space-y-6 text-center"
              >
                <SparkGuide
                  state="speaking"
                  message="Perfect. I'm Spark."
                  subtitle="Before I build your creative operating system, I need to understand your business."
                />
                <p className="text-xs text-muted-foreground animate-pulse">
                  Initializing Executive Director Engine...
                </p>
              </motion.div>
            )}

            {step === "niche" && (
              <motion.div
                key="niche"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <SparkGuide
                  state="speaking"
                  message="I'll build around your niche."
                  subtitle="What kind of creator or brand are you building?"
                />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {["Business", "Creator", "Artist", "Agency", "Educator", "Personal Brand"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleNicheChoice(item)}
                      className="p-4 rounded-2xl bg-card border border-border/80 hover:border-blue-500/50 hover:bg-card/80 text-left transition-all active:scale-[0.97] group"
                    >
                      <span className="text-sm font-medium text-foreground block group-hover:text-blue-400">
                        {item}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Select archetype</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === "character" && (
              <motion.div
                key="character"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <SparkGuide
                  state="speaking"
                  message="Let's meet the face of your brand."
                  subtitle="Select how you'd like your primary character avatar represented."
                />

                <div className="space-y-3 pt-2">
                  {[
                    { id: "photo", label: "Take Photo", icon: Camera, desc: "Use webcam device" },
                    { id: "upload", label: "Upload Image", icon: Upload, desc: "Choose from local files" },
                    { id: "self", label: "I'll appear myself", icon: User, desc: "Direct video creator" },
                    { id: "skip", label: "Skip for now", icon: SkipForward, desc: "Configure later in MySpark" },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleCharacterChoice(opt.label)}
                        className="w-full p-4 rounded-2xl bg-card border border-border/80 hover:border-blue-500/50 hover:bg-card/80 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === "character-scanning" && (
              <motion.div
                key="character-scanning"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4 }}
                className="space-y-6 text-center"
              >
                <SparkGuide
                  state="scanning"
                  message="Scanning & Mapping Character Mesh..."
                  subtitle={`Analyzing visual consistency rules for ${characterOpt}...`}
                />
                <div className="p-4 rounded-2xl bg-card/60 border border-blue-500/30 backdrop-blur-md text-xs text-blue-200/80 space-y-1">
                  <p className="font-semibold text-blue-400">"Nice."</p>
                  <p>I'll remember this character across every future production.</p>
                </div>
              </motion.div>
            )}

            {step === "voice" && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <SparkGuide
                  state="speaking"
                  message="How should your brand sound?"
                  subtitle="Spark will adapt script tones and audio synthesis to match."
                />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { title: "Confident", desc: "Bold & authoritative" },
                    { title: "Luxury", desc: "Sophisticated & refined" },
                    { title: "Educational", desc: "Clear & insightful" },
                    { title: "Calm", desc: "Measured & reassuring" },
                    { title: "Energetic", desc: "High impact & dynamic" },
                    { title: "Funny", desc: "Witty & engaging" },
                  ].map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleVoiceChoice(item.title)}
                      className="p-4 rounded-2xl bg-card border border-border/80 hover:border-blue-500/50 hover:bg-card/80 text-left transition-all active:scale-[0.97]"
                    >
                      <span className="text-sm font-medium text-foreground block">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === "publishing" && (
              <motion.div
                key="publishing"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <SparkGuide
                  state="speaking"
                  message="Where do you publish today?"
                  subtitle="Select target channels. You can connect API credentials later."
                />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {["Instagram", "TikTok", "LinkedIn", "X", "Facebook", "YouTube"].map((acc) => {
                    const isSel = selectedAccounts.includes(acc);
                    return (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => toggleAccount(acc)}
                        className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                          isSel
                            ? "bg-blue-950/40 border-blue-500/60 text-blue-300"
                            : "bg-card border-border/80 text-foreground hover:bg-card/80"
                        }`}
                      >
                        <span className="text-sm font-medium">{acc}</span>
                        {isSel && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setStep("automation")}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all text-sm flex items-center justify-center space-x-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {step === "automation" && (
              <motion.div
                key="automation"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <SparkGuide
                  state="speaking"
                  message="How involved do you want to be?"
                  subtitle="Choose your operating autonomy level."
                />

                <div className="space-y-3 pt-2">
                  {[
                    {
                      id: "manual" as const,
                      title: "Manual",
                      desc: "I ask before every major creative & publishing decision.",
                      icon: Sliders,
                    },
                    {
                      id: "balanced" as const,
                      title: "Balanced",
                      desc: "I create independently but wait for your explicit approval.",
                      icon: Shield,
                    },
                    {
                      id: "autonomous" as const,
                      title: "Autonomous",
                      desc: "I operate like a full creative team from discovery to post.",
                      icon: Layers,
                    },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleAutomationChoice(mode.id)}
                        className="w-full p-4 rounded-2xl bg-card border border-border/80 hover:border-blue-500/50 hover:bg-card/80 text-left transition-all active:scale-[0.98] flex items-start space-x-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{mode.title}</p>
                          <p className="text-xs text-muted-foreground pt-0.5 leading-relaxed">
                            {mode.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

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
                  subtitle="Initializing Executive Director, Department Engines & Brand Memory..."
                />

                <div className="bg-card/80 border border-border/80 p-5 rounded-2xl backdrop-blur-md space-y-3 text-left text-xs">
                  {[
                    { name: "Research Engine", done: initProgress >= 15 },
                    { name: "Creative Department", done: initProgress >= 30 },
                    { name: "Production & Storyboard", done: initProgress >= 45 },
                    { name: "Editing Intelligence", done: initProgress >= 60 },
                    { name: "Publishing Channels", done: initProgress >= 75 },
                    { name: "Analytics & Learning Loops", done: initProgress >= 90 },
                    { name: "Executive Director Calibration", done: initProgress >= 100 },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <span className={item.done ? "text-foreground font-medium" : "text-muted-foreground/60"}>
                        {item.name}
                      </span>
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-blue-500/40 animate-pulse" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="h-2 w-full bg-card rounded-full overflow-hidden border border-border/50">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-600 to-emerald-400"
                      style={{ width: `${initProgress}%` }}
                    />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">
                    {initProgress}% Calibrated
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Interactive Executive Depth Canvas */}
        <div className="w-full h-[520px]">
          <DesktopCanvas step={step} characterOpt={characterOpt} />
        </div>
      </div>

      <div className="pb-6 text-center text-xs text-muted-foreground/50 z-10">
        Spark Media OS • Desktop Executive Director
      </div>
    </div>
  );
}
