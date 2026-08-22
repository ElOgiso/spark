import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { MiniMediaThumbnail } from "../MediaPreviewHelper";
import {
  Pencil, Video, Rocket, CheckCircle2, X, RotateCw, Check,
  Sparkles, Clock, ArrowLeft, Loader2, AlertTriangle, Brain,
  ChevronRight, Download, Calendar, Trash2,
} from "lucide-react";
import { MobileCreativeReview } from "./MobileCreativeReview";
import { StatusChip, ConfidenceBar, Button, type ChipVariant } from "../ds";

type StageFilter = "all" | "drafting" | "ready" | "needs_edit" | "approved" | "scheduled";

interface ReviewItem {
  id: string;
  productionId: string;
  title: string;
  type: "creative" | "production" | "publishing";
  priority: "high" | "medium" | "low";
  stage: "drafting" | "ready" | "needs_edit" | "approved" | "scheduled";
  aiConfidence: number;
  timeWaiting: string;
  account: string;
  format: string;
  videoUrl?: string;
  audioUrl?: string;
  brief?: any;
  scenes?: any[];
  generationProgress?: any;
  isGeneratingAssets?: boolean;
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

function clipText(str: any, n = 35, fallback = ""): string {
  if (typeof str !== "string" || !str.trim()) return fallback;
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function getPreviewMediaUrl(prod?: any, review?: any): string | undefined {
  if (!prod && !review) return undefined;
  const brief = prod?.brief || review?.brief;
  const scenes = prod?.scenes?.length ? prod.scenes : brief?.storyboard;
  const genAssets = brief?.generatedAssets;

  if (scenes?.[0]?.image) return scenes[0].image;
  if (genAssets?.generatedFrames?.[0]) return genAssets.generatedFrames[0];
  if (genAssets?.thumbnails?.[0]?.image) return genAssets.thumbnails[0].image;
  if (brief?.storyboard?.[0]?.image) return brief.storyboard[0].image;

  if (prod?.videoUrl && (prod.videoUrl.startsWith("http") || prod.videoUrl.startsWith("data:"))) {
    return prod.videoUrl;
  }
  return undefined;
}

function ReviewDetail({ item, onBack }: { item: ReviewItem; onBack: () => void }) {
  const {
    approveReviewItem,
    rejectOrRequestEditReviewItem,
    generateProductionAssets,
    cancelProduction,
    deleteProduction,
    productions,
  } = useSpark();
  const [approved, setApproved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeProd = productions?.find((p) => p.id === item.productionId || p.id === item.id);
  const hasMediaOrBrief = Boolean(activeProd || item.brief || item.videoUrl || item.audioUrl || (item.scenes && item.scenes.length > 0));

  if (item.type === "creative" || hasMediaOrBrief) {
    return <MobileCreativeReview onBack={onBack} item={item} />;
  }

  const handleGenerateAssets = (force = false) => {
    if (!item.productionId || !generateProductionAssets) return;
    setFeedback(force ? "Forcing full regeneration..." : "Continuing asset generation...");
    void generateProductionAssets(item.productionId, force)
      .then(() => {
        setFeedback("Asset generation complete!");
        setTimeout(() => setFeedback(null), 3000);
      });
  };

  const handleCancel = () => {
    if (item.productionId && cancelProduction) {
      cancelProduction(item.productionId);
      setFeedback("Generation cancelled.");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Delete this production? Cannot be undone.")) {
      if (item.productionId && deleteProduction) {
        deleteProduction(item.productionId);
      }
      onBack();
    }
  };

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
      <div className="flex-1 overflow-y-auto pb-[340px] px-4 pt-5 space-y-4">

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

      {feedback && (
        <div className="fixed bottom-[320px] left-4 right-4 bg-card border border-border px-4 py-3 rounded-2xl flex items-center justify-between shadow-xl z-50 animate-pulse">
          <span className="text-xs text-foreground font-medium">{feedback}</span>
        </div>
      )}

      {/* Solid Opaque Fixed Action Dock (Onboard Style) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17] border-t border-white/10 px-4 pt-3.5 space-y-2.5 shadow-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {/* 1) Continue generation / Generate Assets OR Cancel generation */}
        {item.isGeneratingAssets ? (
          <button
            onClick={handleCancel}
            className="w-full py-3.5 px-4 rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <X className="w-4 h-4 animate-spin text-red-400" />
            <span>Cancel Generation</span>
          </button>
        ) : (
          <button
            onClick={() => handleGenerateAssets(false)}
            className="w-full py-3.5 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Continue Generation</span>
          </button>
        )}

        {/* 2) Regenerate all */}
        <button
          onClick={() => handleGenerateAssets(true)}
          disabled={item.isGeneratingAssets}
          className="w-full py-3.5 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          <RotateCw className={`w-4 h-4 text-white/70 ${item.isGeneratingAssets ? "animate-spin" : ""}`} />
          <span>Regenerate All</span>
        </button>

        {/* 3) Reject / Request revision */}
        <button
          onClick={() => { rejectOrRequestEditReviewItem(item.id); onBack(); }}
          className="w-full py-3.5 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Pencil className="w-4 h-4 text-white/60" />
          <span>Request Revision</span>
        </button>

        {/* 4) Delete production */}
        <button
          onClick={handleDelete}
          className="w-full py-3.5 px-4 rounded-2xl border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Trash2 className="w-4 h-4 text-red-400/80" />
          <span>Delete Production</span>
        </button>

        {/* 5) Approve production (PRIMARY — last, strongest purple CTA) */}
        <button
          onClick={() => {
            approveReviewItem(item.id);
            setApproved(true);
          }}
          className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-base font-semibold tracking-wide flex items-center justify-center gap-2.5 shadow-[0_0_24px_rgba(168,85,247,0.35)] transition-all active:scale-[0.98]"
        >
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>Approve Production</span>
        </button>
      </div>
    </div>
  );
}

interface MobileReviewProps {
  onNavigate?: (path: string) => void;
}

export function MobileReview({ onNavigate }: MobileReviewProps = {}) {
  const { productions, reviewItems, deleteProduction } = useSpark();
  const [activeFilter, setActiveFilter] = useState<StageFilter>("all");
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);

  const reviews: ReviewItem[] = productions.map((p) => {
    const rev = reviewItems.find((r) => r.productionId === p.id || r.id === p.id);
    
    let stage: "drafting" | "ready" | "needs_edit" | "approved" | "scheduled" = "drafting";
    if (["Ready for Review", "Awaiting Review", "Research Complete", "Planning Complete", "Storyboard Complete"].includes(p.status)) stage = "ready";
    else if (["Needs Edit", "Failed", "Generation Failed", "Editing Failed"].includes(p.status)) stage = "needs_edit";
    else if (p.status === "Approved") {
      if (p.id === "p7" || p.id.includes("scheduled")) stage = "scheduled";
      else stage = "approved";
    } else if (p.status === "Published") stage = "scheduled";
    else stage = "drafting";

    const videoUrl = p.videoUrl || p.brief?.videoUrl || rev?.videoUrl || p.brief?.generatedAssets?.generatedVideos?.[0];
    const audioUrl = p.audioUrl || p.brief?.audioUrl || rev?.audioUrl || p.brief?.generatedAssets?.voiceoverUrl;
    const brief = p.brief || rev?.brief;
    const scenes = p.scenes?.length ? p.scenes : p.brief?.storyboard;
    const generationProgress = p.generationProgress || p.brief?.generationProgress || rev?.brief?.generationProgress;

    return {
      id: rev?.id || `rev-${p.id}`,
      productionId: p.id,
      title: p.title,
      type: "creative",
      priority: (p.id === "p1" || p.id === "p2" || p.id.includes("-")) ? "high" : "medium",
      stage,
      aiConfidence: p.id === "p1" ? 94 : p.id === "p2" ? 88 : 85,
      timeWaiting: p.dateCreated === "2026-07-01" ? "2m" : "1h",
      account: rev?.account || (p.aspectRatio === "16:9" ? "YouTube" : "TikTok"),
      format: p.formats ? p.formats.join(" + ") : "Short-form",
      videoUrl,
      audioUrl,
      brief,
      scenes,
      generationProgress,
      isGeneratingAssets: p.isGeneratingAssets,
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
    <div className="w-full min-h-[100dvh] flex flex-col space-y-4 pt-3 pb-6 px-4">
      {/* Top Block */}
      <div className="space-y-4 flex-shrink-0 bg-background z-10">

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
      </div>

      {/* Content Block */}
      <div className="space-y-3 py-2">
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
            const prod = productions.find(
              (p) => p.id === review.productionId || p.id === review.id || p.id === review.id.replace("rev-", "")
            );
            const genProgress = prod?.generationProgress || prod?.brief?.generationProgress || review.generationProgress;
            const progressPct = genProgress?.percent ?? (prod?.isGeneratingAssets || review.isGeneratingAssets ? 15 : 0);
            const progressStage = genProgress?.stage || (prod?.isGeneratingAssets ? "Synthesizing Media" : "");

            const isComplete = progressStage === "Complete" || progressPct >= 100;
            const isFailed = progressStage === "Failed" || (prod?.status as any) === "Failed" || (prod?.status as any) === "Generation Failed";
            const isCancelled = progressStage === "Cancelled" || prod?.status === "Cancelled";

            const isDrafting = Boolean(
              prod?.isGeneratingAssets ||
              review.isGeneratingAssets ||
              (genProgress && !isComplete && !isFailed && !isCancelled) ||
              (review.stage === "drafting" && !isComplete && !isFailed && !isCancelled) ||
              (["Drafting", "In Progress", "Synthesizing", "Queued"].includes(prod?.status || "") && !isComplete && !isFailed && !isCancelled)
            );

            const previewImage = getPreviewMediaUrl(prod, review);

            return (
              <div key={review.id} className="relative group">
                <button
                  onClick={() => setSelectedReview(review)}
                  className={`w-full rounded-xl border p-4 pr-10 text-left transition-all active:scale-[0.98] ${
                    review.priority === "high" ? "border-destructive/25 bg-destructive/5" :
                    "border-border bg-card hover:bg-accent/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Media Thumbnail */}
                    <div className="relative flex-shrink-0">
                      <MiniMediaThumbnail
                        id={review.id}
                        title={review.title}
                        imageUrl={previewImage}
                        isVideo={Boolean(prod?.videoUrl || review.videoUrl || isComplete)}
                        aspectRatio={prod?.aspectRatio === "16:9" ? "16:9" : "9:16"}
                        className="shadow-md"
                      />
                      {isDrafting && (
                        <div className="absolute inset-0 bg-black/65 backdrop-blur-[0.5px] flex flex-col items-center justify-center rounded-lg p-0.5 text-center">
                          <Loader2 className="w-4 h-4 text-accent animate-spin mb-0.5" />
                          <span className="text-[9px] font-bold text-accent font-mono">{progressPct}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-center gap-1.5 mb-1">
                        {isDrafting && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />}
                        <p className="text-sm font-medium leading-snug truncate">{review.title}</p>
                      </div>

                      {/* Account + type */}
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {review.account} · {typeLabel[review.type]}
                      </p>

                      {/* Progress Bar & Stage text while drafting */}
                      {isDrafting && (
                        <div className="space-y-1 my-1.5 p-2 rounded-lg bg-accent/5 border border-accent/20">
                          <div className="flex items-center justify-between text-xs text-accent font-mono">
                            <span className="truncate max-w-[140px] font-semibold">{progressStage || "Synthesizing Media"}</span>
                            <span className="font-bold">{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-accent/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent via-emerald-400 to-accent rounded-full transition-all duration-300 animate-pulse"
                              style={{ width: `${Math.max(progressPct, 5)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Badges */}
                      {isCancelled && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium my-1">
                          <X className="w-3 h-3 text-muted-foreground" />
                          Cancelled
                        </div>
                      )}

                      {isFailed && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-destructive/15 text-destructive text-xs font-medium my-1">
                          <AlertTriangle className="w-3 h-3" />
                          {prod?.lastError ? clipText(prod.lastError, 30, "Generation Failed") : "Generation Failed"}
                        </div>
                      )}

                      {/* Stage + confidence + time */}
                      <div className="flex items-center gap-3 flex-wrap mt-1">
                        <StatusChip variant={isDrafting ? "drafting" : stageToChip[review.stage]} />
                        {!isDrafting && <ConfidenceBar value={review.aiConfidence} width="w-14" />}
                        <span className="text-xs text-muted-foreground">{review.timeWaiting}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${review.title}"? Cannot undo.`)) {
                      if (deleteProduction && review.productionId) {
                        deleteProduction(review.productionId);
                      }
                    }
                  }}
                  title="Delete production"
                  className="absolute top-3 right-3 p-2 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/15 active:bg-destructive/25 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
