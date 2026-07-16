import {
  Eye, DollarSign, Tv, Video, AlertCircle, Lightbulb,
  TrendingUp, CheckCircle2, Rocket, BarChart3, Flame,
  ArrowRight, Loader2, Clock, Package,
} from "lucide-react";
import { useSpark } from "../../state/SparkContext";
import { AIChatPill } from "../AIChatPill";
import { AIChatModal } from "../AIChatModal";
import { useState } from "react";

interface ActivityItem {
  id: string;
  type: "opportunity" | "approved" | "completed" | "published" | "analytics";
  title: string;
  time: string;
}

interface MobileHomeProps {
  onNavigate?: (path: string) => void;
}

export function MobileHome({ onNavigate }: MobileHomeProps = {}) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { productions, reviewItems, viralSparks } = useSpark();
  const isEmpty = productions.length === 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Pipeline counts
  const draftingCount = productions.filter(p => p.status === "Drafting").length;
  const readyCount = productions.filter(p => p.status === "Ready for Review").length;
  const approvedCount = productions.filter(p => p.status === "Approved" && p.id !== "p7" && !p.id.includes("scheduled") && p.id !== "p8" && !p.id.includes("export")).length;
  const scheduledCount = productions.filter(p => p.status === "Approved" && (p.id === "p7" || p.id.includes("scheduled"))).length;
  const publishedCount = isEmpty ? 0 : 8; // standard baseline or dynamic equivalent

  const priorityItems = isEmpty ? [] : [
    {
      icon: AlertCircle,
      iconColor: "text-warning",
      borderColor: "border-l-warning",
      bg: "bg-warning/5",
      label: `${readyCount} reviews waiting`,
      desc: "Creative review — oldest 2 min",
      action: "Review",
      path: "/review",
    },
    {
      icon: Flame,
      iconColor: "text-destructive",
      borderColor: "border-l-destructive",
      bg: "bg-destructive/5",
      label: "Hot opportunity",
      desc: "Nigerian Creators + AI · 97% fit",
      action: "Create",
      path: "/viral-sparks",
    },
    {
      icon: CheckCircle2,
      iconColor: "text-success",
      borderColor: "border-l-success",
      bg: "bg-success/5",
      label: "Publishing today 2 PM",
      desc: "Psychology of Viral Content · YouTube",
      action: "Calendar",
      path: "/review", // Since calendar isn't directly a separate page, we can route it to review queue (e.g. approved / scheduled list)
    },
  ];

  const pipeline = [
    { label: "Drafting", count: draftingCount, color: "text-muted-foreground", path: "/review" },
    { label: "Ready", count: readyCount, color: "text-warning", path: "/review" },
    { label: "Approved", count: approvedCount, color: "text-success", path: "/review" },
    { label: "Scheduled", count: scheduledCount, color: "text-accent-foreground", path: "/review" },
    { label: "Published", count: publishedCount, color: "text-muted-foreground", path: "/analytics" },
  ];

  const metrics = [
    { label: "Monthly Views", value: isEmpty ? "0" : "24.8M", icon: Eye, trend: isEmpty ? "0%" : "+18%", path: "/analytics" },
    { label: "Revenue", value: isEmpty ? "$0" : "$142K", icon: DollarSign, trend: isEmpty ? "0%" : "+24%", path: "/analytics" },
    { label: "Accounts", value: isEmpty ? "0" : "8", icon: Tv, path: "/more" },
    { label: "Published Today", value: isEmpty ? "0" : "12", icon: Video, trend: isEmpty ? "+0" : "+3", path: "/analytics" },
    { label: "Reviews Pending", value: String(readyCount), icon: AlertCircle, path: "/review" },
    { label: "Viral Sparks", value: String(viralSparks.length), icon: Flame, trend: isEmpty ? "" : "new", path: "/viral-sparks" },
  ];

  const activities: ActivityItem[] = isEmpty ? [] : [
    { id: "a1", type: "opportunity", title: "AI editing trends discovered (97% fit)", time: "5m ago" },
    { id: "a2", type: "approved", title: "Storyboard approved for Marketing Tactics", time: "12m ago" },
    { id: "a3", type: "completed", title: "Psychology of Viral Content ready for review", time: "45m ago" },
    { id: "a4", type: "published", title: "Build a Media Empire published to YouTube", time: "1h ago" },
  ];

  const activityIcons = {
    opportunity: { icon: Lightbulb, color: "text-accent-foreground", path: "/viral-sparks" },
    approved: { icon: CheckCircle2, color: "text-success", path: "/review" },
    completed: { icon: Video, color: "text-accent-foreground", path: "/review" },
    published: { icon: Rocket, color: "text-success", path: "/analytics" },
    analytics: { icon: BarChart3, color: "text-muted-foreground", path: "/analytics" },
  };

  return (
    <div className="h-[calc(100vh-76px)] flex flex-col overflow-hidden">
      {/* Fixed Header & Pipeline Block */}
      <div className="p-4 pb-0 space-y-4 flex-shrink-0 bg-background z-10">
        {/* Command Header */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
              <h1 className="text-xl font-medium">{greeting}, Alex</h1>
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
            {isEmpty ? (
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

      {/* Scrollable Metrics and Activity Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-none pb-28">
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
                { text: "YouTube growing rapidly (+42%) — momentum window open", type: "success" as const, path: "/analytics" },
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

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Activity</p>
            {!isEmpty && (
              <button
                onClick={() => onNavigate?.("/review")}
                className="text-xs text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95"
              >
                View all
              </button>
            )}
          </div>
          <div className="space-y-3">
            {isEmpty ? (
              <div className="text-center py-2 text-xs text-muted-foreground">
                No activity recorded yet.
              </div>
            ) : (
              activities.map((activity) => {
                const config = activityIcons[activity.type];
                const Icon = config.icon;
                return (
                  <button
                    key={activity.id}
                    onClick={() => onNavigate?.(config.path)}
                    className="w-full flex items-start gap-3 text-left transition-colors duration-150 active:bg-accent/5 p-1 -m-1 rounded-lg"
                  >
                    <div className="w-7 h-7 rounded-lg bg-accent/30 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{activity.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <AIChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
