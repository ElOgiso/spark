import { useState } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import { MiniMediaThumbnail } from "./MediaPreviewHelper";
import {
  Button, StatusChip, Card, EmptyState, PageHeader, SectionHeader,
  FilterPill, ConfidenceBar, type ChipVariant,
} from "./ds";
import {
  Pencil, Video, Rocket, CheckCircle2, XCircle, Sparkles,
  AlertTriangle, ChevronRight, Loader2, Package, Calendar,
  LayoutList, Clock, Zap,
} from "lucide-react";

interface ReviewCenterProps {
  onNavigate?: (path: string) => void;
}

type Stage = "all" | "drafting" | "ready" | "needs_edit" | "approved" | "scheduled" | "export_ready";

interface ProductionItem {
  id: string;
  title: string;
  account: string;
  series?: string;
  reviewType: "creative" | "production" | "publishing";
  priority: "high" | "medium" | "low";
  stage: Exclude<Stage, "all">;
  aiConfidence: number;
  timeWaiting: string;
  format: string;
}

// Map internal stage → DS ChipVariant
const stageToChip: Record<Exclude<Stage, "all">, ChipVariant> = {
  drafting:     "drafting",
  ready:        "ready",
  needs_edit:   "needs-edit",
  approved:     "approved",
  scheduled:    "scheduled",
  export_ready: "export-ready",
};

const stageLabels: Record<Exclude<Stage, "all">, string> = {
  drafting:     "Drafting",
  ready:        "Ready for Review",
  needs_edit:   "Needs Edit",
  approved:     "Approved",
  scheduled:    "Scheduled",
  export_ready: "Export Ready",
};

const stageIcons: Record<Exclude<Stage, "all">, React.ComponentType<{className?: string}>> = {
  drafting:     Loader2,
  ready:        Clock,
  needs_edit:   AlertTriangle,
  approved:     CheckCircle2,
  scheduled:    Calendar,
  export_ready: Package,
};

const stageSummaryStyles: Record<Exclude<Stage, "all">, string> = {
  drafting:     "border-border bg-card",
  ready:        "border-warning/30 bg-warning/5",
  needs_edit:   "border-destructive/30 bg-destructive/5",
  approved:     "border-success/25 bg-success/5",
  scheduled:    "border-accent/35 bg-accent/10",
  export_ready: "border-accent/25 bg-accent/5",
};

const items: ProductionItem[] = [
  { id: "r1", title: "5 Viral Marketing Tactics That Actually Work in 2026", account: "YouTube", series: "Marketing Masterclass", reviewType: "creative", priority: "high", stage: "ready", aiConfidence: 94, timeWaiting: "2m", format: "Long-form + Clips" },
  { id: "r2", title: "The Psychology Behind Viral Content", account: "TikTok", series: "Content Science", reviewType: "production", priority: "high", stage: "ready", aiConfidence: 88, timeWaiting: "15m", format: "Short-form 60s" },
  { id: "r3", title: "How AI Creates Engaging Stories", account: "Instagram", reviewType: "creative", priority: "medium", stage: "needs_edit", aiConfidence: 76, timeWaiting: "1h", format: "Carousel + Reel" },
  { id: "r4", title: "Building a Personal Brand in 2026", account: "LinkedIn", series: "Career Growth", reviewType: "publishing", priority: "low", stage: "approved", aiConfidence: 82, timeWaiting: "2h", format: "Article" },
  { id: "r5", title: "Content Creation Workflow Optimization", account: "YouTube", reviewType: "production", priority: "medium", stage: "drafting", aiConfidence: 91, timeWaiting: "3h", format: "Tutorial 12min" },
  { id: "r6", title: "Nigerian Creator Economy Deep Dive", account: "YouTube", reviewType: "creative", priority: "medium", stage: "drafting", aiConfidence: 85, timeWaiting: "1h", format: "Data story 8min" },
  { id: "r7", title: "AI Editing Tools Comparison 2026", account: "YouTube", series: "Tool Reviews", reviewType: "creative", priority: "high", stage: "scheduled", aiConfidence: 96, timeWaiting: "4h", format: "Tutorial 14min" },
  { id: "r8", title: "Free Tools Every Creator Needs", account: "TikTok", reviewType: "production", priority: "medium", stage: "export_ready", aiConfidence: 89, timeWaiting: "5h", format: "Short-form 45s" },
];

