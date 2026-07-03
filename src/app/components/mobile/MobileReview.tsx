import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { MiniMediaThumbnail } from "../MediaPreviewHelper";
import {
  Pencil, Video, Rocket, CheckCircle2, X, RotateCw, Check,
  Sparkles, Clock, ArrowLeft, Loader2, AlertTriangle, Brain,
  ChevronRight, Download, Calendar,
} from "lucide-react";
import { MobileCreativeReview } from "./MobileCreativeReview";
import { StatusChip, ConfidenceBar, Button, type ChipVariant } from "../ds";

type StageFilter = "all" | "drafting" | "ready" | "needs_edit" | "approved";

interface ReviewItem {
  id: string;
  title: string;
  type: "creative" | "production" | "publishing";
  priority: "high" | "medium" | "low";
  stage: "drafting" | "ready" | "needs_edit" | "approved" | "scheduled";
  aiConfidence: number;
  timeWaiting: string;
  account: string;
  format: string;
}

const stageToChip: Record<ReviewItem["stage"], ChipVariant> = {
  drafting:  "drafting",
  ready:     "ready",
  needs_edit:"needs-edit",
  approved:  "approved",
  scheduled: "scheduled",
};

const typeLabel: Record<ReviewItem["type"], string> = {
  creative:   "Creative",
  production: "Production",
  publishing: "Publishing",
};

const stageTabs: { id: StageFilter; label: string }[] = [
  { id: "all",       label: "All" },
  { id: "ready",     label: "Ready" },
  { id: "needs_edit",label: "Needs Edit" },
  { id: "approved",  label: "Approved" },
  { id: "drafting",  label: "Drafting" },
];

