import { useState } from "react";
import { Flame, TrendingUp, Zap, Users, Clock, CheckCircle2, Loader2, X, Shield, Sparkles, ArrowRight } from "lucide-react";
import { Button, StatusChip, ConfidenceBar } from "../ds";

type FilterTab = "all" | "hot" | "rising" | "niche";
type DrawerState = "idle" | "creating" | "created";

interface MobileSpark {
  id: string;
  title: string;
  whyNow: string;
  hookAngle: string;
  suggestedHook: string;
  platforms: string[];
  audienceEmotion: string;
  brandFitScore: number;
  riskLevel: "Low" | "Medium" | "High";
  suggestedFormat: string;
  productionTime: string;
  category: "hot" | "rising" | "niche";
  timeWindow: string;
}

const sparks: MobileSpark[] = [
  { id: "s1", title: "How Nigerian Creators Are Using AI to Build Media Empires", whyNow: "AI content tools crossed mainstream adoption in West Africa — 48h window before saturation", hookAngle: "'I replaced a 5-person team with one tool'", suggestedHook: "\"I replaced my entire production team with one AI tool — and tripled output.\"", platforms: ["YouTube", "TikTok"], audienceEmotion: "Aspiration + FOMO", brandFitScore: 97, riskLevel: "Low", suggestedFormat: "Long-form + 3 clips", productionTime: "6–12 hours", category: "hot", timeWindow: "48h window" },
  { id: "s2", title: "The 60-Second Edit That Tripled My Watch Time", whyNow: "YouTube Shorts algorithm heavily rewarding hook-first editing right now", hookAngle: "Show before/after in first 3 seconds without explanation", suggestedHook: "\"Watch time tripled after I changed just ONE thing.\"", platforms: ["TikTok", "Shorts"], audienceEmotion: "Curiosity + Urgency", brandFitScore: 91, riskLevel: "Low", suggestedFormat: "Short-form (45–60s)", productionTime: "2–4 hours", category: "hot", timeWindow: "24h window" },
  { id: "s3", title: "Free AI Tools Replacing ₦500K Worth of Software", whyNow: "Pricing pressure making local affordability angle highly resonant right now", hookAngle: "Show ₦500K → ₦0 on screen instantly", suggestedHook: "\"I was spending ₦500K a year on software. Now I spend ₦0.\"", platforms: ["YouTube", "TikTok", "Reels"], audienceEmotion: "Relief + Excitement", brandFitScore: 95, riskLevel: "Low", suggestedFormat: "Tutorial + Summary reel", productionTime: "6–12 hours", category: "hot", timeWindow: "7-day window" },
  { id: "s4", title: "Why Smart Creators Are Quietly Leaving Manual Editing", whyNow: "3 major creator tools just dropped AI features — narrative gap in Nigerian market", hookAngle: "'I found out at a conference and nobody was talking about it'", suggestedHook: "\"At a creator conference, I found out something nobody was talking about.\"", platforms: ["YouTube"], audienceEmotion: "FOMO + Curiosity", brandFitScore: 88, riskLevel: "Medium", suggestedFormat: "Long-form (8–12 min)", productionTime: "6–12 hours", category: "rising", timeWindow: "72h window" },
  { id: "s5", title: "Behind the Algorithm: How Naija Creators Get 1M Views", whyNow: "Consistent growth pattern identified across 12 accounts — teachable system", hookAngle: "'The strategy that works with zero followers'", suggestedHook: "\"These creators hit 1M views and none of their videos ever went viral.\"", platforms: ["YouTube"], audienceEmotion: "Aspiration", brandFitScore: 93, riskLevel: "Low", suggestedFormat: "Long-form deep-dive", productionTime: "24–48 hours", category: "rising", timeWindow: "14-day window" },
];

const riskVariant = { Low: "low-risk", Medium: "medium-risk", High: "needs-attention" } as const;

