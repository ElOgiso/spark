import {
  Sparkles,
  TrendingUp,
  Mic,
  Plus,
  Play,
  FileText,
  Search,
  Lightbulb,
  ChevronRight,
  BarChart3,
} from "lucide-react";

export function MobileChannelWorkspace() {
  const channel = {
    name: "Tech Insights Nigeria",
    status: "Accelerating",
    aiHealth: 94,
    growth: {
      rate: "+42%",
      engagement: "8.2%",
      retention: 72
    },
    latestContent: [
      { id: "1", title: "How AI Changes Content Creation in Africa", views: "124K", time: "2d ago" },
      { id: "2", title: "Free Tools Every Creator Needs", views: "89K", time: "5d ago" },
      { id: "3", title: "Tech Trends Shaping Nigeria 2026", views: "156K", time: "1w ago" },
    ],
    aiRecommendations: [
      "High opportunity: AI automation for small businesses",
      "Trending: Mobile payment solutions",
      "Create: Success story with local startup"
    ],
    primaryVoice: {
      name: "Spark_Nigeria_English",
      status: "Active",
      language: "English (Nigerian)",
    }
  };

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">Channel Control Panel</p>
        <h1 className="text-2xl font-medium mb-3">{channel.name}</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/20 text-success">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{channel.status}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{channel.aiHealth}% AI</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-medium mb-4">Growth Snapshot</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-background">
            <p className="text-xl font-medium">{channel.growth.rate}</p>
            <p className="text-xs text-muted-foreground mt-1">Growth</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background">
            <p className="text-xl font-medium">{channel.growth.engagement}</p>
            <p className="text-xs text-muted-foreground mt-1">Engagement</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background">
            <p className="text-xl font-medium">{channel.growth.retention}%</p>
            <p className="text-xs text-muted-foreground mt-1">Retention</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium">Latest Content</h3>
          <button className="text-xs text-muted-foreground">View all</button>
        </div>
        <div className="space-y-3">
          {channel.latestContent.map((content) => (
            <div key={content.id} className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-accent/5 transition-colors">
              <BarChart3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{content.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>{content.views} views</span>
                  <span>•</span>
                  <span>{content.time}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-accent-foreground" />
          <h3 className="text-base font-medium">AI Recommendations</h3>
        </div>
        <div className="space-y-3">
          {channel.aiRecommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-background">
              <Lightbulb className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm flex-1">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="w-4 h-4" />
          <h3 className="text-base font-medium">Voice Status</h3>
        </div>
        <div className="p-4 rounded-lg bg-accent/20 border border-accent/40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium font-mono">{channel.primaryVoice.name}</p>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-success/20 text-success">
              {channel.primaryVoice.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{channel.primaryVoice.language}</p>
          <button className="w-full py-2 rounded-lg bg-accent hover:bg-accent/80 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Play className="w-3.5 h-3.5" />
            Preview Voice
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-medium mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 active:bg-accent/70 transition-all active:scale-[0.98] flex flex-col items-center gap-2 text-center">
            <Plus className="w-5 h-5" />
            <span className="text-xs font-medium">Create Series</span>
          </button>
          <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 active:bg-accent/70 transition-all active:scale-[0.98] flex flex-col items-center gap-2 text-center">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-medium">Generate Idea</span>
          </button>
          <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 active:bg-accent/70 transition-all active:scale-[0.98] flex flex-col items-center gap-2 text-center">
            <FileText className="w-5 h-5" />
            <span className="text-xs font-medium">Storyboard</span>
          </button>
          <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 active:bg-accent/70 transition-all active:scale-[0.98] flex flex-col items-center gap-2 text-center">
            <Search className="w-5 h-5" />
            <span className="text-xs font-medium">Research</span>
          </button>
        </div>
      </div>
    </div>
  );
}