function ReviewDetail({ item, onBack }: { item: ReviewItem; onBack: () => void }) {
  const { approveReviewItem, rejectOrRequestEditReviewItem } = useSpark();
  const [approved, setApproved] = useState(false);

  if (item.type === "creative") {
    return <MobileCreativeReview onBack={onBack} item={item} />;
  }

  if (approved) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center pb-24">
        <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-xl font-medium mb-2">Approved</h2>
        <p className="text-sm text-muted-foreground mb-8">
          "{item.title}" has been approved and is now scheduled.
        </p>
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>
          Back to Review
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0 active:bg-accent/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{typeLabel[item.type]} Review</p>
          <p className="text-sm font-medium truncate">{item.account}</p>
        </div>
        <StatusChip variant={stageToChip[item.stage]} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-36 px-4 pt-5 space-y-4">

        {/* Title + AI score */}
        <div>
          <h1 className="text-xl font-medium leading-snug mb-3">{item.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              item.aiConfidence >= 80 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}>
              <Sparkles className="w-3.5 h-3.5" />
              {item.aiConfidence}% AI confidence
            </span>
            <span className="text-xs text-muted-foreground">{item.format}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Waiting {item.timeWaiting}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="aspect-video bg-muted/40 flex items-center justify-center">
            <div className="text-center">
              <Video className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Preview pending approval</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Details</p>
          {[
            { label: "Account", value: item.account },
            { label: "Format", value: item.format },
            { label: "Expected Reach", value: "2.4M – 3.8M views" },
            { label: "Priority", value: item.priority, accent: item.priority === "high" ? "text-destructive" : item.priority === "medium" ? "text-warning" : "" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className={`text-sm font-medium capitalize ${row.accent ?? ""}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* AI assessment */}
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-accent-foreground" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI Assessment</p>
          </div>
          <div className="space-y-2">
            {[
              { label: "Hook clarity", pass: true },
              { label: "Brand consistency", pass: true },
              { label: "Platform-fit", pass: true },
              { label: "Caption reviewed", pass: item.type !== "publishing" },
            ].map((check) => (
              <div key={check.label} className="flex items-center gap-2.5">
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${check.pass ? "text-success" : "text-muted-foreground/30"}`} />
                <span className={`text-sm ${check.pass ? "" : "text-muted-foreground"}`}>{check.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Fixed action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-safe shadow-2xl space-y-2.5">
        <Button
          variant="approve"
          size="xl"
          fullWidth
          icon={<CheckCircle2 className="w-5 h-5" />}
          onClick={() => {
            approveReviewItem(item.id);
            setApproved(true);
          }}
        >
          Approve
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="regenerate"
            size="md"
            icon={<RotateCw className="w-4 h-4" />}
            onClick={() => {
              rejectOrRequestEditReviewItem(item.id);
              onBack();
            }}
          >
            Regenerate
          </Button>
          <Button
            variant="schedule"
            size="md"
            icon={<Calendar className="w-4 h-4" />}
            onClick={() => {
              approveReviewItem(item.id);
              setApproved(true);
            }}
          >
            Schedule
          </Button>
          <Button
            variant="danger"
            size="md"
            icon={<X className="w-4 h-4" />}
            onClick={() => {
              rejectOrRequestEditReviewItem(item.id);
              onBack();
            }}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MobileReviewProps {
  onNavigate?: (path: string) => void;
}

export function MobileReview({ onNavigate }: MobileReviewProps = {}) {
  const { productions, reviewItems } = useSpark();
  const [activeFilter, setActiveFilter] = useState<StageFilter>("all");
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);

  const reviews: ReviewItem[] = productions.map((p) => {
    const rev = reviewItems.find((r) => r.productionId === p.id);
    
    let stage: "drafting" | "ready" | "needs_edit" | "approved" | "scheduled" = "drafting";
    if (p.status === "Ready for Review") stage = "ready";
    else if (p.status === "Needs Edit") stage = "needs_edit";
    else if (p.status === "Approved") {
      if (p.id === "p7" || p.id.includes("scheduled")) stage = "scheduled";
      else stage = "approved";
    } else if (p.status === "Drafting") stage = "drafting";

    return {
      id: rev?.id || `rev-${p.id}`,
      title: p.title,
      type: (p.id === "p2" || p.id === "p5" ? "production" : "creative") as "creative" | "production" | "publishing",
      priority: (p.id === "p1" || p.id === "p2" || p.id.includes("-")) ? "high" : "medium" as "high" | "medium" | "low",
      stage: stage,
      aiConfidence: p.id === "p1" ? 94 : p.id === "p2" ? 88 : 85,
      timeWaiting: p.dateCreated === "2026-07-01" ? "2m" : "1h",
      account: rev?.account || (p.aspectRatio === "16:9" ? "YouTube" : "TikTok"),
      format: p.formats.join(" + "),
    };
  });

  if (selectedReview) {
    const currentReview = reviews.find((r) => r.id === selectedReview.id) || selectedReview;
    return <ReviewDetail item={currentReview} onBack={() => setSelectedReview(null)} />;
  }

  const filtered = activeFilter === "all"
    ? reviews
    : reviews.filter((r) => r.stage === activeFilter);

  const counts = Object.fromEntries(
    stageTabs.map(({ id }) => [id, id === "all" ? reviews.length : reviews.filter(r => r.stage === id).length])
  ) as Record<StageFilter, number>;

  return (
    <div className="pb-24 px-4 pt-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium">Review</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {counts.ready > 0 ? `${counts.ready} ready for your review` : "All clear — queue empty"}
        </p>
      </div>

      {/* Stage summary chips */}
      <div className="grid grid-cols-5 gap-2">
        {(["drafting", "ready", "needs_edit", "approved", "scheduled"] as const).map((stage) => {
          const count = reviews.filter(r => r.stage === stage).length;
          if (count === 0) return null;
          return (
            <button
              key={stage}
              onClick={() => setActiveFilter(stage)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                activeFilter === stage ? "border-accent/60 bg-accent/10" : "border-border bg-card"
              }`}
            >
              <p className={`text-lg font-medium ${activeFilter === stage ? "text-foreground" : "text-muted-foreground"}`}>{count}</p>
              <StatusChip variant={stageToChip[stage]} label={stage === "needs_edit" ? "Edit" : undefined} className="text-[10px] px-1.5 py-0.5" />
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {stageTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all flex-shrink-0 ${
              activeFilter === tab.id
                ? "bg-accent text-foreground"
                : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${activeFilter === tab.id ? "bg-background/40" : "bg-muted/50"}`}>
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Review cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center flex flex-col items-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">Nothing here</p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            {activeFilter === "drafting" ? "Spark isn't generating anything right now." : "No items in this stage."}
          </p>
          <button
            onClick={() => onNavigate?.("/viral-sparks")}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-xs font-medium active:scale-95 transition-transform"
          >
            Find Viral Sparks to Draft →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => {
            const isDrafting = review.stage === "drafting";
            return (
              <button
                key={review.id}
                onClick={() => !isDrafting && setSelectedReview(review)}
                className={`w-full rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                  isDrafting ? "opacity-60 cursor-default" :
                  review.priority === "high" ? "border-destructive/25 bg-destructive/5" :
                  "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Media Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <MiniMediaThumbnail
                      id={review.id}
                      title={review.title}
                      isVideo={review.stage === "approved" || review.stage === "scheduled"}
                      className="shadow-md"
                    />
                    {isDrafting && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <p className="text-sm font-medium leading-snug mb-1.5 line-clamp-2">{review.title}</p>

                    {/* Account + type */}
                    <p className="text-xs text-muted-foreground mb-2.5">
                      {review.account} · {typeLabel[review.type]}
                      {isDrafting && " · Spark is generating…"}
                    </p>

                    {/* Stage + confidence + time */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <StatusChip variant={stageToChip[review.stage]} />
                      {!isDrafting && <ConfidenceBar value={review.aiConfidence} width="w-14" />}
                      <span className="text-xs text-muted-foreground">{review.timeWaiting}</span>
                    </div>
                  </div>

                  {!isDrafting && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}
