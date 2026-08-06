import { Clock, Loader2, CheckCircle2, XCircle, type LucideIcon } from "lucide-react";

interface StatusItem {
  stage: "scheduled" | "publishing" | "published" | "failed";
  count: number;
  details?: string;
}

const stageConfig: Record<StatusItem["stage"], {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  animate?: boolean;
}> = {
  scheduled: {
    label: "Scheduled",
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    border: "border-border/50",
  },
  publishing: {
    label: "Publishing",
    icon: Loader2,
    color: "text-accent-foreground",
    bg: "bg-accent/50",
    border: "border-accent/40",
    animate: true,
  },
  published: {
    label: "Published",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/20",
    border: "border-success/30",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/20",
    border: "border-destructive/30",
  },
};

interface PublishingStatusProps {
  statuses: StatusItem[];
}

export function PublishingStatus({ statuses }: PublishingStatusProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Publishing Status</h2>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View queue
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statuses.map((status) => {
          const config = stageConfig[status.stage];
          const Icon = config.icon;

          return (
            <div
              key={status.stage}
              className={`
                rounded-lg border p-4
                ${config.bg} ${config.border}
                hover:shadow-lg hover:shadow-black/5 transition-all duration-200
              `}
            >
              <div className={`${config.color} mb-3`}>
                <Icon
                  className={`w-5 h-5 ${config.animate ? "animate-spin" : ""}`}
                />
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {config.label}
              </p>
              <p className="text-2xl font-medium">{status.count}</p>
              {status.details && (
                <p className="text-xs text-muted-foreground mt-2">
                  {status.details}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
