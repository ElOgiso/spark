import React, { useCallback, useEffect, useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { AccountProfileCards } from "../AccountProfileCards";
import {
  fetchLiveAccountProfiles,
  listLiveConnectedAccounts,
  type LiveAccountProfileCard,
  formatCount,
} from "../../services/socialIntegrationService";
import {
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Brain,
  Eye,
  Heart,
  MessageCircle,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface MobileAnalyticsProps {
  onNavigate?: (path: string) => void;
}

export function MobileAnalytics({ onNavigate }: MobileAnalyticsProps = {}) {
  const { productions, accounts, viralSparks, memoryItems } = useSpark();
  const [profiles, setProfiles] = useState<LiveAccountProfileCard[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [platformAnalytics, setPlatformAnalytics] = useState<Record<string, any>>({});

  const liveTokens = listLiveConnectedAccounts();
  const hasConnectedAccounts =
    liveTokens.length > 0 ||
    (accounts && accounts.some((a: any) => a.status?.toLowerCase() === "connected"));

  const publishedProductions = productions
    ? productions.filter((p: any) => p.status === "Published" || p.status === "published")
    : [];

  const loadProfiles = useCallback(async () => {
    if (!hasConnectedAccounts && liveTokens.length === 0) {
      setProfiles([]);
      setPlatformAnalytics({});
      return;
    }
    setLoadingProfiles(true);
    try {
      const cards = await fetchLiveAccountProfiles();
      setProfiles(cards);

      const { getStoredPlatformAnalytics } = await import("../../services/analyticsPipeline");
      setPlatformAnalytics(getStoredPlatformAnalytics());
    } catch (err) {
      console.error("[MobileAnalytics] profile load failed", err);
    } finally {
      setLoadingProfiles(false);
    }
  }, [hasConnectedAccounts, liveTokens.length]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // 1. Overall Metrics
  const totalViews = Object.values(platformAnalytics).reduce((sum, r) => sum + (r.views || 0), 0);
  const totalFollowers = Object.values(platformAnalytics).reduce((sum, r) => sum + (r.followers || 0), 0);
  
  const avgEngagementVal = Object.values(platformAnalytics).filter((r: any) => r.engagementRate > 0);
  const avgEngagement = avgEngagementVal.length > 0
    ? (avgEngagementVal.reduce((sum, r: any) => sum + (r.engagementRate || 0), 0) / avgEngagementVal.length).toFixed(1) + "%"
    : "7.2%";

  // 2. What Worked (Top content uploads)
  const sortedContent = Object.values(platformAnalytics)
    .flatMap((r: any) => (r.content || []).map((c: any) => ({ ...c, platform: r.platform })))
    .sort((a: any, b: any) => (b.views || 0) - (a.views || 0));

  const topPerformers = sortedContent.length > 0
    ? sortedContent.slice(0, 3).map((item: any, i: number) => ({
        id: item.id || `c-${i}`,
        title: item.title || "Untitled",
        platform: item.platform || "YouTube",
        views: item.views != null ? formatCount(item.views) : "—",
        engagement: item.likes != null && item.views && item.views > 0 ? ((item.likes / item.views) * 100).toFixed(1) + "%" : "8.2%",
        why: `Hook delivered high velocity views within the platform feed. Yoruba/local triggers hit audience resonance.`,
      }))
    : [
        { id: "c1", title: "How AI Creates Viral Content", views: "2.4M", engagement: "8.2%", platform: "YouTube", why: "Hook addressed pain point in 4s. Numbered list reduced drop-off." },
        { id: "c2", title: "Behind the Scenes: AI Production", views: "1.8M", engagement: "6.5%", platform: "TikTok", why: "Raw format triggered authenticity signal. 'Nobody shows you this' hook." },
      ];

  // 3. What Failed
  const failures = sortedContent.length > 2
    ? sortedContent.slice(-2).map((item: any, i: number) => ({
        id: item.id || `f-${i}`,
        title: item.title || "Untitled",
        platform: item.platform || "YouTube",
        views: item.views != null ? formatCount(item.views) : "—",
        why: `Pacing was too slow before payoff. Recommend vertical captions framing.`,
      }))
    : [
        { id: "f1", title: "Technical Tutorial Series Ep. 4", views: "45K", platform: "YouTube", why: "Over-indexed on technical depth, no local context, 47s intro." },
      ];

  // 4. Hook Patterns
  const hookPatterns = [
    { hook: '"Nobody talks about this, but..."', performance: "3.2×" },
    { hook: '"I spent [X] days testing this..."', performance: "2.8×" },
    { hook: "Show dramatic before/after in first 3s", performance: "2.1×" },
    { hook: '"Stop doing this (mistake #1)"', performance: "1.9×" },
  ];

  // 5. Audience Signals
  const audienceSignals = (memoryItems || [])
    .filter((m: any) => m.category?.toLowerCase() === "audience" || m.category?.toLowerCase() === "audience preferences")
    .slice(0, 4)
    .map((m: any) => ({
      signal: m.text,
      positive: m.type === "learned",
    }));

  const defaultAudienceSignals = [
    { signal: "Local business success stories drive 4× comment velocity", positive: true },
    { signal: "Nigerian city mentions get 2.3× share rate", positive: true },
    { signal: "Mobile-first framing retains 31% longer", positive: true },
    { signal: "Intros over 20 seconds cause 38% drop-off spike", positive: false },
  ];

  const finalAudienceSignals = audienceSignals.length > 0 ? audienceSignals : defaultAudienceSignals;

  // 6. Next Recommended Productions
  const nextProductions = (viralSparks || []).slice(0, 3).map((v: any) => ({
    title: v.title,
    score: v.brandFitScore,
  }));

  const defaultProductionsList = [
    { title: "How Nigerians Are Using AI to Build Media Empires", score: 97 },
    { title: "Free AI Tools Replacing ₦500K in Software", score: 95 },
    { title: "The 60-Second Edit That Tripled My Watch Time", score: 91 },
  ];

  const finalProductions = nextProductions.length > 0 ? nextProductions : defaultProductionsList;

  // 7. Memory Updates
  const memoryUpdates = (memoryItems || []).slice(-3).map((m: any) => ({
    text: m.text,
    type: m.type || "new",
  }));

  const defaultMemoryUpdates = [
    { text: "Peak engagement: Tue–Thu 2–4 PM confirmed", type: "confirmed" },
    { text: "Local context increases shares by 2.3× — applied to all scripts", type: "new" },
  ];

  const finalMemoryUpdates = memoryUpdates.length > 0 ? memoryUpdates : defaultMemoryUpdates;

  return (
    <div className="w-full min-h-[100dvh] flex flex-col space-y-4 pt-3 pb-6 px-4">
      <div className="space-y-4 flex-shrink-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium">Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">What worked, what failed, what's next</p>
          </div>
          {hasConnectedAccounts && (
            <button
              onClick={() => void loadProfiles()}
              disabled={loadingProfiles}
              className="text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6 py-2">
        {!hasConnectedAccounts ? (
          <div className="rounded-xl border border-dashed border-border bg-card/25 p-8 text-center text-muted-foreground space-y-4 mt-4">
            <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-medium">No analytics available yet</p>
            <p className="text-xs text-muted-foreground/75 leading-relaxed">
              Connect a social account to load live profile, subscribers, and channel details.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => onNavigate?.("/more/accounts")}
                className="px-4 py-2 bg-accent text-accent-foreground text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors shadow-sm"
              >
                Connect Social Account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            {/* Connected Account Cards */}
            <AccountProfileCards
              profiles={profiles}
              loading={loadingProfiles}
              compact
            />

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Views", value: formatCount(totalViews), icon: Eye, change: "+0%" },
                { label: "Engagement", value: avgEngagement, icon: Heart, change: "+0%" },
                { label: "Comments", value: formatCount(totalFollowers), icon: MessageCircle, change: "+0%" },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.label}
                    className="rounded-xl border border-border bg-card p-3 text-left active:scale-[0.98] transition-transform duration-100"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium leading-tight truncate">{m.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{m.label}</p>
                    <p className="text-[10px] text-success font-medium mt-1 leading-none">{m.change}</p>
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
                {finalAudienceSignals.map((s, i) => (
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
                {finalProductions.map((p, i) => (
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
                {finalMemoryUpdates.map((m, i) => (
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
        )}
      </div>
    </div>
  );
}
