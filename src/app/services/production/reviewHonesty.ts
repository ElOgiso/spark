/**
 * Honest Review presentation helpers.
 * Only surface real Spec/brief/media facts — never invent QC passes or narrative beats.
 */

export type ReviewAspectMode = "landscape" | "portrait";

export function resolveReviewAspectMode(params: {
  aspectRatio?: string | null;
  formatSettings?: { aspectMode?: string } | null;
  brief?: { formatSettings?: { aspectMode?: string }; aspectRatio?: string } | null;
}): ReviewAspectMode {
  const ar = String(params.aspectRatio || params.brief?.aspectRatio || "").trim();
  const mode = String(
    params.formatSettings?.aspectMode || params.brief?.formatSettings?.aspectMode || ""
  ).toLowerCase();
  if (ar === "16:9" || mode === "landscape") return "landscape";
  if (ar === "9:16" || mode === "portrait" || mode === "vertical") return "portrait";
  // Default short-form portrait when unspecified
  return "portrait";
}

/** Frame classes: full image visible (contain), production aspect, no crop. */
export function reviewMediaFrameClass(aspect: ReviewAspectMode, opts?: { dense?: boolean }): string {
  const aspectCls = aspect === "landscape" ? "aspect-video" : "aspect-[9/16]";
  const maxH = opts?.dense
    ? aspect === "landscape"
      ? "max-h-48"
      : "max-h-72"
    : aspect === "landscape"
      ? "max-h-[28rem]"
      : "max-h-[36rem]";
  return `w-full ${aspectCls} ${maxH} mx-auto rounded-lg overflow-hidden border border-border/50 bg-black/40 flex items-center justify-center`;
}

