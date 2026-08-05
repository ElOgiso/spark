import { useSpark } from "../state/SparkContext";
import { useAuth } from "../state/AuthContext";
import { TopBar } from "./TopBar";
import { ActivityFeed } from "./ActivityFeed";
import { SectionHeader, MetricCard, Button, WhySparkRecommends } from "./ds";
import { AIChatPill } from "./AIChatPill";
import { AIChatModal } from "./AIChatModal";
import { useState, useEffect } from "react";
import {
  Eye, DollarSign, TrendingUp, Video, Tv, Clapperboard,
  ArrowRight, Zap, Brain, Flame, AlertCircle, CheckCircle2,
} from "lucide-react";

interface SparkHomeProps {
  onNavigate: (path: string) => void;
}

export function SparkHome({ onNavigate }: SparkHomeProps) {
  const auth = useAuth();
  const { productions, reviewItems, viralSparks, character, brand, accounts } = useSpark() as any;
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

  const pendingReviews = reviewItems.filter((r: any) => r.status === "Pending Review");
  const approvedProductions = productions.filter((p: any) => p.status === "Approved");
  const blockedProductionsCount = productions.filter((p: any) => p.status === "Blocked" || p.status === "blocked").length;

  const priorityItems = isEmpty ? [] : [
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
    { stage: "Drafting", count: isEmpty ? 0 : productions.filter((p: any) => ["Drafting", "Draft", "Researching", "Research Complete", "Planning", "Planning Complete", "Storyboarding", "Storyboard Complete", "Generating", "Editing"].includes(p.status)).length, color: "text-muted-foreground", indicator: "animate-pulse bg-muted-foreground/40", path: "/review" },
    { stage: "Ready", count: isEmpty ? 0 : productions.filter((p: any) => ["Ready for Review", "Awaiting Review"].includes(p.status)).length, color: "text-warning", indicator: "bg-warning", path: "/review" },
    { stage: "Approved", count: isEmpty ? 0 : productions.filter((p: any) => p.status === "Approved").length, color: "text-success", indicator: "bg-success", path: "/review" },
    { stage: "Scheduled", count: isEmpty ? 0 : productions.filter((p: any) => p.status === "Scheduled").length, color: "text-accent-foreground", indicator: "bg-accent", path: "/calendar" },
    { stage: "Published", count: isEmpty ? 0 : productions.filter((p: any) => p.status === "Published" || p.status === "published").length, color: "text-muted-foreground", indicator: "bg-muted-foreground/40", path: "/analytics" },
  ];

  const hotSparks = isEmpty ? [] : viralSparks.slice(0, 3).map((s: any, i: number) => ({
    id: `v${i}`,
    title: s.title || s.topic || "Untitled Spark",
    score: s.score || s.confidence || 0,
    format: s.format || "Short-form",
    window: s.window || "—",
    risk: s.risk || "Low",
  }));

  const intelligence = [
    {
      type: "opportunity", label: "Top Opportunities",
      items: isEmpty ? ["No opportunities yet. Connect your integrations to retrieve market signals."] : ["Trending topics detected in your niche — review opportunities", "Format analysis suggests potential for engagement growth", `${viralSparks.length} topics awaiting production`],
      color: "text-success", bg: "bg-success/10", border: "border-success/20",
    },
    {
      type: "signal", label: "Audience Signal",
      items: isEmpty ? ["Signals will index here after publishing content."] : ["Connect analytics to receive audience engagement signals", "Posting window analysis available after first publish", "Hook style analysis requires minimum 3 published posts"],
      color: "text-accent-foreground", bg: "bg-accent/10", border: "border-accent/30",
    },
    {
      type: "warning", label: "Needs Attention",
      items: isEmpty ? ["No action items pending."] : [`${reviewItems.filter((r: any) => r.status === "Pending Review").length} items pending review`, "Connect analytics to monitor content performance", "Review pending creative approvals"],
      color: "text-warning", bg: "bg-warning/10", border: "border-warning/20",
    },
    {
      type: "action", label: "Recommended Actions",
      items: isEmpty ? ["Start by generating a campaign storyboard."] : ["Create production from your top opportunity", "Review pending creative approvals", "Connect more accounts to expand distribution"],
      color: "text-foreground", bg: "bg-muted/20", border: "border-border/50",
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
  const hasAccounts = accounts && accounts.length > 0;

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
    { title: "Accounts", value: String(accounts?.length || 0), icon: Tv, subtitle: "Connected" },
    { title: "Productions", value: String(productions.length), icon: Clapperboard, subtitle: "Active" },
  ];

  const activities = isEmpty ? [] : productions.slice(0, 5).map((p: any, i: number) => ({
    id: `a${i}`,
    type: "production_completed" as const,
    title: p.status === "Published" ? "Published" : p.status === "Approved" ? "Storyboard Approved" : "Production Created",
    metadata: `"${p.title}" · ${p.status}`,
    timestamp: p.createdAt ? new Date(p.createdAt).toLocaleTimeString() : "—",
  }));

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
              {isEmpty ? (
                <div className="px-8 py-6 text-center text-xs text-muted-foreground">
                  All caught up! Start a workspace campaign to populate action items.
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
              {isEmpty ? (
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
              <p className="text-xs text-muted-foreground">Generated 6:00 AM · Refreshed 12m ago</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {intelligence.map((section) => (
                  <div key={section.type} className={`rounded-xl border p-5 ${section.bg} ${section.border}`}>
                    <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${section.color}`}>{section.label}</p>
                    <div className="space-y-2.5">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">{item}</p>
                        </div>
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
      <AIChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
}
