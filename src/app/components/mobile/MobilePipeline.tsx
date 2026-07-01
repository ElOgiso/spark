import {
  Lightbulb,
  FileText,
  Image as ImageIcon,
  Clapperboard,
  Rocket,
  CheckCircle2,
  Clock,
} from "lucide-react";

type ContentStage =
  | "opportunity"
  | "narrative"
  | "storyboard"
  | "rendering"
  | "published"
  | "learning";

interface PipelineItem {
  id: string;
  title: string;
  stage: ContentStage;
  channel: string;
  progress?: number;
  time: string;
  thumbnail?: string;
}

export function MobilePipeline() {
  const stageConfig = {
    opportunity: {
      label: "Opportunity Found",
      icon: Lightbulb,
      color: "text-accent-foreground",
      bg: "bg-accent/20",
    },
    narrative: {
      label: "Narrative Approved",
      icon: FileText,
      color: "text-success",
      bg: "bg-success/10",
    },
    storyboard: {
      label: "Storyboard Ready",
      icon: ImageIcon,
      color: "text-success",
      bg: "bg-success/10",
    },
    rendering: {
      label: "Rendering",
      icon: Clapperboard,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    published: {
      label: "Published",
      icon: Rocket,
      color: "text-success",
      bg: "bg-success/10",
    },
    learning: {
      label: "Learning Complete",
      icon: CheckCircle2,
      color: "text-muted-foreground",
      bg: "bg-muted/30",
    },
  };

  const pipelineItems: PipelineItem[] = [
    {
      id: "p1",
      title: "AI-Powered Video Editing Trends",
      stage: "opportunity",
      channel: "YouTube",
      time: "5m ago",
    },
    {
      id: "p2",
      title: "5 Viral Marketing Tactics",
      stage: "narrative",
      channel: "YouTube",
      time: "12m ago",
    },
    {
      id: "p3",
      title: "Psychology of Viral Content",
      stage: "rendering",
      channel: "TikTok",
      progress: 67,
      time: "45m ago",
    },
    {
      id: "p4",
      title: "How to Build a Media Empire",
      stage: "published",
      channel: "YouTube",
      time: "1h ago",
    },
    {
      id: "p5",
      title: "Content Creation Workflow",
      stage: "storyboard",
      channel: "Instagram",
      time: "2h ago",
    },
    {
      id: "p6",
      title: "AI Content Tips #47",
      stage: "published",
      channel: "TikTok",
      time: "3h ago",
    },
    {
      id: "p7",
      title: "Behind the Scenes: AI Production",
      stage: "learning",
      channel: "YouTube",
      time: "1d ago",
    },
  ];

  const stats = [
    { label: "In Progress", value: "12", icon: Clock, color: "text-warning" },
    { label: "Published Today", value: "8", icon: Rocket, color: "text-success" },
    { label: "Opportunities", value: "18", icon: Lightbulb, color: "text-accent-foreground" },
  ];

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track content progress
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-3"
            >
              <Icon className={`w-4 h-4 ${stat.color} mb-2`} />
              <p className="text-xl font-medium">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {pipelineItems.map((item) => {
          const config = stageConfig[item.stage];
          const Icon = config.icon;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-card p-4 active:bg-accent/5 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium mb-1 line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>{item.channel}</span>
                    <span>•</span>
                    <span>{item.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${config.bg} ${config.color}`}
                    >
                      {config.label}
                    </span>
                    {item.progress !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {item.progress}%
                      </span>
                    )}
                  </div>
                  {item.progress !== undefined && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-warning transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
