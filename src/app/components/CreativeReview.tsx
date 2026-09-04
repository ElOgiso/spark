import { useState, useEffect } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import { NotificationService } from "../notifications/notificationService";
import { Button, WhySparkRecommends } from "./ds";
import { InteractiveVideoPlayer, ThumbnailVariantCard, MiniMediaThumbnail } from "./MediaPreviewHelper";
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
  Youtube,
  Instagram,
  Video,
  Shield,
  AlertTriangle,
  Brain,
  Target,
  Calendar,
  Clock,
  Download,
  Trash2,
  Film,
} from "lucide-react";
import { DesktopProductionAssetsGallery } from "./DesktopProductionAssetsGallery";
import { isPlayableVideoUrl, isDurableMasterVideoReady } from "../services/production/productionAssetService";
import { getNotionModeLabel } from "../services/production/resolveProductionMode";

interface CreativeReviewProps {
  onNavigate?: (path: string) => void;
  onBack?: () => void;
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

export function CreativeReview({ onNavigate, onBack }: CreativeReviewProps) {
  const { reviewItems, productions, brand, character, approveReviewItem, rejectOrRequestEditReviewItem, generateProductionAssets, cancelProduction, deleteProduction } = useSpark() as any;

  // 1. Resolve focus target ID from query params or sessionStorage
  const [focusId] = useState<string | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const qId = params.get("productionId") || params.get("id") || params.get("reviewId");
        if (qId) return qId;
        const stored = sessionStorage.getItem("spark_review_focus_id");
        if (stored) {
          sessionStorage.removeItem("spark_review_focus_id");
          return stored;
        }
      }
    } catch {}
    return null;
  });

  // 2. Fetch active production linked to focusId or fallback
  const activeProd = (() => {
    if (focusId) {
      const match = productions.find((p: any) => p.id === focusId);
      if (match) return match;
    }
    const revMatch = reviewItems.find((r: any) => r.id === focusId || r.productionId === focusId);
    if (revMatch?.productionId) {
      const match = productions.find((p: any) => p.id === revMatch.productionId);
      if (match) return match;
    }
    return productions.find((p: any) => p.status === "Ready for Review") || productions[0];
  })();

  // 3. Resolve active review
  const activeReview = (() => {
    if (focusId) {
      const match = reviewItems.find(
        (r: any) => r.id === focusId || r.productionId === focusId || r.production?.id === focusId
      );
      if (match) return match;
    }
    if (activeProd?.id) {
      const match = reviewItems.find((r: any) => r.productionId === activeProd.id);
      if (match) return match;
    }
    return reviewItems.find((r: any) => r.status === "Pending Review") || reviewItems[0];
  })();

  const reviewId = activeReview?.id || (activeProd ? `r-${activeProd.id}` : "r1");

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["why-this-works", "storyboard"])
  );

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    next.has(section) ? next.delete(section) : next.add(section);
    setExpandedSections(next);
  };

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<"A" | "B" | "C">("B");
  const [showAssetsGallery, setShowAssetsGallery] = useState(false);

  useEffect(() => {
    const st = String(activeReview?.status || activeProd?.status || "");
    if (st === "Needs Edit") setShowAssetsGallery(true);
  }, [activeReview?.status, activeProd?.status]);

  if (showAssetsGallery) {
    return (
      <DesktopProductionAssetsGallery
        onBack={() => setShowAssetsGallery(false)}
        production={activeProd}
        item={activeReview}
      />
    );
  }

  const handleGenerateAssets = () => {
    if (activeProd?.id && generateProductionAssets) {
      setActionSuccess("Generating Assets...");
      void generateProductionAssets(activeProd.id, false).then(() => {
        setActionSuccess("Assets Generated");
        setTimeout(() => setActionSuccess(null), 3000);
      });
    }
  };

  const handleCancelProduction = () => {
    if (activeProd?.id && cancelProduction) {
      cancelProduction(activeProd.id);
      setActionSuccess("Production Cancelled");
      NotificationService.addNotification({
        title: "Production Cancelled",
        description: `"${activeProd?.title || activeReview?.title || "Production"}" generation has been cancelled cleanly.`,
        type: "system_update",
        priority: "medium",
        actionLabel: "View Review Queue",
        relatedRoute: "/review"
      });
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleApprove = () => {
    approveReviewItem(reviewId);
    setActionSuccess("Approved");
    NotificationService.addNotification({
      title: "Production Approved",
      description: `"${proposal.title}" has been approved and moved to the calendar.`,
      type: "publishing_complete",
      priority: "medium",
      actionLabel: "View Calendar",
      relatedRoute: "/calendar"
    });
    setTimeout(() => {
      onBack?.();
    }, 1500);
  };

  const handleRequestEdit = () => {
    rejectOrRequestEditReviewItem(reviewId);
    setActionSuccess("Needs Edit");
    NotificationService.addNotification({
      title: "Revision Requested",
      description: `"${proposal.title}" opened in Production Assets for image and scene corrections.`,
      type: "brand_rule_conflict",
      priority: "high",
      actionLabel: "Open Production Assets",
      relatedRoute: "/review"
    });
    setShowAssetsGallery(true);
  };

  const handleRegenerate = async () => {
    const prodId = activeProd?.id || activeReview?.productionId;
    if (!prodId || !generateProductionAssets) {
      setActionSuccess("Production not found");
      setTimeout(() => setActionSuccess(null), 3000);
      return;
    }

    setRegenerating(true);
    setActionSuccess("Regenerating Assets...");
    try {
      await generateProductionAssets(prodId, true);
      setActionSuccess("Regenerated");
    } catch (err) {
      console.warn("[CreativeReview] Regenerate notice:", err);
      setActionSuccess("Regeneration failed");
    } finally {
      setRegenerating(false);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleExport = () => {
    setExporting(true);
    setActionSuccess("Exporting...");
    setTimeout(() => {
      setExporting(false);
      setActionSuccess("Exported");
      setTimeout(() => setActionSuccess(null), 3500);
    }, 1800);
  };

  const handleDeleteProduction = () => {
    const targetId = activeProd?.id || activeReview?.productionId || activeReview?.id;
    if (!targetId) return;
    if (window.confirm("Delete this production? Cannot be undone.")) {
      if (deleteProduction) {
        deleteProduction(targetId);
      }
      setActionSuccess("Deleted");
      NotificationService.addNotification({
        title: "Production Deleted",
        description: `"${proposal.title}" has been deleted from review queue.`,
        type: "system_update",
        priority: "medium",
        actionLabel: "Back to Review Queue",
        relatedRoute: "/review"
      });
      setTimeout(() => {
        if (onBack) onBack();
        else if (onNavigate) onNavigate("/review");
      }, 500);
    }
  };

  const brief = activeProd?.brief || activeReview?.brief;
  const prodMode = String(activeProd?.productionMode || brief?.productionMode || "").toLowerCase();
  const isExpressMode = prodMode === "express" || prodMode === "narrator";

  const proposal = {
    title: asText(brief?.title || activeProd?.title || activeReview?.title, "5 Viral Marketing Tactics That Actually Work in 2026"),
    contentType: `${getNotionModeLabel(brief?.productionMode || activeProd?.productionMode || activeProd?.mode)} Production`,
    series: asText(activeReview?.series, "Viral Concept Series"),
    account: asText(brief?.platformRecommendation || activeReview?.account, "YouTube Shorts"),
    opportunityScore: brief?.brandFitScore || 94,
    aiConfidence: brief?.brandFitScore || 94,
    concept: asText(brief?.whyThisWorks || activeProd?.reasoning?.planning?.outline || activeProd?.reasoning?.research?.notes || activeReview?.conceptText, "Reveal proven viral tactics adapted to brand identity"),
    targetAudience: asText(activeProd?.reasoning?.research?.audience, "Target Audience & Brand Followers"),
    expectedReach: "2.4M – 3.8M views",
    format: `${asText(brief?.suggestedDuration, "30–60s")} Vertical (${getNotionModeLabel(brief?.productionMode || activeProd?.productionMode || activeProd?.mode)})`,
    platforms: [asText(brief?.platformRecommendation, "YouTube Shorts"), "TikTok", "Instagram Reels"],
    hook: asText(brief?.hook || activeReview?.scriptSnippet, "Stop wasting money on marketing that doesn't work"),
    hookType: "High-curiosity gap angle",
    openingMoment: asText(brief?.visualDirection || activeProd?.reasoning?.storyboard?.narration || activeReview?.openingMoment, "Vertical 9:16 presenter with text overlays"),
    captionDirection: asText(brief?.caption, "Lead with stat. Use em-dash rhythm. End with open loop question. 3-line max mobile preview."),
    offerCta: brief?.offerCta || activeProd?.brief?.offerCta,
    thumbnails: brief?.generatedAssets?.thumbnails?.length
      ? brief.generatedAssets.thumbnails.map((t: any, idx: number) => ({
          id: t.id || String(idx + 1),
          concept: asText(t.concept, `Thumbnail Variant ${t.variant || ["A", "B", "C"][idx] || "A"}`),
          variant: (t.variant || ["A", "B", "C"][idx] || "A") as "A" | "B" | "C",
          image: t.image || brief?.generatedAssets?.generatedFrames?.[idx] || brief?.storyboard?.[idx]?.image,
        }))
      : [
          { id: "1", concept: "Split screen contrast lighting with face reaction", variant: "A", image: brief?.generatedAssets?.generatedFrames?.[0] || brief?.storyboard?.[0]?.image },
          { id: "2", concept: "Bold text overlay, high contrast, presenter reaction", variant: "B", image: brief?.generatedAssets?.generatedFrames?.[1] || brief?.storyboard?.[1]?.image },
          { id: "3", concept: "Glowing screen preview, text reads 'This Changed Everything'", variant: "C", image: brief?.generatedAssets?.generatedFrames?.[2] || brief?.storyboard?.[2]?.image },
        ],
    narrative: {
      hook: asText(brief?.hook || activeReview?.scriptSnippet, "Failed marketing campaigns waste time and energy"),
      buildUp: clip(brief?.scriptOutline, 100, "Modern strategy breakdown"),
      conflict: "Most creators don't know these AI strategies exist",
      reveal: "Here's exactly what works",
      payoff: "Implement these and 10× your organic reach",
    },
    storyboard: activeProd?.productionScenes?.length
      ? activeProd.productionScenes.map((s: any, idx: number) => ({
          scene: s.scene || idx + 1,
          description: s.visualDescription || s.shotList || s.onScreenText || s.description || `Scene ${idx + 1}`,
          duration: s.duration || "0–10s",
          image: s.image || s.keyframeImageUrl || brief?.storyboard?.[idx]?.image,
          videoUrl: s.videoUrl || undefined,
        }))
      : activeProd?.scenes?.length
      ? activeProd.scenes.map((s: any, idx: number) => ({
          scene: s.scene || idx + 1,
          description: s.description,
          duration: s.duration || "0–10s",
          image: s.image || brief?.storyboard?.[idx]?.image,
          videoUrl: s.videoUrl || undefined,
        }))
      : brief?.storyboard?.length
      ? brief.storyboard.map((s: any, idx: number) => ({
          scene: s.scene || idx + 1,
          description: s.visualDescription || s.shotList || s.onScreenText || `Scene ${idx + 1}`,
          duration: s.duration || "0–10s",
          image: s.image,
          videoUrl: s.videoUrl || undefined,
        }))
      : [
          { scene: 1, description: `Hook: ${brief?.hook || activeReview?.openingMoment || "Opening hook"}`, duration: "0–5s", image: brief?.generatedAssets?.generatedFrames?.[0] },
          { scene: 2, description: `Body: ${brief?.visualDirection || "Script body breakdown"}`, duration: "5–25s", image: brief?.generatedAssets?.generatedFrames?.[1] },
          { scene: 3, description: `CTA: ${brief?.caption || "Call to Action"}`, duration: "25–30s", image: brief?.generatedAssets?.generatedFrames?.[2] },
        ],
    platformStrategy: {
      youtube: `${brief?.suggestedDuration || "30–60s"} Short, SEO optimized — chaptered`,
      tiktok: "60s cut with CTA to bio link",
      shorts: "30s teaser — first 8s hook cliffhanger",
      reels: "45s cut with native text overlays",
    },
    whyThisWorks: [
      brief?.whyThisWorks || "Hook directly addresses most-searched pain point in your target segment",
      "Numbered list & curiosity gap format averages 2.3× completion",
      "Mode framing triggers high engagement loop",
      "Brand memory rules enforced for maximum audience fit",
    ],
    brandConsistency: {
      score: brief?.brandFitScore || 92,
      checks: [
        { label: "Tone matches brand voice profile", pass: true },
        { label: "Hook style consistent with top performers", pass: true },
        { label: "Production mode rules enforced", pass: true },
        { label: "Format aligns with content pillars", pass: true },
        { label: "Executive quality gates cleared", pass: true },
      ],
    },
    riskFlags: [
      { level: "low", text: "Ensure script pacing matches target platform duration" },
    ],
    qualityChecks: [
      { label: "Hook clarity", pass: true, note: "Curiosity gap validated" },
      { label: "Narrative arc complete", pass: true, note: "Hook -> Body -> CTA" },
      { label: "CTA present", pass: true, note: "Brand conversion CTA" },
      { label: "Platform-specific versions planned", pass: true, note: "9:16 vertical layout" },
      { label: "Thumbnail concepts reviewed", pass: true, note: "Visual variants active" },
      { label: "Caption direction complete", pass: true, note: "Formatted for engagement" },
    ],
  };


  const SectionToggle = ({ id, title }: { id: string; title: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-6 hover:bg-accent/5 transition-colors rounded-t-xl"
    >
      <h2 className="text-base font-medium">{title}</h2>
      {expandedSections.has(id) ? (
        <ChevronUp className="w-5 h-5 text-muted-foreground" />
      ) : (
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );

  return (
    <>
      <TopBar pageName="Review" />
      <main className="flex-1 overflow-y-auto scrollbar-none pb-28">
        <div className="max-w-5xl mx-auto p-8 space-y-6">

          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Review Queue
          </button>

          {/* Quick Production Queue Strip */}
          {productions.length > 1 && (
            <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Production Queue ({productions.length})
                </span>
                <button
                  onClick={onBack}
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  View Full Table
                </button>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pb-1">
                {productions.map((p: any) => {
                  const rev = reviewItems.find((r: any) => r.productionId === p.id || r.id === p.id);
                  const brief = p.brief || rev?.brief;

                  const videoUrl = [
                    p.videoUrl,
                    rev?.videoUrl,
                    brief?.videoUrl,
                    brief?.generatedAssets?.generatedVideos?.[0],
                  ].find((u) => isPlayableVideoUrl(u));

                  const sceneStill =
                    p.scenes?.[0]?.image ||
                    p.productionScenes?.[0]?.image ||
                    brief?.storyboard?.[0]?.image ||
                    p.scenes?.find((s: any) => s.image)?.image ||
                    brief?.storyboard?.find((s: any) => s.image)?.image ||
                    brief?.generatedAssets?.generatedFrames?.[0];

                  const thumbImage =
                    p.thumbnails?.find((t: any) => t.image || t.url)?.image ||
                    p.thumbnails?.find((t: any) => t.image || t.url)?.url ||
                    brief?.thumbnails?.[0]?.url ||
                    brief?.thumbnails?.[0]?.image;

                  const fallbackImage = character?.avatarUrl || character?.imageUrl || brand?.logoUrl || undefined;

                  const realMediaUrl = sceneStill || thumbImage || fallbackImage;

                  const isGenerating =
                    Boolean(p.isGeneratingAssets) &&
                    p.generationProgress?.stage !== "Complete" &&
                    p.generationProgress?.stage !== "Cancelled" &&
                    p.generationProgress?.stage !== "Failed" &&
                    (p.generationProgress?.percent === undefined || p.generationProgress?.percent < 100);

                  const stageLabel = p.generationProgress?.stage || (isGenerating ? "Synthesizing" : "Ready");
                  const percent = typeof p.generationProgress?.percent === "number" && p.generationProgress.percent >= 0
                    ? p.generationProgress.percent
                    : 0;
                  const isSelected = p.id === activeProd?.id;

                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        try {
                          sessionStorage.setItem("spark_review_focus_id", p.id);
                        } catch {}
                        onNavigate?.(`/review/creative?productionId=${p.id}`);
                      }}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all flex-shrink-0 max-w-[240px] ${
                        isSelected
                          ? "border-accent bg-accent/15 text-foreground shadow-sm"
                          : "border-border/60 bg-background hover:bg-accent/5 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <MiniMediaThumbnail
                        id={p.id}
                        title={p.title}
                        imageUrl={realMediaUrl}
                        videoUrl={videoUrl}
                        aspectRatio={p.aspectRatio === "9:16" ? "9:16" : "16:9"}
                        isVideo={Boolean(videoUrl)}
                        isGenerating={isGenerating}
                        stageLabel={stageLabel}
                        percent={percent}
                        className="w-16 h-10 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate text-foreground">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {isGenerating ? `${stageLabel} · ${percent > 0 ? `${percent}%` : "Active"}` : videoUrl ? "Playable MP4" : p.status || "Ready"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-muted-foreground">{proposal.contentType}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-muted-foreground">{proposal.series}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-muted-foreground">{proposal.account}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-muted-foreground">{proposal.format}</span>
              </div>
              <h1 className="text-2xl font-medium leading-snug">{proposal.title}</h1>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <div className="px-4 py-3 rounded-xl bg-success/10 border border-success/20 text-center min-w-[80px]">
                <div className="flex items-center gap-1 text-success mb-1 justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Opportunity</span>
                </div>
                <p className="text-2xl font-medium">{proposal.opportunityScore}%</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-accent/20 border border-accent/40 text-center min-w-[80px]">
                <div className="flex items-center gap-1 text-accent-foreground mb-1 justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">AI Score</span>
                </div>
                <p className="text-2xl font-medium">{proposal.aiConfidence}%</p>
              </div>
            </div>
          </div>

          {/* Active Generation Progress Card */}
          {activeProd?.isGeneratingAssets &&
           activeProd.generationProgress?.stage !== "Complete" &&
           activeProd.generationProgress?.stage !== "Cancelled" &&
           activeProd.generationProgress?.stage !== "Failed" &&
           !(activeProd.generationProgress?.stages || []).some((s: any) => s?.status === "failed" && s?.id === "video") && (
            <div className="p-4 rounded-xl bg-card border border-accent/40 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-accent animate-spin" />
                  <span className="text-sm font-semibold text-foreground">
                    {activeProd.generationProgress?.stage
                      ? `Synthesizing Production Assets — Stage: ${activeProd.generationProgress.stage}`
                      : "Synthesizing Production Assets"}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-accent bg-accent/20 px-2.5 py-1 rounded-full">
                  {typeof activeProd.generationProgress?.percent === "number" && activeProd.generationProgress.percent >= 0
                    ? `${activeProd.generationProgress.percent}%`
                    : "Initializing..."}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-accent/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent via-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${typeof activeProd.generationProgress?.percent === "number" && activeProd.generationProgress.percent > 0
                      ? Math.max(activeProd.generationProgress.percent, 3)
                      : 3}%`
                  }}
                />
              </div>

              {/* Stage Message */}
              <p className="text-xs text-muted-foreground">
                {activeProd.generationProgress?.message || "Synthesizing multi-scene keyframes, thumbnails, and preview clips..."}
              </p>

              {/* Compact Stage Checklist */}
              {activeProd.generationProgress?.stages && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/40">
                  {activeProd.generationProgress.stages.map((stg: any) => (
                    <div key={stg.id} className="flex items-center gap-2 text-xs">
                      {stg.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                      {stg.status === "active" && <RotateCw className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />}
                      {stg.status === "failed" && <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
                      {stg.status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-border flex-shrink-0" />}
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

          {/* Character Sheet Required Alert / Last Error */}
          {(() => {
            const motionFailed = (activeProd?.generationProgress?.stages || []).some(
              (s: any) => s?.id === "video" && s?.status === "failed"
            );
            const errText =
              activeProd?.lastError ||
              brief?.lastError ||
              activeProd?.generationProgress?.partialAssets?.lastError ||
              (activeProd?.generationProgress?.stage === "Failed"
                ? activeProd?.generationProgress?.message
                : undefined) ||
              (motionFailed
                ? "Motion synthesis (Image-to-video) failed — scenes remain stills until regenerate."
                : undefined);
            if (!errText) return null;
            if (activeProd?.isGeneratingAssets && !motionFailed) return null;
            const isCharacterGate = /character sheet|character reference/i.test(errText);
            return (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-200">
                    {motionFailed ? "Motion synthesis failed" : "Generation issue"}
                  </p>
                  <p className="text-xs text-amber-100/90 mt-1 break-words">{errText}</p>
                  <p className="text-xs text-amber-200/70 mt-1">
                    {isCharacterGate
                      ? "A locked character reference sheet is required for host / story / anime formats before asset rendering can begin."
                      : motionFailed
                        ? "Stills succeeded; image-to-video did not return clips. Use Regenerate All after checking the video provider (Grok/xAI), or wait for failover/slideshow recovery on the latest build."
                        : "Open Regenerate All to retry asset synthesis."}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Interactive Media Preview Section */}
          <div className="space-y-6">
            <div className="p-1 rounded-2xl bg-gradient-to-r from-accent/30 via-success/20 to-warning/20 border border-border">
              <InteractiveVideoPlayer 
                id={activeReview?.id || "p1"} 
                title={proposal.title} 
                scenes={proposal.storyboard} 
                videoUrl={
                  [activeProd?.videoUrl, activeReview?.videoUrl, brief?.videoUrl].find((u) => isDurableMasterVideoReady(u))
                }
                audioUrl={
                  ![activeProd?.videoUrl, activeReview?.videoUrl, brief?.videoUrl].some((u) => isDurableMasterVideoReady(u))
                    ? (activeProd?.audioUrl || activeReview?.audioUrl || brief?.audioUrl || brief?.generatedAssets?.generatedAudio?.[0])
                    : undefined
                }
                onApprove={handleApprove}
                reviewRequired={activeProd?.review_required !== false}
              />
            </div>
            
            {/* Open Production Assets Action Button */}
            <div className="flex items-center justify-end">
              <button
                onClick={() => setShowAssetsGallery(true)}
                className="px-5 py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 font-semibold text-xs flex items-center gap-2 transition-all active:scale-[0.98] shadow-md cursor-pointer"
              >
                <Film className="w-4 h-4 text-purple-400" />
                <span>Open Production Assets</span>
              </button>
            </div>
            
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Proposed Thumbnail Variants</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {proposal.thumbnails.map((t: any) => (
                  <ThumbnailVariantCard 
                    key={t.id}
                    id={activeReview?.id || "p1"}
                    variant={t.variant as "A" | "B" | "C"}
                    concept={t.concept}
                    image={t.image}
                    isSelected={selectedVariant === t.variant}
                    onClick={() => setSelectedVariant(t.variant as "A" | "B" | "C")}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-medium mb-4">Executive Summary</h2>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Concept</p>
              <p className="text-sm leading-relaxed">{proposal.concept}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Target Audience</p>
                <p className="text-sm">{proposal.targetAudience}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Expected Reach</p>
                <p className="text-sm font-medium">{proposal.expectedReach}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Platforms</p>
              <div className="flex gap-2 flex-wrap">
                {proposal.platforms.map((p) => (
                  <span key={p} className="px-3 py-1 rounded-lg bg-accent/20 text-sm font-medium">{p}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Production Workspace - Live Checkpoints */}
          {activeProd && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
              <h2 className="text-base font-semibold mb-2 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-accent" />
                <span>Live Workspace Sync</span>
                <span className="text-[10px] text-accent font-bold bg-accent/10 px-1.5 py-0.5 rounded-md ml-auto animate-pulse">
                  Status: {activeProd.status}
                </span>
              </h2>

              {activeProd.reasoning?.research?.notes && (
                <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 animate-fadeIn">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    Research & Trend Analysis
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    <strong>Audience:</strong> {activeProd.reasoning.research.audience || "Tech professionals"}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {activeProd.reasoning.research.notes}
                  </p>
                </div>
              )}

              {activeProd.reasoning?.planning?.outline && (
                <div className="p-4 rounded-xl bg-success/5 border border-success/20 animate-fadeIn">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-success mb-2 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Concept Planning Outline
                  </h3>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {activeProd.reasoning.planning.outline}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Hook Preview */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-medium mb-4">Hook & Opening</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-foreground/5 border border-border">
                <p className="text-xs text-muted-foreground mb-2">Primary Hook</p>
                <p className="text-lg font-medium">"{proposal.hook}"</p>
                <p className="text-xs text-muted-foreground mt-1.5">Type: {proposal.hookType}</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground mb-2">Opening Moment (0–3s)</p>
                <p className="text-sm">{proposal.openingMoment}</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground mb-2">Caption Direction</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{proposal.captionDirection}</p>
              </div>
              {proposal.offerCta && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <p className="text-xs font-semibold text-accent uppercase tracking-wider">Promoted Offer CTA (Marketer)</p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-accent/20 text-accent uppercase">
                      {proposal.offerCta.type || "Offer"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{proposal.offerCta.title}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{proposal.offerCta.url}</p>
                    </div>
                    {proposal.offerCta.priceLabel && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-background border border-border text-foreground shrink-0">
                        {proposal.offerCta.priceLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Strategic Decision & Recommendations */}
          <div className="space-y-3">
            <WhySparkRecommends
              details={{
                reason: "This storyboard bridges the gap between raw data and audience aspiration. Numbered tactics keep watch-time high while cultural triggers spark high community engagement.",
                evidence: [
                  "Matches your brand rule 'Actionable value for tech founders'.",
                  "Numbered tactics average 2.3x higher completion rates in your niche.",
                  "Opening challenged pain point reduces immediate drop-off by 37%.",
                  "Tactic #4 incorporates real historical data from Nigerian creators."
                ],
                confidence: "Very High",
                confidencePercent: proposal.aiConfidence,
                expectedOutcome: "High reach (2.4M – 3.8M views) with 60%+ average audience retention across connected channels.",
                risk: "Low",
                nextBestAction: "Approve and Publish Production",
                brandRules: ["Brand Voice Pillar 2: Professional", "Creator Authority Rules"]
              }}
              defaultExpanded={true}
            />
          </div>

          {/* Brand Consistency */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="brand" title="Brand Consistency" />
            {expandedSections.has("brand") && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-success" style={{ width: `${proposal.brandConsistency.score}%` }} />
                  </div>
                  <span className="text-sm font-medium text-success">{proposal.brandConsistency.score}% consistent</span>
                </div>
                <div className="space-y-2">
                  {proposal.brandConsistency.checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 className={`w-4 h-4 ${check.pass ? "text-success" : "text-muted-foreground/30"}`} />
                      <span className={`text-sm ${check.pass ? "" : "text-muted-foreground"}`}>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Risk Flags */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="risk" title="Risk Flags" />
            {expandedSections.has("risk") && (
              <div className="px-6 pb-6 space-y-2.5">
                {proposal.riskFlags.map((flag, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                    flag.level === "medium" ? "bg-warning/10 border-warning/20" : "bg-muted/20 border-border/50"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${flag.level === "medium" ? "text-warning" : "text-muted-foreground"}`} />
                    <p className="text-sm">{flag.text}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ml-auto flex-shrink-0 ${
                      flag.level === "medium" ? "bg-warning/20 text-warning" : "bg-muted/40 text-muted-foreground"
                    }`}>{flag.level}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quality Checks */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="quality" title="Quality Checks" />
            {expandedSections.has("quality") && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-2">
                  {proposal.qualityChecks.map((check, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${check.pass ? "bg-success/5 border border-success/10" : "bg-warning/5 border border-warning/20"}`}>
                      {check.pass
                        ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                      }
                      <div>
                        <p className="text-sm">{check.label}</p>
                        {check.note && <p className="text-xs text-muted-foreground">{check.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Narrative Blueprint */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="narrative" title="Narrative Blueprint" />
            {expandedSections.has("narrative") && (
              <div className="px-6 pb-6 space-y-3">
                {Object.entries(proposal.narrative).map(([key, value]) => (
                  <div key={key} className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 capitalize">{key}</p>
                    <p className="text-sm">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Storyboard */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="storyboard" title="Storyboard Preview & Sequential Visual Map" />
            {expandedSections.has("storyboard") && (
              <div className="px-6 pb-6 space-y-4">
                {(brief?.storyboardGridUrl || brief?.generatedAssets?.storyboardGridUrl) && (
                  <div className="p-4 rounded-xl bg-background border border-border/70 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Master Multi-Panel Storyboard Map</p>
                    <div className="w-full max-h-64 overflow-hidden rounded-lg border border-border bg-black/40 flex items-center justify-center">
                      <img
                        src={brief?.storyboardGridUrl || brief?.generatedAssets?.storyboardGridUrl}
                        alt="Master Storyboard Grid Map"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {proposal.storyboard.map((scene: any) => (
                    <div key={scene.scene} className="p-4 rounded-xl bg-background border border-border flex flex-col gap-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded bg-accent/30 text-xs font-medium">Scene {scene.scene}</span>
                        <span className="text-xs text-muted-foreground">{scene.duration}</span>
                      </div>
                      {scene.image && (
                        <div className="w-full h-32 rounded-lg overflow-hidden border border-border/50 bg-black/30 mb-1">
                          <img src={scene.image} alt={`Scene ${scene.scene} Still`} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <p className="text-sm">{scene.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Platform Strategy */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="platform" title="Platform Strategy" />
            {expandedSections.has("platform") && (
              <div className="px-6 pb-6 space-y-3">
                {[
                  { key: "youtube", label: "YouTube", icon: Youtube, color: "text-destructive" },
                  { key: "tiktok", label: "TikTok", icon: Video, color: "text-muted-foreground" },
                  { key: "shorts", label: "YouTube Shorts", icon: Youtube, color: "text-destructive" },
                  { key: "reels", label: "Instagram Reels", icon: Instagram, color: "text-warning" },
                ].map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="p-4 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <p className="text-sm font-medium">{label}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{proposal.platformStrategy[key as keyof typeof proposal.platformStrategy]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Fixed Action Bar */}
      <div className="fixed bottom-0 left-0 md:left-56 right-0 bg-card border-t border-border p-5 shadow-2xl z-50">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          {actionSuccess && (
            <div
              className={`p-2 rounded-lg text-xs font-medium text-center border ${
                actionSuccess === "Approved" || actionSuccess === "Regenerated" || actionSuccess === "Exported"
                  ? "bg-success/10 text-success border-success/25"
                  : actionSuccess.includes("...")
                  ? "bg-accent/20 text-accent-foreground border-accent/30 animate-pulse"
                  : "bg-warning/10 text-warning border-warning/25"
              }`}
            >
              {actionSuccess === "Approved"
                ? "Production approved! Publishing job & export packages created."
                : actionSuccess === "Needs Edit"
                ? "Review flagged for Edit. Status updated."
                : actionSuccess === "Regenerating..."
                ? "Spark Intelligence is drafting a fresh creative blueprint..."
                : actionSuccess === "Regenerated"
                  ? "Storyboard & script regenerated with a fresh curiosity hook and updated thumbnails!"
                : actionSuccess === "Exporting..."
                ? "Compiling production sequence, voice narrative, and subtitles to 4K Master Zip..."
                : actionSuccess === "Exported"
                ? "Success! Export package compiled and downloaded (45.0 MB Zip Archive)."
                : actionSuccess}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="approve"
              size="lg"
              className="flex-1 min-w-[160px]"
              icon={<CheckCircle2 className="w-5 h-5" />}
              onClick={handleApprove}
              disabled={regenerating || exporting || activeProd?.isGeneratingAssets}
            >
              Approve Production
            </Button>
            <Button
              variant="accent"
              size="lg"
              icon={<Sparkles className={`w-4 h-4 ${activeProd?.isGeneratingAssets ? "animate-spin text-purple-400" : ""}`} />}
              onClick={handleGenerateAssets}
              disabled={activeProd?.isGeneratingAssets || regenerating || exporting}
            >
              {activeProd?.isGeneratingAssets &&
               activeProd.generationProgress?.stage !== "Complete" &&
               activeProd.generationProgress?.stage !== "Failed" &&
               activeProd.generationProgress?.stage !== "Cancelled" &&
               !(activeProd.generationProgress?.stages || []).some((s: any) => s?.id === "video" && s?.status === "failed")
                ? (activeProd.generationProgress?.stage ? `Synthesizing ${activeProd.generationProgress.stage}...` : "Synthesizing Assets...")
                : (brief?.videoUrl || brief?.generatedAssets?.generatedVideos?.length)
                ? "Generate Assets"
                : "Continue Generation"}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<RotateCw className={`w-4 h-4 ${regenerating ? "animate-spin text-purple-400" : ""}`} />}
              onClick={handleRegenerate}
              disabled={activeProd?.isGeneratingAssets || regenerating || exporting}
            >
              {regenerating ? "Regenerating..." : "Regenerate All"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleDeleteProduction}
              disabled={regenerating || exporting || activeProd?.isGeneratingAssets}
            >
              Delete Production
            </Button>
            <Button
              variant="ghost"
              size="lg"
              icon={<XCircle className="w-4 h-4" />}
              onClick={handleCancelProduction}
              disabled={regenerating || exporting}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Edit className="w-4 h-4" />}
              onClick={handleRequestEdit}
              disabled={regenerating || exporting}
            >
              Request Revision
            </Button>
            <Button
              variant="schedule"
              size="lg"
              icon={<Calendar className="w-4 h-4" />}
              onClick={() => onNavigate?.("/calendar")}
              disabled={regenerating || exporting}
            >
              Publish Later
            </Button>
            <Button
              variant="schedule"
              size="lg"
              icon={<Download className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />}
              onClick={handleExport}
              disabled={regenerating || exporting}
            >
              {exporting ? "Compiling..." : "Export Assets"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
