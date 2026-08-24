import React, { useState, useEffect } from "react";
import { useSpark } from "../state/SparkContext";
import { useAuth } from "../state/AuthContext";
import { AIChatModal } from "./AIChatModal";
import { VideoFullscreenModal } from "./mobile/DonorSparkMediaHome";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Flame,
  Search,
  Loader2,
  Play,
  Sparkles,
  TrendingUp,
  Brain,
  Clock,
  Tv,
  Video,
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

const DESKTOP_STYLES = `
  /* press feedback */
  .d-press { transition: transform 0.16s ease, opacity 0.16s ease, background 0.2s ease; cursor: pointer; }
  .d-press:hover { background: rgba(255,255,255,0.06); }
  .d-press:active { transform: scale(0.98); opacity: 0.9; }

  /* card entry animation */
  @keyframes d-card-in {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .d-card-in { animation: d-card-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* neon border flow for Super Spark control */
  @keyframes neon-border-flow-desktop {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes neon-glow-pulse-desktop {
    0%,100% { box-shadow: 0 0 14px rgba(168,85,247,0.4), 0 0 28px rgba(240,24,255,0.2); }
    50%      { box-shadow: 0 0 24px rgba(168,85,247,0.8), 0 0 48px rgba(240,24,255,0.4); }
  }
  .neon-pill-wrap-desktop {
    padding: 1.5px; border-radius: 50px;
    background: linear-gradient(90deg,#a855f7,#22d3ee,#ec4899,#6366f1,#F018FF,#a855f7);
    background-size: 400% 400%;
    animation: neon-border-flow-desktop 2.6s ease infinite, neon-glow-pulse-desktop 2.6s ease infinite;
  }
  .neon-pill-inner-desktop {
    background: #0B0F17; border-radius: 50px;
    display: flex; align-items: center; gap: 8px;
    padding: 10px 18px; cursor: pointer;
    transition: background 0.2s ease;
  }
  .neon-pill-inner-desktop:hover {
    background: #111726;
  }

  /* decision glow */
  @keyframes decision-glow-amber-d {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
    50%      { box-shadow: 0 4px 24px rgba(245,158,11,0.15); }
  }
  @keyframes decision-glow-magenta-d {
    0%,100% { box-shadow: 0 0 0 0 rgba(240,24,255,0); }
    50%      { box-shadow: 0 4px 24px rgba(240,24,255,0.15); }
  }
  @keyframes decision-glow-green-d {
    0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    50%      { box-shadow: 0 4px 24px rgba(34,197,94,0.15); }
  }
`;

function DesktopSparkLogoMark({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="sg_desktop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d="M18 2L6 18h10l-2 12 14-16H18L18 2z" fill="url(#sg_desktop)" />
    </svg>
  );
}

function DesktopDecisionCard({
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
      className="d-press d-card-in"
      style={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 20,
        padding: "20px 22px",
        animation: `d-card-in 0.35s ease ${delay}ms both, decision-glow-${accentKey}-d 3s ease 0.4s infinite`,
      }}
    >
      <div
        style={{
          width: 4,
          height: 48,
          borderRadius: 4,
          background: accent,
          flexShrink: 0,
          boxShadow: `0 0 12px ${accent}aa`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "white", margin: 0, lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: 13, color: M.muted, margin: "5px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          padding: "8px 16px",
          borderRadius: 50,
          background: `${accent}18`,
          border: `1px solid ${accent}40`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{cta}</span>
        <ArrowRight style={{ width: 14, height: 14, color: accent }} />
      </div>
    </button>
  );
}

function DesktopPipelineStrip({ activeIdx = 1 }: { activeIdx?: number }) {
  const stages = ["Research", "Produce", "Review", "Publish", "Learn"];
  return (
    <div className="w-full bg-white/[0.025] border border-white/10 rounded-2xl p-6">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">Live Pipeline Execution</p>
      <div style={{ display: "flex", alignItems: "center" }}>
        {stages.map((label, i) => {
          const active = i === activeIdx;
          const done = i < activeIdx;
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, position: "relative" }}>
              {i > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 9,
                    left: "-50%",
                    width: "100%",
                    height: 2,
                    background: done
                      ? "linear-gradient(90deg,rgba(168,85,247,0.6),rgba(240,24,255,0.4))"
                      : "rgba(255,255,255,0.08)",
                  }}
                />
              )}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  zIndex: 1,
                  position: "relative",
                  background: active ? M.magenta : done ? "rgba(168,85,247,0.45)" : "transparent",
                  border: `2px solid ${active ? M.magenta : done ? M.purple : "rgba(255,255,255,0.15)"}`,
                  boxShadow: active ? `0 0 16px ${M.magenta}` : undefined,
                  transition: "all 0.3s",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: active ? "white" : done ? M.purple : M.label,
                  fontWeight: active ? 700 : 500,
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
    </div>
  );
}

