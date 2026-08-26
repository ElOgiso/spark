import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { InteractiveVideoPlayer, ThumbnailVariantCard } from "../MediaPreviewHelper";
import {
  ArrowLeft,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Edit,
  RotateCw,
  XCircle,
  AlertTriangle,
  Play,
  Trash2,
  X,
  Film,
} from "lucide-react";
import { MobileProductionAssetsGallery } from "./MobileProductionAssetsGallery";

interface MobileCreativeReviewProps {
  onBack?: () => void;
  item?: any;
}

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? JSON.stringify(v) : String(v)))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

function clip(value: unknown, n: number, fallback: string): string {
  const t = asText(value, fallback);
  return t ? t.slice(0, n) : fallback;
}

export function MobileCreativeReview({ onBack, item }: MobileCreativeReviewProps) {
  const {
    approveReviewItem,
    rejectOrRequestEditReviewItem,
    generateProductionAssets,
    cancelProduction,
    deleteProduction,
    productions,
  } = useSpark() as any;

  const activeProd = productions?.find((p: any) =>
    (item?.productionId && p.id === item.productionId) ||
    (item?.id && p.id === item.id) ||
    (item?.id && item.id.replace("rev-", "") === p.id)
  );
  const brief = activeProd?.brief || item?.brief;
  const genProgress = activeProd?.generationProgress || item?.generationProgress || brief?.generationProgress;
  const isGenerating = Boolean(
    activeProd?.isGeneratingAssets ||
    item?.isGeneratingAssets ||
    (genProgress && genProgress.stage !== "Complete" && genProgress.stage !== "Failed" && (genProgress.percent || 0) < 100)
  );

  const prodId = activeProd?.id || item?.productionId || (item?.id ? item.id.replace("rev-", "") : "");
  const reviewId = item?.id || (prodId ? `rev-${prodId}` : "");
  const hasPlayableVideo = Boolean(
    activeProd?.videoUrl || brief?.videoUrl || brief?.generatedAssets?.generatedVideos?.[0]
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<"A" | "B" | "C">("B");
  const [showAssetsGallery, setShowAssetsGallery] = useState(false);

  if (showAssetsGallery) {
    return (
      <MobileProductionAssetsGallery
        onBack={() => setShowAssetsGallery(false)}
        production={activeProd}
        item={item}
      />
    );
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleGenerateAssets = (forceRegenerate = false) => {
    if (!prodId || !generateProductionAssets) {
      setFeedback("Production ID not found.");
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setFeedback(forceRegenerate ? "Forcing full regeneration..." : "Continuing asset generation...");
    void generateProductionAssets(prodId, forceRegenerate)
      .then(() => {
        setFeedback(forceRegenerate ? "Assets regenerated!" : "Asset generation complete!");
        setTimeout(() => setFeedback(null), 3000);
      })
      .catch((err: any) => {
        setFeedback(`Generation failed: ${err?.message || "Error"}`);
        setTimeout(() => setFeedback(null), 3500);
      });
  };

  const handleCancelGeneration = () => {
    if (prodId && cancelProduction) {
      cancelProduction(prodId);
      setFeedback("Generation cancelled.");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleReject = () => {
    if (reviewId) {
      rejectOrRequestEditReviewItem(reviewId);
    }
    setFeedback("Draft marked for edit/revision.");
    setTimeout(() => {
      setFeedback(null);
      onBack?.();
    }, 1500);
  };

  const handleDelete = () => {
    if (window.confirm("Delete this production? Cannot be undone.")) {
      if (prodId && deleteProduction) {
        deleteProduction(prodId);
      }
      setFeedback("Production deleted.");
      setTimeout(() => {
        setFeedback(null);
        onBack?.();
      }, 1000);
    }
  };

  const handleApprove = () => {
    if (reviewId) {
      approveReviewItem(reviewId);
    }
    setApproved(true);
  };

  const proposal = {
    title: asText(brief?.title || activeProd?.title || item?.title, "5 Viral Marketing Tactics That Actually Work in 2026"),
    opportunityScore: brief?.brandFitScore || 94,
    aiConfidence: brief?.brandFitScore || 94,
    concept: asText(brief?.whyThisWorks || activeProd?.reasoning?.planning?.outline || item?.conceptText, "Reveal proven marketing tactics adapted to brand rules"),
    expectedReach: "2.4M – 3.8M views",
    platforms: [asText(brief?.platformRecommendation, "YouTube Shorts"), "TikTok", "Instagram Reels"],
    hook: asText(brief?.hook || item?.scriptSnippet, "Stop wasting money on marketing that doesn't work"),
    openingMoment: asText(brief?.visualDirection || activeProd?.reasoning?.storyboard?.narration || item?.openingMoment, "Vertical 9:16 presenter with text overlays"),
    captionDirection: asText(brief?.caption, "Lead with curiosity hook and clear call to action."),
    offerCta: brief?.offerCta || activeProd?.brief?.offerCta || item?.brief?.offerCta,
    thumbnails: brief?.generatedAssets?.thumbnails?.length
      ? brief.generatedAssets.thumbnails.map((t: any, idx: number) => ({
          id: t.id || String(idx + 1),
          concept: asText(t.concept, `Variant ${t.variant || ["A", "B", "C"][idx] || "A"} optimized for CTR`),
          variant: (t.variant || ["A", "B", "C"][idx] || "A") as "A" | "B" | "C",
          image: t.image || brief?.generatedAssets?.generatedFrames?.[idx] || brief?.storyboard?.[idx]?.image,
        }))
      : [
          { id: "1", variant: "A", concept: "Cinematic Split hook preview", image: brief?.generatedAssets?.generatedFrames?.[0] },
          { id: "2", variant: "B", concept: "Bold Reaction Accent curiosity card", image: brief?.generatedAssets?.generatedFrames?.[1] },
          { id: "3", variant: "C", concept: "Focal Curiosity Loop end screen", image: brief?.generatedAssets?.generatedFrames?.[2] },
        ],
    narrative: {
      hook: asText(brief?.hook || item?.scriptSnippet, "Failed marketing campaigns waste billions annually"),
      buildUp: clip(brief?.scriptOutline, 100, "Modern strategy breakdown"),
      conflict: "Most creators don't know these AI strategies exist",
      reveal: "Here's exactly what works in 2026",
      payoff: "Implement these tactics to 10x your results",
    },
    storyboard: activeProd?.scenes?.length
      ? activeProd.scenes.map((s: any, idx: number) => ({
          scene: s.scene || idx + 1,
          description: s.description,
          duration: s.duration || "0–10s",
          image: s.image || brief?.storyboard?.[idx]?.image || brief?.generatedAssets?.generatedFrames?.[idx],
          videoUrl: s.videoUrl || activeProd?.videoUrl || brief?.videoUrl || brief?.generatedAssets?.generatedVideos?.[0],
        }))
      : brief?.storyboard?.length
      ? brief.storyboard.map((s: any, idx: number) => ({
          scene: s.scene || idx + 1,
          description: s.visualDescription || s.shotList || s.onScreenText || `Scene ${idx + 1}`,
          duration: s.duration || "0–10s",
          image: s.image || brief.generatedAssets?.generatedFrames?.[idx],
          videoUrl: s.videoUrl || brief.videoUrl || brief.generatedAssets?.generatedVideos?.[0],
        }))
      : [
          { scene: 1, description: `Hook: ${brief?.hook || item?.openingMoment || "Opening hook"}`, duration: "0-5s", image: brief?.generatedAssets?.generatedFrames?.[0] },
          { scene: 2, description: `Body: ${brief?.visualDirection || "Script body breakdown"}`, duration: "5-25s", image: brief?.generatedAssets?.generatedFrames?.[1] },
          { scene: 3, description: `CTA: ${brief?.caption || "Call to Action"}`, duration: "25-30s", image: brief?.generatedAssets?.generatedFrames?.[2] },
        ],
    platformStrategy: {
      youtube: "12-15 min deep dive, SEO optimized",
      tiktok: "60s version highlighting primary hook",
      reels: "45s version with native text overlays",
    },
  };

  if (approved) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center pb-24">
        <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-8 h-8 text-success animate-bounce" />
        </div>
        <h2 className="text-xl font-medium mb-2">Approved & Scheduled</h2>
        <p className="text-sm text-muted-foreground mb-8">
          "{proposal.title}" has been approved and moved to the publishing queue.
        </p>
        <button
          onClick={onBack}
          className="w-full py-3.5 bg-foreground text-background font-medium rounded-xl text-sm active:scale-95 transition-transform"
        >
          Back to Review Queue
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[#0B0F17] text-white flex flex-col overflow-hidden">
      <div
        className="sticky top-0 z-10 bg-[#0B0F17]/95 backdrop-blur-md border-b border-white/10 p-4 shrink-0"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 12px))" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-3 cursor-pointer active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Review</span>
        </button>
        <h1 className="text-lg font-bold leading-snug mb-2 text-white line-clamp-2">{proposal.title}</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{proposal.opportunityScore}% Fit</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{proposal.aiConfidence}% AI Confidence</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 pb-[380px] min-h-0">

      {isGenerating && genProgress && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-card border border-accent/40 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCw className="w-3.5 h-3.5 text-accent animate-spin" />
              <span className="text-xs font-semibold text-foreground">
                {genProgress?.stage ? `Stage: ${genProgress.stage}` : "Synthesizing Media"}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-accent bg-accent/20 px-2 py-0.5 rounded-full">
              {typeof genProgress?.percent === "number" && genProgress.percent >= 0 ? `${genProgress.percent}%` : "Starting..."}
            </span>
          </div>

          <div className="w-full h-1.5 bg-accent/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${typeof genProgress?.percent === "number" && genProgress.percent > 0 ? Math.max(genProgress.percent, 3) : 3}%` }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            {genProgress?.message || "Synthesizing storyboard keyframes, thumbnails, and audio..."}
          </p>

          {genProgress?.stages && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
              {genProgress.stages.map((stg: any) => (
                <div key={stg.id} className="flex items-center gap-1.5 text-[10px]">
                  {stg.status === "done" && <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />}
                  {stg.status === "active" && <RotateCw className="w-3 h-3 text-accent animate-spin flex-shrink-0" />}
                  {stg.status === "failed" && <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />}
                  {stg.status === "pending" && <div className="w-3 h-3 rounded-full border border-border flex-shrink-0" />}
                  <span
                    className={`truncate ${
                      stg.status === "active"
                        ? "text-foreground font-medium"
                        : stg.status === "done"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    {stg.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-6">
        {/* Playable Storyboard Draft Player */}
        <div className="p-0.5 rounded-2xl bg-gradient-to-r from-accent/30 via-success/20 to-warning/20 border border-border overflow-hidden">
          <InteractiveVideoPlayer 
            id={item?.id || activeProd?.id || "p1"} 
            title={proposal.title} 
            scenes={proposal.storyboard} 
            durationText="3:20"
            videoUrl={activeProd?.videoUrl || item?.videoUrl || brief?.videoUrl || brief?.generatedAssets?.generatedVideos?.[0]}
            audioUrl={
              !hasPlayableVideo
                ? (activeProd?.audioUrl || item?.audioUrl || brief?.audioUrl || brief?.generatedAssets?.voiceoverUrl || brief?.generatedAssets?.generatedAudio?.[0])
                : undefined
            }
            onApprove={() => {
              if (item?.id) {
                approveReviewItem(item.id);
              }
              setApproved(true);
            }}
          />
        </div>

        {/* Open Production Assets Action Button */}
        <button
          onClick={() => setShowAssetsGallery(true)}
          className="w-full py-3.5 px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md cursor-pointer"
        >
          <Film className="w-4 h-4 text-purple-400" />
          <span>Open Production Assets</span>
        </button>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground mb-2">Concept</p>
          <p className="text-base mb-4">{proposal.concept}</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expected Reach</span>
            <span className="font-medium">{proposal.expectedReach}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-base font-medium mb-3">Hook</h3>
          <p className="text-lg font-medium mb-3">{proposal.hook}</p>
          <div className="p-3 rounded-lg bg-accent/10">
            <p className="text-sm text-muted-foreground">{proposal.openingMoment}</p>
          </div>
        </div>

        {/* Promoted Offer CTA */}
        {proposal.offerCta && (
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Promoted Offer CTA</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-accent/20 text-accent uppercase">
                {proposal.offerCta.type || "Offer"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{proposal.offerCta.title}</p>
              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{proposal.offerCta.url}</p>
            </div>
            {proposal.offerCta.priceLabel && (
              <div className="pt-1">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-background border border-border text-foreground">
                  {proposal.offerCta.priceLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {/* High impact cover selection */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Proposed Thumbnails (Tap to select)</span>
          </h3>
          <div className="grid grid-cols-1 gap-3.5">
            {proposal.thumbnails.map((thumbnail: any) => (
              <ThumbnailVariantCard 
                key={thumbnail.id}
                id={item?.id || "p1"}
                variant={thumbnail.variant as "A" | "B" | "C"}
                concept={thumbnail.concept || `Variant ${thumbnail.variant} design customized for High Click-Through Rates across all platforms.`}
                image={thumbnail.image}
                isSelected={selectedVariant === thumbnail.variant}
                onClick={() => setSelectedVariant(thumbnail.variant as "A" | "B" | "C")}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => toggleSection("narrative")}
          className="w-full text-left rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Narrative</h3>
            {expandedSections.has("narrative") ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {expandedSections.has("narrative") && (
            <div className="mt-4 space-y-3">
              {Object.entries(proposal.narrative).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground mb-1 capitalize">{key}</p>
                  <p className="text-sm">{value}</p>
                </div>
              ))}
            </div>
          )}
        </button>

        <button
          onClick={() => toggleSection("storyboard")}
          className="w-full text-left rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Storyboard & Visual Map</h3>
            {expandedSections.has("storyboard") ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {expandedSections.has("storyboard") && (
            <div className="mt-4 space-y-3">
              {(brief?.storyboardGridUrl || brief?.generatedAssets?.storyboardGridUrl) && (
                <div className="p-3 rounded-lg bg-background border border-border/60 space-y-1.5">
                  <p className="text-[11px] font-semibold text-accent uppercase tracking-wider">Master Storyboard Map</p>
                  <div className="w-full max-h-56 rounded-md overflow-hidden bg-black/40 flex items-center justify-center">
                    <img
                      src={brief?.storyboardGridUrl || brief?.generatedAssets?.storyboardGridUrl}
                      alt="Master Storyboard Grid Map"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              {proposal.storyboard.map((scene: any) => (
                <div key={scene.scene} className="p-3 rounded-lg bg-background flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-accent/30 text-xs font-medium">
                      Scene {scene.scene}
                    </span>
                    <span className="text-xs text-muted-foreground">{scene.duration}</span>
                  </div>
                  {scene.image && (
                    <div className="w-full h-28 rounded-md overflow-hidden border border-border/40 bg-black/30">
                      <img src={scene.image} alt={`Scene ${scene.scene}`} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-sm">{scene.description}</p>
                </div>
              ))}
            </div>
          )}
        </button>

        <button
          onClick={() => toggleSection("platform")}
          className="w-full text-left rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Platform Strategy</h3>
            {expandedSections.has("platform") ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {expandedSections.has("platform") && (
            <div className="mt-4 space-y-3">
              {Object.entries(proposal.platformStrategy).map(([platform, strategy]) => (
                <div key={platform} className="p-3 rounded-lg bg-background">
                  <p className="text-sm font-medium mb-1 capitalize">{platform}</p>
                  <p className="text-sm text-muted-foreground">{strategy}</p>
                </div>
              ))}
            </div>
          )}
        </button>
      </div>

      {feedback && (
        <div className="fixed bottom-[320px] left-4 right-4 bg-card border border-border px-4 py-3 rounded-2xl flex items-center justify-between shadow-xl z-50 animate-pulse">
          <span className="text-xs text-foreground font-medium">{feedback}</span>
        </div>
      )}

      </div>

      {/* Solid Opaque Fixed Action Dock (Onboard Style) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[95] bg-[#0B0F17] border-t border-white/10 px-4 pt-3.5 space-y-2.5 shadow-2xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 16px))" }}
      >
        {/* 1) Continue generation / Generate Assets OR Cancel generation */}
        {isGenerating ? (
          <button
            onClick={handleCancelGeneration}
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
            <span>{hasPlayableVideo ? "Generate Assets" : "Continue Generation"}</span>
          </button>
        )}

        {/* 2) Regenerate all */}
        <button
          onClick={() => handleGenerateAssets(true)}
          disabled={isGenerating}
          className="w-full py-3.5 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          <RotateCw className={`w-4 h-4 text-white/70 ${isGenerating ? "animate-spin" : ""}`} />
          <span>Regenerate All</span>
        </button>

        {/* 3) Reject / Request revision */}
        <button
          onClick={handleReject}
          className="w-full py-3.5 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Edit className="w-4 h-4 text-white/60" />
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
          onClick={handleApprove}
          className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-base font-semibold tracking-wide flex items-center justify-center gap-2.5 shadow-[0_0_24px_rgba(168,85,247,0.35)] transition-all active:scale-[0.98]"
        >
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>Approve Production</span>
        </button>
      </div>
    </div>
  );
}