const aiDecisions = [
  { id: "d1", outcome: "approved" as const, text: "Approved storyboard for 'AI Content Tips #47' — matches top-performing narrative patterns", confidence: 94, time: "5m ago" },
  { id: "d2", outcome: "flagged" as const, text: "Flagged 'Tech News Recap' for human review — topic complexity requires strategic decision", confidence: 68, time: "12m ago" },
  { id: "d3", outcome: "rejected" as const, text: "Rejected thumbnail variant B — visual contrast below brand guidelines threshold", confidence: 87, time: "25m ago" },
  { id: "d4", outcome: "approved" as const, text: "Approved publishing schedule — peak engagement window confirmed for Thursday 2 PM", confidence: 92, time: "1h ago" },
];

const priorityColor = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

const outcomeConfig = {
  approved: { icon: CheckCircle2, color: "text-success",     bg: "bg-success/10 border-success/20" },
  flagged:  { icon: AlertTriangle, color: "text-warning",    bg: "bg-warning/10 border-warning/20" },
  rejected: { icon: XCircle,       color: "text-destructive",bg: "bg-destructive/10 border-destructive/20" },
};

const stageTabs: { id: Stage; label: string; icon: React.ComponentType<{className?: string}> }[] = [
  { id: "all",          label: "All",            icon: LayoutList },
  { id: "drafting",     label: "Drafting",       icon: Loader2 },
  { id: "ready",        label: "Ready",          icon: Clock },
  { id: "needs_edit",   label: "Needs Edit",     icon: AlertTriangle },
  { id: "approved",     label: "Approved",       icon: CheckCircle2 },
  { id: "scheduled",    label: "Scheduled",      icon: Calendar },
  { id: "export_ready", label: "Export Ready",   icon: Package },
];

function EmptyStageState({ stage }: { stage: Stage }) {
  const messages: Partial<Record<Stage, { title: string; desc: string }>> = {
    drafting:     { title: "Nothing drafting right now",    desc: "Create a production from Viral Sparks — it will appear here while Spark generates." },
    ready:        { title: "Queue is clear",                desc: "You're all caught up. Spark will notify you when something is ready for review." },
    needs_edit:   { title: "No edits requested",            desc: "Everything reviewed has passed without revision requests." },
    approved:     { title: "Nothing approved yet",          desc: "Items move here once you approve them in review." },
    scheduled:    { title: "Nothing scheduled",             desc: "Approved productions can be scheduled from the Calendar." },
    export_ready: { title: "No export packages ready",      desc: "Approved and finalised productions will appear here." },
    all:          { title: "No productions yet",            desc: "Create your first production from Viral Sparks." },
  };
  const msg = messages[stage] ?? messages.all!;
  return (
    <EmptyState
      icon={<Zap className="w-5 h-5 text-muted-foreground/40" />}
      title={msg.title}
      description={msg.desc}
    />
  );
}

