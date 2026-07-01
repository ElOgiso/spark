import {
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  Eye,
  Heart,
  MessageCircle,
} from "lucide-react";

interface ContentPerformance {
  id: string;
  title: string;
  views: string;
  engagement: string;
  channel: string;
}

interface Recommendation {
  id: string;
  text: string;
  impact: "high" | "medium";
}

export function MobileInsights() {
  const topPerforming: ContentPerformance[] = [
    {
      id: "c1",
      title: "How AI Creates Viral Content",
      views: "2.4M",
      engagement: "8.2%",
      channel: "YouTube",
    },
    {
      id: "c2",
      title: "Behind the Scenes: AI Production",
      views: "1.8M",
      engagement: "6.5%",
      channel: "TikTok",
    },
    {
      id: "c3",
      title: "Future of Content Creation",
      views: "890K",
      engagement: "12.5%",
      channel: "Instagram",
    },
  ];

  const underperforming: ContentPerformance[] = [
    {
      id: "u1",
      title: "Technical Tutorial Series",
      views: "145K",
      engagement: "2.1%",
      channel: "YouTube",
    },
    {
      id: "u2",
      title: "Industry News Recap",
      views: "98K",
      engagement: "1.8%",
      channel: "LinkedIn",
    },
  ];

  const recommendations: Recommendation[] = [
    {
      id: "r1",
      text: "Expand successful tutorial format to TikTok for broader reach",
      impact: "high",
    },
    {
      id: "r2",
      text: "Increase publishing frequency during peak engagement windows (2-4 PM)",
      impact: "high",
    },
    {
      id: "r3",
      text: "Consider collaboration opportunities with 3 identified creators",
      impact: "medium",
    },
  ];

  const nextTopics = [
    "AI-powered video editing workflows",
    "Psychology of viral storytelling",
    "Content creation automation trends",
  ];

  const metrics = [
    { label: "Total Views", value: "24.8M", change: "+18%", icon: Eye },
    { label: "Avg Engagement", value: "7.2%", change: "+2.3%", icon: Heart },
    { label: "Comments", value: "42.5K", change: "+31%", icon: MessageCircle },
  ];

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Learn what's working
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-xl border border-border bg-card p-3"
            >
              <Icon className="w-4 h-4 text-muted-foreground mb-2" />
              <p className="text-lg font-medium">{metric.value}</p>
              <p className="text-[11px] text-muted-foreground mb-1">
                {metric.label}
              </p>
              <p className="text-[11px] text-success font-medium">
                {metric.change}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-success" />
          <h2 className="text-base font-medium">What Worked</h2>
        </div>
        <div className="space-y-3">
          {topPerforming.map((content) => (
            <div
              key={content.id}
              className="p-3 rounded-lg bg-success/5 border border-success/20"
            >
              <h3 className="text-sm font-medium mb-2 line-clamp-2">
                {content.title}
              </h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{content.channel}</span>
                <span className="text-success font-medium">
                  {content.views} views
                </span>
                <span className="text-success font-medium">
                  {content.engagement} engagement
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-warning" />
          <h2 className="text-base font-medium">What Failed</h2>
        </div>
        <div className="space-y-3">
          {underperforming.map((content) => (
            <div
              key={content.id}
              className="p-3 rounded-lg bg-warning/5 border border-warning/20"
            >
              <h3 className="text-sm font-medium mb-2 line-clamp-2">
                {content.title}
              </h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{content.channel}</span>
                <span>{content.views} views</span>
                <span>{content.engagement} engagement</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-accent-foreground" />
          <h2 className="text-base font-medium">What To Create Next</h2>
        </div>
        <div className="space-y-2">
          {nextTopics.map((topic, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-accent/10"
            >
              <div className="w-6 h-6 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                {index + 1}
              </div>
              <p className="text-sm flex-1">{topic}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-accent-foreground" />
          <h2 className="text-base font-medium">AI Recommendations</h2>
        </div>
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`p-3 rounded-lg ${
                rec.impact === "high"
                  ? "bg-success/10 border border-success/20"
                  : "bg-accent/10 border border-accent/20"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    rec.impact === "high"
                      ? "bg-success/20 text-success"
                      : "bg-accent/30 text-accent-foreground"
                  }`}
                >
                  {rec.impact === "high" ? "High Impact" : "Medium Impact"}
                </span>
              </div>
              <p className="text-sm">{rec.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
