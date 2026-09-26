/**
 * Phase 20 — user-facing production language.
 * Presentation only. Pricing comes from the canonical credit policy.
 * Status copy does not own transitions.
 */
import { convertUsdToCredits } from "../credits/pricingPolicy";
import {
  getNotionModeLabel,
  normalizeModeString,
  type ResolvedMode,
} from "../resolveProductionMode";

export const LOCKED_PRIMARY_NAV = [
  { id: "spark", label: "SPARK", path: "/" },
  { id: "my-spark", label: "MY SPARK", path: "/my-spark" },
  { id: "viral-sparks", label: "VIRAL SPARKS", path: "/viral-sparks" },
  { id: "review", label: "REVIEW", path: "/review" },
  { id: "calendar", label: "CALENDAR", path: "/calendar" },
  { id: "analytics", label: "ANALYTICS", path: "/analytics" },
  { id: "more", label: "MORE", path: "/more" },
] as const;

export const USER_MODE_COPY: Record<
  ResolvedMode,
  { label: "Narrator" | "Hybrid" | "Cinematic"; description: string }
> = {
  express: {
    label: "Narrator",
    description: "Voice-led production with efficient visual coverage.",
  },
  standard: {
    label: "Hybrid",
    description:
      "Selective generated motion for high-impact moments plus efficient supporting visuals.",
  },
  deep: {
    label: "Cinematic",
    description:
      "Storyboard-driven production with deeper continuity, references, keyframes and video coverage.",
  },
};

export const AUTOMATION_USER_LABELS = {
  manual: "Manual Review Required",
  balanced: "Approval Required",
  autonomous: "Autonomous",
} as const;

export const NO_PERFORMANCE_DATA = "No performance data yet.";
export const ANALYTICS_EMPTY_COPY =
  "Performance data appears after published content starts receiving analytics.";
export const ESTIMATE_DISCLAIMER =
  "Estimated from current production plan. Final usage may vary if retries or repairs are required.";
export const UNKNOWN_SUBMISSION_COPY =
  "SPARK is confirming whether this generation completed before retrying.";

export function userModePresentation(raw?: string | null) {
  const key = normalizeModeString(raw) || "standard";
  const copy = USER_MODE_COPY[key];
  return {
    key,
    label: copy.label,
    description: copy.description,
    matchesCanonicalLabel: copy.label === getNotionModeLabel(raw),
  };
}

export type CreditEstimateView =
  | {
      kind: "known";
      credits: number;
      label: string;
      disclaimer: string;
    }
  | { kind: "unknown"; label: "Estimate unavailable" };

/** Never render unknown economics as 0 credits or Free. */
export function presentFromCostEstimate(
  estimate: { amount: number | null; status?: string } | null | undefined,
): CreditEstimateView {
  if (!estimate || estimate.amount == null || !Number.isFinite(estimate.amount)) {
    return { kind: "unknown", label: "Estimate unavailable" };
  }
  if (String(estimate.status || "").toUpperCase() === "UNKNOWN") {
    return { kind: "unknown", label: "Estimate unavailable" };
  }
  if (estimate.amount < 0) {
    return { kind: "unknown", label: "Estimate unavailable" };
  }
  const credits = convertUsdToCredits(estimate.amount);
  return {
    kind: "known",
    credits,
    label: `\u2248 ${credits} Spark Credits`,
    disclaimer: ESTIMATE_DISCLAIMER,
  };
}

export function presentInsufficientCredits(available: number, required: number | null) {
  if (required == null) {
    return { blocked: false as const, reason: "estimate_unknown" as const };
  }
  if (!Number.isFinite(available) || available < required) {
    return {
      blocked: true as const,
      title: "Not enough Spark Credits" as const,
      available: Number.isFinite(available) ? available : 0,
      required,
    };
  }
  return { blocked: false as const };
}

export const ESTIMATE_REQUIRED_COPY = "Estimate unavailable. SPARK will not spend until a price is attached.";

