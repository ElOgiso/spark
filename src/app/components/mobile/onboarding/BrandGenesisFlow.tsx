import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Camera,
  Upload,
  UserCheck,
  SkipForward,
  CheckCircle2,
  Volume2,
  Music,
  Share2,
  Sliders,
  CreditCard,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { useSpark } from "../../../state/SparkContext";
import { SparkGuide } from "./SparkGuide";
import { SoftVerificationBanner } from "./SoftVerificationBanner";
import { createMemoryItem } from "../../../backend/repositories/memoryRepository";
import { RuntimeEvents } from "../../../services/runtime/runtimeEvents";

type GenesisStep =
  | "awakening"
  | "business"
  | "positioning"
  | "character"
  | "character-scan"
  | "voice"
  | "audio"
  | "channels"
  | "automation"
  | "billing"
  | "initialization";

type BrandGenesisFlowProps = {
  onComplete: () => void;
};

export function BrandGenesisFlow({ onComplete }: BrandGenesisFlowProps) {
  const auth = useAuth();
  const spark = useSpark();
  const [step, setStep] = useState<GenesisStep>("awakening");

  // Step Data States
  const [businessInput, setBusinessInput] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("Educational Founder Brand");
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [voiceTone, setVoiceTone] = useState("Confident");
  const [audioVibe, setAudioVibe] = useState("Minimal Cinematic");
  const [channels, setChannels] = useState<string[]>(["LinkedIn", "Instagram"]);
  const [automationMode, setAutomationMode] = useState<"manual" | "balanced" | "autonomous">("balanced");
  
  // Initialization Progress States
  const [initProgress, setInitProgress] = useState(0);
  const [initChecklist, setInitChecklist] = useState({
    departments: false,
    memory: false,
    executive: false,
    channels: false,
    calibration: false,
    ready: false,
  });

  // Auto-advance awakening scene
  useEffect(() => {
    if (step === "awakening") {
      const timer = setTimeout(() => setStep("business"), 2500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Handle Character Scanning Simulation
  useEffect(() => {
    if (step === "character-scan") {
      const timer = setTimeout(() => {
        // Save Character Memory
        if (auth.brand?.id) {
          void createMemoryItem({
            brand_id: auth.brand.id,
            category: "character",
            title: "Primary Character Appearance",
            description: "Consistent facial features and persona profile learned.",
            source: "Brand Genesis Character Scan",
            confidence: "0.95",
            evidence: { image: characterImage ?? "preset" },
            affected_systems: ["creative", "production"],
            archived: false,
          });
          RuntimeEvents.getInstance().emit("AgentCompleted", { agentId: "CharacterProfileCreated", brandId: auth.brand.id });
        }
        setStep("voice");
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [step, auth.brand?.id, characterImage]);

  // Handle VisionOS Initialization Sequence
  useEffect(() => {
    if (step === "initialization") {
      const interval = setInterval(() => {
        setInitProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 150);

      const t1 = setTimeout(() => setInitChecklist((c) => ({ ...c, departments: true })), 800);
      const t2 = setTimeout(() => setInitChecklist((c) => ({ ...c, memory: true })), 1800);
      const t3 = setTimeout(() => setInitChecklist((c) => ({ ...c, executive: true })), 2800);
      const t4 = setTimeout(() => setInitChecklist((c) => ({ ...c, channels: true })), 3600);
      const t5 = setTimeout(() => setInitChecklist((c) => ({ ...c, calibration: true })), 4400);
      const t6 = setTimeout(() => {
        setInitChecklist((c) => ({ ...c, ready: true }));
        // Complete Genesis
        auth.markOnboardingComplete();
        RuntimeEvents.getInstance().emit("LearningCompleted", { brandId: auth.brand?.id });
        setTimeout(() => onComplete(), 1000);
      }, 5200);

      return () => {
        clearInterval(interval);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
        clearTimeout(t6);
      };
    }
  }, [step, auth, onComplete]);

  // Helper to persist memory item immediately per step
  const persistStepMemory = (category: any, title: string, description: string) => {
    if (auth.brand?.id) {
      void createMemoryItem({
        brand_id: auth.brand.id,
        category,
        title,
        description,
        source: "Brand Genesis",
        confidence: "0.90",
        evidence: { step },
        affected_systems: ["executive", "creative"],
        archived: false,
      });
      RuntimeEvents.getInstance().emit("LearningCompleted", { category, title });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between antialiased relative overflow-hidden select-none">
      {/* Top Soft Background Verification Banner */}
      <SoftVerificationBanner />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-sm w-full mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {/* STEP 0: Spark Awakening */}
          {step === "awakening" && (
            <motion.div
              key="awakening"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="text-center space-y-6 my-auto"
            >
              <SparkGuide state="speaking" />
              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                  Spark Operating System Online.
                </h1>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Before I build your creative operating system, I need to understand your business.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 1: Understand Business */}
          {step === "business" && (
            <motion.div
              key="business"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto"
            >
              <SparkGuide
                state="idle"
                message="Tell me what you're building."
                subtitle="Describe your business, agency, brand, or creative goal."
              />

              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  value={businessInput}
                  onChange={(e) => setBusinessInput(e.target.value)}
                  placeholder="e.g. Building an AI agency for creators..."
                  className="w-full bg-card border border-border/60 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-blue-500 transition"
                  autoFocus
                />
                
                <div className="flex flex-wrap gap-2 pt-1">
                  {["AI Agency", "SaaS Product", "Educational Channel", "E-commerce Brand"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBusinessInput(preset)}
                      className="px-3 py-1.5 rounded-lg bg-card/80 border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:border-blue-500/40 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!businessInput.trim()}
                  onClick={() => {
                    persistStepMemory("niche", "Business Focus", businessInput);
                    setStep("positioning");
                  }}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center justify-center space-x-2 transition disabled:opacity-40 shadow-lg shadow-blue-600/20"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Generative Strategy Recommendations */}
          {step === "positioning" && (
            <motion.div
              key="positioning"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto"
            >
              <SparkGuide
                state="speaking"
                message={`Understood. I'll build Spark around "${businessInput || "your brand"}".`}
                subtitle="Select the primary content positioning strategy:"
              />

              <div className="space-y-2.5 pt-2">
                {[
                  { title: "Educational Founder Brand", desc: "Thought leadership & high-trust breakdowns." },
                  { title: "B2B Growth Engine", desc: "Case studies, ROI breakdowns, and client conversion." },
                  { title: "Viral Creator Identity", desc: "High-hook short-form videos & audience growth." },
                ].map((strat) => (
                  <motion.button
                    key={strat.title}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedStrategy(strat.title);
                      persistStepMemory("brand", "Positioning Strategy", strat.title);
                      setStep("character");
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition ${
                      selectedStrategy === strat.title
                        ? "bg-blue-600/10 border-blue-500/60 text-foreground"
                        : "bg-card border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{strat.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{strat.desc}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 3: Character Creation */}
          {step === "character" && (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto text-center"
            >
              <SparkGuide
                state="idle"
                message="Let's meet the face of your brand."
                subtitle="Upload or select a character avatar to maintain visual consistency."
              />

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setCharacterImage("camera-preset");
                    setStep("character-scan");
                  }}
                  className="p-4 rounded-xl bg-card border border-border/60 flex flex-col items-center justify-center space-y-2 hover:border-blue-500/50 transition group"
                >
                  <Camera className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium">Take Photo</span>
                </button>

                <button
                  onClick={() => {
                    setCharacterImage("upload-preset");
                    setStep("character-scan");
                  }}
                  className="p-4 rounded-xl bg-card border border-border/60 flex flex-col items-center justify-center space-y-2 hover:border-blue-500/50 transition group"
                >
                  <Upload className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium">Upload Image</span>
                </button>

                <button
                  onClick={() => {
                    setCharacterImage("self-preset");
                    setStep("character-scan");
                  }}
                  className="p-4 rounded-xl bg-card border border-border/60 flex flex-col items-center justify-center space-y-2 hover:border-blue-500/50 transition group"
                >
                  <UserCheck className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium">I'll Appear Myself</span>
                </button>

                <button
                  onClick={() => {
                    setCharacterImage(null);
                    setStep("voice");
                  }}
                  className="p-4 rounded-xl bg-card/50 border border-border/40 flex flex-col items-center justify-center space-y-2 hover:border-border transition"
                >
                  <SkipForward className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Skip for now</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3.5: Character Scanning Pulse Animation */}
          {step === "character-scan" && (
            <motion.div
              key="character-scan"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="text-center space-y-6 my-auto"
            >
              <SparkGuide state="scanning" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-cyan-400 tracking-wide uppercase text-[11px]">
                  Scanning Face Wireframe & Depth Mesh...
                </p>
                <h2 className="text-lg font-bold">I've learned your appearance.</h2>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  I'll preserve consistency across every future production.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Voice Archetype */}
          {step === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto"
            >
              <SparkGuide
                state="speaking"
                message="How should your brand sound?"
                subtitle="Select your primary voice archetype:"
              />

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {["Confident", "Calm", "Energetic", "Educational", "Luxury", "Funny"].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setVoiceTone(v);
                      persistStepMemory("voice", "Voice Archetype", v);
                      setStep("audio");
                    }}
                    className={`p-3.5 rounded-xl border text-center transition text-xs font-semibold ${
                      voiceTone === v
                        ? "bg-blue-600/10 border-blue-500/60 text-blue-400"
                        : "bg-card border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 5: Signature Audio Atmosphere */}
          {step === "audio" && (
            <motion.div
              key="audio"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto"
            >
              <SparkGuide
                state="speaking"
                message="Let's give your content a signature atmosphere."
                subtitle="Select music & audio style presets:"
              />

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {["Minimal Cinematic", "Modern Ambient", "Afrobeats Pulse", "Corporate Tech", "Luxury Subtle", "Lo-Fi Focus"].map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      setAudioVibe(a);
                      persistStepMemory("audio", "Signature Audio Vibe", a);
                      setStep("channels");
                    }}
                    className={`p-3.5 rounded-xl border text-center transition text-xs font-semibold ${
                      audioVibe === a
                        ? "bg-purple-600/10 border-purple-500/60 text-purple-400"
                        : "bg-card border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 6: Publishing Channels */}
          {step === "channels" && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto"
            >
              <SparkGuide
                state="speaking"
                message="Where do you publish today?"
                subtitle="Connect or select your active distribution nodes:"
              />

              <div className="space-y-2 pt-2">
                {[
                  { name: "LinkedIn", status: "Connected", color: "text-emerald-400 bg-emerald-500/10" },
                  { name: "Instagram", status: "Needs Login", color: "text-amber-400 bg-amber-500/10" },
                  { name: "TikTok", status: "Waiting", color: "text-blue-400 bg-blue-500/10" },
                  { name: "X (Twitter)", status: "Connected", color: "text-emerald-400 bg-emerald-500/10" },
                  { name: "YouTube", status: "Waiting", color: "text-blue-400 bg-blue-500/10" },
                ].map((ch) => (
                  <div
                    key={ch.name}
                    className="p-3 rounded-xl bg-card border border-border/60 flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold">{ch.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${ch.color}`}>
                      {ch.status}
                    </span>
                  </div>
                ))}

                <button
                  onClick={() => {
                    persistStepMemory("publishing_behavior", "Active Channels", channels.join(", "));
                    setStep("automation");
                  }}
                  className="w-full mt-3 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-600/20"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 7: Automation Mode Selection */}
          {step === "automation" && (
            <motion.div
              key="automation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto"
            >
              <SparkGuide
                state="speaking"
                message="How involved do you want to be?"
                subtitle="Select Spark's autonomy level:"
              />

              <div className="space-y-2.5 pt-2">
                {[
                  { mode: "manual", title: "Manual Control", desc: "I ask before every major creative decision." },
                  { mode: "balanced", title: "Balanced Autonomy", desc: "I create independently but wait for your final review." },
                  { mode: "autonomous", title: "Full Autonomous OS", desc: "I operate like a complete self-driving creative team." },
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => {
                      setAutomationMode(item.mode as any);
                      persistStepMemory("brand", "Automation Mode", item.title);
                      setStep("billing");
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition ${
                      automationMode === item.mode
                        ? "bg-blue-600/10 border-blue-500/60 text-foreground"
                        : "bg-card border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 8: Subscription Tier Billing Preview */}
          {step === "billing" && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full space-y-6 my-auto text-center"
            >
              <SparkGuide
                state="speaking"
                message="Everything is ready."
                subtitle="Confirm your Spark Media OS tier:"
              />

              <div className="p-4 rounded-2xl bg-gradient-to-b from-card to-card/60 border border-blue-500/30 text-left space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Pro Studio Tier</span>
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-medium">Included</span>
                </div>
                <p className="text-xl font-bold">$49 <span className="text-xs text-muted-foreground font-normal">/ month</span></p>
                <ul className="text-xs space-y-1.5 text-muted-foreground pt-1">
                  <li className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Unlimited Brand Memory Initialization</span>
                  </li>
                  <li className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Multi-Platform Autonomous Publishing</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setStep("initialization")}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-600/25"
              >
                <span>Initialize Creative Operating System</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 9: VisionOS Cinematic Initialization (4-6s) */}
          {step === "initialization" && (
            <motion.div
              key="initialization"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6 my-auto text-center"
            >
              <SparkGuide state="thinking" />

              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight">Spark Operating System</h2>
                <p className="text-xs text-cyan-400 uppercase tracking-widest font-mono">
                  Initializing... {initProgress}%
                </p>
              </div>

              {/* Cinematic Progress Bar */}
              <div className="w-full h-1.5 bg-card rounded-full overflow-hidden border border-border/40">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400"
                  style={{ width: `${initProgress}%` }}
                />
              </div>

              {/* Department Checklist */}
              <div className="text-left space-y-2 pt-2 max-w-xs mx-auto text-xs font-mono">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Loading Departments (Research, Creative, Production)</span>
                  <span className={initChecklist.departments ? "text-emerald-400" : "opacity-30"}>✓</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Building Brand Memory</span>
                  <span className={initChecklist.memory ? "text-emerald-400" : "opacity-30"}>✓</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Preparing Executive Director</span>
                  <span className={initChecklist.executive ? "text-emerald-400" : "opacity-30"}>✓</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Connecting Creative Departments</span>
                  <span className={initChecklist.channels ? "text-emerald-400" : "opacity-30"}>✓</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Calibrating Automation Systems</span>
                  <span className={initChecklist.calibration ? "text-emerald-400" : "opacity-30"}>✓</span>
                </div>
              </div>

              {initChecklist.ready && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-semibold text-emerald-400 pt-2"
                >
                  Creative Operating System Ready.
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
