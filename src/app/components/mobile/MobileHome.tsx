import {
  Eye,
  DollarSign,
  Tv,
  Video,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  CheckCircle2,
  Rocket,
  BarChart3,
} from "lucide-react";

interface MetricCard {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}

interface BriefingItem {
  id: string;
  text: string;
  type: "opportunity" | "alert" | "success";
}

interface ActivityItem {
  id: string;
  type: "opportunity" | "approved" | "completed" | "published" | "analytics";
  title: string;
  time: string;
}

export function MobileHome() {
  const metrics: MetricCard[] = [
    { label: "Monthly Views", value: "24.8M", icon: Eye, trend: "+18%" },
    { label: "Revenue", value: "$142K", icon: DollarSign, trend: "+24%" },
    { label: "Active Channels", value: "8", icon: Tv },
    { label: "Published Today", value: "12", icon: Video, trend: "+3" },
    { label: "Reviews Pending", value: "5", icon: AlertCircle },
    { label: "Opportunities", value: "18", icon: Lightbulb, trend: "+7" },
  ];

  const briefing: BriefingItem[] = [
    {
      id: "b1",
      text: "3 high opportunity topics discovered",
      type: "opportunity",
    },
    {
      id: "b2",
      text: "2 productions awaiting approval",
      type: "alert",
    },
    {
      id: "b3",
      text: "YouTube channel growing rapidly (+42%)",
      type: "success",
    },
  ];

  const activities: ActivityItem[] = [
    {
      id: "a1",
      type: "opportunity",
      title: "AI video editing trends discovered",
      time: "5m ago",
    },
    {
      id: "a2",
      type: "approved",
      title: "Storyboard approved for Marketing Tactics",
      time: "12m ago",
    },
    {
      id: "a3",
      type: "completed",
      title: "Psychology of Viral Content rendered",
      time: "45m ago",
    },
    {
      id: "a4",
      type: "published",
      title: "Build a Media Empire published to YouTube",
      time: "1h ago",
    },
  ];

  const activityIcons = {
    opportunity: { icon: Lightbulb, color: "text-accent-foreground" },
    approved: { icon: CheckCircle2, color: "text-success" },
    completed: { icon: Video, color: "text-accent-foreground" },
    published: { icon: Rocket, color: "text-success" },
    analytics: { icon: BarChart3, color: "text-muted-foreground" },
  };

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your AI media company
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className="w-5 h-5 text-muted-foreground" />
                {metric.trend && (
                  <span className="text-xs font-medium text-success">
                    {metric.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-medium">{metric.value}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-medium mb-4">AI Daily Briefing</h2>
        <div className="space-y-3">
          {briefing.map((item) => {
            const config = {
              opportunity: {
                icon: TrendingUp,
                color: "text-success",
                bg: "bg-success/10",
              },
              alert: {
                icon: AlertCircle,
                color: "text-warning",
                bg: "bg-warning/10",
              },
              success: {
                icon: CheckCircle2,
                color: "text-success",
                bg: "bg-success/10",
              },
            };
            const Icon = config[item.type].icon;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${config[item.type].bg}`}
              >
                <Icon className={`w-4 h-4 mt-0.5 ${config[item.type].color}`} />
                <p className="text-sm flex-1">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">Recent Activity</h2>
          <button className="text-xs text-muted-foreground">View all</button>
        </div>
        <div className="space-y-3">
          {activities.map((activity) => {
            const config = activityIcons[activity.type];
            const Icon = config.icon;

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 hover:bg-accent/5 p-2 rounded-lg -mx-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activity.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium">Review Queue</h2>
          <span className="text-sm font-medium text-warning">5 pending</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          3 creative reviews and 2 production reviews need your attention
        </p>
        <button className="w-full py-3 bg-foreground text-background rounded-lg font-medium text-sm">
          Review Now
        </button>
      </div>
    </div>
  );
}
