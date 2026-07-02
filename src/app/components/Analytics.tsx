import { useState } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import { PageHeader, SectionHeader, MetricCard, Button } from "./ds";
import {
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Brain,
  Target,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Heart,
  MessageCircle,
  Zap,
} from "lucide-react";

interface AnalyticsProps {
  onNavigate: (path: string) => void;
}

export function Analytics({ onNavigate }: AnalyticsProps) {
  const { addMemoryItem } = useSpark();
  const [appliedIndices, setAppliedIndices] = useState<number[]>([]);

  const handleApplyToMemory = (text: string, index: number) => {
    addMemoryItem(text, "learned");
    setAppliedIndices((prev) => [...prev, index]);
  };

  const topPerformers = [
    {
      id: "c1",
      title: "How AI Creates Viral Content",
      platform: "YouTube",
      views: "2.4M",
      engagement: "8.2%",
      completion: "68%",
      why: "Hook addressed specific pain point in first 4s. Numbered list format reduced drop-off. Nigerian example in minute 3 drove share spike.",
    },
    {
      id: "c2",
      title: "Behind the Scenes: AI Production",
      platform: "TikTok",
      views: "1.8M",
      engagement: "6.5%",
      completion: "71%",
      why: "Raw behind-the-scenes format triggered authenticity signal. 'Nobody shows you this' hook created curiosity gap that held 73% past 30s.",
    },
    {
      id: "c3",
      title: "Free Tools for Nigerian Creators",
      platform: "YouTube",
      views: "1.1M",
      engagement: "11.2%",
      completion: "74%",
      why: "High local relevance — tools priced in accessible range for Nigerian market. Comment section became community discussion, boosting algorithm signal.",
    },
  ];

  const failures = [
    {
      id: "f1",
      title: "Technical Tutorial Series Ep. 4",
      platform: "YouTube",
      views: "45K",
      engagement: "1.8%",
      why: "Over-indexed on technical depth without local context. Introduction ran 47 seconds before hook payoff. No mobile optimization.",
    },
    {
      id: "f2",
      title: "Industry News Weekly Recap",
      platform: "LinkedIn",
      views: "12K",
      engagement: "0.9%",
      why: "Generic format with no unique angle. News was 4 days old at publish time. No audience-specific interpretation of why it matters.",
    },
  ];

  const hookPatterns = [
    { hook: '"Nobody talks about this, but..."', performance: "3.2×", category: "Exclusivity" },
    { hook: '"I spent [X] days testing this..."', performance: "2.8×", category: "Proof" },
    { hook: '"This changed everything for me"', performance: "2.4×", category: "Transformation" },
    { hook: "Show dramatic before/after in first 3s", performance: "2.1×", category: "Visual" },
    { hook: '"Stop doing this (mistake #1)"', performance: "1.9×", category: "Anti-pattern" },
    { hook: "Local success story name-drop", performance: "1.7×", category: "Social Proof" },
  ];

  const platformFit = [
    { platform: "YouTube", score: 94, status: "Primary strength — long-form authority", trend: "up" },
    { platform: "TikTok", score: 82, status: "Strong short-form clips from long content", trend: "up" },
    { platform: "Instagram", score: 71, status: "Carousel format outperforms Reels here", trend: "neutral" },
    { platform: "LinkedIn", score: 58, status: "Low resonance — audience mismatch", trend: "down" },
  ];

  const audienceSignals = [
    { signal: "Local business success stories drive 4× comment velocity", type: "high" },
    { signal: "Content mentioning specific Nigerian cities gets 2.3× share rate", type: "high" },
    { signal: "Mobile-first framing (vertical, captions on) retains 31% longer", type: "high" },
    { signal: "Tutorials under 12 minutes complete at 2× rate vs longer", type: "medium" },
    { signal: "Posting Tuesday–Thursday 2–4 PM outperforms by 34%", type: "medium" },
    { signal: "Intro over 20 seconds causes 38% drop-off spike", type: "warning" },
  ];

  const nextProductions = [
    {
      id: "p1",
      title: "How Nigerians Are Using AI to Build Media Empires",
      reason: "Combines top hook pattern + local success angle + trending topic. Projected 94% brand fit.",
      score: 97,
      platform: "YouTube + TikTok",
    },
    {
      id: "p2",
      title: "Free AI Tools Replacing ₦500K in Software",
      reason: "Local affordability angle with proven 'free tools' hook. High share potential across demographic.",
      score: 95,
      platform: "YouTube + Reels",
    },
    {
      id: "p3",
      title: "The 60-Second Edit That Tripled My Watch Time",
      reason: "Process-reveal format with quantified result in title — proven completion driver.",
      score: 91,
      platform: "TikTok + Shorts",
    },
  ];

  const memoryUpdates = [
    { text: "Updated: peak engagement window confirmed as Tue–Thu 2–4 PM (was previously Mon–Fri 9 AM)", type: "updated" },
    { text: "Learned: Nigerian local context mention increases shares by 2.3× — now applied to all scripts", type: "new" },
    { text: "Confirmed: tutorial completion rates drop sharply after 12 minutes for this audience", type: "confirmed" },
    { text: "Flagged: LinkedIn engagement remains below threshold — de-prioritizing platform cadence", type: "flagged" },
  ];

  const overallMetrics = [
    { label: "Total Views", value: "24.8M", change: "+18.2%", icon: Eye, pos: true },
    { label: "Avg Engagement", value: "7.2%", change: "+2.3%", icon: Heart, pos: true },
    { label: "Comments", value: "42.5K", change: "+31%", icon: MessageCircle, pos: true },
    { label: "Productions", value: "187", change: "+12", icon: Zap, pos: true },
  ];

  return (
    <>
      <TopBar pageName="Analytics" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-8 space-y-10">

          <div>
            <h1 className="text-3xl font-medium">Analytics</h1>
            <p className="text-muted-foreground mt-1">What worked, what failed, and what to create next</p>
          </div>

          {/* Overall Metrics */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">This Month</h2>
            <div className="grid grid-cols-4 gap-4">
              {overallMetrics.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className={`text-xs font-medium ${m.pos ? "text-success" : "text-destructive"}`}>{m.change}</span>
                    </div>
                    <p className="text-3xl font-medium tracking-tight">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">{m.label}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* What Worked */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-4 h-4 text-success" />
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What Worked</h2>
            </div>
            <div className="space-y-4">
              {topPerformers.map((item) => (
                <div key={item.id} className="rounded-xl border border-success/20 bg-success/5 p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-base font-medium">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{item.platform}</p>
                    </div>
                    <div className="flex gap-4 flex-shrink-0 text-right">
                      <div>
                        <p className="text-lg font-medium text-success">{item.views}</p>
                        <p className="text-xs text-muted-foreground">Views</p>
                      </div>
                      <div>
                        <p className="text-lg font-medium text-success">{item.engagement}</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                      <div>
                        <p className="text-lg font-medium">{item.completion}</p>
                        <p className="text-xs text-muted-foreground">Completion</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-background/60 border border-success/10">
                    <Brain className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.why}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* What Failed */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <TrendingDown className="w-4 h-4 text-warning" />
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What Failed</h2>
            </div>
            <div className="space-y-3">
              {failures.map((item) => (
                <div key={item.id} className="rounded-xl border border-warning/20 bg-warning/5 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-sm font-medium">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.platform}</p>
                    </div>
                    <div className="flex gap-4 flex-shrink-0 text-right">
                      <div>
                        <p className="text-base font-medium text-warning">{item.views}</p>
                        <p className="text-xs text-muted-foreground">Views</p>
                      </div>
                      <div>
                        <p className="text-base font-medium text-warning">{item.engagement}</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{item.why}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Two column: Hook Patterns + Platform Fit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Hook Patterns */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-4 h-4 text-accent-foreground" />
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best Hook Patterns</h2>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                {hookPatterns.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/5 transition-colors">
                    <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.hook}</p>
                      <p className="text-xs text-muted-foreground">{h.category}</p>
                    </div>
                    <span className="text-sm font-medium text-success flex-shrink-0">{h.performance}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Platform Fit */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-4 h-4 text-accent-foreground" />
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform Fit</h2>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                {platformFit.map((p) => (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{p.platform}</span>
                      <div className="flex items-center gap-2">
                        {p.trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-success" />}
                        {p.trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-warning" />}
                        <span className={`text-sm font-medium ${
                          p.score >= 80 ? "text-success" : p.score >= 65 ? "text-warning" : "text-muted-foreground"
                        }`}>{p.score}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full ${p.score >= 80 ? "bg-success" : p.score >= 65 ? "bg-warning" : "bg-muted-foreground/40"}`}
                        style={{ width: `${p.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{p.status}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Audience Signals */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Heart className="w-4 h-4 text-accent-foreground" />
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audience Signals</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="grid grid-cols-2 gap-3">
                {audienceSignals.map((s, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                    s.type === "high" ? "bg-success/5 border-success/15" :
                    s.type === "medium" ? "bg-accent/10 border-accent/20" :
                    "bg-warning/5 border-warning/15"
                  }`}>
                    {s.type === "warning"
                      ? <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      : <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${s.type === "high" ? "text-success" : "text-accent-foreground"}`} />
                    }
                    <p className="text-sm">{s.signal}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Next Recommended Productions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-4 h-4 text-accent-foreground" />
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next Recommended Productions</h2>
              </div>
              <button
                onClick={() => onNavigate("/viral-sparks")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                All opportunities <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {nextProductions.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-5 hover:border-accent/40 hover:shadow-lg hover:shadow-black/10 transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${p.score >= 90 ? "text-success" : "text-warning"}`}>{p.score}% fit</span>
                    <span className="text-xs text-muted-foreground">{p.platform}</span>
                  </div>
                  <h3 className="text-sm font-medium mb-2 leading-snug">{p.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{p.reason}</p>
                  <button
                    onClick={() => onNavigate("/viral-sparks")}
                    className="w-full py-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 text-sm font-medium transition-colors"
                  >
                    Create Production
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Memory Updates */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-4 h-4 text-accent-foreground" />
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Memory Updates This Week</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-2.5">
              {memoryUpdates.map((m, i) => (
                <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                  m.type === "new" ? "bg-success/5 border-success/15" :
                  m.type === "updated" ? "bg-accent/10 border-accent/20" :
                  m.type === "flagged" ? "bg-warning/5 border-warning/15" :
                  "bg-background border-border"
                }`}>
                  <Sparkles className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                    m.type === "new" ? "text-success" :
                    m.type === "updated" ? "text-accent-foreground" :
                    m.type === "flagged" ? "text-warning" : "text-muted-foreground"
                  }`} />
                  <p className="text-sm flex-1">{m.text}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                      m.type === "new" ? "bg-success/20 text-success" :
                      m.type === "updated" ? "bg-accent/20 text-accent-foreground" :
                      m.type === "flagged" ? "bg-warning/20 text-warning" :
                      "bg-muted/40 text-muted-foreground"
                    }`}>{m.type}</span>

                    {appliedIndices.includes(i) ? (
                      <span className="text-xs text-success font-medium flex items-center gap-1">
                        ✓ Applied
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApplyToMemory(m.text, i)}
                        className="text-xs bg-accent/20 text-accent-foreground hover:bg-accent/40 px-2 py-1 rounded transition-colors"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
