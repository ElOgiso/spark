/**
 * Home + Review-queue card helpers.
 * Playable video face + CreativeReview focus (sessionStorage + SPA query).
 * Does not invent a router — App already splits currentPage on "?" .
 */
import { isPlayableVideoUrl } from "./productionAssetService";
import {
  resolveCanonicalMasterVideoUrl,
  resolveImmediatePlayableVideoUrl,
} from "./canonicalProductionMedia";

export const SPARK_REVIEW_FOCUS_KEY = "spark_review_focus_id";

export function parseProductionIdFromPage(page?: string | null): string | null {
  if (!page || typeof page !== "string") return null;
  const qIndex = page.indexOf("?");
  if (qIndex < 0) return null;
  try {
    const params = new URLSearchParams(page.slice(qIndex + 1));
    return params.get("productionId") || params.get("id") || params.get("reviewId");
  } catch {
    return null;
  }
}

export function readSparkReviewFocusId(currentPage?: string | null): string | null {
  try {
    if (typeof sessionStorage !== "undefined") {
      const stored = sessionStorage.getItem(SPARK_REVIEW_FOCUS_KEY);
      if (stored && stored.trim()) {
        sessionStorage.removeItem(SPARK_REVIEW_FOCUS_KEY);
        return stored.trim();
      }
    }
  } catch {}
  const fromPage = parseProductionIdFromPage(currentPage);
  if (fromPage) return fromPage;
  try {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("productionId") || params.get("id") || params.get("reviewId");
    }
  } catch {}
  return null;
}

export function openProductionReviewDetail(
  onNavigate: ((path: string) => void) | undefined,
  productionId?: string | null
) {
  const id = String(productionId || "").trim();
  if (!id) return;
  try {
    sessionStorage.setItem(SPARK_REVIEW_FOCUS_KEY, id);
  } catch {}
  onNavigate?.(`/review/creative?productionId=${encodeURIComponent(id)}`);
}

function isHttpPlayableVideo(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return isPlayableVideoUrl(trimmed);
}

/** Card/queue face: playable http(s) video, never a still when a video exists (provider or Spark). */
export function resolveCardPlayableVideoUrl(
  production?: any,
  extras?: { review?: any; brief?: any }
): string | undefined {
  const immediate = resolveImmediatePlayableVideoUrl(production, extras);
  if (isHttpPlayableVideo(immediate)) return immediate;
  return undefined;
}
