/**
 * Distribution Service — Prompt 8, Component E
 *
 * Creates PublishJob records for a completed production after the
 * evaluatePublishGate has passed. Does NOT directly call platform APIs.
 *
 * Constitution rules:
 * - Rejects ephemeral canonical master URLs (vidgen.x.ai, fal.media, blob:, data:, etc.)
 * - Evaluates evaluatePublishGate FIRST; blocked → throws, awaiting → returns jobs in "Needs Review"
 * - YouTube: stub — always returns "Export Ready" / "Needs Review" with export package pointer
 * - TikTok / Reels: stub — capability "unavailable", job status "Failed" with descriptive reason
 * - Does NOT call productionAssetService
 * - Lives in publishing/ — not in productionAssetService
 */

import type { PublishJob } from "../../../domain/types";
import { evaluatePublishGate } from "./publishPolicy";
import type { PublishGateInput } from "./publishPolicy";
import { isEphemeralMediaUrl } from "../mediaUrlUtils";
import { DISTRIBUTION_PROFILES } from "../capability/sparkCapabilities";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatePublishJobsInput {
  productionId: string;
  title: string;
  /** Canonical master URL — must be durable (non-ephemeral) storage URL. */
  canonicalMasterUrl?: string;
  /** Platforms to target. Default: ["youtube"] */
  platforms?: Array<"youtube" | "tiktok" | "reels">;
  /** Scheduled publish time (ISO-8601). Defaults to now. */
  scheduledTime?: string;
  /** Gate input — passed through to evaluatePublishGate. */
  gateInput: PublishGateInput;
  /** Optional export package pointer (e.g. GCS path for export bundle). */
  exportPackagePath?: string;
}

export interface CreatePublishJobsResult {
  jobs: PublishJob[];
  gateAction: "PUBLISH" | "AWAITING_APPROVAL" | "BLOCKED";
  gateReasons: string[];
  errors: string[];
}

// ─── Durable URL Validation ───────────────────────────────────────────────────

/**
 * Validates that canonicalMasterUrl is durable and non-ephemeral.
 * Constitution rule: "If canonical master URL is missing, DO NOT implement
 * shorts slice or publish. Report and stop."
 */
function assertDurableMasterUrl(canonicalMasterUrl?: string): void {
  if (!canonicalMasterUrl) {
    throw new Error(
      "[distributionService] canonicalMasterUrl is required for publish jobs. " +
        "Run ingestRemoteMediaToSpark() first to persist to durable Spark bucket storage."
    );
  }
  if (isEphemeralMediaUrl(canonicalMasterUrl)) {
    throw new Error(
      `[distributionService] canonicalMasterUrl is ephemeral and will expire: "${canonicalMasterUrl}". " +
        "Ingest to bucket 'Spark' via ingestRemoteMediaToSpark() before creating publish jobs.`
    );
  }
}

// ─── Platform Job Builders ────────────────────────────────────────────────────

function buildYouTubeJob(
  input: CreatePublishJobsInput,
  gateAction: "PUBLISH" | "AWAITING_APPROVAL"
): PublishJob {
  const profile = DISTRIBUTION_PROFILES["youtube"];
  // YouTube adapter is confirmed stub (socialIntegrationService.ts:567)
  // Return "Export Ready" with export package pointer — never fake a published status
  const status: PublishJob["status"] =
    gateAction === "AWAITING_APPROVAL" ? "Needs Review" : "Export Ready";

  return {
    id: `pub-yt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productionId: input.productionId,
    title: input.title,
    platform: "YouTube Shorts",
    scheduledTime: input.scheduledTime || new Date().toISOString(),
    status,
    // Attach export package and master URL as metadata (PublishJob is extensible via intersection)
    ...(input.exportPackagePath ? { exportPackagePath: input.exportPackagePath } : {}),
    ...(input.canonicalMasterUrl ? { canonicalMasterUrl: input.canonicalMasterUrl } : {}),
    ...(profile ? { platformCapabilityId: "distribution_youtube" } : {}),
  } as PublishJob & Record<string, unknown>;
}

function buildUnavailableJob(
  input: CreatePublishJobsInput,
  platform: "tiktok" | "reels"
): PublishJob {
  const label = platform === "tiktok" ? "TikTok" : "Instagram Reels";
  return {
    id: `pub-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productionId: input.productionId,
    title: input.title,
    platform: label as any,
    scheduledTime: input.scheduledTime || new Date().toISOString(),
    status: "Failed",
    ...({ publishError: `${label} distribution capability is "unavailable" — no live adapter registered` }),
  } as PublishJob & Record<string, unknown>;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Creates PublishJob records for a completed production.
 * Call this after Review approval or in publishProduction for the canonical master.
 *
 * Returns jobs for all requested platforms. Jobs are NOT persisted here —
 * the caller (SparkContext.publishProduction) persists via persistPublishJobCreate.
 */
export function createPublishJobsForProduction(
  input: CreatePublishJobsInput
): CreatePublishJobsResult {
  const errors: string[] = [];

  // ── Step 1: Durable master URL check (hard gate — constitution rule) ──────
  try {
    assertDurableMasterUrl(input.canonicalMasterUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // This is a hard stop per constitution ("DO NOT implement … publish. Report and stop.")
    return {
      jobs: [],
      gateAction: "BLOCKED",
      gateReasons: [msg],
      errors: [msg],
    };
  }

  // ── Step 2: Publish gate evaluation ───────────────────────────────────────
  const gateResult = evaluatePublishGate(input.gateInput);

  if (gateResult.action === "BLOCKED") {
    return {
      jobs: [],
      gateAction: "BLOCKED",
      gateReasons: gateResult.reasons,
      errors: gateResult.reasons,
    };
  }

  // ── Step 3: Build platform jobs ───────────────────────────────────────────
  const platforms = input.platforms?.length ? input.platforms : ["youtube" as const];
  const jobs: PublishJob[] = [];

  for (const platform of platforms) {
    if (platform === "youtube") {
      jobs.push(buildYouTubeJob(input, gateResult.action));
    } else if (platform === "tiktok") {
      jobs.push(buildUnavailableJob(input, "tiktok"));
    } else if (platform === "reels") {
      jobs.push(buildUnavailableJob(input, "reels"));
    }
  }

  return {
    jobs,
    gateAction: gateResult.action,
    gateReasons: gateResult.reasons,
    errors,
  };
}
