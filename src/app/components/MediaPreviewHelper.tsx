import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, Maximize, Check, Sparkles, Film, ArrowRight, Music } from "lucide-react";

// Color maps and short labels for gorgeous custom thumbnails
export function getMediaTheme(id: string) {
  const themes: Record<string, { from: string; via: string; to: string; text: string; tag: string; emoji: string }> = {
    p1: { from: "from-amber-500", via: "via-red-500", to: "to-purple-600", text: "5 VIRAL TACTICS", tag: "MARKETING", emoji: "🔥" },
    p2: { from: "from-purple-600", via: "via-indigo-500", to: "to-blue-600", text: "VIRAL BRAIN", tag: "PSYCHOLOGY", emoji: "🧠" },
    p3: { from: "from-teal-400", via: "via-emerald-500", to: "to-cyan-600", text: "AI STORIES", tag: "AI WRITING", emoji: "✨" },
    p4: { from: "from-rose-500", via: "via-pink-500", to: "to-orange-500", text: "BRAND 2026", tag: "CREATOR", emoji: "👑" },
    p5: { from: "from-blue-600", via: "via-indigo-600", to: "to-teal-500", text: "WORKFLOW 10X", tag: "OPTIMIZATION", emoji: "⚡" },
    r1: { from: "from-amber-500", via: "via-red-500", to: "to-purple-600", text: "5 VIRAL TACTICS", tag: "MARKETING", emoji: "🔥" },
    r2: { from: "from-purple-600", via: "via-indigo-500", to: "to-blue-600", text: "VIRAL BRAIN", tag: "PSYCHOLOGY", emoji: "🧠" },
    r3: { from: "from-teal-400", via: "via-emerald-500", to: "to-cyan-600", text: "AI STORIES", tag: "AI WRITING", emoji: "✨" },
    r4: { from: "from-rose-500", via: "via-pink-500", to: "to-orange-500", text: "BRAND 2026", tag: "CREATOR", emoji: "👑" },
    r5: { from: "from-blue-600", via: "via-indigo-600", to: "to-teal-500", text: "WORKFLOW 10X", tag: "OPTIMIZATION", emoji: "⚡" },
  };

  const keys = Object.keys(themes);
  const matchedKey = keys.find(k => id.toLowerCase().includes(k));
  if (matchedKey) return themes[matchedKey];

  // Default fallback gradient generator
  return {
    from: "from-blue-500",
    via: "via-purple-500",
    to: "to-pink-500",
    text: "CREATIVE DRAFT",
    tag: "SPARK",
    emoji: "🚀"
  };
}

interface MiniMediaThumbnailProps {
  id: string;
  title: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  isVideo?: boolean;
  className?: string;
  duration?: string;
}

