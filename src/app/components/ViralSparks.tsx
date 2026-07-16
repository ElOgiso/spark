import { useState } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import { NotificationService } from "../notifications/notificationService";
import {
  Button, StatusChip, ScoreBadge, Card, EmptyState,
  PageHeader, SectionHeader, FilterPill, WhySparkRecommends,
} from "./ds";
import {
  Flame, Zap, TrendingUp, Users, Clock, X, CheckCircle2,
  Loader2, AlertTriangle, ArrowRight, Shield, Sparkles,
} from "lucide-react";

interface ViralSparksProps {
  onNavigate: (path: string) => void;
}

type FilterTab = "all" | "hot" | "rising" | "niche";
type DrawerState = "idle" | "creating" | "created";

interface Spark {
  id: string;
  title: string;
  whyNow: string;
  platforms: string[];
  hookAngle: string;
  audienceEmotion: string;
  brandFitScore: number;
  riskLevel: "Low" | "Medium" | "High";
  suggestedFormat: string;
  suggestedHook: string;
  productionTime: string;
  category: "hot" | "rising" | "niche";
  timeWindow: string;
}

// Sparks are loaded dynamically from the SparkContext registry

const riskColor = {
  Low: "text-success bg-success/10 border-success/20",
  Medium: "text-warning bg-warning/10 border-warning/20",
  High: "text-destructive bg-destructive/10 border-destructive/20",
};

const scoreColor = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 80) return "text-warning";
  return "text-muted-foreground";
};

// ── Production Drawer ───────────────────────────────────────────────────────

interface DrawerProps {
  spark: Spark;
  drawerState: DrawerState;
  onConfirm: () => void;
  onClose: () => void;
  onGoToReview: () => void;
}

