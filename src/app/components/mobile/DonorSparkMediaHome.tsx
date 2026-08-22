import React, { useState, useRef } from "react";
import { useSpark } from "../../state/SparkContext";
import { useAuth } from "../../state/AuthContext";
import { AIChatModal } from "../AIChatModal";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Flame,
  Search,
  Loader2,
  Play,
  Pause,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

// Shared visual tokens from SPARK DONOR — same family as Brand Genesis
const M = {
  bg: "#0B0F17",
  card: "rgba(255,255,255,0.035)",
  cardHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.09)",
  borderHi: "rgba(168,85,247,0.45)",
  purple: "#a855f7",
  magenta: "#F018FF",
  muted: "rgba(255,255,255,0.38)",
  body: "rgba(255,255,255,0.78)",
  label: "rgba(255,255,255,0.25)",
};

const MOBILE_STYLES = `
  /* press feedback */
  .m-press { transition: transform 0.14s ease, opacity 0.14s ease; cursor: pointer; }
  .m-press:active { transform: scale(0.96); opacity: 0.84; }

  /* card entry — mirrors genesis-in from onboarding */
  @keyframes m-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .m-card-in { animation: m-card-in 0.32s ease both; }

  /* orb background blobs */
  @keyframes orb-drift {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(14px,-10px) scale(1.05); }
    66%      { transform: translate(-10px,12px) scale(0.96); }
  }

  /* neon border — same as onboard neon-border-flow */
  @keyframes neon-border-flow {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes neon-glow-pulse {
    0%,100% { box-shadow: 0 0 12px rgba(168,85,247,0.5), 0 0 24px rgba(240,24,255,0.2); }
    50%      { box-shadow: 0 0 22px rgba(168,85,247,0.9), 0 0 44px rgba(240,24,255,0.4); }
  }
  .neon-pill-wrap {
    padding: 1.5px; border-radius: 50px;
    background: linear-gradient(90deg,#a855f7,#22d3ee,#ec4899,#6366f1,#F018FF,#a855f7);
    background-size: 400% 400%;
    animation: neon-border-flow 2.6s ease infinite, neon-glow-pulse 2.6s ease infinite;
  }
  .neon-pill-inner {
    background: #0B0F17; border-radius: 50px;
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; cursor: pointer;
  }

  /* pipeline node pulse */
  @keyframes node-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(240,24,255,0.6); }
    50%      { box-shadow: 0 0 0 6px rgba(240,24,255,0); }
  }
  .node-active { animation: node-pulse 1.6s ease infinite; }

  /* decision card glow */
  @keyframes decision-glow-amber {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
    50%      { box-shadow: 0 2px 18px rgba(245,158,11,0.14); }
  }
  @keyframes decision-glow-magenta {
    0%,100% { box-shadow: 0 0 0 0 rgba(240,24,255,0); }
    50%      { box-shadow: 0 2px 18px rgba(240,24,255,0.14); }
  }
  @keyframes decision-glow-green {
    0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    50%      { box-shadow: 0 2px 18px rgba(34,197,94,0.14); }
  }

  /* thinking dots */
  @keyframes thinking-pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.8); }
  }

  /* photo card zoom on entry */
  @keyframes photo-zoom-in {
    from { transform: scale(1.06); }
    to   { transform: scale(1); }
  }
  .photo-zoom { animation: photo-zoom-in 600ms ease-out both; }

  /* ping for status dot */
  @keyframes ping {
    0%    { transform: scale(1); opacity: 0.8; }
    75%,100% { transform: scale(2); opacity: 0; }
  }
`;