export function reviewMediaImgClass(): string {
  return "max-w-full max-h-full w-auto h-auto object-contain";
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Narrative from brief/Spec beats only — omit invented conflict/reveal/payoff. */
export function buildHonestNarrativeBlueprint(params: {
  brief?: any;
  production?: any;
}): Array<{ key: string; label: string; value: string }> {
  const brief = params.brief || {};
  const rows: Array<{ key: string; label: string; value: string }> = [];

  const hook = text(brief.hook);
  if (hook) rows.push({ key: "hook", label: "Hook", value: hook });

  const outline = text(brief.scriptOutline);
  if (outline) rows.push({ key: "outline", label: "Script outline", value: outline.slice(0, 400) });

  const beats = Array.isArray(brief.beats) ? brief.beats : [];
  beats.forEach((b: any, i: number) => {
    const spoken = text(b.spokenLines || b.scriptSnippet || b.line);
    const job = text(b.valueJob || b.role || `Beat ${i + 1}`);
    const visual = text(b.visualDescription || b.visual);
    const parts = [spoken, visual].filter(Boolean);
    if (parts.length) {
      rows.push({
        key: `beat_${i + 1}`,
        label: `Beat ${i + 1}${job ? ` · ${job}` : ""}`,
        value: parts.join(" — "),
      });
    }
  });

  const cta = text(brief.spokenCta || brief.offerCta || brief.caption);
  if (cta) rows.push({ key: "cta", label: "CTA", value: cta });

  const visual = text(brief.visualDirection);
  if (visual && !rows.some((r) => r.value === visual)) {
    rows.push({ key: "visual", label: "Visual direction", value: visual });
  }

  return rows;
}

export type HonestCheck = {
  label: string;
  status: "pass" | "fail" | "pending" | "info";
  note: string;
};

/** Factual media/presence checks — never fake green QC when lifecycle QC did not run. */
export function buildHonestQualityChecks(params: {
  reviewView?: { qcSummary?: Array<{ label: string; status: string; detail?: string }> } | null;
  mediaView?: {
    storyboardGridUrl?: string;
    scenes?: Array<{ imageUrl?: string; videoUrl?: string }>;
    isGenerating?: boolean;
    canonical?: { canonicalMasterUrl?: string };
  } | null;
  brief?: any;
  production?: any;
}): HonestCheck[] {
  const qc = params.reviewView?.qcSummary || [];
  const evaluated = qc.filter(
    (c) => c.status && c.status !== "not_evaluated" && c.status !== "not_analyzed"
  );
  if (evaluated.length > 0) {
    return evaluated.map((c) => ({
      label: c.label,
      status: c.status === "pass" ? "pass" : c.status === "fail" ? "fail" : "info",
      note: c.detail || c.status,
    }));
  }

  const brief = params.brief || {};
  const mv = params.mediaView;
  const scenes = mv?.scenes || [];
  const stillCount = scenes.filter((s) => s.imageUrl).length;
  const clipCount = scenes.filter((s) => s.videoUrl).length;
  const master = mv?.canonical?.canonicalMasterUrl || brief.videoUrl || brief.canonicalMasterUrl;
  const sheet = mv?.storyboardGridUrl || brief.storyboardGridUrl || brief.generatedAssets?.storyboardGridUrl;
  const thumbs = Array.isArray(brief.generatedAssets?.thumbnails)
    ? brief.generatedAssets.thumbnails.filter((t: any) => t?.image || t?.url).length
    : 0;
  const hook = text(brief.hook);
  const voice = brief.audioUrl || brief.generatedAssets?.generatedAudio?.[0];

  const checks: HonestCheck[] = [
    {
      label: "Spoken hook",
      status: hook.length >= 12 ? "pass" : "fail",
      note: hook.length >= 12 ? "Host line present on brief" : "Missing spoken hook on brief",
    },
    {
      label: "Storyboard sheet",
      status: sheet ? "pass" : mv?.isGenerating ? "pending" : "info",
      note: sheet
        ? "Multi-panel sheet URL present"
        : mv?.isGenerating
          ? "Generating…"
          : "No storyboard sheet on this production yet",
    },
    {
      label: "Scene stills",
      status: stillCount > 0 ? "pass" : mv?.isGenerating ? "pending" : "info",
      note:
        stillCount > 0
          ? `${stillCount} still${stillCount === 1 ? "" : "s"} available`
          : mv?.isGenerating
            ? "Generating…"
            : "No scene stills generated",
    },
    {
      label: "Motion / master",
      status: master || clipCount > 0 ? "pass" : mv?.isGenerating ? "pending" : "info",
      note: master
        ? "Canonical master present"
        : clipCount > 0
          ? `${clipCount} scene clip${clipCount === 1 ? "" : "s"} present`
          : "No master or scene clips yet",
    },
    {
      label: "Voiceover",
      status: voice ? "pass" : "info",
      note: voice ? "Audio URL present" : "No voice asset on brief (may be cinematic / skipped)",
    },
    {
      label: "Thumbnail variants",
      status: thumbs > 0 ? "pass" : "info",
      note: thumbs > 0 ? `${thumbs} generated variant${thumbs === 1 ? "" : "s"}` : "No thumbnail images generated",
    },
    {
      label: "Pipeline QC / critic",
      status: "info",
      note: "Full QC/repair loop not run on this Create→Generate path",
    },
  ];
  return checks;
}

/** Platforms actually attached to the production — no invented TikTok/Reels playbooks. */
export function buildHonestPlatformStrategy(params: {
  production?: any;
  brief?: any;
}): Array<{ key: string; label: string; value: string }> {
  const brief = params.brief || {};
  const prod = params.production || {};
  const duration =
    text(brief.suggestedDuration) ||
    (typeof prod.targetDurationSec === "number" ? `${prod.targetDurationSec}s` : "") ||
    (typeof brief.formatSettings?.targetDurationSec === "number"
      ? `${brief.formatSettings.targetDurationSec}s`
      : "");
  const aspect = text(prod.aspectRatio) || text(brief.aspectRatio) || "9:16";
  const mode = text(prod.mode || prod.productionMode || brief.productionMode) || "standard";

  const formats: string[] = [];
  if (Array.isArray(prod.formats)) {
    for (const f of prod.formats) {
      if (typeof f === "string" && f.trim()) formats.push(f.trim());
    }
  }
  const rec = text(brief.platformRecommendation || prod.platform);
  if (rec && !formats.some((f) => f.toLowerCase() === rec.toLowerCase())) {
    formats.unshift(rec);
  }
  if (formats.length === 0) {
    formats.push(aspect === "16:9" ? "YouTube" : "YouTube Shorts");
  }

  return formats.map((label, i) => ({
    key: `platform_${i}`,
    label,
    value: [
      duration ? `Target length: ${duration}` : null,
      `Aspect: ${aspect}`,
      `Production mode: ${mode}`,
      "Cut / publish plan follows this production's format settings — not a separate invented multi-platform script.",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}

export function buildHonestWhyThisWorks(params: { brief?: any; production?: any }): string[] {
  const brief = params.brief || {};
  const items: string[] = [];
  const why = text(brief.whyThisWorks);
  if (why) items.push(why);
  const research = text(params.production?.reasoning?.research?.notes);
  if (research) items.push(research.slice(0, 280));
  const audience = text(params.production?.reasoning?.research?.audience);
  if (audience) items.push(`Audience: ${audience}`);
  if (items.length === 0) {
    items.push("No separate “why this works” rationale was stored on this brief.");
  }
  return items;
}

export function buildHonestBrandConsistency(params: {
  brief?: any;
  brand?: any;
}): { score: number | null; checks: HonestCheck[] } {
  const score =
    typeof params.brief?.brandFitScore === "number" ? params.brief.brandFitScore : null;
  const checks: HonestCheck[] = [
    {
      label: "Brand fit score on spark/brief",
      status: score == null ? "info" : score >= 70 ? "pass" : "fail",
      note: score == null ? "No brandFitScore stored" : `${score}/100`,
    },
    {
      label: "Brand name on workspace",
      status: text(params.brand?.name) ? "pass" : "info",
      note: text(params.brand?.name) || "Brand name missing",
    },
    {
      label: "Content format setting",
      status: text(params.brief?.formatSettings?.contentFormat || params.brand?.contentFormat)
        ? "pass"
        : "info",
      note:
        text(params.brief?.formatSettings?.contentFormat || params.brand?.contentFormat) ||
        "Using default host path when unset",
    },
  ];
  return { score, checks };
}

export function buildHonestThumbnails(brief?: any): Array<{
  id: string;
  concept: string;
  variant: "A" | "B" | "C" | string;
  image?: string;
}> {
  const list = brief?.generatedAssets?.thumbnails;
  if (!Array.isArray(list) || list.length === 0) return [];
  return list
    .map((t: any, idx: number) => {
      const image = t.image || t.url;
      if (!image || typeof image !== "string") return null;
      return {
        id: String(t.id || idx + 1),
        concept: text(t.concept) || `Thumbnail variant ${t.variant || idx + 1}`,
        variant: (t.variant || ["A", "B", "C"][idx] || String(idx + 1)) as string,
        image,
      };
    })
    .filter(Boolean) as any[];
}
