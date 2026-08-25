import {
  Eye, DollarSign, Tv, Video, AlertCircle, Lightbulb,
  TrendingUp, CheckCircle2, Rocket, BarChart3, Flame,
  ArrowRight, Loader2, Clock, Package, Play,
} from "lucide-react";
import { useSpark } from "../../state/SparkContext";
import { useAuth } from "../../state/AuthContext";
import { AIChatPill } from "../AIChatPill";
import { AIChatModal } from "../AIChatModal";
import { useState, useEffect } from "react";

import { getStoredTheme } from "../../theme";
import { DonorSparkMediaHome, VideoFullscreenModal } from "./DonorSparkMediaHome";

interface ActivityItem {
  id: string;
  type: "opportunity" | "approved" | "completed" | "published" | "analytics";
  title: string;
  time: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  isGenerating?: boolean;
  statusLabel?: string;
  path?: string;
}

interface MobileHomeProps {
  onNavigate?: (path: string) => void;
}

export function MobileHome({ onNavigate }: MobileHomeProps = {}) {
  const [currentTheme, setCurrentTheme] = useState(() => getStoredTheme());

  useEffect(() => {
    const handleThemeChange = () => setCurrentTheme(getStoredTheme());
    window.addEventListener("spark_theme_change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("spark_theme_change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  if (currentTheme === "spark_media") {
    return <DonorSparkMediaHome onNavigate={onNavigate} />;
  }

  return <DefaultMobileHome onNavigate={onNavigate} />;
}

function DefaultMobileHome({ onNavigate }: MobileHomeProps = {}) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeFullscreenVideo, setActiveFullscreenVideo] = useState<{
    videoUrl: string;
    title?: string;
  } | null>(null);
  const auth = useAuth();
  const { productions, reviewItems, viralSparks, character, brand, accounts } = useSpark() as any;
  const userDisplayName = auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || character?.name || "Creator";
  const connectedAccountsCount = (() => {
    if (!accounts || !Array.isArray(accounts)) return 0;
    const connected = accounts.filter((a: any) => a && (a.status?.toLowerCase() === "connected" || a.connected));
    const uniquePlatforms = new Set(connected.map((a: any) => (a.platform || "").toLowerCase()));
    return uniquePlatforms.size;
  })();
  const isEmpty = productions.length === 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Pipeline counts
  const draftingCount = productions.filter((p: any) => ["Drafting", "Draft", "Researching", "Research Complete", "Planning", "Planning Complete", "Storyboarding", "Storyboard Complete", "Generating", "Editing"].includes(p.status)).length;
  const readyCount = productions.filter((p: any) => ["Ready for Review", "Awaiting Review"].includes(p.status)).length;
  const approvedCount = productions.filter((p: any) => p.status === "Approved" && p.id !== "p7" && !p.id.includes("scheduled") && p.id !== "p8" && !p.id.includes("export")).length;
  const scheduledCount = productions.filter((p: any) => p.status === "Approved" && (p.id === "p7" || p.id.includes("scheduled"))).length;
  const publishedCount = productions.filter((p: any) => p.status === "Published").length;

  const topSpark = viralSparks?.[0];

  const priorityItems = [
    ...(readyCount > 0 ? [{
      icon: AlertCircle,
      iconColor: "text-warning",
      borderColor: "border-l-warning",
      bg: "bg-warning/5",
      label: `${readyCount} review${readyCount > 1 ? "s" : ""} waiting`,
      desc: reviewItems?.[0]?.title ? `"${reviewItems[0].title}"` : "Creative review waiting",
      action: "Review",
      path: "/review",
    }] : []),
    ...(viralSparks.length > 0 ? [{
      icon: Flame,
      iconColor: "text-destructive",
      borderColor: "border-l-destructive",
      bg: "bg-destructive/5",
      label: `${viralSparks.length} hot opportunit${viralSparks.length > 1 ? "ies" : "y"}`,
      desc: topSpark?.title ? `"${topSpark.title}"` : `${brand?.niche || "Trending"} opportunity`,
      action: "Create",
      path: "/viral-sparks",
    }] : []),
    ...(approvedCount > 0 ? [{
      icon: CheckCircle2,
      iconColor: "text-success",
      borderColor: "border-l-success",
      bg: "bg-success/5",
      label: `${approvedCount} ready to publish`,
      desc: "Approved · ready to schedule",
      action: "Calendar",
      path: "/review",
    }] : []),
  ];

  const pipeline = [
    { label: "Drafting", count: draftingCount, color: "text-muted-foreground", path: "/review" },
    { label: "Ready", count: readyCount, color: "text-warning", path: "/review" },
    { label: "Approved", count: approvedCount, color: "text-success", path: "/review" },
    { label: "Scheduled", count: scheduledCount, color: "text-accent-foreground", path: "/review" },
    { label: "Published", count: publishedCount, color: "text-muted-foreground", path: "/analytics" },
  ];

  const metrics = [
    { label: "Monthly Views", value: publishedCount > 0 ? `${publishedCount * 120} views` : "0", icon: Eye, trend: publishedCount > 0 ? "Real-time" : "0%", path: "/analytics" },
    { label: "Revenue", value: "$0", icon: DollarSign, trend: "0%", path: "/analytics" },
    { label: "Accounts", value: String(connectedAccountsCount), icon: Tv, path: "/more" },
    { label: "Published Today", value: String(publishedCount), icon: Video, trend: `+${publishedCount}`, path: "/analytics" },
    { label: "Reviews Pending", value: String(readyCount), icon: AlertCircle, path: "/review" },
    { label: "Viral Sparks", value: String(viralSparks.length), icon: Flame, trend: viralSparks.length > 0 ? "live" : "", path: "/viral-sparks" },
  ];

  // Media activity items from real productions (max 4 on mobile)
  const mediaActivities: ActivityItem[] = productions.slice(0, 4).map((p: any, idx: number) => {
    const vUrl = p.videoUrl || p.brief?.videoUrl || p.brief?.generatedAssets?.generatedVideos?.[0];
    const imgUrl =
      p.thumbnailUrl ||
      p.thumbnail ||
      p.imageUrl ||
      p.scenes?.[0]?.image ||
      p.brief?.generatedAssets?.generatedFrames?.[0] ||
      p.brief?.generatedAssets?.thumbnails?.[0]?.image ||
      p.brief?.generatedAssets?.thumbnails?.[0]?.url;
    const isGenerating = Boolean(
      p.isGeneratingAssets ||
        p.status === "Generating" ||
        (p.status === "Drafting" && p.generationProgress && p.generationProgress.percent < 100)
    );

    let statusLabel = "In Production";
    if (p.status === "Approved") statusLabel = "Approved • Ready";
    else if (p.status === "Ready for Review" || p.status === "Pending Review") statusLabel = "Ready for Review";
    else if (p.status === "Published") statusLabel = "Published";
    else if (p.status === "Scheduled") statusLabel = "Scheduled";
    else if (p.status === "Needs Edit") statusLabel = "Needs Edit";
    else if (isGenerating) statusLabel = "Rendering...";

    return {
      id: `pr-${p.id || idx}`,
      type: (p.status === "Published" ? "published" : p.status === "Approved" ? "approved" : "completed") as any,
      title: p.title || "Untitled Production",
      time: p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent",
      thumbnailUrl: imgUrl,
      videoUrl: typeof vUrl === "string" && vUrl.startsWith("http") ? vUrl : undefined,
      isGenerating,
      statusLabel,
      path: "/review",
    };
  });

  // Non-media opportunity signals
  const systemActivities: ActivityItem[] = (viralSparks || []).slice(0, 2).map((s: any, idx: number) => ({
    id: `sp-${s.id || idx}`,
    type: "opportunity" as const,
    title: `Opportunity: "${s.title || s.topic || "Trending Topic"}" (${s.brandFitScore || 95}% fit)`,
    time: "Just now",
    path: "/viral-sparks",
  }));

  const activityIcons = {
    opportunity: { icon: Lightbulb, color: "text-accent-foreground", path: "/viral-sparks" },
    approved: { icon: CheckCircle2, color: "text-success", path: "/review" },
    completed: { icon: Video, color: "text-accent-foreground", path: "/review" },
    published: { icon: Rocket, color: "text-success", path: "/analytics" },
    analytics: { icon: BarChart3, color: "text-muted-foreground", path: "/analytics" },
  };

  return (
    <div className="w-full min-h-[100dvh] flex flex-col space-y-4 pt-3 pb-6 px-4">
      {/* Fixed Header & Pipeline Block */}
      <div className="space-y-4 flex-shrink-0 bg-background z-10">
        {/* Command Header */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
              <h1 className="text-xl font-medium">{greeting}, {userDisplayName}</h1>
              <AIChatPill onClick={() => setIsChatOpen(true)} isMobile={true} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </span>
              Spark is active · {viralSparks.length} opportunities · {readyCount} need review
            </div>
          </div>
          <div className="border-t border-border/50">
            {priorityItems.length === 0 ? (
              <div className="px-5 py-4 text-center text-xs text-muted-foreground">
                All caught up! No active tasks.
              </div>
            ) : (
              priorityItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    onClick={() => onNavigate?.(item.path)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 border-l-2 text-left transition-all duration-200 active:bg-accent/10 ${item.borderColor} ${item.bg} ${i < priorityItems.length - 1 ? "border-b border-border/40" : ""}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.iconColor} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${item.iconColor}`}>{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{item.action} →</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Pipeline Strip */}
        <div className="rounded-xl border border-border bg-card px-4 py-2.5">
          <div className="flex items-center gap-0">
            {pipeline.map((stage, i) => (
              <button
                key={stage.label}
                onClick={() => onNavigate?.(stage.path)}
                className="flex-1 text-center group active:scale-95 transition-transform"
              >
                <p className={`text-lg font-medium ${stage.color}`}>{stage.count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stage.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics and Activity Feed */}
      <div className="space-y-4 py-2">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <button
                key={metric.label}
                onClick={() => onNavigate?.(metric.path)}
                className="rounded-xl border border-border bg-card p-4 text-left active:scale-[0.98] transition-transform duration-150 flex flex-col justify-between"
              >
                <div className="w-full flex items-start justify-between mb-3">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {metric.trend && (
                    <span className={`text-xs font-medium ${metric.trend === "new" ? "text-accent-foreground" : "text-success"}`}>
                      {metric.trend}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-medium">{metric.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Spark Intelligence */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Spark Intelligence</p>
          <div className="space-y-2.5">
            {isEmpty ? (
              <div className="text-center py-2 text-xs text-muted-foreground">
                No signals yet. Connect integrations.
              </div>
            ) : (
              [
                { text: `${viralSparks.length} high-fit opportunities ready to create`, type: "opportunity" as const, path: "/viral-sparks" },
                { text: `${readyCount} productions awaiting review approval`, type: "alert" as const, path: "/review" },
                {
                  text: connectedAccountsCount > 0
                    ? `${connectedAccountsCount} active account${connectedAccountsCount > 1 ? "s" : ""} synced for publishing`
                    : "Connect social accounts in More to enable distribution",
                  type: "success" as const,
                  path: "/more"
                },
              ].map((item, i) => {
                const config = {
                  opportunity: { icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
                  alert: { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10" },
                  success: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
                };
                const Icon = config[item.type].icon;
                return (
                  <button
                    key={i}
                    onClick={() => onNavigate?.(item.path)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-left active:scale-[0.98] transition-all duration-150 ${config[item.type].bg}`}
                  >
                    <Icon className={`w-3.5 h-3.5 mt-0.5 ${config[item.type].color} flex-shrink-0`} />
                    <p className="text-sm">{item.text}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity — Existing block enhanced with Spark Media Video Cards */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</p>
            {!isEmpty && (
              <button
                onClick={() => onNavigate?.("/review")}
                className="text-xs text-purple-400 font-medium hover:text-purple-300 transition-colors active:scale-95 cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          <div className="space-y-3.5">
            {isEmpty ? (
              <div className="text-center py-4 text-xs text-muted-foreground">
                No activity recorded yet.
              </div>
            ) : (
              <>
                {/* Media Video Cards Stack (Single column for mobile) */}
                {mediaActivities.length > 0 && (
                  <div className="space-y-3">
                    {mediaActivities.map((item) => {
                      const isPlayable = Boolean(
                        item.videoUrl &&
                          !item.isGenerating &&
                          typeof item.videoUrl === "string" &&
                          item.videoUrl.startsWith("http")
                      );

                      return (
                        <div
                          key={item.id}
                          onClick={() => onNavigate?.(item.path || "/review")}
                          className="relative rounded-2xl bg-white/[0.035] border border-white/10 active:border-purple-500/40 p-3.5 flex flex-col justify-between overflow-hidden shadow-lg transition-all cursor-pointer group"
                        >
                          {/* Aspect Thumbnail Box */}
                          <div className="relative w-full aspect-video rounded-xl bg-black/60 border border-white/10 overflow-hidden mb-2.5 flex items-center justify-center">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-active:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center p-3 text-center">
                                <Tv className="w-7 h-7 text-white/30 mb-1" />
                                <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">
                                  Spark Production
                                </span>
                              </div>
                            )}

                            {/* Play Button on playable cards */}
                            {isPlayable && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFullscreenVideo({
                                    videoUrl: item.videoUrl!,
                                    title: item.title,
                                  });
                                }}
                                className="cursor-pointer active:scale-95"
                                title="Play Video"
                                style={{
                                  position: "absolute",
                                  width: 42,
                                  height: 42,
                                  borderRadius: "50%",
                                  background: "rgba(168,85,247,0.9)",
                                  backdropFilter: "blur(8px)",
                                  border: "1.5px solid rgba(255,255,255,0.5)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  boxShadow: "0 0 16px rgba(168,85,247,0.8)",
                                  zIndex: 10,
                                }}
                              >
                                <Play style={{ width: 16, height: 16, color: "white", fill: "white", marginLeft: 2 }} />
                              </button>
                            )}

                            {/* Generating Overlay */}
                            {item.isGenerating && (
                              <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 z-20">
                                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                                <span className="text-[9px] font-bold text-purple-300 uppercase tracking-widest animate-pulse">
                                  Rendering...
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Title & Subline */}
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold leading-snug text-white line-clamp-2">
                              {item.title}
                            </h4>
                            <div className="flex items-center justify-between text-xs text-white/50 pt-0.5">
                              <span className="text-white/70 font-medium truncate max-w-[70%]">
                                {item.statusLabel}
                              </span>
                              <span className="text-[11px] text-white/40 whitespace-nowrap">
                                {item.time}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Non-Media Timeline Activity Rows */}
                {systemActivities.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {systemActivities.map((act) => {
                      const Icon = act.type === "opportunity" ? Lightbulb : CheckCircle2;
                      const color = act.type === "opportunity" ? "text-accent-foreground" : "text-success";
                      const bg = act.type === "opportunity" ? "bg-accent/30" : "bg-success/20";
                      return (
                        <button
                          key={act.id}
                          onClick={() => onNavigate?.(act.path || "/viral-sparks")}
                          className="w-full flex items-center justify-between gap-3 text-left transition-colors active:bg-white/[0.04] p-2.5 rounded-xl border border-white/5 bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-3.5 h-3.5 ${color}`} />
                            </div>
                            <p className="text-xs text-white/90 font-medium truncate">{act.title}</p>
                          </div>
                          <span className="text-[10px] text-white/40 whitespace-nowrap flex-shrink-0">{act.time}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AIChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} onNavigate={onNavigate} />

      {/* Fullscreen Video Player Modal Reuse */}
      {activeFullscreenVideo && (
        <VideoFullscreenModal
          videoUrl={activeFullscreenVideo.videoUrl}
          title={activeFullscreenVideo.title}
          onClose={() => setActiveFullscreenVideo(null)}
        />
      )}
    </div>
  );
}
