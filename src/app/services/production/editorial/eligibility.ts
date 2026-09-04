/**
 * QC-aware eligibility for editorial assembly — consumes Phase 5 results; does not re-run QC.
 */

import type { ProductionAsset } from "../../../domain/types";
import type { ShotSpec } from "../specification/shotSpec";
import type { ProductionQcVerdict } from "../qc/types";
import type { EditorialClipStatus } from "./types";

export interface ShotEligibility {
  shotId: string;
  eligible: boolean;
  status: EditorialClipStatus;
  reason: string;
  asset?: ProductionAsset;
}

export interface EditorialEntryPolicy {
  /** Allow provisional clips when QC says needs_review */
  allowProvisional: boolean;
  /** Allow manually approved exceptions even if QC failed */
  allowManualException: boolean;
}

export const DEFAULT_ENTRY_POLICY: EditorialEntryPolicy = {
  allowProvisional: false,
  allowManualException: true,
};

function assetUsable(asset: ProductionAsset | undefined): boolean {
  return Boolean(
    asset &&
      asset.status === "completed" &&
      (asset.publicUrl || asset.storagePath) &&
      asset.assetType !== "thumbnail"
  );
}

/**
 * Select best asset for a shot — prefers newest completed video, then image.
 */
export function selectAssetForShot(
  shotId: string,
  assets: ProductionAsset[]
): ProductionAsset | undefined {
  const candidates = assets
    .filter((a) => a.shotId === shotId && assetUsable(a))
    .sort((a, b) => {
      const ta = a.createdAt || "";
      const tb = b.createdAt || "";
      return tb.localeCompare(ta);
    });
  return (
    candidates.find((a) => a.assetType === "video") ||
    candidates.find((a) => a.assetType === "image" || a.assetType === "frame") ||
    candidates[0]
  );
}

export function evaluateShotEligibility(params: {
  shot: ShotSpec;
  assets: ProductionAsset[];
  qcVerdict?: ProductionQcVerdict;
  policy?: EditorialEntryPolicy;
  manualExceptionShotIds?: Set<string>;
}): ShotEligibility {
  const policy = params.policy || DEFAULT_ENTRY_POLICY;
  const shot = params.shot;
  const asset = selectAssetForShot(shot.id, params.assets);
  const manual = params.manualExceptionShotIds?.has(shot.id);

  if (params.qcVerdict === "production_failed" && !manual) {
    return {
      shotId: shot.id,
      eligible: false,
      status: "excluded",
      reason: "production QC failed — editorial entry blocked",
      asset,
    };
  }

  if (shot.qcStatus === "fail" && !manual) {
    return {
      shotId: shot.id,
      eligible: false,
      status: "excluded",
      reason: "shot QC failed",
      asset,
    };
  }

  if (shot.generationStatus === "qc_failed" && !manual) {
    return {
      shotId: shot.id,
      eligible: false,
      status: "excluded",
      reason: "generation marked qc_failed",
      asset,
    };
  }

  if (manual && policy.allowManualException) {
    if (!assetUsable(asset)) {
      return {
        shotId: shot.id,
        eligible: false,
        status: "missing",
        reason: "manual exception but no usable asset",
      };
    }
    return {
      shotId: shot.id,
      eligible: true,
      status: "manual_exception",
      reason: "manually approved exception",
      asset,
    };
  }

  if (!assetUsable(asset)) {
    // Fall back to shot.mediaUrl as soft reference (legacy path)
    if (shot.mediaUrl) {
      const provisional =
        shot.qcStatus === "retry" ||
        shot.generationStatus === "qc_pending" ||
        params.qcVerdict === "production_needs_review";
      if (provisional && !policy.allowProvisional) {
        return {
          shotId: shot.id,
          eligible: false,
          status: "provisional",
          reason: "repair-pending / needs review — excluded from master assembly",
        };
      }
      return {
        shotId: shot.id,
        eligible: true,
        status: provisional ? "provisional" : "accepted",
        reason: provisional ? "provisional mediaUrl reference" : "legacy mediaUrl accepted",
      };
    }
    return {
      shotId: shot.id,
      eligible: false,
      status: "missing",
      reason: "no approved usable asset for shot",
    };
  }

  if (
    (shot.qcStatus === "retry" || shot.generationStatus === "qc_pending") &&
    !policy.allowProvisional
  ) {
    return {
      shotId: shot.id,
      eligible: false,
      status: "provisional",
      reason: "repair-pending asset excluded",
      asset,
    };
  }

  const accepted =
    shot.qcStatus === "pass" ||
    shot.qcStatus === "waived" ||
    shot.generationStatus === "approved" ||
    shot.generationStatus === "generated" ||
    params.qcVerdict === "production_ready" ||
    !shot.qcStatus ||
    shot.qcStatus === "pending";

  if (!accepted && params.qcVerdict === "production_needs_review" && !policy.allowProvisional) {
    return {
      shotId: shot.id,
      eligible: false,
      status: "provisional",
      reason: "production needs review — not auto-assembled into master",
      asset,
    };
  }

  return {
    shotId: shot.id,
    eligible: true,
    status: accepted ? "accepted" : "provisional",
    reason: accepted ? "accepted asset" : "provisional inclusion",
    asset,
  };
}
