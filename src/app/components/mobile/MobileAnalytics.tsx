import {
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  Brain,
  Eye,
  Heart,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface MobileAnalyticsProps {
  onNavigate?: (path: string) => void;
}

export function MobileAnalytics({ onNavigate }: MobileAnalyticsProps = {}) {
  const topPerformers = [
    { id: "c1", title: "How AI Creates Viral Content", views: "2.4M", engagement: "8.2%", platform: "YouTube", why: "Hook addressed pain point in 4s. Numbered list reduced drop-off." },
    { id: "c2", title: "Behind the Scenes: AI Production", views: "1.8M", engagement: "6.5%", platform: "TikTok", why: "Raw format triggered authenticity signal. 'Nobody shows you this' hook." },
    { id: "c3", title: "Free Tools for Nigerian Creators", views: "1.1M", engagement: "11.2%", platform: "YouTube", why: "High local relevance + community discussion boosted algorithm." },
  ];

  const failures = [
    { id: "f1", title: "Technical Tutorial Series Ep. 4", views: "45K", platform: "YouTube", why: "Over-indexed on technical depth, no local context, 47s intro." },
    { id: "f2", title: "Industry News Weekly Recap", views: "12K", platform: "LinkedIn", why: "No unique angle, news was 4 days old, no audience interpretation." },
  ];

  const hookPatterns = [
    { hook: '"Nobody talks about this, but..."', performance: "3.2×" },
    { hook: '"I spent [X] days testing this..."', performance: "2.8×" },
    { hook: "Show dramatic before/after in first 3s", performance: "2.1×" },
    { hook: '"Stop doing this (mistake #1)"', performance: "1.9×" },
  ];

  const audienceSignals = [
    { signal: "Local business success stories drive 4× comment velocity", positive: true },
    { signal: "Nigerian city mentions get 2.3× share rate", positive: true },
    { signal: "Mobile-first framing retains 31% longer", positive: true },
    { signal: "Intros over 20 seconds cause 38% drop-off spike", positive: false },
  ];

  const nextProductions = [
    { title: "How Nigerians Are Using AI to Build Media Empires", score: 97 },
    { title: "Free AI Tools Replacing ₦500K in Software", score: 95 },
    { title: "The 60-Second Edit That Tripled My Watch Time", score: 91 },
  ];

  const memoryUpdates = [
    { text: "Peak engagement: Tue–Thu 2–4 PM confirmed", type: "confirmed" },
    { text: "Local context increases shares by 2.3× — applied to all scripts", type: "new" },
    { text: "LinkedIn engagement below threshold — de-prioritizing", type: "flagged" },
  ];

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">What worked, what failed, what's next</p>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Views", value: "24.8M", icon: Eye, change: "+18%" },
          { label: "Engagement", value: "7.2%", icon: Heart, change: "+2.3%" },
          { label: "Comments", value: "42.5K", icon: Brain, change: "+31%" },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.label}
              className="rounded-xl border border-border bg-card p-3 text-left active:scale-[0.98] transition-transform duration-100"
            >
              <Icon className="w-4 h-4 text-muted-foreground mb-2" />
              <p className="text-base font-medium">{m.value}</p>
              <p className="text-[11px] text-muted-foreground">{m.label}</p>
              <p className="text-[11px] text-success font-medium">{m.change}</p>
            </button>
          );
        })}
      </div>

      {/* What Worked */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-success" />
          <h2 className="text-base font-medium">What Worked</h2>
        </div>
        <div className="space-y-3">
          {topPerformers.map((c) => (
            <div key={c.id} className="p-3 rounded-lg bg-success/5 border border-success/15">
              <p className="text-sm font-medium mb-1 line-clamp-2">{c.title}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                <span>{c.platform}</span>
                <span className="text-success font-medium">{c.views}</span>
                <span className="text-success font-medium">{c.engagement}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.why}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What Failed */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-4 h-4 text-warning" />
          <h2 className="text-base font-medium">What Failed</h2>
        </div>
        <div className="space-y-3">
          {failures.map((f) => (
            <div key={f.id} className="p-3 rounded-lg bg-warning/5 border border-warning/15">
              <p className="text-sm font-medium mb-1 line-clamp-2">{f.title}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                <span>{f.platform}</span>
                <span className="text-warning">{f.views} views</span>
              </div>
              <p className="text-xs text-muted-foreground">{f.why}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hook Patterns */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-accent-foreground" />
          <h2 className="text-base font-medium">Best Hook Patterns</h2>
        </div>
        <div className="space-y-2">
          {hookPatterns.map((h, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/5">
              <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
              <p className="text-sm flex-1 truncate">{h.hook}</p>
              <span className="text-sm font-medium text-success flex-shrink-0">{h.performance}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Audience Signals */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-4 h-4 text-accent-foreground" />
          <h2 className="text-base font-medium">Audience Signals</h2>
        </div>
        <div className="space-y-2.5">
          {audienceSignals.map((s, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg ${s.positive ? "bg-success/5 border border-success/10" : "bg-warning/5 border border-warning/10"}`}>
              {s.positive
                ? <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
              }
              <p className="text-xs">{s.signal}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Next Productions */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-accent-foreground" />
          <h2 className="text-base font-medium">Create Next</h2>
        </div>
        <div className="space-y-3">
          {nextProductions.map((p, i) => (
            <button
              key={i}
              onClick={() => onNavigate?.("/viral-sparks")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20 text-left active:scale-[0.98] transition-all duration-100"
            >
              <span className={`text-sm font-medium flex-shrink-0 ${p.score >= 90 ? "text-success" : "text-warning"}`}>{p.score}%</span>
              <p className="text-sm flex-1 line-clamp-2 font-medium">{p.title}</p>
              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Memory Updates */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-accent-foreground" />
          <h2 className="text-base font-medium">Memory Updated</h2>
        </div>
        <div className="space-y-2">
          {memoryUpdates.map((m, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${
              m.type === "new" ? "bg-success/5 border-success/15" :
              m.type === "flagged" ? "bg-warning/5 border-warning/15" :
              "bg-background border-border"
            }`}>
              <Sparkles className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                m.type === "new" ? "text-success" : m.type === "flagged" ? "text-warning" : "text-muted-foreground"
              }`} />
              <p className="text-xs">{m.text}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded ml-auto flex-shrink-0 capitalize ${
                m.type === "new" ? "bg-success/20 text-success" :
                m.type === "flagged" ? "bg-warning/20 text-warning" :
                "bg-muted/40 text-muted-foreground"
              }`}>{m.type}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