function DesktopMetricTile({
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
      className="d-press"
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 20,
        padding: "24px 18px",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontSize: 36,
          fontWeight: 800,
          color: color || "white",
          margin: 0,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          textShadow: color ? `0 0 24px ${color}55` : undefined,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 13, color: M.muted, margin: "8px 0 0", lineHeight: 1.3 }}>{label}</p>
    </button>
  );
}

export interface DesktopSparkMediaHomeProps {
  onNavigate: (path: string) => void;
}

export function DesktopSparkMediaHome({ onNavigate }: DesktopSparkMediaHomeProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeFullscreenVideo, setActiveFullscreenVideo] = useState<{ videoUrl: string; title?: string } | null>(null);
  const { productions = [], reviewItems = [], viralSparks = [], brand, character, accounts = [], memoryItems = [] } = useSpark() as any;
  const auth = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const brandName = brand?.name || auth.profile?.display_name || character?.name || "Creator";

  const pendingReviews = productions.filter((p: any) => ["Ready for Review", "Awaiting Review"].includes(p.status));
  const approvedProductions = productions.filter((p: any) => p.status === "Approved");
  const approvedCount = approvedProductions.length;
  const inProd = productions.filter((p: any) =>
    ["Drafting", "Draft", "Researching", "Research Complete", "Planning", "Planning Complete", "Storyboarding", "Storyboard Complete", "Generating", "Editing"].includes(p.status)
  ).length;

  const decisions = [
    pendingReviews.length > 0
      ? {
          accent: "#f59e0b",
          accentKey: "amber" as const,
          title: `${pendingReviews.length} Creative Review${pendingReviews.length !== 1 ? "s" : ""} Awaiting Approval`,
          subtitle: pendingReviews[0]?.title || "Review latest video productions",
          cta: "Review Now",
          onClick: () => onNavigate("/review"),
        }
      : null,
    viralSparks.length > 0
      ? {
          accent: M.magenta,
          accentKey: "magenta" as const,
          title: `${viralSparks.length} Live Opportunity${viralSparks.length !== 1 ? "s" : ""} Discovered`,
          subtitle: viralSparks[0]?.title || "High engagement trend fit",
          cta: "Create",
          onClick: () => onNavigate("/viral-sparks"),
        }
      : null,
    approvedCount > 0
      ? {
          accent: "#22c55e",
          accentKey: "green" as const,
          title: `${approvedCount} Approved Production${approvedCount !== 1 ? "s" : ""} Ready`,
          subtitle: approvedProductions[0]?.title || "Scheduled for auto-publishing",
          cta: "Calendar",
          onClick: () => onNavigate("/calendar"),
        }
      : null,
  ].filter(Boolean) as any[];

  // Real Production & Media cards array (capped at max 8 items)
  const mixedItems = (() => {
    const list: Array<{
      id: string;
      title: string;
      sub: string;
      imageUrl?: string;
      videoUrl?: string;
      score?: number;
      isGenerating?: boolean;
      targetPath: string;
    }> = [];

    // Add completed review items / productions first
    productions.forEach((p: any) => {
      const vUrl = p.videoUrl || p.brief?.videoUrl || p.brief?.generatedAssets?.generatedVideos?.[0];
      const imgUrl = p.scenes?.[0]?.image || p.brief?.generatedAssets?.generatedFrames?.[0] || p.brief?.generatedAssets?.thumbnails?.[0]?.image;

      list.push({
        id: p.id,
        title: p.title,
        sub: p.status === "Approved" ? "Approved • Ready" : p.status === "Ready for Review" ? "Review Pending" : "In Production",
        imageUrl: imgUrl,
        videoUrl: typeof vUrl === "string" && vUrl.startsWith("http") ? vUrl : undefined,
        isGenerating: p.isGeneratingAssets,
        targetPath: "/review",
      });
    });

    // Add Viral Sparks
    viralSparks.forEach((s: any) => {
      if (!list.some((item) => item.title === s.title)) {
        list.push({
          id: s.id,
          title: s.title,
          sub: `${s.timeWindow || "Hot Trend"} • ${s.platformFit || "Vertical Short"}`,
          score: s.brandFitScore || 92,
          targetPath: "/viral-sparks",
        });
      }
    });

    return list.slice(0, 8);
  })();

  const connectedAccountsCount = (accounts || []).filter((a: any) => String(a.status || "").toLowerCase() === "connected").length;

  return (
    <>
      <style>{DESKTOP_STYLES}</style>

      <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 space-y-8 max-w-7xl mx-auto overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                {greeting}, {brandName}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Spark Media OS
              </span>
            </div>
            <p className="text-sm text-white/50">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          {/* Neon Super Spark Pill Entry */}
          <div className="neon-pill-wrap-desktop self-start md:self-auto">
            <div className="neon-pill-inner-desktop" onClick={() => setIsChatOpen(true)}>
              <DesktopSparkLogoMark className="w-6 h-6" />
              <span className="text-sm font-semibold text-white">Talk to Super Spark</span>
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-1" />
            </div>
          </div>
        </div>

        {/* Executive Decision Cards Grid */}
        {decisions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {decisions.map((d, idx) => (
              <DesktopDecisionCard
                key={idx}
                accent={d.accent}
                accentKey={d.accentKey}
                title={d.title}
                subtitle={d.subtitle}
                cta={d.cta}
                onClick={d.onClick}
                delay={idx * 100}
              />
            ))}
          </div>
        )}

        {/* Live Pipeline Strip */}
        <DesktopPipelineStrip activeIdx={pendingReviews.length > 0 ? 2 : inProd > 0 ? 1 : 0} />

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DesktopMetricTile
            value={String(pendingReviews.length)}
            label="Ready to Review"
            color={pendingReviews.length > 0 ? "#f59e0b" : undefined}
            onClick={() => onNavigate("/review")}
          />
          <DesktopMetricTile
            value={String(approvedCount)}
            label="Approved & Ready"
            color={approvedCount > 0 ? "#22c55e" : undefined}
            onClick={() => onNavigate("/calendar")}
          />
          <DesktopMetricTile
            value={String(inProd)}
            label="In Production"
            color={inProd > 0 ? M.purple : undefined}
            onClick={() => onNavigate("/review")}
          />
          <DesktopMetricTile
            value={String(connectedAccountsCount)}
            label="Connected Platforms"
            color={connectedAccountsCount > 0 ? "#22d3ee" : undefined}
            onClick={() => onNavigate("/my-spark")}
          />
        </div>

        {/* Production & Media Grid Section (Capped at 8 items max) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-white">Production & Media</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/60 font-mono">
                {mixedItems.length} / 8 Recent
              </span>
            </div>
            <button
              onClick={() => onNavigate("/review")}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All Productions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {mixedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate(item.targetPath)}
                className="d-press relative rounded-2xl bg-white/[0.035] border border-white/10 hover:border-purple-500/40 p-4 flex flex-col justify-between overflow-hidden group shadow-lg"
              >
                {/* Media Image / Aspect Thumbnail Box */}
                <div className="relative w-full aspect-video rounded-xl bg-black/60 border border-white/10 overflow-hidden mb-3.5 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <Tv className="w-8 h-8 text-white/30 mb-1.5" />
                      <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Spark Production</span>
                    </div>
                  )}

                  {/* Play Video Button on cards with playable videoUrl */}
                  {item.videoUrl && !item.isGenerating ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFullscreenVideo({ videoUrl: item.videoUrl!, title: item.title });
                      }}
                      className="m-press"
                      title="Play Video Fullscreen"
                      style={{
                        position: "absolute",
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "rgba(168,85,247,0.9)",
                        backdropFilter: "blur(8px)",
                        border: "1.5px solid rgba(255,255,255,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 0 20px rgba(168,85,247,0.8)",
                        zIndex: 10,
                      }}
                    >
                      <Play style={{ width: 18, height: 18, color: "white", fill: "white", marginLeft: 2 }} />
                    </button>
                  ) : item.score ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        padding: "4px 8px",
                        borderRadius: 12,
                        background: "rgba(8,12,20,0.75)",
                        backdropFilter: "blur(6px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Flame className="w-3 h-3 text-fuchsia-400" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>{item.score}%</span>
                    </div>
                  ) : null}

                  {item.isGenerating && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                      <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest animate-pulse">Rendering...</span>
                    </div>
                  )}
                </div>

                {/* Info Text */}
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold leading-snug text-white line-clamp-2 group-hover:text-purple-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-white/40 truncate">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Activity & Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Executive Activity */}
          <div className="p-6 rounded-2xl bg-white/[0.035] border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Recent Executive Activity
              </h3>
              <span className="text-xs text-white/40">Live Sync</span>
            </div>
            <div className="space-y-3">
              {productions.slice(0, 3).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-none">
                  <div className="flex items-center gap-2 max-w-[70%]">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span className="font-medium text-white/90 truncate">{p.title}</span>
                  </div>
                  <span className="text-white/40 uppercase font-mono text-[10px]">{p.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Insights */}
          <div className="p-6 rounded-2xl bg-white/[0.035] border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                Executive Memory Insights
              </h3>
              <span className="text-xs text-white/40">{memoryItems.length} Saved</span>
            </div>
            <div className="space-y-3">
              {memoryItems.slice(0, 3).map((m: any, idx: number) => (
                <div key={m.id || idx} className="flex items-start gap-2 text-xs py-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-white/80 leading-relaxed line-clamp-2">{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AIChatModal for Super Spark Chat */}
      <AIChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Fullscreen Video Player Modal */}
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
