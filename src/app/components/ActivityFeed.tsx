import {
  Lightbulb,
  CheckCircle2,
  Video,
  Rocket,
  BarChart3,
} from "lucide-react";

interface Activity {
  id: string;
  type:
    | "opportunity_discovered"
    | "storyboard_approved"
    | "production_completed"
    | "publishing_completed"
    | "analytics_updated";
  title: string;
  metadata: string;
  timestamp: string;
}

const activityConfig = {
  opportunity_discovered: {
    icon: Lightbulb,
    color: "text-accent-foreground",
    bg: "bg-accent/30",
  },
  storyboard_approved: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/20",
  },
  production_completed: {
    icon: Video,
    color: "text-accent-foreground",
    bg: "bg-accent/30",
  },
  publishing_completed: {
    icon: Rocket,
    color: "text-success",
    bg: "bg-success/20",
  },
  analytics_updated: {
    icon: BarChart3,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
  },
};

interface ActivityFeedProps {
  activities: Activity[];
  onNavigate?: (path: string) => void;
}

export function ActivityFeed({ activities, onNavigate }: ActivityFeedProps) {
  const getRouteForActivity = (type: Activity["type"]) => {
    switch (type) {
      case "opportunity_discovered": return "/viral-sparks";
      case "storyboard_approved": return "/calendar";
      case "production_completed": return "/review";
      case "publishing_completed": return "/analytics";
      case "analytics_updated": return "/analytics";
      default: return "/";
    }
  };

  return (
    <div className="space-y-0.5">
      {activities.map((activity, index) => {
        const config = activityConfig[activity.type];
        const Icon = config.icon;
        const isLast = index === activities.length - 1;

        return (
          <div key={activity.id} className="relative">
            <div
              onClick={() => onNavigate?.(getRouteForActivity(activity.type))}
              className="flex gap-4 p-3 hover:bg-accent/10 rounded-lg transition-all duration-200 cursor-pointer group"
            >
              <div className="relative flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-lg ${config.bg}
                    flex items-center justify-center flex-shrink-0
                    group-hover:scale-110 transition-transform
                  `}
                >
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                {!isLast && (
                  <div className="w-px h-6 bg-border/50 mt-1" />
                )}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm font-medium group-hover:text-foreground transition-colors">
                    {activity.title}
                  </h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {activity.timestamp}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.metadata}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
