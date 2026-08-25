import { useSpark } from "../state/SparkContext";
import { useAuth } from "../state/AuthContext";
import { TopBar } from "./TopBar";
import { ActivityFeed, type Activity } from "./ActivityFeed";
import { SectionHeader, MetricCard, Button, WhySparkRecommends } from "./ds";
import { AIChatPill } from "./AIChatPill";
import { AIChatModal } from "./AIChatModal";
import { useState, useEffect } from "react";
import {
  Eye, DollarSign, TrendingUp, Video, Tv, Clapperboard,
  ArrowRight, Zap, Brain, Flame, AlertCircle, CheckCircle2,
} from "lucide-react";

import { getStoredTheme, type ThemeMode } from "../theme";
import { DesktopSparkMediaHome } from "./DesktopSparkMediaHome";
import { normalizeHandle } from "../domain/accountUtils";

interface SparkHomeProps {
  onNavigate: (path: string) => void;
}

export function SparkHome({ onNavigate }: SparkHomeProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getStoredTheme());

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
    return <DesktopSparkMediaHome onNavigate={onNavigate} />;
  }

  return <DefaultSparkHome onNavigate={onNavigate} />;
}

function DefaultSparkHome({ onNavigate }: SparkHomeProps) {
  const auth = useAuth();
  const { productions = [], reviewItems = [], viralSparks = [], character, brand, accounts = [], memoryItems = [], researchSources = [] } = useSpark() as any;
  const connectedAccounts = (accounts || []).filter((a: any) => String(a.status || "").toLowerCase() === "connected");
  const liveMemory = (memoryItems || []).filter((m: any) => !m.archived);
  const pendingReviews = (reviewItems || []).filter((r: any) => r.status === "Pending Review");
  const userDisplayName = auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || character?.name || "Creator";
  const isEmpty = productions.length === 0;
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [platformAnalytics, setPlatformAnalytics] = useState<Record<string, any>>({});
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    import("../services/analyticsPipeline").then(({ getStoredPlatformAnalytics }) => {
      setPlatformAnalytics(getStoredPlatformAnalytics());
    }).catch(err => console.warn("[SparkHome] analytics load fail", err));
  }, []);

  const approvedProductions = productions.filter((p: any) => p.status === "Approved");
  const blockedProductionsCount = productions.filter((p: any) => p.status === "Blocked" || p.status === "blocked").length;

  const priorityItems = [
    ...(pendingReviews.length > 0 ? [{
      id: "p1",
      icon: AlertCircle,
      iconColor: "text-warning",
      borderColor: "border-l-warning",
      bg: "bg-warning/5",
      label: `${pendingReviews.length} creative review${pendingReviews.length !== 1 ? "s" : ""} waiting`,
      description: pendingReviews[0] ? `"${pendingReviews[0].title || "Untitled"}" · Awaiting review` : "Review pending items",
      action: "Review Now",
      path: "/review",
    }] : []),
    ...(viralSparks.length > 0 ? [{
      id: "p2",
      icon: Flame,
      iconColor: "text-destructive",
      borderColor: "border-l-destructive",
      bg: "bg-destructive/5",
      label: `${viralSparks.length} opportunity${viralSparks.length !== 1 ? "s" : ""} detected`,
      description: viralSparks[0] ? `"${viralSparks[0].title || viralSparks[0].topic || "Trending topic"}" · Ready for production` : "View opportunities",
      action: "Create Production",
      path: "/viral-sparks",
    }] : []),
    ...(approvedProductions.length > 0 ? [{
      id: "p3",
      icon: CheckCircle2,
      iconColor: "text-success",
      borderColor: "border-l-success",
      bg: "bg-success/5",
      label: `${approvedProductions.length} approved production${approvedProductions.length !== 1 ? "s" : ""} ready`,
      description: approvedProductions[0] ? `"${approvedProductions[0].title || "Untitled"}" · Ready to publish` : "View approved items",
      action: "View Calendar",
      path: "/calendar",
    }] : []),
  ];

  const pipeline = [
    { stage: "Drafting", count: productions.filter((p: any) => ["Drafting", "Draft", "Researching", "Research Complete", "Planning", "Planning Complete", "Storyboarding", "Storyboard Complete", "Generating", "Editing"].includes(p.status)).length, color: "text-muted-foreground", indicator: "animate-pulse bg-muted-foreground/40", path: "/review" },
    { stage: "Ready", count: productions.filter((p: any) => ["Ready for Review", "Awaiting Review"].includes(p.status)).length, color: "text-warning", indicator: "bg-warning", path: "/review" },
    { stage: "Approved", count: productions.filter((p: any) => p.status === "Approved").length, color: "text-success", indicator: "bg-success", path: "/review" },
    { stage: "Scheduled", count: productions.filter((p: any) => p.status === "Scheduled").length, color: "text-accent-foreground", indicator: "bg-accent", path: "/calendar" },
    { stage: "Published", count: productions.filter((p: any) => p.status === "Published" || p.status === "published").length, color: "text-muted-foreground", indicator: "bg-muted-foreground/40", path: "/analytics" },
  ];

  const hotSparks = (viralSparks || []).slice(0, 3).map((s: any, i: number) => ({
    id: s.id || `v${i}`,
    title: s.title || s.topic || "Untitled Spark",
    score: s.score || s.confidence || s.brandFitScore || 94,
    format: s.format || s.suggestedFormat || "Short-form",
    window: s.window || s.timeWindow || "24h",
    risk: s.risk || s.riskLevel || "Low",
  }));

  const hasLiveSignals = (viralSparks.length > 0) || (liveMemory.length > 0) || (researchSources.length > 0) || (connectedAccounts.length > 0);

  const intelligence = [
    {
      type: "opportunity",
      label: "Top Opportunities",
      color: "text-success", bg: "bg-success/10", border: "border-success/20",
      items: viralSparks.length > 0
        ? viralSparks.slice(0, 3).map((s: any) => ({
            text: `[${s.score || s.brandFitScore || 90}% Match] ${s.title || s.topic}`,
            sub: s.hook || s.whyNow || "Trending topic in your niche",
            path: "/viral-sparks",
          }))
        : researchSources.length > 0
        ? [{ text: `${researchSources.length} research source(s) active`, sub: "Extracting trend patterns for your brand...", path: "/my-spark" }]
        : [{ text: "No live signals yet — add Research Sources in My Spark", sub: "Add creator channels or topics to begin automated indexing", path: "/my-spark" }],
    },
    {
      type: "signal",
      label: "Audience & Channels",
      color: "text-accent-foreground", bg: "bg-accent/10", border: "border-accent/30",
      items: connectedAccounts.length > 0
        ? connectedAccounts.map((a: any) => ({
            text: `${a.platform} (${normalizeHandle(a.handle) || "Connected"})`,
            sub: "Connected publishing channel ready for automated distribution",
            path: "/more/accounts",
          }))
        : [{ text: "No social accounts connected yet", sub: "Connect accounts in Settings to expand audience reach", path: "/more/accounts" }],
    },
    {
      type: "warning",
      label: "Needs Attention",
      color: "text-warning", bg: "bg-warning/10", border: "border-warning/20",
      items: pendingReviews.length > 0
        ? pendingReviews.slice(0, 3).map((r: any) => ({
            text: `Pending Review: "${r.title || "Production"}"`,
            sub: "Awaiting executive decision before publishing",
            path: "/review",
          }))
        : blockedProductionsCount > 0
        ? [{ text: `${blockedProductionsCount} blocked production(s)`, sub: "Review brand policy or asset generation flags", path: "/review" }]
        : [{ text: "All creative approvals & pipelines clear", sub: "No action items pending", path: "/review" }],
    },
    {
      type: "action",
      label: "Executive Memory & Rules",
      color: "text-foreground", bg: "bg-muted/20", border: "border-border/50",
      items: liveMemory.length > 0
        ? liveMemory.slice(0, 3).map((m: any) => ({
            text: `[${m.category || "Rule"}] ${m.text.length > 80 ? m.text.slice(0, 80) + "…" : m.text}`,
            sub: `Added ${m.dateAdded || "recently"}`,
            path: "/my-spark",
          }))
        : [{ text: "No executive memory rules defined yet", sub: "Add brand rules or creative preferences in My Spark", path: "/my-spark" }],
    },
  ];

  // Calculated from platform analytics
  const totalViews = Object.values(platformAnalytics).reduce((sum, r: any) => sum + (r.views || 0), 0);
  const avgEngagementVal = Object.values(platformAnalytics).filter((r: any) => r.engagementRate > 0);
  const avgEngagement = avgEngagementVal.length > 0
    ? (avgEngagementVal.reduce((sum, r: any) => sum + (r.engagementRate || 0), 0) / avgEngagementVal.length).toFixed(1) + "%"
    : "—";

  const totalRevenue = Object.values(platformAnalytics).reduce((sum, r: any) => sum + (r.estimatedRevenue || 0), 0);
  const hasRevenueData = Object.values(platformAnalytics).some((r: any) => r.estimatedRevenue != null && r.estimatedRevenue > 0);
  const hasAccounts = connectedAccounts.length > 0;

  const revenueValue = hasRevenueData
    ? `$${totalRevenue.toLocaleString()}`
    : hasAccounts
      ? "Unavailable from Platform"
      : "No data";

  const revenueSubtitle = hasRevenueData
    ? "Live estimated revenue"
    : hasAccounts
      ? "Not exposed via API"
      : "Connect analytics to track";

  const metrics = [
    { title: "Monthly Views", value: totalViews > 0 ? totalViews.toLocaleString() : "No data", icon: Eye, subtitle: totalViews > 0 ? "Live views" : "Connect analytics to track" },
    { title: "Revenue", value: revenueValue, icon: DollarSign, subtitle: revenueSubtitle },
    { title: "Growth Rate", value: avgEngagement !== "—" ? avgEngagement : "No data", icon: TrendingUp, subtitle: avgEngagement !== "—" ? "Avg engagement" : "Connect analytics to track" },
    { title: "Published", value: String(productions.filter((p: any) => p.status === "Published" || p.status === "published").length), icon: Video, subtitle: "This month" },
    { title: "Accounts", value: String(connectedAccounts.length), icon: Tv, subtitle: "Connected" },
    { title: "Productions", value: String(productions.length), icon: Clapperboard, subtitle: "Active" },
  ];

  const activities: Activity[] = isEmpty
    ? []
    : [
        // 1. Real Production & Review Media activities (up to 8)
        ...productions.slice(0, 8).map((p: any, i: number) => {
          const vUrl =
            p.videoUrl ||
            p.brief?.videoUrl ||
            p.brief?.generatedAssets?.generatedVideos?.[0];
          const imgUrl =
            p.thumbnailUrl ||
            p.thumbnail ||
            p.imageUrl ||
            p.scenes?.[0]?.image ||
            p.brief?.generatedAssets?.generatedFrames?.[0] ||
            p.brief?.generatedAssets?.thumbnails?.[0]?.image ||
            p.brief?.generatedAssets?.thumbnails?.[0]?.url ||
            p.brief?.generatedAssets?.storyboardGridUrl;
          const isGenerating = Boolean(
            p.isGeneratingAssets ||
              p.status === "Generating" ||
              (p.status === "Drafting" && p.generationProgress && p.generationProgress.percent < 100)
          );

          let statusLabel = "In Production";
          if (p.status === "Approved") statusLabel = "Approved • Ready";
          else if (p.status === "Ready for Review" || p.status === "Pending Review") statusLabel = "Ready for Review";
          else if (p.status === "Published" || p.status === "published") statusLabel = "Published";
          else if (p.status === "Scheduled") statusLabel = "Scheduled";
          else if (p.status === "Needs Edit") statusLabel = "Needs Edit";
          else if (isGenerating) statusLabel = "Rendering...";

          return {
            id: p.id || `prod-${i}`,
            type: (isGenerating ? "production_generating" : "production_completed") as any,
            title: p.title || "Untitled Production",
            metadata: statusLabel,
            statusLabel,
            timestamp: p.createdAt
              ? new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—",
            hasMedia: true,
            thumbnailUrl: imgUrl,
            imageUrl: imgUrl,
            videoUrl: typeof vUrl === "string" && vUrl.startsWith("http") ? vUrl : undefined,
            isGenerating,
            productionId: p.id,
            targetPath: "/review",
          };
        }),

        // 2. Real System signals (Memory rules, Discovered opportunities)
        ...(liveMemory.slice(0, 2).map((m: any, i: number) => ({
          id: `mem-${m.id || i}`,
          type: "memory_rule_added" as const,
          title: `Brand Rule: ${m.category || "General"}`,
          metadata: m.text.length > 90 ? m.text.slice(0, 90) + "…" : m.text,
          timestamp: m.dateAdded || "Recent",
          targetPath: "/my-spark",
        }))),

        ...(viralSparks.slice(0, 2).map((s: any, i: number) => ({
          id: `spark-${s.id || i}`,
          type: "opportunity_discovered" as const,
          title: `Viral Opportunity: "${s.title || s.topic}"`,
          metadata: `${s.brandFitScore || 90}% Brand Fit · ${s.timeWindow || "24h"} window`,
          timestamp: "Recent",
          targetPath: "/viral-sparks",
        }))),
      ];

  const dynamicReason = totalViews > 0
    ? `Your connected outlets show ${totalViews.toLocaleString()} total views across platforms. Spark recommends publishing short-form clips targeting peak audience retention segments.`
    : "Strategy recommendations will appear once your social channels are synced and the first opportunity index completes.";

  const dynamicEvidence = Object.values(platformAnalytics).length > 0
    ? Object.values(platformAnalytics).map((p: any) => `${p.platform}: ${p.followers.toLocaleString()} subscribers with ${p.views.toLocaleString()} total views.`)
    : [];

  const homeRecommendation = {
    reason: dynamicReason,
    evidence: dynamicEvidence.length > 0 ? dynamicEvidence : [
      "Peak audience activity detected during optimal posting windows.",
      `Content aligns with ${brand?.name || "your brand"} positioning and tone guidelines.`,
    ],
    confidence: isEmpty ? "Low" as const : "High" as const,
    confidencePercent: isEmpty ? 0 : 75,
    expectedOutcome: isEmpty ? "—" : "Projected strong engagement velocity based on current signals.",
    risk: isEmpty ? "Low" as const : "Low" as const,
    nextBestAction: isEmpty ? "Connect Integrations" : "Review Storyboard",
    brandRules: isEmpty ? [] : (brand?.name ? [`${brand.name} Brand Guidelines`, "Creator Authority"] : ["Brand Guidelines", "Creator Authority"]),
  };

  return (
    <>
      <TopBar pageName="Spark" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">

          {/* ── Command Briefing ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header row */}
            <div className="px-8 pt-7 pb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-4 flex-wrap">
                  <h1 className="text-2xl font-medium">{greeting}, {userDisplayName}</h1>
                  <AIChatPill onClick={() => setIsChatOpen(true)} />
                </div>
                <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                    Spark Active
                  </span>
                  <span className="text-xs text-foreground bg-accent/15 px-2.5 py-1 rounded-full border border-accent/20">
                    💡 <span className="font-medium text-accent-foreground">Discovered:</span> {viralSparks.length} opportunities
                  </span>
                  <span className="text-xs text-foreground bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
                    ⚠️ <span className="font-medium text-warning">Attention:</span> {reviewItems.filter((r: any) => r.status === "Pending Review" || r.status === "Needs Edit").length} reviews waiting
                  </span>
                  <span className="text-xs text-foreground bg-destructive/5 px-2.5 py-1 rounded-full border border-destructive/15">
                    🚫 <span className="font-medium text-destructive">Blocked:</span> {blockedProductionsCount} active blocked
                  </span>
                  <span className="text-xs text-foreground bg-success/10 px-2.5 py-1 rounded-full border border-success/25">
                    ✓ <span className="font-medium text-success">Ready:</span> {reviewItems.filter((r: any) => r.status === "Approved").length} ready
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{today}</p>
                <button
                  onClick={() => onNavigate("/my-spark")}
                  className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  <Brain className="w-3.5 h-3.5" />
                  {brand?.name || "My Brand"}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Priority items */}
            <div className="border-t border-border/60">
              {priorityItems.length === 0 ? (
                <div className="px-8 py-6 text-center text-xs text-muted-foreground">
                  All caught up! Start a workspace campaign or explore viral opportunities to populate action items.
                </div>
              ) : (
                priorityItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                     <div
                      key={item.id}
                      className={`flex items-center gap-5 px-8 py-4 border-l-[3px] ${item.borderColor} ${item.bg} transition-all hover:brightness-[1.04] ${i < priorityItems.length - 1 ? "border-b border-border/40" : ""}`}
                    >
                      <Icon className={`w-4 h-4 ${item.iconColor} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${item.iconColor} mb-0.5`}>{item.label}</p>
                        <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <button
                        onClick={() => onNavigate(item.path)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-background/60 hover:bg-background border border-border/60 text-sm font-medium transition-all"
                      >
                        {item.action}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Executive Strategic Briefing ── */}
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Executive Strategic Briefing</h2>
            <WhySparkRecommends details={homeRecommendation} defaultExpanded={true} />
          </section>

          {/* ── Production Status Strip ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Production Status</h2>
              <button
                onClick={() => onNavigate("/review")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card px-6 py-4">
              <div className="flex items-center gap-0">
                {pipeline.map((stage, i) => (
                  <button
                    key={stage.stage}
                    onClick={() => onNavigate(stage.path)}
                    className="flex-1 group"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-full h-1 rounded-full ${stage.indicator}`} />
                      <div className="flex flex-col items-center">
                        <span className={`text-xl font-medium ${stage.color} group-hover:scale-110 transition-transform`}>
                          {stage.count}
                        </span>
                        <span className="text-xs text-muted-foreground mt-0.5">{stage.stage}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Hot Viral Sparks ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hot Viral Sparks</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Spark found these opportunities for your brand today</p>
              </div>
              <button
                onClick={() => onNavigate("/viral-sparks")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                All opportunities <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {hotSparks.length === 0 ? (
                <div className="col-span-3 rounded-xl border border-dashed border-border bg-card/25 p-8 text-center text-xs text-muted-foreground">
                  No opportunities discovered yet. Spark will index trending niches once connected to social channels.
                </div>
              ) : (
                hotSparks.map((spark: any) => (
                  <div
                    key={spark.id}
                    className="rounded-xl border border-border bg-card p-5 hover:border-accent/40 hover:shadow-xl hover:shadow-black/10 transition-all duration-200 group flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-warning" />
                        <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                          {spark.window} window
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${spark.score >= 92 ? "text-success" : "text-warning"}`}>
                        {spark.score}%
                      </span>
                    </div>
                    <h3 className="text-sm font-medium leading-snug mb-3 flex-1">{spark.title}</h3>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground">{spark.format}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-lg ${spark.risk === "Low" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                        {spark.risk} risk
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigate("/viral-sparks")}
                      className="w-full py-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 text-sm font-medium transition-all flex items-center justify-center gap-2 group-hover:bg-foreground group-hover:text-background"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Create Production
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ── Spark Intelligence ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spark Intelligence</h2>
              <p className="text-xs text-muted-foreground">
                {hasLiveSignals ? "Live Workspace Signals Active" : "Awaiting Live Signals"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {intelligence.map((section) => (
                  <div key={section.type} className={`rounded-xl border p-5 ${section.bg} ${section.border}`}>
                    <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${section.color}`}>{section.label}</p>
                    <div className="space-y-2.5">
                      {section.items.map((item: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onNavigate(item.path)}
                          className="w-full text-left flex items-start gap-2.5 group hover:bg-background/40 p-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/50 group-hover:text-foreground transition-colors flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground/90 font-medium group-hover:text-accent transition-colors truncate">
                              {item.text}
                            </p>
                            {item.sub && (
                              <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Performance Metrics ── */}
          <section>
            <SectionHeader
              label="Performance Overview"
              action={
                <button
                  onClick={() => onNavigate("/analytics")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  View Analytics <ArrowRight className="w-3 h-3" />
                </button>
              }
            />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {metrics.map((m) => {
                const Icon = m.icon;
                return (
                  <MetricCard
                    key={m.title}
                    title={m.title}
                    value={m.value}
                    subtitle={m.subtitle}
                    trend={(m as any).trend || "—"}
                    highlight={(m as any).success}
                    icon={<Icon className="w-3.5 h-3.5 text-foreground/80" />}
                    onClick={() => onNavigate("/analytics")}
                  />
                );
              })}
            </div>
          </section>

          {/* ── Activity ── */}
          <section>
            <SectionHeader label="Recent Activity" />
            <div className="rounded-xl border border-border bg-card p-6">
              {isEmpty ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No activity recorded yet.
                </div>
              ) : (
                <ActivityFeed activities={activities} onNavigate={onNavigate} />
              )}
            </div>
          </section>

        </div>
      </main>
      <AIChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} onNavigate={onNavigate} />
    </>
  );
}
