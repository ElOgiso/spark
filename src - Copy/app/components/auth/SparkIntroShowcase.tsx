import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Play,
  Pause,
  Film,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Heart,
  Zap,
  ArrowRight,
  Layers,
  Video,
  ShoppingBag,
  Tv,
  CheckCircle2,
  X,
  Volume2,
  Sparkle
} from "lucide-react";
import { SparkLogo } from "../SparkLogo";

interface SparkIntroShowcaseProps {
  onComplete: () => void;
}

type VideoCategory = "film" | "anime" | "product" | "reels";

export const SparkIntroShowcase: React.FC<SparkIntroShowcaseProps> = ({ onComplete }) => {
  const [activeStage, setActiveStage] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeVideoCategory, setActiveVideoCategory] = useState<VideoCategory>("film");
  const [genProgress, setGenProgress] = useState<number>(18);
  const [earningsValue, setEarningsValue] = useState<number>(1240);
  const [likeCount, setLikeCount] = useState<number>(14200);
  const [autoTimerProgress, setAutoTimerProgress] = useState<number>(0);

  // Auto advance stages
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setAutoTimerProgress((prev) => {
        if (prev >= 100) {
          setActiveStage((stage) => {
            const nextStage = (stage + 1) % 4;
            // rotate video category in stage 1
            if (nextStage === 1) {
              const categories: VideoCategory[] = ["film", "anime", "product", "reels"];
              const currentIndex = categories.indexOf(activeVideoCategory);
              setActiveVideoCategory(categories[(currentIndex + 1) % categories.length]);
            }
            return nextStage;
          });
          return 0;
        }
        return prev + 2.5; // ~4 seconds per stage
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, activeVideoCategory]);

  // Video generation simulated progress animation
  useEffect(() => {
    const genInterval = setInterval(() => {
      setGenProgress((prev) => (prev >= 100 ? 12 : prev + 4));
    }, 120);

    return () => clearInterval(genInterval);
  }, []);

  // Earnings counter simulation
  useEffect(() => {
    const earnInterval = setInterval(() => {
      setEarningsValue((prev) => (prev >= 18940 ? 1240 : prev + 245));
    }, 150);

    return () => clearInterval(earnInterval);
  }, []);

  // Likes live counter
  useEffect(() => {
    const likeInterval = setInterval(() => {
      setLikeCount((prev) => prev + Math.floor(Math.random() * 12) + 5);
    }, 300);

    return () => clearInterval(likeInterval);
  }, []);

  const stages = [
    { id: 0, title: "AI Prompt to 4K Video", icon: Video, color: "from-pink-500 to-purple-600" },
    { id: 1, title: "Multi-Genre Rendering", icon: Film, color: "from-purple-600 to-cyan-500" },
    { id: 2, title: "Monetization Engine", icon: TrendingUp, color: "from-emerald-500 to-teal-400" },
    { id: 3, title: "Viral Shockwaves & Audience", icon: Heart, color: "from-amber-400 to-rose-500" },
  ];

  const videoTypes = [
    {
      id: "film" as VideoCategory,
      name: "4K Cinematic Film",
      tag: "21:9 Anamorphic",
      icon: Film,
      desc: "Hollywood-grade cinematic lighting, volumetric fog & 3D depth camera movement.",
      prompt: "Cinematic 4K shot of a neon cyberpunk runner navigating a misty rain street, lens flare, 35mm film grain",
      badge: "Cinematic Studio",
      metrics: "60 FPS • ProRes RAW • HDR10",
      gradient: "from-fuchsia-950/80 via-purple-900/60 to-black",
      accent: "border-purple-500/50 text-purple-300",
    },
    {
      id: "anime" as VideoCategory,
      name: "2D/3D Anime & Animation",
      tag: "Stylized Cell Shader",
      icon: Tv,
      desc: "High-octane action sequences, hand-drawn aesthetic & dynamic speed lines.",
      prompt: "Anime battle scene, glowing aura swords, electric particles, dramatic camera zoom, Makoto Shinkai style",
      badge: "Animation Lab",
      metrics: "Style Transfer • Vector Motion",
      gradient: "from-blue-950/80 via-indigo-900/60 to-black",
      accent: "border-cyan-500/50 text-cyan-300",
    },
    {
      id: "product" as VideoCategory,
      name: "360° E-Commerce Product",
      tag: "Studio Photorealism",
      icon: ShoppingBag,
      desc: "Commercial product showcases with ray-traced glass, fluid physics & macro focus.",
      prompt: "Luxury matte black smartwatch spinning on water ripples, softbox rim lighting, studio reflection",
      badge: "Commercial Ad",
      metrics: "High Conversion • Ray-Traced 3D",
      gradient: "from-amber-950/80 via-rose-950/60 to-black",
      accent: "border-amber-500/50 text-amber-300",
    },
    {
      id: "reels" as VideoCategory,
      name: "Viral Short-Form Reels",
      tag: "9:16 TikTok / Shorts",
      icon: Layers,
      desc: "Hook-optimized short videos with auto-generated kinetic captions & sound effects.",
      prompt: "High energy tech founder explaining 3 viral AI shortcuts, fast pacing, kinetic subtitles, pop-up graphics",
      badge: "95%+ Watch Time",
      metrics: "Auto Captions • B-Roll Engine",
      gradient: "from-pink-950/80 via-fuchsia-900/60 to-black",
      accent: "border-pink-500/50 text-pink-300",
    },
  ];

  const comments = [
    {
      name: "Marcus Vance",
      handle: "@marcus_vance",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
      text: "Insane quality! Is this video actually synthesized by AI in under 10 seconds?! 🤯",
      likes: "2.4k",
      time: "2m ago",
      tag: "VIRAL HOOK",
    },
    {
      name: "Sophia Lin",
      handle: "@sophia_creates",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80",
      text: "Monetized my first YouTube Shorts channel in 3 days with Spark! Made $1,240 yesterday! 💰🔥",
      likes: "1.8k",
      time: "5m ago",
      tag: "$1.2k EARNED",
    },
    {
      name: "Devon Reed",
      handle: "@devon_media",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
      text: "The product ad video converted at 14.8% ROAS! Our e-com revenue tripled this week 📈",
      likes: "940",
      time: "12m ago",
      tag: "14.8% ROAS",
    },
  ];

  const activeVideoInfo = videoTypes.find((v) => v.id === activeVideoCategory) || videoTypes[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#080B11] text-white flex flex-col justify-between overflow-hidden select-none font-sans antialiased">
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-[#BA00C0]/25 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[150px]" />
        <div className="absolute top-[40%] right-[-5%] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[140px]" />
        {/* Subtle Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      </div>

      {/* TOP BAR */}
      <header className="relative z-10 px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <SparkLogo className="w-10 h-10" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-fuchsia-300">
                Spark AI Engine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#BA00C0]/30 border border-[#BA00C0]/50 text-[10px] font-semibold text-fuchsia-300 uppercase tracking-widest">
                v3.8 Production
              </span>
            </div>
            <p className="text-xs text-purple-200/70">
              AI media industry production system for monetization & virality
            </p>
          </div>
        </div>

        {/* Stage Selector Pills */}
        <div className="hidden md:flex items-center bg-black/60 border border-white/10 rounded-full p-1 space-x-1">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const isActive = activeStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => {
                  setActiveStage(stage.id);
                  setAutoTimerProgress(0);
                }}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-r " + stage.color + " text-white shadow-md shadow-purple-500/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{stage.title}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors"
            title={isPlaying ? "Pause Showcase" : "Play Showcase"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={onComplete}
            className="group relative flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#BA00C0] to-purple-600 hover:from-[#d100d8] hover:to-purple-500 text-white font-semibold text-xs tracking-wide shadow-xl shadow-[#BA00C0]/30 border border-white/20 transition-all transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <span>Enter Spark Sign In</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </header>

      {/* STAGE MAIN DISPLAY */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-6xl mx-auto w-full">
        {/* Stage 0: AI Prompt to Video Generation */}
        {activeStage === 0 && (
          <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Stage Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 animate-spin" />
                <span>Text-to-Video Latent Diffusion Engine</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-fuchsia-300">
                Generating Cinema-Grade 4K Video in Seconds
              </h2>
              <p className="text-sm text-gray-400 max-w-2xl mx-auto">
                Watch real-time multi-modal AI synthesize lighting, camera choreography, particle physics, and audio in 1-click.
              </p>
            </div>

            {/* Simulated Live Video Generation Dashboard */}
            <div className="bg-black/60 border border-white/15 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              {/* Top Prompt Input */}
              <div className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-6">
                <Zap className="w-5 h-5 text-fuchsia-400 shrink-0 animate-pulse" />
                <div className="flex-1 font-mono text-xs md:text-sm text-purple-200 truncate">
                  <span className="text-purple-400 font-bold mr-2">PROMPT &gt;</span>
                  "Generate 4K anamorphic cinematic video of cybernetic runner navigating neon marketplace with particle refraction..."
                </div>
                <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[11px] font-mono border border-purple-500/40 shrink-0">
                  30 FPS • 4K HDR
                </span>
              </div>

              {/* Main Video Generation Canvas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Simulated Main Video Viewport */}
                <div className="md:col-span-2 relative aspect-video rounded-xl border border-purple-500/30 overflow-hidden bg-gradient-to-br from-purple-950/80 via-black to-slate-950 shadow-2xl group">
                  {/* Simulated Animated Video Scene */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-fuchsia-600/30 via-purple-900/20 to-black animate-pulse" />
                  
                  {/* Neural Scan Line Simulation */}
                  <div
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_15px_#e040ff] z-20 transition-all duration-300"
                    style={{ top: `${genProgress}%` }}
                  />

                  {/* Rendered Frame Preview Artwork / Cyberpunk Scene Elements */}
                  <div className="absolute inset-0 flex flex-col justify-between p-4 z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-[11px] font-mono text-emerald-300 font-bold">RENDERING FRAME #148</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-purple-300">
                        LATENT DIFFUSION 3.8
                      </div>
                    </div>

                    {/* Center Animated Particle Wave */}
                    <div className="my-auto text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-[#BA00C0]/30 border border-[#BA00C0] flex items-center justify-center shadow-2xl shadow-[#BA00C0]/50 animate-bounce">
                        <Film className="w-8 h-8 text-fuchsia-300" />
                      </div>
                      <div className="font-mono text-xs text-fuchsia-200 font-bold tracking-widest uppercase">
                        AI Neural Frame Synthesis: {genProgress}%
                      </div>
                    </div>

                    {/* Bottom Status Ticker */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 bg-black/70 backdrop-blur-md p-2 rounded-lg border border-white/10">
                      <span>VOXEL MESH: OK</span>
                      <span>LIGHTING: VOLUMETRIC</span>
                      <span className="text-fuchsia-400 font-bold">UP-SCALED: 3840x2160</span>
                    </div>
                  </div>
                </div>

                {/* Right Generation Specs & Step Metrics */}
                <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Live Pipeline</span>
                    <span className="text-emerald-400 font-mono">0.8s / frame</span>
                  </h4>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-black/40 border border-emerald-500/30 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-gray-200">Semantic Prompt Tokenization</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">100%</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/40 border border-fuchsia-500/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-fuchsia-400 animate-spin" />
                        <span className="text-purple-200 font-medium">3D Temporal Diffusion</span>
                      </div>
                      <span className="text-[10px] text-fuchsia-400 font-mono">{genProgress}%</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between opacity-70">
                      <div className="flex items-center space-x-2">
                        <Volume2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">Spatial AI Audio Master</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">QUEUED</span>
                    </div>
                  </div>

                  {/* Progress Meter Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-[11px] font-mono text-purple-300 mb-1">
                      <span>RENDER COMPLETION</span>
                      <span>{genProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-cyan-400 transition-all duration-300 shadow-[0_0_10px_#e040ff]"
                        style={{ width: `${genProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage 1: Multi-Genre Video Types (Film, Anime, Product, Reels) */}
        {activeStage === 1 && (
          <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Multi-Format Creative Engine</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-purple-300">
                Any Style. Any Genre. Instant Production.
              </h2>
              <p className="text-sm text-gray-400 max-w-2xl mx-auto">
                Generate high-performing video content across 4K Cinema, 2D/3D Animation, E-Commerce Products, and Viral Reels.
              </p>
            </div>

            {/* Video Category Switch Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {videoTypes.map((vt) => {
                const Icon = vt.icon;
                const isSelected = activeVideoCategory === vt.id;
                return (
                  <button
                    key={vt.id}
                    onClick={() => setActiveVideoCategory(vt.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all duration-300 relative overflow-hidden ${
                      isSelected
                        ? "bg-black/80 " + vt.accent + " shadow-xl scale-[1.02] ring-1 ring-white/30"
                        : "bg-black/40 border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg bg-white/5 ${isSelected ? "text-white" : ""}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300">
                        {vt.tag}
                      </span>
                    </div>
                    <div className="font-bold text-xs md:text-sm text-white mb-0.5">{vt.name}</div>
                    <div className="text-[11px] text-gray-400 truncate">{vt.badge}</div>
                  </button>
                );
              })}
            </div>

            {/* Featured Video Type Deep Showcase */}
            <div className={`bg-gradient-to-br ${activeVideoInfo.gradient} border ${activeVideoInfo.accent} rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden transition-all duration-500`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Left Media Stage */}
                <div className="relative aspect-video rounded-xl border border-white/20 overflow-hidden bg-black/80 flex items-center justify-center group shadow-2xl">
                  {/* Dynamic Gradient Background Visual */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 via-fuchsia-500/20 to-transparent opacity-80 group-hover:scale-105 transition-transform duration-700" />
                  
                  {/* Central Play Icon & Pulse */}
                  <div className="relative z-10 text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/30 flex items-center justify-center backdrop-blur-md shadow-2xl mx-auto">
                      <Play className="w-8 h-8 text-white fill-white ml-1" />
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full bg-black/60 border border-white/20 text-xs font-mono text-purple-200">
                      {activeVideoInfo.metrics}
                    </span>
                  </div>

                  {/* Top Left Badge */}
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-xs font-bold text-white flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
                    <span>{activeVideoInfo.badge}</span>
                  </div>
                </div>

                {/* Right Details & Prompt Capabilities */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center space-x-2">
                      <span>{activeVideoInfo.name}</span>
                    </h3>
                    <p className="text-xs text-gray-300 leading-relaxed">{activeVideoInfo.desc}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-2 font-mono text-xs">
                    <div className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider">
                      AI Generation Blueprint
                    </div>
                    <p className="text-gray-200 italic">"{activeVideoInfo.prompt}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                      <div className="text-lg font-black text-emerald-400">98.4%</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">Audience Retention</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                      <div className="text-lg font-black text-fuchsia-400">&lt; 15s</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">Generation Speed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: Monetization & Revenue Expansion Graph */}
        {activeStage === 2 && (
          <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Automated Monetization Engine</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-teal-300">
                Turn AI Views into Predictable Creator Revenue
              </h2>
              <p className="text-sm text-gray-400 max-w-2xl mx-auto">
                Automatic RPM optimization, ad placement hooks, and multi-platform monetization across YouTube, TikTok & Meta.
              </p>
            </div>

            {/* Monetization Main Card */}
            <div className="bg-black/60 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Live Ticker Cards */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/60 to-black border border-emerald-500/40 space-y-1">
                    <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider">
                      ESTIMATED MONTHLY PAYOUT
                    </span>
                    <div className="text-3xl font-black text-white font-mono flex items-baseline space-x-2">
                      <span>${earningsValue.toLocaleString()}</span>
                      <span className="text-xs text-emerald-400 font-bold">+342% ↗</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Directly deposited via Stripe & AdSense</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-gray-400">AVG RPM</div>
                      <div className="text-lg font-black text-emerald-400">$14.80</div>
                      <div className="text-[10px] text-gray-400">/ 1,000 views</div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-gray-400">VIRAL LIFT</div>
                      <div className="text-lg font-black text-fuchsia-400">4.8x</div>
                      <div className="text-[10px] text-gray-400">Multiplier</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="text-xs font-bold text-gray-300 flex justify-between">
                      <span>Revenue Breakdown</span>
                      <span className="text-emerald-400">Active</span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-gray-300">
                        <span>Ad Sense & Creator Fund</span>
                        <span className="text-white font-bold">$12,400</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Brand Sponsorships</span>
                        <span className="text-white font-bold">$4,850</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Affiliate & Digital Sales</span>
                        <span className="text-white font-bold">$1,690</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Animated Revenue Growth Graph */}
                <div className="md:col-span-2 bg-gradient-to-b from-black to-emerald-950/20 border border-white/10 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-white">Cumulative Revenue Growth (30 Days)</h4>
                      <p className="text-xs text-gray-400">AI-generated content channel expansion</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/40">
                      LIVE DATA
                    </span>
                  </div>

                  {/* SVG Animated Area Chart */}
                  <div className="relative h-48 w-full">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Horizontal Lines */}
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#ffffff15" strokeDasharray="4 4" />
                      <line x1="0" y1="75" x2="500" y2="75" stroke="#ffffff15" strokeDasharray="4 4" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="#ffffff15" strokeDasharray="4 4" />

                      {/* Area Fill */}
                      <path
                        d="M 0,140 Q 100,120 200,80 T 400,30 T 500,10 L 500,150 L 0,150 Z"
                        fill="url(#chartGrad)"
                      />

                      {/* Main Glow Line */}
                      <path
                        d="M 0,140 Q 100,120 200,80 T 400,30 T 500,10"
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="4"
                        className="shadow-[0_0_15px_#10b981]"
                      />

                      {/* Key Milestone Nodes */}
                      <circle cx="100" cy="120" r="5" fill="#34d399" />
                      <circle cx="200" cy="80" r="5" fill="#34d399" />
                      <circle cx="400" cy="30" r="5" fill="#34d399" />
                      <circle cx="500" cy="10" r="7" fill="#6ee7b7" className="animate-ping" />
                      <circle cx="500" cy="10" r="6" fill="#34d399" />
                    </svg>

                    {/* Milestone Tooltip Overlays */}
                    <div className="absolute top-2 right-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/50 p-2 rounded-lg text-xs font-mono text-emerald-200">
                      Day 30: $18,940.00
                    </div>
                  </div>

                  {/* X-Axis Timeline Labels */}
                  <div className="flex justify-between text-[11px] font-mono text-gray-400 pt-2 border-t border-white/10">
                    <span>Day 1 ($0)</span>
                    <span>Day 7 ($1.4k)</span>
                    <span>Day 14 ($5.8k)</span>
                    <span>Day 21 ($11.2k)</span>
                    <span className="text-emerald-400 font-bold">Day 30 ($18.9k)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage 3: Viral Shockwaves & Shocked/Smiling User Audience Reactions */}
        {activeStage === 3 && (
          <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 animate-bounce" />
                <span>Audience Virality & Reaction Signals</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-rose-100 to-amber-300">
                Millions of Views & Mind-Blown Audiences
              </h2>
              <p className="text-sm text-gray-400 max-w-2xl mx-auto">
                Watch Spark content generate massive engagement loops, shocked reactions, and viral comment explosions.
              </p>
            </div>

            {/* Shocked & Smiling Users Showcase Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User Reaction Card 1: Shocked / Mind-Blown Creator */}
              <div className="bg-gradient-to-b from-purple-950/70 via-black to-black border border-purple-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-[10px] font-mono font-bold text-purple-300">
                  SHOCKED CREATOR
                </div>

                <div className="flex items-center space-x-3 mb-4">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                      alt="Shocked Creator"
                      className="w-14 h-14 rounded-full object-cover border-2 border-purple-400 shadow-xl"
                    />
                    <span className="absolute -bottom-1 -right-1 text-xl animate-bounce">🤯</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Alex K.</h4>
                    <p className="text-xs text-purple-300">@alex_tech_viral</p>
                    <div className="text-[10px] text-emerald-400 font-mono font-bold">9.8M Views in 24h</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200 leading-relaxed italic mb-3">
                  "I posted the AI video generated by Spark at 11 PM. Woke up at 7 AM to 9.8 MILLION VIEWS! My phone notification sound went completely crazy!"
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-2 border-t border-white/10">
                  <span className="flex items-center space-x-1 text-rose-400 font-bold">
                    <Heart className="w-3.5 h-3.5 fill-rose-400" />
                    <span>842.5k Likes</span>
                  </span>
                  <span className="text-purple-300">32.4k Shares</span>
                </div>
              </div>

              {/* User Reaction Card 2: Smiling & Hyped Creator */}
              <div className="bg-gradient-to-b from-emerald-950/70 via-black to-black border border-emerald-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-mono font-bold text-emerald-300">
                  HAPPY CREATOR
                </div>

                <div className="flex items-center space-x-3 mb-4">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80"
                      alt="Smiling Creator"
                      className="w-14 h-14 rounded-full object-cover border-2 border-emerald-400 shadow-xl"
                    />
                    <span className="absolute -bottom-1 -right-1 text-xl animate-bounce">😁</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Sarah Chen</h4>
                    <p className="text-xs text-emerald-300">@sarah_media_studio</p>
                    <div className="text-[10px] text-emerald-400 font-mono font-bold">+$4,250 First Payout</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200 leading-relaxed italic mb-3">
                  "Finally quit my 9-to-5! Spark automated my entire 3D product video workflow. We scale 15 channels concurrently with zero stress!"
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-2 border-t border-white/10">
                  <span className="flex items-center space-x-1 text-emerald-400 font-bold">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>$18,400/mo</span>
                  </span>
                  <span className="text-emerald-300">Automated</span>
                </div>
              </div>

              {/* Live Comment Stream Feed */}
              <div className="bg-black/60 border border-white/15 rounded-2xl p-5 shadow-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-bold text-gray-300 flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-fuchsia-400" />
                    <span>Real-Time Audience Feed</span>
                  </span>
                  <span className="text-[10px] font-mono text-rose-400 font-bold">
                    ❤️ {likeCount.toLocaleString()} LIKES
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[190px] overflow-hidden">
                  {comments.map((comment, index) => (
                    <div
                      key={index}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <img
                            src={comment.avatar}
                            alt={comment.name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-white">{comment.name}</span>
                          <span className="text-[10px] text-gray-400">{comment.handle}</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 font-mono">
                          {comment.tag}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300">{comment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM CONTROL & AUTO TIMER FOOTER */}
      <footer className="relative z-10 px-6 py-4 border-t border-white/10 bg-black/60 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Stage Progress Indicators */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {stages.map((st) => (
            <button
              key={st.id}
              onClick={() => {
                setActiveStage(st.id);
                setAutoTimerProgress(0);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                activeStage === st.id
                  ? "w-12 bg-gradient-to-r from-[#BA00C0] to-cyan-400 shadow-[0_0_10px_#e040ff]"
                  : "w-3 bg-white/20 hover:bg-white/40"
              }`}
              title={st.title}
            />
          ))}
          <span className="text-xs font-mono text-gray-400 ml-2">
            Stage 0{activeStage + 1} / 04
          </span>
        </div>

        {/* Auto Progress Bar Message */}
        <div className="flex items-center space-x-4">
          <span className="text-xs text-gray-400 hidden sm:inline">
            Auto-advancing showcase • Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-purple-200">Sign In</kbd> anytime
          </span>

          <button
            onClick={onComplete}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#BA00C0] via-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-[#BA00C0]/40 border border-white/20 transition-all hover:scale-105"
          >
            <span>Proceed to Spark Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};