export function presentGenerateSpendGate(
  estimate: CreditEstimateView,
  available: number,
  signedIn: boolean,
):
  | { blocked: true; reason: "estimate_unknown"; title: string }
  | { blocked: true; reason: "insufficient"; title: "Not enough Spark Credits"; available: number; required: number }
  | { blocked: false; reason: "ok"; credits: number; label: string } {
  if (estimate.kind !== "known") {
    return { blocked: true, reason: "estimate_unknown", title: ESTIMATE_REQUIRED_COPY };
  }
  if (signedIn) {
    const credits = presentInsufficientCredits(available, estimate.credits);
    if (credits.blocked) {
      return {
        blocked: true,
        reason: "insufficient",
        title: credits.title,
        available: credits.available,
        required: credits.required,
      };
    }
  }
  return { blocked: false, reason: "ok", credits: estimate.credits, label: estimate.label };
}

export function confirmPricedGeneration(label: string): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(`Use ${label} to generate this production? Final usage may vary if retries are required.`);
}

export function coverFrameIsAvailable(production?: {
  status?: string;
  videoUrl?: string;
  isGeneratingAssets?: boolean;
  brief?: { videoUrl?: string } | null;
} | null): boolean {
  if (!production || production.isGeneratingAssets) return false;
  const status = String(production.status || "");
  if (status === "Ready for Review" || status === "Approved" || status === "Published") return true;
  return Boolean(production.videoUrl || production.brief?.videoUrl);
}

export function presentBrandLock(input?: {
  brandName?: string | null;
  brandId?: string | null;
  styleProvenance?: Record<string, string> | null;
} | null): { locked: boolean; label: string } {
  const brandLocked = Boolean(input?.brandId || input?.brandName);
  const bibleLocked = Object.values(input?.styleProvenance || {}).some((value) => value === "BRAND");
  if (!brandLocked && !bibleLocked) return { locked: false, label: "" };
  const name = input?.brandName?.trim();
  return {
    locked: true,
    label: name
      ? `Brand lock on ${name}. Logo, palette, and type stay on the Style Bible. Do not redraw an approved mark.`
      : "Brand look is locked on the Style Bible. Do not redraw an approved mark.",
  };
}

export function userSafeGenerationMessage(raw?: string | null): string {
  const text = String(raw || "");
  const upper = text.toUpperCase();
  if (upper.includes("UNKNOWN_SUBMISSION") || upper.includes("SUBMISSION_UNKNOWN") || /unknown submission/i.test(text)) {
    return UNKNOWN_SUBMISSION_COPY;
  }
  if (/credit/i.test(text) || /402/.test(text)) {
    return "Not enough Spark Credits";
  }
  if (/continu/i.test(text) || /\bqc\b/i.test(text)) {
    return "Quality check found a continuity issue.";
  }
  if (/reconcil/i.test(text)) {
    return "SPARK is reconciling this generation before retrying.";
  }
  if (!text.trim()) return "Visual generation needs another attempt.";
  if (text.length > 180 || /stack|Error:|at \w+\(/.test(text)) {
    return "Visual generation needs another attempt.";
  }
  return text;
}

export function allowsUnsafeRetry(submissionState?: string | null): boolean {
  const value = String(submissionState || "").toUpperCase();
  if (!value) return true;
  if (value.includes("UNKNOWN_SUBMISSION") || value.includes("SUBMISSION_UNKNOWN")) return false;
  if (value === "UNKNOWN") return false;
  return true;
}

/** Measured analytics only. Missing evidence is empty, never a fabricated score. */
export function measuredPerformance<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows : [];
}

export function submissionEvidence(parts: Array<string | null | undefined>): string {
  return parts.filter((part) => typeof part === "string" && part.trim()).join(" ");
}

