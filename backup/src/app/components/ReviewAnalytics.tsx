import { Clock, TrendingUp, TrendingDown, Zap } from "lucide-react";

interface AnalyticsMetric {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface ReviewAnalyticsProps {
  metrics: {
    avgApprovalTime: string;
    approvalRate: number;
    rejectionRate: number;
    automationRate: number;
  };
}

export function ReviewAnalytics({ metrics }: ReviewAnalyticsProps) {
  const analyticsData: AnalyticsMetric[] = [
    {
      label: "Average Approval Time",
      value: metrics.avgApprovalTime,
      change: "-15%",
      positive: true,
      icon: Clock,
    },
    {
      label: "Approval Rate",
      value: `${metrics.approvalRate}%`,
      change: "+3.2%",
      positive: true,
      icon: TrendingUp,
    },
    {
      label: "Rejection Rate",
      value: `${metrics.rejectionRate}%`,
      change: "-1.5%",
      positive: true,
      icon: TrendingDown,
    },
    {
      label: "Automation Rate",
      value: `${metrics.automationRate}%`,
      change: "+12%",
      positive: true,
      icon: Zap,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-medium mb-6">Review Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsData.map((metric) => {
          const Icon = metric.icon;

          return (
            <div
              key={metric.label}
              className="rounded-lg border border-border/50 bg-background/50 p-4 hover:shadow-lg hover:shadow-black/5 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-muted-foreground">
                  <Icon className="w-4 h-4" />
                </div>
                {metric.change && (
                  <span
                    className={`text-xs font-medium ${
                      metric.positive ? "text-success" : "text-destructive"
                    }`}
                  >
                    {metric.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-medium mb-1">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