function SparkLogoMark({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="sg_donor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d="M18 2L6 18h10l-2 12 14-16H18L18 2z" fill="url(#sg_donor)" />
    </svg>
  );
}

function MobileDecisionCard({
  accent,
  accentKey,
  title,
  subtitle,
  cta,
  onClick,
  delay = 0,
}: {
  accent: string;
  accentKey: "amber" | "magenta" | "green";
  title: string;
  subtitle: string;
  cta: string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="m-press m-card-in"
      style={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 20,
        padding: "16px 18px",
        animationDelay: `${delay}ms`,
        animation: `m-card-in 0.32s ease ${delay}ms both, decision-glow-${accentKey} 3s ease 0.4s infinite`,
      }}
    >
      {/* colored glow bar */}
      <div
        style={{
          width: 3,
          height: 40,
          borderRadius: 4,
          background: accent,
          flexShrink: 0,
          boxShadow: `0 0 10px ${accent}88`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "white", margin: 0, lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: 12, color: M.muted, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
          padding: "6px 12px",
          borderRadius: 50,
          background: `${accent}18`,
          border: `1px solid ${accent}40`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{cta}</span>
        <ArrowRight style={{ width: 12, height: 12, color: accent }} />
      </div>
    </button>
  );
}

function MobilePipelineStrip({ activeIdx = 1 }: { activeIdx?: number }) {
  const stages = ["Research", "Produce", "Review", "Publish", "Learn"];
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {stages.map((label, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
            {i > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 7,
                  left: "-50%",
                  width: "100%",
                  height: 1.5,
                  background: done
                    ? "linear-gradient(90deg,rgba(168,85,247,0.6),rgba(240,24,255,0.4))"
                    : "rgba(255,255,255,0.08)",
                }}
              />
            )}
            <div
              className={active ? "node-active" : ""}
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                zIndex: 1,
                position: "relative",
                background: active ? M.magenta : done ? "rgba(168,85,247,0.45)" : "transparent",
                border: `2px solid ${active ? M.magenta : done ? M.purple : "rgba(255,255,255,0.15)"}`,
                transition: "all 0.3s",
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: active ? "white" : done ? M.purple : M.label,
                fontWeight: active ? 700 : 400,
                textAlign: "center",
                lineHeight: 1.2,
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MobileMetricTile({
  value,
  label,
  color,
  onClick,
}: {
  value: string;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="m-press"
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 20,
        padding: "20px 14px",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: color || "white",
          margin: 0,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          textShadow: color ? `0 0 20px ${color}55` : undefined,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 11, color: M.muted, margin: "7px 0 0", lineHeight: 1.3 }}>{label}</p>
    </button>
  );
}

function VideoFullscreenModal({
  videoUrl,
  title,
  onClose,
}: {
  videoUrl: string;
  title?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration) setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B0F17] flex flex-col justify-between overflow-hidden select-none">
      {/* Header Bar with Onboard-style Close Button */}
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 z-20 bg-gradient-to-b from-[#0B0F17] via-[#0B0F17]/90 to-transparent">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider truncate max-w-[220px]">
            {title || "Spark Production"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white transition-all cursor-pointer shadow-lg"
          aria-label="Close video player"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Video Viewport — Contain in correct aspect */}
      <div 
        className="flex-1 relative flex items-center justify-center bg-black/90 cursor-pointer overflow-hidden"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          playsInline
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full object-contain max-h-[85vh]"
        />

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl scale-110">
              <Play className="w-8 h-8 fill-current text-black translate-x-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar — Copy Onboard Language */}
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/90 to-transparent z-20 space-y-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-white/70">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            className="flex-1 h-1.5 accent-purple-500 bg-white/20 rounded-full cursor-pointer"
          />
          <span className="text-[10px] font-mono text-white/40">{formatTime(duration)}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={togglePlay}
            className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? "Pause" : "Play Video"}</span>
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 transition-all"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface DonorSparkMediaHomeProps {
  onNavigate?: (path: string) => void;
}

