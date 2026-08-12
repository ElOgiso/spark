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
} from "lucide-react";

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
  const { approveReviewItem, rejectOrRequestEditReviewItem, productions } = useSpark() as any;
  const activeProd = productions?.find((p: any) => p.id === item?.productionId || p.id === item?.id);
  const brief = activeProd?.brief || item?.brief;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<"A" | "B" | "C">("B");

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleAction = (type: "changes" | "regenerate" | "reject") => {
    if (item?.id) {
      rejectOrRequestEditReviewItem(item.id);
    }
    if (type === "changes") {
      setFeedback("Requesting storyboard adjustments...");
    } else if (type === "regenerate") {
      setFeedback("Regenerating new hooks and creative angles...");
    } else if (type === "reject") {
      setFeedback("Creative draft rejected and archived.");
    }
    setTimeout(() => {
      setFeedback(null);
      onBack?.();
    }, 2000);
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
    <div className="min-h-screen bg-background pb-32">
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-xl font-medium mb-3">{proposal.title}</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/20 text-success">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{proposal.opportunityScore}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{proposal.aiConfidence}% AI</span>
          </div>
        </div>
      </div>

      {activeProd?.isGeneratingAssets && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-card border border-accent/40 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCw className="w-3.5 h-3.5 text-accent animate-spin" />
              <span className="text-xs font-semibold text-foreground">
                {activeProd.generationProgress?.stage ? `Stage: ${activeProd.generationProgress.stage}` : "Synthesizing Media"}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-accent bg-accent/20 px-2 py-0.5 rounded-full">
              {activeProd.generationProgress?.percent ?? 15}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-accent/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(activeProd.generationProgress?.percent ?? 15, 6)}%` }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            {activeProd.generationProgress?.message || "Synthesizing storyboard keyframes, thumbnails, and audio..."}
          </p>

          {activeProd.generationProgress?.stages && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
              {activeProd.generationProgress.stages.map((stg: any) => (
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
            id={item?.id || "p1"} 
            title={proposal.title} 
            scenes={proposal.storyboard} 
            durationText="3:20"
            onApprove={() => {
              if (item?.id) {
                approveReviewItem(item.id);
              }
              setApproved(true);
            }}
          />
        </div>

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
            <h3 className="text-base font-medium">Storyboard</h3>
            {expandedSections.has("storyboard") ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {expandedSections.has("storyboard") && (
            <div className="mt-4 space-y-3">
              {proposal.storyboard.map((scene: any) => (
                <div key={scene.scene} className="p-3 rounded-lg bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-accent/30 text-xs font-medium">
                      Scene {scene.scene}
                    </span>
                    <span className="text-xs text-muted-foreground">{scene.duration}</span>
                  </div>
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
        <div className="fixed bottom-36 left-4 right-4 bg-card border border-border px-4 py-3 rounded-xl flex items-center justify-between shadow-lg z-50 animate-pulse">
          <span className="text-xs text-foreground font-medium">{feedback}</span>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-safe shadow-2xl">
        <button
          onClick={() => {
            if (item?.id) {
              approveReviewItem(item.id);
            }
            setApproved(true);
          }}
          className="w-full py-5 bg-success hover:bg-success/90 active:bg-success/80 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-2 mb-3 shadow-lg transition-all active:scale-[0.98]"
        >
          <CheckCircle2 className="w-6 h-6" />
          Approve
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleAction("changes")}
            className="py-3 bg-accent hover:bg-accent/80 active:bg-accent/70 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            Changes
          </button>
          <button
            onClick={() => handleAction("regenerate")}
            className="py-3 bg-accent hover:bg-accent/80 active:bg-accent/70 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
          <button
            onClick={() => handleAction("reject")}
            className="py-3 bg-muted hover:bg-muted/80 active:bg-muted/70 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