const STAGE_RULES: Array<[RegExp, string]> = [
  [/unknown submission|confirming whether/i, "Checking generation status"],
  [/plan|initial|script|brief/i, "Planning"],
  [/still|keyframe|storyboard|image|visual|prepar/i, "Preparing visuals"],
  [/video|motion|clip/i, "Generating media"],
  [/voice|audio|narrat|music|caption/i, "Building audio"],
  [/qc|quality|continu/i, "Checking quality"],
  [/merge|master|final|assembl/i, "Finalizing"],
  [/review|complete|done/i, "Ready for review"],
  [/fail|cancel|error/i, "Action required"],
];

/** Progress copy from a real lifecycle record. Missing percent stays indeterminate. */
export function presentLifecycleProgress(progress?: {
  percent?: number | null;
  stage?: string | null;
  message?: string | null;
} | null): { stage: string; percent: number | null; indeterminate: boolean } {
  const raw = `${progress?.stage || ""} ${progress?.message || ""}`.trim();
  let stage = raw ? "Generating" : "Planning";
  if (raw) {
    const hit = STAGE_RULES.find(([rule]) => rule.test(raw));
    if (hit) stage = hit[1];
    else if (String(progress?.stage || "").length > 0 && String(progress?.stage || "").length <= 48) {
      stage = String(progress?.stage);
    }
  }
  const percent =
    typeof progress?.percent === "number" &&
    Number.isFinite(progress.percent) &&
    progress.percent >= 0 &&
    progress.percent <= 100
      ? progress.percent
      : null;
  return { stage, percent, indeterminate: percent == null };
}

/** Only an estimate object already attached by CostEngine. Never invent USD. */
export function readAttachedCostEstimate(source: unknown): { amount: number | null; status?: string } | null {
  if (!source || typeof source !== "object") return null;
  const root = source as Record<string, any>;
  const candidates = [
    root.costEstimate,
    root.estimatedCost,
    root.economics?.estimate,
    root.reasoning?.economics?.estimate,
    root.generationProgress?.costEstimate,
    root.brief?.costEstimate,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && ("amount" in candidate || "status" in candidate)) {
      const amount = typeof candidate.amount === "number" ? candidate.amount : null;
      return { amount, status: typeof candidate.status === "string" ? candidate.status : undefined };
    }
  }
  return null;
}

export function reviewStatusAfterMaster(production?: {
  lastError?: string | null;
  generationProgress?: { message?: string | null; stage?: string | null } | null;
  reasoning?: {
    lifecycle?: { deliverableReady?: boolean; completed?: boolean } | null;
    qc?: { passed?: boolean } | null;
  } | null;
} | null): "Ready for Review" | "Needs Edit" | "Checking Quality" {
  const evidence = submissionEvidence([
    production?.lastError,
    production?.generationProgress?.message,
    production?.generationProgress?.stage,
  ]);
  if (!allowsUnsafeRetry(evidence)) return "Checking Quality";
  if (production?.reasoning?.qc?.passed === false) return "Needs Edit";
  if (production?.reasoning?.lifecycle?.deliverableReady === true) return "Ready for Review";
  return "Checking Quality";
}

export function presentLedgerEntry(entry: {
  delta?: number | null;
  type?: string | null;
  reason?: string | null;
} | null | undefined): { label: string; signed: string } | null {
  if (!entry || entry.delta == null || !Number.isFinite(Number(entry.delta)) || Number(entry.delta) === 0) {
    return null;
  }
  const delta = Number(entry.delta);
  const type = String(entry.type || "").toUpperCase();
  const reason = String(entry.reason || "");
  let label = "Credit activity";
  if (/REFUND/.test(type) || /refund/i.test(reason)) label = "Refund";
  else if (delta < 0 || /CONSUM|SETTLE|RESERV|SPEND|DEBIT/.test(type)) label = "Production generation";
  else if (delta > 0) label = "Credit purchase/grant";
  return { label, signed: `${delta > 0 ? "+" : ""}${delta}` };
}
