import { TopBar } from "./TopBar";
import { ActivityFeed } from "./ActivityFeed";
import { SectionHeader, MetricCard, Button, FilterPill } from "./ds";
import {
  Eye, DollarSign, TrendingUp, Video, Tv, Clapperboard,
  ArrowRight, Zap, Brain, Flame, AlertCircle, CheckCircle2,
  Loader2, Clock, Package, Calendar,
} from "lucide-react";

interface SparkHomeProps {
  onNavigate: (path: string) => void;
}

export function SparkHome({ onNavigate }: SparkHomeProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
  });

  const priorityItems = [
    {
      id: "p1",
      icon: AlertCircle,
      iconColor: "text-warning",
      borderColor: "border-l-warning",
      bg: "bg-warning/5",
      label: "5 creative reviews waiting",
      description: "\"5 Viral Marketing Tactics\" · Storyboard ready · 94% brand fit · Oldest: 2 min",
      action: "Review Now",
      path: "/review",
    },
    {
      id: "p2",
      icon: Flame,
      iconColor: "text-destructive",
      borderColor: "border-l-destructive",
      bg: "bg-destructive/5",
      label: "Hot opportunity — 48h window closing",
      description: "Nigerian Creators Using AI to Build Media Empires · 97% fit · Low risk",
      action: "Create Production",
      path: "/viral-sparks",
    },
    {
      id: "p3",
      icon: CheckCircle2,
      iconColor: "text-success",
      borderColor: "border-l-success",
      bg: "bg-success/5",
      label: "Publishing today at 2:00 PM",
      description: "\"Psychology of Viral Content\" · YouTube + TikTok · Approved and ready to go",
      action: "View Calendar",
      path: "/calendar",
    },
  ];

  const pipeline = [
    { stage: "Drafting", count: 2, color: "text-muted-foreground", indicator: "animate-pulse bg-muted-foreground/40", path: "/review" },
    { stage: "Ready", count: 5, color: "text-warning", indicator: "bg-warning", path: "/review" },
    { stage: "Approved", count: 3, color: "text-success", indicator: "bg-success", path: "/review" },
    { stage: "Scheduled", count: 12, color: "text-accent-foreground", indicator: "bg-accent", path: "/calendar" },
    { stage: "Published", count: 8, color: "text-muted-foreground", indicator: "bg-muted-foreground/40", path: "/analytics" },
  ];

  const hotSparks = [
    { id: "v1", title: "How Nigerian Creators Are Using AI to Build Media Empires", score: 97, format: "Long-form + Clips", window: "48h", risk: "Low" },
    { id: "v2", title: "Free AI Tools Replacing ₦500K Worth of Software", score: 95, format: "Tutorial + Reel", window: "7-day", risk: "Low" },
    { id: "v3", title: "The 60-Second Edit That Tripled Watch Time", score: 91, format: "Short-form", window: "24h", risk: "Low" },
  ];

  const intelligence = [
    {
      type: "opportunity", label: "Top Opportunities",
      items: ["AI content creation trending +340% — strong match for your niche", "Viral storytelling formats gaining velocity across short-form", "3 audience-confirmed topics awaiting production"],
      color: "text-success", bg: "bg-success/10", border: "border-success/20",
    },
    {
      type: "signal", label: "Audience Signal",
      items: ["\"How AI Creates Viral Content\" hitting 8.2% engagement — replicate format", "Peak window: Tue–Thu 2–4 PM showing 34% higher reach", "Hook style 'Nobody talks about this' averaging 3× retention"],
      color: "text-accent-foreground", bg: "bg-accent/10", border: "border-accent/30",
    },
    {
      type: "warning", label: "Needs Attention",
      items: ["Tutorial series engagement down 35% — format needs refresh", "Instagram Reels retention dropping below threshold", "2 scheduled posts missing caption review"],
      color: "text-warning", bg: "bg-warning/10", border: "border-warning/20",
    },
    {
      type: "action", label: "Recommended Actions",
      items: ["Create production from top opportunity: AI editing workflow", "Expand successful format to TikTok and YouTube Shorts", "Review 5 pending creative approvals — oldest is 2h"],
      color: "text-foreground", bg: "bg-muted/20", border: "border-border/50",
    },
  ];

  const metrics = [
    { title: "Monthly Views", value: "24.8M", icon: Eye, trend: "+18.2%", subtitle: "Across all accounts" },
    { title: "Revenue", value: "$142K", icon: DollarSign, trend: "+24.5%", subtitle: "This month", success: true },
    { title: "Growth Rate", value: "+42%", icon: TrendingUp, trend: "+8.2%", subtitle: "Month over month" },
    { title: "Published", value: "187", icon: Video, subtitle: "This month" },
    { title: "Accounts", value: "8", icon: Tv, subtitle: "Connected" },
    { title: "Productions", value: "21", icon: Clapperboard, subtitle: "Active" },
  ];

  const activities = [
    { id: "a1", type: "opportunity_discovered" as const, title: "Opportunity Discovered", metadata: "AI-powered video editing trends · 97% confidence", timestamp: "5m ago" },
    { id: "a2", type: "storyboard_approved" as const, title: "Storyboard Approved", metadata: "\"5 Viral Marketing Tactics\" · Sent to production", timestamp: "12m ago" },
    { id: "a3", type: "production_completed" as const, title: "Production Completed", metadata: "\"Psychology of Viral Content\" · Awaiting review", timestamp: "45m ago" },
    { id: "a4", type: "publishing_completed" as const, title: "Published", metadata: "\"How to Build a Media Empire\" · YouTube", timestamp: "1h ago" },
    { id: "a5", type: "analytics_updated" as const, title: "Intelligence Updated", metadata: "Weekly performance patterns refreshed · +42% growth signal", timestamp: "2h ago" },
  ];

  return (
    <>
      <TopBar pageName="Spark" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">

          {/* ── Command Briefing ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header row */}
            <div className="px-8 pt-7 pb-5 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-medium">{greeting}, Alex</h1>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <span>Spark is active · 3 opportunities found · 5 items need your attention · 2 publishing today</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{today}</p>
                <button
                  onClick={() => onNavigate("/my-spark")}
                  className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  <Brain className="w-3.5 h-3.5" />
                  Tech Insights Nigeria
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Priority items */}
            <div className="border-t border-border/60">
              {priorityItems.map((item, i) => {
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
              })}
            </div>
          </div>

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
              {hotSparks.map((spark) => (
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
              ))}
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
                    trend={m.trend}
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
              <ActivityFeed activities={activities} onNavigate={onNavigate} />
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