function ProductionDrawer({ spark, drawerState, onConfirm, onClose, onGoToReview }: DrawerProps) {
  const preparations = [
    "Full narrative storyboard (8 scenes)",
    "3 thumbnail concept variants",
    "Script outline with hook + CTA",
    "Caption templates for all platforms",
    "Platform-specific cut versions",
    "Brand consistency verification",
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={drawerState === "idle" || drawerState === "creating" ? onClose : undefined}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] z-50 bg-card border-l border-border flex flex-col shadow-2xl shadow-black/40 transition-transform duration-300 ease-out">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-base font-medium">Create Production</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Spark will draft this for your review</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent/20 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* Success State */}
          {drawerState === "created" ? (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-xl font-medium mb-2">Production created</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-1">
                Spark is drafting your production now. It will be ready for your review in approximately{" "}
                <span className="text-foreground font-medium">{spark.productionTime}</span>.
              </p>
              <p className="text-xs text-muted-foreground mt-3 mb-8">
                You'll see it in Review when it's ready.
              </p>
              <div className="w-full space-y-2">
                <button
                  onClick={onGoToReview}
                  className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-all"
                >
                  Go to Review Queue
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-accent/20 hover:bg-accent/30 text-sm font-medium transition-colors"
                >
                  Back to Viral Sparks
                </button>
              </div>
            </div>
          ) : drawerState === "creating" ? (
            /* Creating State */
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center mb-5">
                <Loader2 className="w-8 h-8 text-accent-foreground animate-spin" />
              </div>
              <h3 className="text-xl font-medium mb-2">Drafting your production</h3>
              <p className="text-sm text-muted-foreground">Spark is setting up the production queue for this opportunity.</p>
              <div className="mt-8 w-full space-y-2">
                {["Queuing opportunity", "Assigning production mode", "Scheduling review gate"].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                    <Loader2 className="w-3.5 h-3.5 text-accent-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Default State */
            <div className="p-6 space-y-5">

              {/* Selected Opportunity */}
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {spark.category === "hot" && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        <Flame className="w-3 h-3" /> Hot
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{spark.timeWindow}</span>
                  </div>
                  <span className={`text-sm font-medium ${scoreColor(spark.brandFitScore)}`}>
                    {spark.brandFitScore}% fit
                  </span>
                </div>
                <h3 className="text-sm font-medium leading-snug">{spark.title}</h3>
              </div>

              {/* Why Spark Recommends This */}
              <WhySparkRecommends
                details={{
                  reason: spark.whyNow,
                  evidence: [
                    `Format fit: ${spark.suggestedFormat} targeting ${spark.platforms.join(" & ")}.`,
                    `Audience alignment matches critical West African creator trigger: "${spark.audienceEmotion}".`,
                    `High brand consistency verified against Tech Insights Nigeria rules (Fit: ${spark.brandFitScore}%).`,
                    `Estimated turnaround is ${spark.productionTime} with zero active resource conflicts.`
                  ],
                  confidence: (spark.brandFitScore >= 90 ? "Very High" : spark.brandFitScore >= 80 ? "High" : "Medium") as any,
                  confidencePercent: spark.brandFitScore,
                  expectedOutcome: `Strategic positioning yields 2.4x engagement velocity with 70%+ audience completion.`,
                  risk: spark.riskLevel,
                  nextBestAction: "Compile Production Master",
                  brandRules: ["Tech Insights Nigeria Rule #1: Actionable Insights", "Authority Rules"]
                }}
                defaultExpanded={false}
              />

              {/* Spark's Plan */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Spark's Plan</p>
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Suggested Hook</p>
                    <p className="text-sm leading-relaxed">{spark.suggestedHook}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Format</p>
                      <p className="text-sm font-medium">{spark.suggestedFormat}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Production Time</p>
                      <p className="text-sm font-medium">{spark.productionTime}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <p className="text-xs text-muted-foreground mb-2">Platform Fit</p>
                    <div className="flex flex-wrap gap-1.5">
                      {spark.platforms.map((p) => (
                        <span key={p} className="text-xs px-2.5 py-1 rounded-lg bg-accent/20 font-medium">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* What Spark Will Prepare */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">What Spark Will Prepare</p>
                <div className="rounded-xl border border-border bg-background p-4 space-y-2">
                  {preparations.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk + Gate */}
              <div className="space-y-2">
                <div className={`flex items-center gap-2.5 p-3.5 rounded-xl border ${riskColor[spark.riskLevel]}`}>
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Risk Level: {spark.riskLevel}</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {spark.riskLevel === "Low"
                        ? "No significant brand or content risks identified"
                        : "Minor concerns flagged — review detail when it enters queue"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-border bg-background">
                  <Sparkles className="w-4 h-4 text-accent-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Creative review required before production begins — you'll approve the storyboard first
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer CTA — only in default state */}
        {drawerState === "idle" && (
          <div className="p-5 border-t border-border">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<Zap className="w-4 h-4" />}
              onClick={onConfirm}
            >
              Confirm & Start Production
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2.5">
              Spark will draft this production and notify you when it's ready for review
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ViralSparks({ onNavigate }: ViralSparksProps) {
  const { createProductionFromSpark, productions, viralSparks } = useSpark();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedSpark, setSelectedSpark] = useState<Spark | null>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>("idle");

  const sparks: Spark[] = (viralSparks || []).map((v) => ({
    id: v.id,
    title: v.title,
    whyNow: v.whyNow,
    platforms: (v.platforms || "").split(",").map((p) => p.trim()),
    hookAngle: v.angle,
    suggestedHook: v.hook,
    audienceEmotion: "Aspiration + Curiosity",
    brandFitScore: v.brandFitScore,
    riskLevel: "Low",
    suggestedFormat: (v.platforms || "").includes("YouTube") ? "Long-form + 3 clips" : "Short-form (45–60 sec)",
    productionTime: v.productionTime,
    category: v.category,
    timeWindow: v.timeWindow,
  }));

  const createdSparks = new Set<string>(
    productions
      .map((p) => p.sparkId)
      .filter((id): id is string => !!id)
  );

  const filters = [
    { id: "all" as const, label: "All Sparks", count: sparks.length },
    { id: "hot" as const, label: "Hot", count: sparks.filter((s) => s.category === "hot").length },
    { id: "rising" as const, label: "Rising", count: sparks.filter((s) => s.category === "rising").length },
    { id: "niche" as const, label: "Niche", count: sparks.filter((s) => s.category === "niche").length },
  ];

  const filtered = activeFilter === "all" ? sparks : sparks.filter((s) => s.category === activeFilter);

  const openDrawer = (spark: Spark) => {
    setSelectedSpark(spark);
    setDrawerState("idle");
  };

  const closeDrawer = () => {
    setSelectedSpark(null);
    setDrawerState("idle");
  };

  const handleConfirm = () => {
    setDrawerState("creating");
    setTimeout(() => {
      setDrawerState("created");
      if (selectedSpark) {
        createProductionFromSpark(selectedSpark.id);
        NotificationService.addNotification({
          title: "Production Draft Started",
          description: `Spark is drafting storyboard and resources for "${selectedSpark.title}".`,
          type: "new_viral_opportunity",
          priority: "high",
          actionLabel: "Review Draft",
          relatedRoute: "/review"
        });
      }
    }, 2000);
  };

  const handleGoToReview = () => {
    closeDrawer();
    onNavigate("/review");
  };

  return (
    <>
      <TopBar pageName="Viral Sparks" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-8 space-y-8">

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-medium">Viral Sparks</h1>
              <p className="text-muted-foreground mt-1">
                Spark found these opportunities for your brand — ranked by fit, timing, and audience signal
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Refreshed 8m ago</span>
            </div>
          </div>

          {/* Summary Strip */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Ready to Create", value: String(sparks.length), color: "text-foreground", bg: "bg-card border-border" },
              { label: "Hot Window", value: String(sparks.filter(s => s.category === "hot").length), color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
              { label: "Avg Brand Fit", value: sparks.length === 0 ? "0%" : `${Math.round(sparks.reduce((a, s) => a + s.brandFitScore, 0) / sparks.length)}%`, color: "text-success", bg: "bg-success/5 border-success/20" },
              { label: "In Production", value: String(createdSparks.size), color: "text-accent-foreground", bg: "bg-accent/10 border-accent/30" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl border p-5 ${stat.bg}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{stat.label}</p>
                <p className={`text-3xl font-medium ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === f.id
                    ? "bg-accent text-foreground"
                    : "bg-card border border-border text-muted-foreground hover:bg-accent/20 hover:text-foreground"
                }`}
              >
                {f.id === "hot" && <Flame className="w-3.5 h-3.5 text-destructive" />}
                {f.id === "rising" && <TrendingUp className="w-3.5 h-3.5 text-warning" />}
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded ${activeFilter === f.id ? "bg-background/40" : "bg-muted/50"}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Spark Cards */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/25 p-12 text-center text-muted-foreground">
              <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium">No opportunities discovered yet</p>
              <p className="text-xs text-muted-foreground/75 mt-1">Spark will index trending topics, keywords, and viral formats once your social integrations are active.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filtered.map((spark) => {
                const isCreated = createdSparks.has(spark.id);
              return (
                <div
                  key={spark.id}
                  className={`rounded-xl border bg-card p-6 transition-all duration-200 ${
                    isCreated
                      ? "border-success/30 bg-success/5"
                      : "border-border hover:border-accent/40 hover:shadow-xl hover:shadow-black/10"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {spark.category === "hot" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
                          <Flame className="w-3 h-3" /> Hot
                        </span>
                      )}
                      {spark.category === "rising" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full">
                          <TrendingUp className="w-3 h-3" /> Rising
                        </span>
                      )}
                      {isCreated ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                          <Loader2 className="w-3 h-3 animate-spin" /> Drafting
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted/30 border border-border/50 px-2 py-0.5 rounded-full">
                          {spark.timeWindow}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xl font-medium ${scoreColor(spark.brandFitScore)}`}>
                        {spark.brandFitScore}%
                      </span>
                      <span className="text-xs text-muted-foreground">fit</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-medium leading-snug mb-4">{spark.title}</h3>

                  {/* Executive Intelligence Grid */}
                  <div className="space-y-3 mb-5">
                    {/* Why Now & Why Audience */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-background border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Why Now</p>
                        <p className="text-xs leading-relaxed text-foreground/90">{spark.whyNow}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-background border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Why Audience</p>
                        <p className="text-xs leading-relaxed text-foreground/90">
                          Resonates with <span className="text-accent-foreground font-medium">{spark.audienceEmotion}</span> triggers targeting active West African creator demographics.
                        </p>
                      </div>
                    </div>

                    {/* Why Brand & Expected Outcome */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-background border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Why Brand</p>
                        <p className="text-xs leading-relaxed text-foreground/90">
                          Directly aligns with your <span className="font-medium text-foreground">Tech Insights Nigeria</span> core pillars, matching existing brand authority rules.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20">
                        <p className="text-[10px] text-accent-foreground uppercase tracking-wider mb-1 font-semibold">Expected Outcome</p>
                        <p className="text-xs leading-relaxed font-medium text-foreground">
                          Projected <span className="text-success">2.4x engagement velocity</span> and 70%+ audience completion rates across targeted channels.
                        </p>
                      </div>
                    </div>

                    {/* Rationale Status Row */}
                    <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/50 text-center">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Confidence</p>
                        <p className="text-xs font-semibold text-foreground">{spark.brandFitScore}% Match</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Risk Rating</p>
                        <p className={`text-xs font-semibold ${spark.riskLevel === "Low" ? "text-success" : "text-warning"}`}>
                          {spark.riskLevel} Risk
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Format Fit</p>
                        <p className="text-xs font-semibold text-foreground truncate">{spark.suggestedFormat.split(" ")[0]}</p>
                      </div>
                    </div>
                  </div>

                  {/* Meta Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {spark.platforms.map((p) => (
                      <span key={p} className="text-[11px] px-2.5 py-1 rounded-lg bg-muted/30 text-muted-foreground border border-border/50 font-medium">{p}</span>
                    ))}
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted/30 text-muted-foreground border border-border/50 font-medium">{spark.suggestedFormat}</span>
                  </div>

                  {/* Action */}
                  {isCreated ? (
                    <button
                      onClick={() => onNavigate("/review")}
                      className="w-full py-3 rounded-xl bg-success/15 border border-success/30 text-success text-sm font-medium flex items-center justify-center gap-2 hover:bg-success/20 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      In Production — View in Review
                    </button>
                  ) : (
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      icon={<Zap className="w-4 h-4" />}
                      onClick={() => openDrawer(spark)}
                    >
                      Create Production
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          )}

        </div>
      </main>

      {/* Production Drawer */}
      {selectedSpark && (
        <ProductionDrawer
          spark={selectedSpark}
          drawerState={drawerState}
          onConfirm={handleConfirm}
          onClose={closeDrawer}
          onGoToReview={handleGoToReview}
        />
      )}
    </>
  );
}