export function DonorSparkMediaHome({ onNavigate = () => {} }: DonorSparkMediaHomeProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeFullscreenVideo, setActiveFullscreenVideo] = useState<{ videoUrl: string; title?: string } | null>(null);
  const { productions = [], reviewItems = [], viralSparks = [], brand, character } = useSpark() as any;
  const auth = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const brandName = brand?.name?.split(" ")[0] || auth.profile?.display_name || character?.name || "Creator";

  const pendingReviews = productions.filter((p: any) => ["Ready for Review", "Awaiting Review"].includes(p.status));
  const approvedProductions = productions.filter((p: any) => p.status === "Approved");
  const approvedCount = approvedProductions.length;
  const inProd = productions.filter((p: any) =>
    ["Drafting", "Draft", "Researching", "Research Complete", "Planning", "Planning Complete", "Storyboarding", "Storyboard Complete", "Generating", "Editing"].includes(p.status)
  ).length;

  const topSpark = viralSparks[0];

  const decisions = [
    pendingReviews.length > 0
      ? {
          accent: "#f59e0b",
          accentKey: "amber" as const,
          title: `${pendingReviews.length} review${pendingReviews.length > 1 ? "s" : ""} waiting`,
          subtitle: `"${pendingReviews[0].title || "Production Draft"}"`,
          cta: "Review",
          path: "/review",
        }
      : null,
    viralSparks.length > 0
      ? {
          accent: M.magenta,
          accentKey: "magenta" as const,
          title: `${viralSparks.length} opportunities detected`,
          subtitle: `"${topSpark?.title || "Viral Signal"}"`,
          cta: "Open",
          path: "/viral-sparks",
        }
      : null,
    approvedCount > 0
      ? {
          accent: "#22c55e",
          accentKey: "green" as const,
          title: `${approvedCount} ready to publish`,
          subtitle: "Approved · awaiting schedule",
          cta: "Schedule",
          path: "/review",
        }
      : null,
  ].filter(Boolean) as {
    accent: string;
    accentKey: "amber" | "magenta" | "green";
    title: string;
    subtitle: string;
    cta: string;
    path: string;
  }[];

  // Derive active pipeline stage index
  const activePipelineIndex = inProd > 0 ? 1 : pendingReviews.length > 0 ? 2 : approvedCount > 0 ? 3 : 0;

  // Build mixed live cards for Opportunities & Media strip
  const mixedItems = React.useMemo(() => {
    const items: Array<{
      id: string;
      type: "generating_production" | "review_production" | "viral_spark";
      title: string;
      subtitle: string;
      badge: string;
      badgeColor: string;
      score?: number;
      isGenerating?: boolean;
      stageLabel?: string;
      percent?: number;
      imageUrl?: string | null;
      videoUrl?: string | null;
      targetPath: string;
    }> = [];

    // 1. Productions (in progress & completed)
    (productions || []).forEach((prod: any) => {
      if (!prod || !prod.id) return;
      const review = (reviewItems || []).find(
        (r: any) => r.productionId === prod.id || r.id === prod.id || r.id === `rev-${prod.id}`
      );
      const brief = prod.brief || review?.brief;

      const isGenerating =
        prod.isGeneratingAssets ||
        (prod.generationProgress &&
          prod.generationProgress.percent > 0 &&
          prod.generationProgress.percent < 100 &&
          prod.generationProgress.stage !== "Complete" &&
          prod.generationProgress.stage !== "Cancelled" &&
          prod.generationProgress.stage !== "Failed");

      const stageLabel = prod.generationProgress?.stage || "Generating";
      const percent = prod.generationProgress?.percent || (prod.isGeneratingAssets ? 15 : 0);

      // Asset priority:
      // 1. videoUrl
      const videoUrl = prod.videoUrl || review?.videoUrl || brief?.videoUrl || brief?.generatedAssets?.generatedVideos?.[0];

      // 2. keyframe / storyboard frame
      const storyboardImage =
        prod.scenes?.find((s: any) => s.image)?.image ||
        brief?.storyboard?.find((s: any) => s.image)?.image ||
        prod.scenes?.[0]?.image ||
        brief?.storyboard?.[0]?.image ||
        brief?.generatedAssets?.generatedFrames?.[0];

      // 3. thumbnail variant
      const thumbImage =
        prod.thumbnails?.find((t: any) => t.image || t.url)?.image ||
        prod.thumbnails?.find((t: any) => t.image || t.url)?.url ||
        brief?.thumbnails?.[0]?.url ||
        brief?.thumbnails?.[0]?.image;

      // 4. character / brand avatar or clean fallback
      const fallbackImage = character?.avatarUrl || character?.imageUrl || brand?.logoUrl || null;

      const imageUrl = storyboardImage || thumbImage || fallbackImage;

      if (isGenerating) {
        items.push({
          id: `gen-${prod.id}`,
          type: "generating_production",
          title: prod.title || brief?.title || "AI Production Loop",
          subtitle: `${stageLabel} · ${percent}%`,
          badge: "GENERATING",
          badgeColor: M.magenta,
          isGenerating: true,
          stageLabel,
          percent,
          imageUrl,
          videoUrl,
          targetPath: "/review",
        });
      } else {
        items.push({
          id: `prod-${prod.id}`,
          type: "review_production",
          title: prod.title || brief?.title || "Production Review",
          subtitle: videoUrl ? "Playable MP4 Ready" : "Storyboard Stills & Audio",
          badge: videoUrl ? "VIDEO READY" : prod.status || "REVIEW READY",
          badgeColor: videoUrl ? "#22c55e" : "#f59e0b",
          isGenerating: false,
          imageUrl,
          videoUrl,
          targetPath: "/review",
        });
      }
    });

    // 2. Viral Sparks
    (viralSparks || []).forEach((spark: any, idx: number) => {
      if (!spark || !spark.title || spark.id?.startsWith("vs-init-")) return;
      const sparkThumb =
        spark.thumbnail ||
        spark.evidenceImage ||
        spark.imageUrl ||
        character?.avatarUrl ||
        brand?.logoUrl ||
        null;

      items.push({
        id: spark.id || `spark-${idx}`,
        type: "viral_spark",
        title: spark.title,
        subtitle: spark.platform || "TikTok & Reels Trend",
        badge: `${spark.window || "24h"} window`,
        badgeColor: "#f59e0b",
        score: spark.score || 94,
        imageUrl: sparkThumb,
        targetPath: "/viral-sparks",
      });
    });

    // Sort: In-progress generating first -> Review ready -> Viral Sparks
    return items.sort((a, b) => {
      if (a.isGenerating && !b.isGenerating) return -1;
      if (!a.isGenerating && b.isGenerating) return 1;
      if (a.type === "review_production" && b.type === "viral_spark") return -1;
      if (a.type === "viral_spark" && b.type === "review_production") return 1;
      return 0;
    }).slice(0, 8);
  }, [productions, reviewItems, viralSparks, brand, character]);

  return (
    <>
      <style>{MOBILE_STYLES}</style>

      {/* Sticky header — glass matching onboarding and donor home */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(8,12,20,0.88)",
          backdropFilter: "blur(24px)",
          padding: "0 22px",
          paddingTop: "calc(env(safe-area-inset-top,0px) + 18px)",
          paddingBottom: 16,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Spark label */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ position: "relative", display: "inline-flex" }}>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "#22c55e",
                    opacity: 0.5,
                    animation: "ping 1.8s ease infinite",
                  }}
                />
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22c55e",
                    display: "block",
                    position: "relative",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Spark
              </span>
            </div>
            {/* Greeting */}
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "white",
                margin: 0,
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
              }}
            >
              {greeting},<br />
              {brandName}
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", margin: "6px 0 0" }}>
              {viralSparks.length} opportunities · {pendingReviews.length} need review
            </p>
          </div>

          {/* Super Spark — neon pill */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="m-press"
            style={{ flexShrink: 0, background: "none", border: "none", padding: 0, marginTop: 2 }}
          >
            <div className="neon-pill-wrap">
              <div className="neon-pill-inner">
                <SparkLogoMark style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: M.purple, letterSpacing: "0.01em" }}>
                  Super Spark
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 88 }} className="scrollbar-none">
        {/* Background ambient orbs */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              right: -80,
              width: 320,
              height: 320,
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 0,
              background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 65%)",
              animation: "orb-drift 9s ease infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 200,
              left: -100,
              width: 280,
              height: 280,
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 0,
              background: "radial-gradient(circle, rgba(240,24,255,0.1) 0%, transparent 65%)",
              animation: "orb-drift 12s ease 2s infinite",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, padding: "28px 20px 0" }}>
            {/* Needs You Section */}
            <section style={{ marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.22)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Needs you
              </p>
              {decisions.length === 0 ? (
                <div
                  className="m-card-in"
                  style={{
                    padding: "24px 20px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 20,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
                    {"You're clear. Spark is watching."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {decisions.slice(0, 3).map((d, i) => (
                    <MobileDecisionCard
                      key={i}
                      accent={d.accent}
                      accentKey={d.accentKey}
                      title={d.title}
                      subtitle={d.subtitle}
                      cta={d.cta}
                      onClick={() => onNavigate(d.path)}
                      delay={i * 60}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Pipeline Section */}
            <section style={{ marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.22)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Pipeline
              </p>
              <div
                className="m-card-in"
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 20,
                  padding: "20px 18px 16px",
                }}
              >
                <MobilePipelineStrip activeIdx={activePipelineIndex} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: M.magenta,
                        opacity: 0.6,
                        animation: `thinking-pulse 1s ease ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>
                    {inProd > 0
                      ? `Spark is producing · ${inProd} draft${inProd > 1 ? "s" : ""} active`
                      : pendingReviews.length > 0
                      ? `Review stage active · ${pendingReviews.length} ready`
                      : "Spark is monitoring for viral opportunities"}
                  </span>
                </div>
              </div>
            </section>

            {/* Opportunities & Media Section */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.22)",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  Opportunities & Media
                </p>
                <button
                  onClick={() => onNavigate(mixedItems[0]?.targetPath || "/viral-sparks")}
                  className="m-press"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 12,
                    color: M.purple,
                    background: "none",
                    border: "none",
                    padding: 0,
                  }}
                >
                  See all <ArrowRight style={{ width: 12, height: 12 }} />
                </button>
              </div>

              {mixedItems.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {mixedItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.targetPath)}
                      className="m-press"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        position: "relative",
                        height: 200,
                        borderRadius: 22,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.1)",
                        display: "block",
                        background: "linear-gradient(135deg, #111827 0%, #0f172a 100%)",
                      }}
                    >
                      {/* Media Background: Video OR Real Image */}
                      {item.videoUrl && !item.isGenerating ? (
                        <video
                          src={item.videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            opacity: 0.75,
                          }}
                        />
                      ) : item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="photo-zoom"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            opacity: item.isGenerating ? 0.45 : 0.65,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "radial-gradient(circle at 50% 30%, rgba(168,85,247,0.2) 0%, rgba(8,12,20,0.95) 75%)",
                          }}
                        />
                      )}

                      {/* Dark Gradient Overlay */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(to top, rgba(8,12,20,0.95) 0%, rgba(8,12,20,0.4) 55%, transparent 100%)",
                        }}
                      />

                      {/* Generating Overlay (P0 progress overlay for live generation) */}
                      {item.isGenerating && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(11,15,23,0.72)",
                            backdropFilter: "blur(3px)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            zIndex: 3,
                            padding: 16,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Loader2 style={{ width: 18, height: 18, color: M.purple, animation: "spin 1.2s linear infinite" }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                              {item.stageLabel}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                            {item.percent}% complete
                          </span>
                          <div style={{ width: 140, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)", overflow: "hidden", marginTop: 4 }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${item.percent}%`,
                                background: "linear-gradient(90deg, #a855f7, #F018FF)",
                                borderRadius: 2,
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Content Layout */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          padding: "16px 18px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          zIndex: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: item.badgeColor,
                              background: `${item.badgeColor}20`,
                              padding: "3px 10px",
                              borderRadius: 50,
                              border: `1px solid ${item.badgeColor}40`,
                              letterSpacing: "0.04em",
                            }}
                          >
                            {item.badge}
                          </span>

                          {item.videoUrl && !item.isGenerating ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFullscreenVideo({ videoUrl: item.videoUrl!, title: item.title });
                              }}
                              className="m-press"
                              title="Play Video Fullscreen"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: "rgba(168,85,247,0.85)",
                                backdropFilter: "blur(8px)",
                                border: "1.5px solid rgba(255,255,255,0.4)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 0 16px rgba(168,85,247,0.6)",
                              }}
                            >
                              <Play style={{ width: 16, height: 16, color: "white", fill: "white", marginLeft: 2 }} />
                            </button>
                          ) : item.score ? (
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 800,
                                color: item.score >= 92 ? "#22c55e" : "#f59e0b",
                                background: "rgba(8,12,20,0.6)",
                                backdropFilter: "blur(8px)",
                                padding: "4px 10px",
                                borderRadius: 50,
                              }}
                            >
                              {item.score}%
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "white",
                              margin: "0 0 4px",
                              lineHeight: 1.3,
                              letterSpacing: "-0.01em",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {item.title}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.subtitle}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "5px 12px",
                                borderRadius: 50,
                                background: "rgba(168,85,247,0.25)",
                                border: "1px solid rgba(168,85,247,0.4)",
                                flexShrink: 0,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700, color: M.purple }}>
                                {item.type === "viral_spark" ? "Open" : "Review"}
                              </span>
                              <ArrowRight style={{ width: 12, height: 12, color: M.purple }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <Search className="w-5 h-5 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/70">No active opportunities or productions</p>
                    <p className="text-xs text-white/40 mt-1">Super Spark is monitoring trends and ready for your next campaign</p>
                  </div>
                </div>
              )}
            </section>

            {/* At a Glance Section */}
            <section style={{ marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.22)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                At a glance
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MobileMetricTile
                  value={String(pendingReviews.length)}
                  label="Reviews pending"
                  color="#f59e0b"
                  onClick={() => onNavigate("/review")}
                />
                <MobileMetricTile
                  value={String(viralSparks.length)}
                  label="Viral Sparks"
                  color={M.magenta}
                  onClick={() => onNavigate("/viral-sparks")}
                />
                <MobileMetricTile
                  value={String(inProd)}
                  label="In production"
                  color={M.purple}
                  onClick={() => onNavigate("/review")}
                />
                <MobileMetricTile
                  value={String(approvedCount)}
                  label="Approved"
                  color="#22c55e"
                  onClick={() => onNavigate("/review")}
                />
              </div>
            </section>

            {/* Recent Section */}
            <section style={{ marginBottom: 16 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.22)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Recent
              </p>
              <div
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 20,
                  overflow: "hidden",
                }}
              >
                {[
                  {
                    icon: CheckCircle2,
                    color: "#22c55e",
                    title: approvedCount > 0 ? "Production Approved" : "System Ready",
                    sub: approvedProductions[0]?.title ? `"${approvedProductions[0].title}"` : "Workspace active",
                    time: "Just now",
                  },
                  {
                    icon: AlertCircle,
                    color: "#f59e0b",
                    title: pendingReviews.length > 0 ? "Review Requested" : "Creative Review",
                    sub: pendingReviews[0]?.title ? `"${pendingReviews[0].title}"` : "No pending reviews",
                    time: "4h ago",
                  },
                  {
                    icon: Flame,
                    color: M.magenta,
                    title: topSpark ? "Opportunity Detected" : "Signal Radar",
                    sub: topSpark ? `"${topSpark.title}"` : "Monitoring niche trends",
                    time: "6h ago",
                  },
                ].map((a, i, arr) => (
                  <div
                    key={i}
                    className="m-card-in"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 13,
                      padding: "14px 18px",
                      borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
                      animationDelay: `${i * 80 + 200}ms`,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 11,
                        flexShrink: 0,
                        background: `${a.color}18`,
                        border: `1px solid ${a.color}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <a.icon style={{ width: 15, height: 15, color: a.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: 0 }}>
                        {a.title}
                      </p>
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "rgba(255,255,255,0.38)",
                          margin: "3px 0 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.sub}
                      </p>
                    </div>
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)", flexShrink: 0 }}>{a.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* AIChatModal for Super Spark chat */}
      <AIChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Onboard-style Fullscreen Video Player Modal */}
      {activeFullscreenVideo && (
        <VideoFullscreenModal
          videoUrl={activeFullscreenVideo.videoUrl}
          title={activeFullscreenVideo.title}
          onClose={() => setActiveFullscreenVideo(null)}
        />
      )}
    </>
  );
}
