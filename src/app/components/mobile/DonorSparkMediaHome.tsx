import React, { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { useAuth } from "../../state/AuthContext";
import { AIChatModal } from "../AIChatModal";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Flame,
  Search,
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

const OPPORTUNITY_PHOTOS = [
  "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80&fit=crop",
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80&fit=crop",
];

export interface DonorSparkMediaHomeProps {
  onNavigate?: (path: string) => void;
}

export function DonorSparkMediaHome({ onNavigate = () => {} }: DonorSparkMediaHomeProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { productions = [], viralSparks = [], brand, character } = useSpark() as any;
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

            {/* Opportunities Section */}
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
                  Opportunities
                </p>
                <button
                  onClick={() => onNavigate("/viral-sparks")}
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

              {viralSparks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {viralSparks.slice(0, 2).map((spark: any, idx: number) => (
                    <button
                      key={spark.id || idx}
                      onClick={() => onNavigate("/viral-sparks")}
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
                      }}
                    >
                      <img
                        src={OPPORTUNITY_PHOTOS[idx % OPPORTUNITY_PHOTOS.length]}
                        alt=""
                        className="photo-zoom"
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          opacity: 0.65,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(to top, rgba(8,12,20,0.95) 0%, rgba(8,12,20,0.45) 50%, transparent 100%)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          padding: "16px 18px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "#f59e0b",
                              background: "rgba(245,158,11,0.15)",
                              padding: "3px 10px",
                              borderRadius: 50,
                              border: "1px solid rgba(245,158,11,0.25)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {spark.window || "24h"} window
                          </span>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: (spark.score || 90) >= 92 ? "#22c55e" : "#f59e0b",
                              background: "rgba(8,12,20,0.6)",
                              backdropFilter: "blur(8px)",
                              padding: "4px 10px",
                              borderRadius: 50,
                              textShadow: `0 0 12px ${(spark.score || 90) >= 92 ? "#22c55e" : "#f59e0b"}88`,
                            }}
                          >
                            {spark.score || 94}%
                          </div>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "white",
                              margin: "0 0 6px",
                              lineHeight: 1.3,
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {spark.title}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>
                              {spark.platform || "TikTok & Reels"}
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
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700, color: M.purple }}>Open</span>
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
                  className="rounded-xl border border-dashed border-border/60 bg-card/40 p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
                    <Search className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Scanning for opportunities</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Spark is indexing new viral signals in your niche</p>
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
    </>
  );
}