export function ReviewCenter({ onNavigate }: ReviewCenterProps = {}) {
  const { productions, reviewItems } = useSpark();
  const [activeStage, setActiveStage] = useState<Stage>("all");

  const items: ProductionItem[] = productions.map((p) => {
    const rev = reviewItems.find((r) => r.productionId === p.id);
    
    let stage: Stage = "drafting";
    if (["Ready for Review", "Awaiting Review", "Research Complete", "Planning Complete", "Storyboard Complete"].includes(p.status)) stage = "ready";
    else if (["Needs Edit", "Failed", "Generation Failed", "Editing Failed"].includes(p.status)) stage = "needs_edit";
    else if (p.status === "Approved") {
      if (p.id === "p7" || p.id.includes("scheduled")) stage = "scheduled";
      else if (p.id === "p8" || p.id.includes("export")) stage = "export_ready";
      else stage = "approved";
    } else if (p.status === "Published") stage = "scheduled";
    else stage = "drafting";

    return {
      id: p.id,
      title: p.title,
      account: rev?.account || (p.aspectRatio === "16:9" ? "YouTube" : "TikTok"),
      series: rev?.series || "Viral Series",
      reviewType: (p.id === "p2" || p.id === "p5" ? "production" : "creative") as "creative" | "production" | "publishing",
      priority: (p.id === "p1" || p.id === "p2" || p.id.includes("-")) ? "high" : "medium",
      stage: stage as Exclude<Stage, "all">,
      aiConfidence: p.id === "p1" ? 94 : p.id === "p2" ? 88 : 85,
      timeWaiting: p.dateCreated === "2026-07-01" ? "2m" : "1h",
      format: p.formats.join(" + "),
    };
  });

  const stageCounts = Object.fromEntries(
    stageTabs.map(({ id }) => [id, id === "all" ? items.length : items.filter(i => i.stage === id).length])
  ) as Record<Stage, number>;

  const filtered = activeStage === "all" ? items : items.filter(i => i.stage === activeStage);

  return (
    <>
      <TopBar pageName="Review" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">

          <PageHeader
            title="Review"
            subtitle="Control room — every production, every stage"
          />

          {/* Review Stages */}
          <section>
            <SectionHeader label="Review Stages" />
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.entries(stageLabels) as [Exclude<Stage, "all">, string][]).map(([key, label]) => {
                const Icon = stageIcons[key];
                const count = stageCounts[key] ?? 0;
                const isActive = activeStage === key;
                const isDrafting = key === "drafting";
                return (
                  <button
                    key={key}
                    onClick={() => setActiveStage(key)}
                    className={`rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-xl hover:shadow-black/10 ${
                      isActive ? stageSummaryStyles[key] : "bg-card border-border hover:border-accent/40"
                    }`}
                  >
                    <div className="mb-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-current" : "text-muted-foreground"} ${isDrafting && count > 0 ? "animate-spin" : ""}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
                    <p className={`text-3xl font-medium tracking-tight ${isActive ? "text-foreground" : "text-foreground"}`}>
                      {count}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Productions Table */}
          <section>
            <SectionHeader label="Productions" />

            {/* Stage Filter Pills */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
              {stageTabs.map((tab) => {
                const Icon = tab.icon;
                const count = stageCounts[tab.id];
                return (
                  <FilterPill
                    key={tab.id}
                    label={tab.label}
                    count={count}
                    active={activeStage === tab.id}
                    onClick={() => setActiveStage(tab.id)}
                    icon={<Icon className={`w-4 h-4 ${tab.id === "drafting" && count > 0 && activeStage !== tab.id ? "animate-spin" : ""}`} />}
                  />
                );
              })}
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {filtered.length === 0 ? (
                <EmptyStageState stage={activeStage} />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-background/50">
                      {["Title", "Account", "Type", "Format", "Priority", "Stage", "AI Score", "Time", ""].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const isDrafting = item.stage === "drafting";
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border/50 transition-colors cursor-pointer group ${isDrafting ? "opacity-60" : "hover:bg-accent/5"}`}
                          onClick={() => !isDrafting && item.reviewType === "creative" && onNavigate?.("/review/creative")}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <MiniMediaThumbnail 
                                id={item.id} 
                                title={item.title} 
                                isVideo={item.stage === "approved" || item.stage === "scheduled" || item.stage === "export_ready"} 
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {isDrafting && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />}
                                  <p className="text-sm font-medium max-w-[220px] truncate">{item.title}</p>
                                </div>
                                {item.series && <p className="text-xs text-muted-foreground mt-0.5">{item.series}</p>}
                                {isDrafting && <p className="text-xs text-muted-foreground/60 mt-0.5">Spark is generating…</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm text-muted-foreground">{item.account}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs capitalize text-muted-foreground">{item.reviewType}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs text-muted-foreground">{item.format}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-xs font-medium capitalize ${priorityColor[item.priority]}`}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <StatusChip variant={stageToChip[item.stage]} />
                          </td>
                          <td className="px-5 py-4">
                            <ConfidenceBar value={item.aiConfidence} width="w-14" />
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs text-muted-foreground">{item.timeWaiting}</p>
                          </td>
                          <td className="px-5 py-4">
                            {!isDrafting && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* AI Decisions */}
          <section>
            <SectionHeader label="AI Decisions" meta="Last 24h" />
            {productions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/25 p-8 text-center text-muted-foreground text-sm">
                Decisions will be logged here as Spark evaluates script hooks, storyboards, and rendering confidence metrics.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {aiDecisions.map((d) => {
                  const cfg = outcomeConfig[d.outcome];
                  const Icon = cfg.icon;
                  return (
                    <div key={d.id} className={`rounded-xl border p-5 ${cfg.bg}`}>
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 ${cfg.color} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed">{d.text}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-muted-foreground">{d.confidence}% confidence</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{d.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </main>
    </>
  );
}