export function MiniMediaThumbnail({ id, title, aspectRatio = "16:9", isVideo = false, className = "", duration = "12:15" }: MiniMediaThumbnailProps) {
  const theme = getMediaTheme(id);
  const isVertical = aspectRatio === "9:16";
  const isSquare = aspectRatio === "1:1";

  const sizeClass = isVertical 
    ? "w-10 h-16" 
    : isSquare 
      ? "w-12 h-12" 
      : "w-20 h-12";

  return (
    <div className={`relative ${sizeClass} rounded-lg overflow-hidden bg-background border border-border/60 flex-shrink-0 select-none ${className}`}>
      {/* Background Gradient Layer with Grid pattern */}
      <div className={`absolute inset-0 bg-gradient-to-tr ${theme.from} ${theme.via} ${theme.to} opacity-90`} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30" />
      
      {/* Text Backdrop Panel */}
      <div className="absolute inset-x-1 bottom-1 top-1 bg-black/25 backdrop-blur-[1px] rounded flex flex-col justify-between p-1">
        <span className="text-[7px] font-bold text-white tracking-widest uppercase opacity-90 truncate">
          {theme.tag}
        </span>
        <span className="text-[8px] font-black leading-none text-white tracking-tight break-all line-clamp-2 uppercase">
          {theme.text}
        </span>
      </div>

      {/* Overlay badges */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-all duration-200">
          <div className="w-5 h-5 rounded-full bg-white/90 shadow flex items-center justify-center">
            <Play className="w-2.5 h-2.5 text-black fill-current translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Duration Badge */}
      {!isVertical && (
        <span className="absolute bottom-0.5 right-1 bg-black/80 px-1 py-[1px] rounded text-[7px] font-mono text-white">
          {duration}
        </span>
      )}
    </div>
  );
}

interface ThumbnailVariantCardProps {
  id: string;
  variant: "A" | "B" | "C";
  concept: string;
  isSelected: boolean;
  onClick: () => void;
}

export function ThumbnailVariantCard({ id, variant, concept, isSelected, onClick }: ThumbnailVariantCardProps) {
  const theme = getMediaTheme(id);
  
  // Custom design configurations per variant
  const designs = {
    A: {
      tagColor: "bg-success text-white",
      styleName: "Cinematic Split",
      gradient: "from-slate-900 via-neutral-800 to-black",
      textLayout: "left-4 bottom-4 text-left max-w-[80%]",
      accentText: "5 VIRAL SECRETS",
      badge: "🔥 HIGH CTR",
    },
    B: {
      tagColor: "bg-accent text-white",
      styleName: "Bold Reaction Accent",
      gradient: `from-purple-900 via-violet-800 to-indigo-950`,
      textLayout: "left-4 right-4 bottom-4 text-center",
      accentText: "STOP WASTING ₦₦₦",
      badge: "🚀 VIRAL WINNER",
    },
    C: {
      tagColor: "bg-destructive text-white",
      styleName: "Focal Curiosity Loop",
      gradient: `from-rose-950 via-neutral-900 to-slate-950`,
      textLayout: "left-4 bottom-4 text-left",
      accentText: "THIS WORKS IN 2026",
      badge: "💡 EXPERT CHOICE",
    }
  };

  const d = designs[variant];

  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-xl border text-left overflow-hidden bg-card transition-all duration-200 active:scale-[0.99] ${
        isSelected 
          ? "border-accent ring-2 ring-accent/30 shadow-lg" 
          : "border-border hover:border-accent/40 hover:shadow-md"
      }`}
    >
      {/* Design Poster Preview */}
      <div className="aspect-video relative overflow-hidden bg-background">
        {/* Colorful Abstract Graphic Backdrops */}
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.from} ${theme.via} ${theme.to} opacity-40`} />
        <div className={`absolute inset-0 bg-gradient-to-tr ${d.gradient} mix-blend-multiply opacity-90`} />
        
        {/* Aesthetic design patterns */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px]" />
        
        {/* Interactive glow pointer */}
        <div className="absolute top-4 right-4 px-2 py-0.5 rounded bg-black/80 text-[9px] font-mono font-medium text-white tracking-wider">
          VARIANT {variant}
        </div>

        {/* Floating Host Sticker Mockup */}
        <div className="absolute right-3 bottom-0 w-20 h-20 opacity-90 group-hover:scale-105 transition-transform duration-300">
          <div className="w-full h-full rounded-full bg-gradient-to-b from-white/20 to-black/50 border border-white/15 flex items-center justify-center overflow-hidden">
            <span className="text-3xl filter saturate-100">🧑🏾‍💻</span>
          </div>
          {/* Neon speech bubble */}
          <div className="absolute -top-1 -left-2 bg-accent text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg text-white">
            Tunde
          </div>
        </div>

        {/* Text Overlay Designs */}
        <div className={`absolute ${d.textLayout} p-1`}>
          <p className="text-[10px] font-extrabold text-amber-400 tracking-wider uppercase mb-1 drop-shadow-md">
            {d.accentText}
          </p>
          <h4 className="text-xs md:text-sm font-black text-white leading-tight uppercase tracking-tight drop-shadow-lg line-clamp-2">
            {theme.text}
          </h4>
        </div>

        {/* Tag Pill */}
        <div className="absolute top-4 left-4">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${d.tagColor}`}>
            {d.badge}
          </span>
        </div>
      </div>

      <div className="p-3 border-t border-border/50 bg-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">{d.styleName}</span>
          {isSelected && (
            <span className="w-4 h-4 rounded-full bg-accent flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" />
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {concept}
        </p>
      </div>
    </button>
  );
}

interface InteractiveVideoPlayerProps {
  id: string;
  title: string;
  scenes?: { scene: number; description: string; duration: string }[];
  durationText?: string;
  onApprove?: () => void;
}

export function InteractiveVideoPlayer({ id, title, scenes = [], durationText = "3:20", onApprove }: InteractiveVideoPlayerProps) {
  const theme = getMediaTheme(id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  
  const totalSeconds = 200; // Mock 200 seconds length
  const progressPercent = (currentTime / totalSeconds) * 100;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Map progress to active storyboard scene
  const activeSceneIndex = Math.min(
    Math.floor((currentTime / totalSeconds) * (scenes.length || 1)),
    (scenes.length || 1) - 1
  );

  const activeScene = scenes[activeSceneIndex] || {
    scene: 1,
    description: "Intro Hook: Eye-catching pattern interrupt graphic",
    duration: "0-10s"
  };

  return (
    <div className="rounded-xl border border-border bg-black overflow-hidden flex flex-col md:flex-row h-auto md:h-[420px] shadow-2xl">
      {/* LEFT: Video Screen Container */}
      <div className="flex-1 relative aspect-video md:aspect-auto bg-neutral-950 flex flex-col justify-between overflow-hidden group select-none">
        
        {/* Animated video background representation */}
        <div className={`absolute inset-0 bg-gradient-to-tr ${theme.from} ${theme.via} ${theme.to} transition-all duration-1000 ${
          isPlaying ? "animate-pulse saturate-150 scale-105" : "saturate-75"
        }`} />
        
        {/* Media patterns & overlays */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/60" />

        {/* Equalizer animation overlay when playing */}
        {isPlaying && (
          <div className="absolute right-6 top-6 flex items-end gap-[3px] h-6">
            {[1, 2, 3, 4, 5, 4, 3, 2, 5, 2, 4].map((h, i) => (
              <span
                key={i}
                className="w-[2px] bg-white rounded-full animate-bounce"
                style={{
                  height: `${h * 20}%`,
                  animationDuration: `${0.4 + i * 0.1}s`,
                  animationDelay: `${i * 0.05}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Platform logo indicator (YouTube style or TikTok format) */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white border border-white/10">
          <Film className="w-3 h-3 text-red-500 fill-current" />
          <span className="font-semibold uppercase tracking-wider text-[9px]">
            {theme.tag} Spark preview
          </span>
        </div>

        {/* Screen center: Host Character Avatar & Subtitles overlay */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          
          {/* Interactive play circle overlay */}
          {!isPlaying && (
            <button
              onClick={() => setIsPlaying(true)}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200 shadow-xl cursor-pointer z-10"
            >
              <Play className="w-7 h-7 fill-current translate-x-0.5 text-black" />
            </button>
          )}

          {/* Simulated Host avatar reacting in viewport */}
          <div className={`w-28 h-28 rounded-full border-4 border-white/15 bg-white/10 flex items-center justify-center transition-all duration-500 overflow-hidden ${
            isPlaying ? "scale-105 rotate-1" : "scale-90"
          }`}>
            <span className={`text-6xl ${isPlaying ? "animate-wiggle" : ""}`}>🧑🏾‍💻</span>
          </div>

          {/* Real-time speech subtitle transcription bubble */}
          <div className="mt-4 max-w-md bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl text-center shadow-2xl">
            <span className="text-[10px] font-bold text-accent tracking-widest uppercase block mb-0.5">
              Tunde speaking
            </span>
            <p className="text-xs font-medium text-white leading-relaxed line-clamp-2">
              {isPlaying 
                ? `"...${activeScene.description}. This ensures high engagement right away."`
                : `[Video Paused] - Click Play to simulate and preview scene transitions.`
              }
            </p>
          </div>
        </div>

        {/* Video Control Bar Panel */}
        <div className="p-3 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 relative z-10">
          {/* Progress Timeline Slider */}
          <div className="flex items-center gap-3 group/timeline mb-2">
            <span className="text-[10px] font-mono text-white/85">
              {formatTime(currentTime)}
            </span>
            <div 
              className="flex-1 h-1.5 rounded-full bg-white/20 relative cursor-pointer overflow-hidden"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const newPercent = clickX / rect.width;
                setCurrentTime(Math.floor(newPercent * totalSeconds));
              }}
            >
              <div 
                className={`h-full bg-accent relative rounded-full`} 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
            <span className="text-[10px] font-mono text-white/50">
              {formatTime(totalSeconds)}
            </span>
          </div>

          {/* Bottom control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-white hover:text-accent transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-white" />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume} 
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-12 h-1 accent-accent bg-white/20 rounded-full cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {["English", "Pidgin"].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      selectedLanguage === lang ? "bg-accent text-white font-bold" : "text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <Maximize className="w-4 h-4 text-white hover:text-accent cursor-pointer" />
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT: Active Storyboard Interactive Script Queue */}
      <div className="w-full md:w-80 bg-neutral-900 border-l border-border/40 flex flex-col justify-between overflow-hidden">
        <div className="p-4 border-b border-border/30 bg-neutral-950/60">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <span>Storyboard Script</span>
            <span className="text-accent text-[10px] font-mono">Active Scene {activeScene.scene}</span>
          </h3>
        </div>

        {/* Scrollable scene list that auto-scrolls/highlights */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-none">
          {scenes.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.scene}
                onClick={() => {
                  const chunk = totalSeconds / (scenes.length || 1);
                  setCurrentTime(Math.floor(index * chunk + 1));
                  setIsPlaying(true);
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  isActive 
                    ? "bg-accent/15 border-accent text-white shadow-md shadow-accent/5" 
                    : "bg-neutral-950/40 border-neutral-800/80 text-muted-foreground hover:bg-neutral-800/40 hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[10px] font-bold tracking-wider ${isActive ? "text-accent" : "text-muted-foreground/60"}`}>
                    SCENE {scene.scene}
                  </span>
                  <span className="text-[9px] font-mono bg-black/40 px-1 py-[1px] rounded">
                    {scene.duration}
                  </span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-2">
                  {scene.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* CTA approval trigger */}
        {onApprove && (
          <div className="p-3 bg-neutral-950 border-t border-border/20">
            <button
              onClick={onApprove}
              className="w-full py-2.5 bg-success hover:bg-success/90 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform"
            >
              <Check className="w-3.5 h-3.5" />
              Approve Storyboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
