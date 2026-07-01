import {
  Eye, DollarSign, Tv, Video, AlertCircle, Lightbulb,
  TrendingUp, CheckCircle2, Rocket, BarChart3, Flame,
  ArrowRight, Loader2, Clock, Package,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: "opportunity" | "approved" | "completed" | "published" | "analytics";
  title: string;
  time: string;
}

export function MobileHome() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const priorityItems = [
    {
      icon: AlertCircle,
      iconColor: "text-warning",
      borderColor: "border-l-warning",
      bg: "bg-warning/5",
      label: "5 reviews waiting",
      desc: "Creative review — oldest 2 min",
      action: "Review",
    },
    {
      icon: Flame,
      iconColor: "text-destructive",
      borderColor: "border-l-destructive",
      bg: "bg-destructive/5",
      label: "Hot opportunity",
      desc: "Nigerian Creators + AI · 97% fit",
      action: "Create",
    },
    {
      icon: CheckCircle2,
      iconColor: "text-success",
      borderColor: "border-l-success",
      bg: "bg-success/5",
      label: "Publishing today 2 PM",
      desc: "Psychology of Viral Content · YouTube",
      action: "Calendar",
    },
  ];

  const pipeline = [
    { label: "Drafting", count: 2, color: "text-muted-foreground" },
    { label: "Ready", count: 5, color: "text-warning" },
    { label: "Approved", count: 3, color: "text-success" },
    { label: "Scheduled", count: 12, color: "text-accent-foreground" },
    { label: "Published", count: 8, color: "text-muted-foreground" },
  ];

  const metrics = [
    { label: "Monthly Views", value: "24.8M", icon: Eye, trend: "+18%" },
    { label: "Revenue", value: "$142K", icon: DollarSign, trend: "+24%" },
    { label: "Accounts", value: "8", icon: Tv },
    { label: "Published Today", value: "12", icon: Video, trend: "+3" },
    { label: "Reviews Pending", value: "5", icon: AlertCircle },
    { label: "Viral Sparks", value: "8", icon: Flame, trend: "new" },
  ];

  const activities: ActivityItem[] = [
    { id: "a1", type: "opportunity", title: "AI editing trends discovered (97% fit)", time: "5m ago" },
    { id: "a2", type: "approved", title: "Storyboard approved for Marketing Tactics", time: "12m ago" },
    { id: "a3", type: "completed", title: "Psychology of Viral Content ready for review", time: "45m ago" },
    { id: "a4", type: "published", title: "Build a Media Empire published to YouTube", time: "1h ago" },
  ];

  const activityIcons = {
    opportunity: { icon: Lightbulb, color: "text-accent-foreground" },
    approved: { icon: CheckCircle2, color: "text-success" },
    completed: { icon: Video, color: "text-accent-foreground" },
    published: { icon: Rocket, color: "text-success" },
    analytics: { icon: BarChart3, color: "text-muted-foreground" },
  };

  return (
    <div className="pb-24 px-4 pt-6 space-y-5">

      {/* Command Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="text-xl font-medium">{greeting}, Alex</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Spark is active · 3 opportunities · 5 need review
          </div>
        </div>
        <div className="border-t border-border/50">
          {priorityItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-5 py-3.5 border-l-2 ${item.borderColor} ${item.bg} ${i < priorityItems.length - 1 ? "border-b border-border/40" : ""}`}
              >
                <Icon className={`w-3.5 h-3.5 ${item.iconColor} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${item.iconColor}`}>{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{item.action} →</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Strip */}
      <div className="rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="flex items-center gap-0">
          {pipeline.map((stage, i) => (
            <div key={stage.label} className="flex-1 text-center">
              <p className={`text-lg font-medium ${stage.color}`}>{stage.count}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stage.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                {metric.trend && (
                  <span className={`text-xs font-medium ${metric.trend === "new" ? "text-accent-foreground" : "text-success"}`}>
                    {metric.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-medium">{metric.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
            </div>
          );
        })}
      </div>

      {/* Today's Intelligence */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Today's Intelligence</p>
        <div className="space-y-2.5">
          {[
            { text: "3 high-fit opportunities ready to create", type: "opportunity" as const },
            { text: "2 productions awaiting review approval", type: "alert" as const },
            { text: "YouTube growing rapidly (+42%) — momentum window open", type: "success" as const },
          ].map((item, i) => {
            const config = {
              opportunity: { icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
              alert: { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10" },
              success: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
            };
            const Icon = config[item.type].icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${config[item.type].bg}`}>
                <Icon className={`w-3.5 h-3.5 mt-0.5 ${config[item.type].color} flex-shrink-0`} />
                <p className="text-sm">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Activity</p>
          <button className="text-xs text-muted-foreground">View all</button>
        </div>
        <div className="space-y-3">
          {activities.map((activity) => {
            const config = activityIcons[activity.type];
            const Icon = config.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-accent/30 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
