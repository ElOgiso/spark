import { Lightbulb, Video, Clapperboard, CheckCircle2, Rocket } from "lucide-react";

interface StatusItem {
  stage: "planning" | "production" | "rendering" | "ready" | "publishing";
  count: number;
  items?: string[];
}

const stageConfig = {
  planning: {
    label: "Planning",
    icon: Lightbulb,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
  production: {
    label: "Production",
    icon: Video,
    color: "text-accent-foreground",
    bg: "bg-accent/50",
  },
  rendering: {
    label: "Rendering",
    icon: Clapperboard,
    color: "text-warning",
    bg: "bg-warning/20",
  },
  ready: {
    label: "Ready For Review",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/20",
  },
  publishing: {
    label: "Publishing",
    icon: Rocket,
    color: "text-accent-foreground",
    bg: "bg-accent/50",
  },
};

interface ProductionStatusProps {
  statuses: StatusItem[];
}

export function ProductionStatus({ statuses }: ProductionStatusProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Production Status</h2>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View all
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statuses.map((status) => {
          const config = stageConfig[status.stage];
          const Icon = config.icon;

          return (
            <div
              key={status.stage}
              className={`
                rounded-lg border border-border/50 p-4
                ${config.bg}
                hover:shadow-lg hover:shadow-black/5 transition-all duration-200
              `}
            >
              <div className={`${config.color} mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {config.label}
              </p>
              <p className="text-2xl font-medium">{status.count}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
