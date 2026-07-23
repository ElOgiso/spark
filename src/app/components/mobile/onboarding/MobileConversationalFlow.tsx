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

type MobileConversationalFlowProps = {
  onComplete: () => void;
};

export function MobileConversationalFlow({ onComplete }: MobileConversationalFlowProps) {
  const auth = useAuth();
  const { updateBrand, updateAutomationMode, addMemoryItem, createProductionFromSpark, viralSparks } = useSpark();


  const [step, setStep] = useState<FlowStep>("awakens");
  const [guideState, setGuideState] = useState<SparkGuideState>("speaking");

  // Selection states
  const [niche, setNicheSelection] = useState("");
  const [characterOpt, setCharacterOpt] = useState("");
  const [voice, setVoiceSelection] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [automationMode, setAutomationModeSelection] = useState<"manual" | "balanced" | "autonomous">("balanced");

  // Initialization progress
  const [initProgress, setInitProgress] = useState(0);

  // Auto-advance from "awakens" step
  useEffect(() => {
    if (step === "awakens") {
      const timer = setTimeout(() => {
        setStep("niche");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Character scanning animation step
  const handleCharacterChoice = (choice: string) => {
    setCharacterOpt(choice);
    setStep("character-scanning");
    setGuideState("scanning");

    setTimeout(() => {
      // Seed Character Memory
      addMemoryItem(
        `Visual reference option selected: ${choice}`,
        "rule",
        "character"
      );
      setGuideState("speaking");
      setStep("voice");
    }, 2500);
  };

  // Handle Niche Selection
  const handleNicheChoice = (choice: string) => {
    setNicheSelection(choice);
    updateBrand({ niche: choice });
    // Seed Niche Memory
    addMemoryItem(
      `Primary content domain set to ${choice}`,
      "rule",
      "niche"
    );
    setStep("character");
  };

  // Handle Voice Selection
  const handleVoiceChoice = (choice: string) => {
    setVoiceSelection(choice);
    updateBrand({ archetype: choice });
    // Seed Voice Memory
    addMemoryItem(
      `Tone of voice archetype configured as ${choice}`,
      "rule",
      "voice"
    );
    setStep("publishing");
  };

  // Toggle Social Account
  const toggleAccount = (acc: string) => {
    setSelectedAccounts((prev: string[]) =>
      prev.includes(acc) ? prev.filter((a: string) => a !== acc) : [...prev, acc]
    );
  };

  // Handle Automation Choice
  const handleAutomationChoice = (mode: "manual" | "balanced" | "autonomous") => {
    setAutomationModeSelection(mode);
    updateAutomationMode(mode);
    setStep("initialization");
    setGuideState("thinking");
  };


  // Screen 8 VisionOS Calibration Progress
  useEffect(() => {
    if (step === "initialization") {
      const interval = setInterval(() => {
        setInitProgress((prev: number) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              // Final Memory & First Production seeding
              addMemoryItem(
                `Automation Mode configured as ${automationMode}`,
                "rule",
                "brand"
              );

              // Create default inaugural production pipeline if viral spark exists
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
      }, 350);
      return () => clearInterval(interval);
    }
  }, [step, niche, automationMode, addMemoryItem, createProductionFromSpark, viralSparks, auth, onComplete]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden antialiased">
      {/* Background Soft Mesh Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Non-Blocking Background Email Verification Pill */}
      <SoftVerificationBanner />

      {/* Top Header Progress Indicator */}
      <div className="px-6 pt-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Spark OS Genesis
          </span>
        </div>
        <div className="text-[11px] font-mono text-blue-400/80">
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

      {/* Main Conversational Area */}
      <div className="flex-1 flex flex-col justify-center px-6 py-6 z-10 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* SCREEN 2: Spark Awakens */}
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
                message="Perfect. I'm Spark."
                subtitle="Before I build your creative operating system, I need to understand your business."
              />
              <p className="text-xs text-muted-foreground animate-pulse">
                Initializing Executive Director...
              </p>
            </motion.div>
          )}

          {/* SCREEN 3: Brand Genesis (Niche) */}
          {step === "niche" && (
            <motion.div
              key="niche"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <SparkGuide
                state="speaking"
                message="I'll build around your niche."
                subtitle="What kind of creator or brand are you building?"
              />

              <div className="grid grid-cols-2 gap-2.5 pt-2">
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

          {/* SCREEN 4: Character Creation */}
          {step === "character" && (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <SparkGuide
                state="speaking"
                message="Let's meet the face of your brand."
                subtitle="Select how you'd like your primary character avatar represented."
              />

              <div className="space-y-2.5 pt-2">
                {[
                  { id: "photo", label: "Take Photo", icon: Camera, desc: "Use device camera" },
                  { id: "upload", label: "Upload Image", icon: Upload, desc: "Choose from gallery" },
                  { id: "self", label: "I'll appear myself", icon: User, desc: "Direct video creator" },
                  { id: "skip", label: "Skip for now", icon: SkipForward, desc: "Configure later in MySpark" },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleCharacterChoice(opt.label)}
                      className="w-full p-3.5 rounded-2xl bg-card border border-border/80 hover:border-blue-500/50 hover:bg-card/80 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* SCREEN 4-SCANNING: Character Wireframe Mesh Scan */}
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
              <div className="p-4 rounded-2xl bg-card/60 border border-blue-500/30 backdrop-blur-md max-w-xs mx-auto text-xs text-blue-200/80 space-y-1">
                <p className="font-semibold text-blue-400">"Nice."</p>
                <p>I'll remember this character across every future production.</p>
              </div>
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
              className="space-y-6"
            >
              <SparkGuide
                state="speaking"
                message="How should your brand sound?"
                subtitle="Spark will adapt script tones and audio synthesis to match."
              />

              <div className="grid grid-cols-2 gap-2.5 pt-2">
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
                    className="p-3.5 rounded-2xl bg-card border border-border/80 hover:border-blue-500/50 hover:bg-card/80 text-left transition-all active:scale-[0.97]"
                  >
                    <span className="text-sm font-medium text-foreground block">{item.title}</span>
                    <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 6: Publishing Accounts */}
          {step === "publishing" && (
            <motion.div
              key="publishing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <SparkGuide
                state="speaking"
                message="Where do you publish today?"
                subtitle="Select target channels. You can connect API credentials later."
              />

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {["Instagram", "TikTok", "LinkedIn", "X", "Facebook", "YouTube"].map((acc) => {
                  const isSel = selectedAccounts.includes(acc);
                  return (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => toggleAccount(acc)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
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

          {/* SCREEN 7: Automation Settings */}
          {step === "automation" && (
            <motion.div
              key="automation"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
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
                      className="w-full p-4 rounded-2xl bg-card border border-border/80 hover:border-blue-500/50 hover:bg-card/80 text-left transition-all active:scale-[0.98] flex items-start space-x-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
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

          {/* SCREEN 8: VisionOS Style OS Calibration & Initialization */}
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

              {/* Calibration Checklist */}
              <div className="bg-card/80 border border-border/80 p-4 rounded-2xl backdrop-blur-md space-y-2.5 max-w-xs mx-auto text-left text-xs">
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

              {/* Progress Bar */}
              <div className="max-w-xs mx-auto space-y-1.5">
                <div className="h-1.5 w-full bg-card rounded-full overflow-hidden border border-border/50">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-400"
                    style={{ width: `${initProgress}%` }}
                  />
                </div>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {initProgress}% Calibrated
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <div className="pb-6 text-center text-[11px] text-muted-foreground/50 z-10">
        Spark Media OS • AI Executive Director
      </div>
    </div>
  );
}