export function MobileViralSparks() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedSpark, setSelectedSpark] = useState<MobileSpark | null>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>("idle");
  const [createdSparks, setCreatedSparks] = useState<Set<string>>(new Set());

  const filtered = activeFilter === "all" ? sparks : sparks.filter((s) => s.category === activeFilter);
  const filters = [
    { id: "all" as const, label: "All", count: sparks.length },
    { id: "hot" as const, label: "Hot", count: sparks.filter((s) => s.category === "hot").length },
    { id: "rising" as const, label: "Rising", count: sparks.filter((s) => s.category === "rising").length },
  ];

  const handleCreate = (spark: MobileSpark) => { setSelectedSpark(spark); setDrawerState("idle"); };
  const handleConfirm = () => {
    setDrawerState("creating");
    setTimeout(() => {
      setDrawerState("created");
      if (selectedSpark) setCreatedSparks((prev) => new Set([...prev, selectedSpark.id]));
    }, 2000);
  };
  const closeDrawer = () => { setSelectedSpark(null); setDrawerState("idle"); };

  return (
    <>
      <div className="pb-24 px-4 pt-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium">Viral Sparks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Spark found these for your brand</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>8m ago</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-xl font-medium">{sparks.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ready</p>
          </div>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
            <p className="text-xl font-medium text-destructive">{sparks.filter((s) => s.category === "hot").length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Hot window</p>
          </div>
          <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-center">
            <p className="text-xl font-medium text-success">{createdSparks.size}</p>
            <p className="text-xs text-muted-foreground mt-0.5">In production</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium flex-shrink-0 transition-all ${
                activeFilter === f.id ? "bg-accent text-foreground" : "bg-card border border-border text-muted-foreground"
              }`}
            >
              {f.id === "hot" && <Flame className="w-3.5 h-3.5 text-destructive" />}
              {f.id === "rising" && <TrendingUp className="w-3.5 h-3.5 text-warning" />}
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded ${activeFilter === f.id ? "bg-background/40" : "bg-muted/50"}`}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.map((spark) => {
            const isCreated = createdSparks.has(spark.id);
            return (
              <div key={spark.id} className={`rounded-xl border bg-card p-4 transition-all ${isCreated ? "border-success/30 bg-success/5" : "border-border"}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    {spark.category === "hot" && <StatusChip variant="hot" label="Hot" />}
                    {spark.category === "rising" && <StatusChip variant="rising" label="Rising" />}
                    {isCreated && <StatusChip variant="in-production" label="Drafting" />}
                    {!isCreated && <span className="text-xs text-muted-foreground">{spark.timeWindow}</span>}
                  </div>
                  <span className={`text-sm font-medium ${spark.brandFitScore >= 90 ? "text-success" : "text-warning"}`}>{spark.brandFitScore}%</span>
                </div>
                <h3 className="text-sm font-medium leading-snug mb-2.5">{spark.title}</h3>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">{spark.whyNow}</p>
                <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 mb-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Hook angle</p>
                  <p className="text-xs font-medium">{spark.hookAngle}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {spark.platforms.map((p) => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground">{p}</span>
                  ))}
                  <span className="text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground">{spark.suggestedFormat}</span>
                  <StatusChip variant={riskVariant[spark.riskLevel]} label={`${spark.riskLevel} risk`} />
                </div>
                {isCreated ? (
                  <Button variant="secondary" size="lg" fullWidth icon={<CheckCircle2 className="w-4 h-4" />} className="border border-success/30 bg-success/10 text-success hover:bg-success/15">
                    In Production
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" fullWidth icon={<Zap className="w-4 h-4" />} onClick={() => handleCreate(spark)}>
                    Create Production
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedSpark && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={drawerState === "idle" ? closeDrawer : undefined} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-medium">Create Production</h2>
                <p className="text-xs text-muted-foreground">Spark will draft this for your review</p>
              </div>
              <button onClick={closeDrawer} className="p-2 rounded-lg hover:bg-accent/20 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {drawerState === "created" ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-7 h-7 text-success" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Production created</h3>
                  <p className="text-sm text-muted-foreground mb-1">Spark is drafting now. Ready in approximately <span className="text-foreground font-medium">{selectedSpark.productionTime}</span>.</p>
                  <p className="text-xs text-muted-foreground mb-8">You'll see it in Review when it's ready.</p>
                  <Button variant="secondary" size="lg" fullWidth onClick={closeDrawer}>Back to Viral Sparks</Button>
                </div>
              ) : drawerState === "creating" ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center mb-4">
                    <Loader2 className="w-7 h-7 text-accent-foreground animate-spin" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Drafting your production</h3>
                  <p className="text-sm text-muted-foreground">Spark is setting up the production queue.</p>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  <div className="p-3.5 rounded-xl bg-background border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{selectedSpark.timeWindow}</span>
                      <span className={`text-sm font-medium ${selectedSpark.brandFitScore >= 90 ? "text-success" : "text-warning"}`}>{selectedSpark.brandFitScore}% fit</span>
                    </div>
                    <p className="text-sm font-medium leading-snug">{selectedSpark.title}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Suggested Hook</p>
                    <p className="text-sm leading-relaxed">{selectedSpark.suggestedHook}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Format</p>
                      <p className="text-sm font-medium">{selectedSpark.suggestedFormat}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Est. time</p>
                      <p className="text-sm font-medium">{selectedSpark.productionTime}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSpark.platforms.map((p) => (
                      <span key={p} className="text-xs px-2.5 py-1 rounded-lg bg-accent/20 font-medium">{p}</span>
                    ))}
                  </div>
                  <div className="rounded-xl bg-background border border-border p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">What Spark Will Prepare</p>
                    <div className="space-y-2">
                      {["Full narrative storyboard", "3 thumbnail concepts", "Script outline + hook", "Caption templates", "Platform-specific versions", "Brand consistency check"].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <StatusChip variant={riskVariant[selectedSpark.riskLevel]} label={`${selectedSpark.riskLevel} Risk`} className="w-full justify-center py-2" />
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border bg-background">
                    <Sparkles className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">Creative review required before production begins — you'll approve the storyboard first</p>
                  </div>
                </div>
              )}
            </div>
            {drawerState === "idle" && (
              <div className="p-4 border-t border-border flex-shrink-0">
                <Button variant="primary" size="xl" fullWidth icon={<Zap className="w-4 h-4" />} onClick={handleConfirm}>
                  Confirm & Start Production
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">Spark will notify you when it's ready for review</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
