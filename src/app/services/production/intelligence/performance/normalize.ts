/**
 * Map existing platform analytics records into normalized PerformanceSnapshots.
 * Does NOT replace analyticsPipeline ingestion — adapter only.
 */

import type { PlatformAnalyticsRecord } from "../../../analyticsPipeline";
import { makeMetric, completenessScore, CANONICAL_METRIC_KEYS } from "./metrics";
import { resolveWindow } from "./windows";
import type {
  PerformanceSnapshot,
  PerformanceObservation,
  PerformanceSeries,
  PerformanceContext,
  PerformanceMetric,
  PerformanceWindowId,
} from "./types";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Build metrics from account-level PlatformAnalyticsRecord (aggregate). */
export function metricsFromPlatformRecord(record: PlatformAnalyticsRecord): PerformanceMetric[] {
  const metrics: PerformanceMetric[] = [];

  if (!record.available || record.syncFailure) {
    for (const key of ["views", "engagement_rate", "followers_gained"] as const) {
      metrics.push(
        makeMetric(key, undefined, {
          availability: "unavailable",
          sourceKey: key,
        })
      );
    }
    return metrics;
  }

  metrics.push(makeMetric("views", record.views, { sourceKey: "views", kind: "platform_native" }));
  metrics.push(
    makeMetric("engagement_rate", record.engagementRate, {
      sourceKey: "engagementRate",
      kind: "rate",
      unit: "percent",
    })
  );
  metrics.push(
    makeMetric("followers_gained", record.growthPercent != null ? undefined : undefined, {
      availability: "unavailable",
      sourceKey: "followers_gained",
    })
  );

  // Impressions/reach often not separately exposed — mark unavailable, never fabricate
  metrics.push(makeMetric("impressions", undefined, { availability: "unavailable", sourceKey: "impressions" }));
  metrics.push(makeMetric("reach", undefined, { availability: "unavailable", sourceKey: "reach" }));
  metrics.push(makeMetric("watch_time", undefined, { availability: "unavailable", sourceKey: "watch_time" }));
  metrics.push(
    makeMetric("average_view_duration", undefined, {
      availability: "unavailable",
      sourceKey: "average_view_duration",
    })
  );
  metrics.push(
    makeMetric("completion_rate", undefined, { availability: "unavailable", sourceKey: "completion_rate" })
  );
  metrics.push(makeMetric("retention", undefined, { availability: "unavailable", sourceKey: "retention" }));
  metrics.push(makeMetric("likes", undefined, { availability: "unavailable", sourceKey: "likes" }));
  metrics.push(makeMetric("comments", undefined, { availability: "unavailable", sourceKey: "comments" }));
  metrics.push(makeMetric("shares", undefined, { availability: "unavailable", sourceKey: "shares" }));
  metrics.push(makeMetric("saves", undefined, { availability: "unavailable", sourceKey: "saves" }));
  metrics.push(makeMetric("clicks", undefined, { availability: "unavailable", sourceKey: "clicks" }));
  metrics.push(makeMetric("conversions", undefined, { availability: "not_applicable", sourceKey: "conversions" }));

  return metrics;
}

/** Per-content row from PlatformAnalyticsRecord.content[] */
export function metricsFromContentRow(row: {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}): PerformanceMetric[] {
  return [
    makeMetric("views", row.views, { sourceKey: "views", kind: "platform_native" }),
    makeMetric("likes", row.likes, { sourceKey: "likes" }),
    makeMetric("comments", row.comments, { sourceKey: "comments" }),
    makeMetric("shares", row.shares, { sourceKey: "shares" }),
    makeMetric("impressions", undefined, { availability: "unavailable" }),
    makeMetric("reach", undefined, { availability: "unavailable" }),
    makeMetric("watch_time", undefined, { availability: "unavailable" }),
    makeMetric("average_view_duration", undefined, { availability: "unavailable" }),
    makeMetric("completion_rate", undefined, { availability: "unavailable" }),
    makeMetric("retention", undefined, { availability: "unavailable" }),
    makeMetric("saves", undefined, { availability: "unavailable" }),
    makeMetric("followers_gained", undefined, { availability: "unavailable" }),
    makeMetric("clicks", undefined, { availability: "unavailable" }),
    makeMetric("conversions", undefined, { availability: "not_applicable" }),
    makeMetric(
      "engagement_rate",
      row.views && row.views > 0
        ? (((row.likes || 0) + (row.comments || 0) + (row.shares || 0)) / row.views) * 100
        : undefined,
      {
        availability: row.views && row.views > 0 ? "estimated" : "unavailable",
        kind: "rate",
        unit: "percent",
        confidence: 0.45,
        sourceKey: "derived_engagement",
      }
    ),
  ];
}

export function snapshotFromPlatformRecord(
  record: PlatformAnalyticsRecord,
  opts?: {
    window?: PerformanceWindowId;
    context?: PerformanceContext;
    accountId?: string;
  }
): PerformanceSnapshot {
  const metrics = metricsFromPlatformRecord(record);
  const confidence = record.available && !record.syncFailure ? 0.75 : 0.2;
  return {
    id: newId("psnap"),
    platform: record.platform,
    accountId: opts?.accountId || record.platform,
    publicationId: "",
    timestamp: record.syncedAt || new Date().toISOString(),
    window: opts?.window || "lifetime",
    metrics,
    context: opts?.context,
    rawProvenance: {
      source: "analyticsPipeline.PlatformAnalyticsRecord",
      syncedAt: record.syncedAt,
      recordKey: record.platform,
    },
    confidence,
    completeness: completenessScore(metrics),
  };
}

export function snapshotFromContentRow(
  record: PlatformAnalyticsRecord,
  row: NonNullable<PlatformAnalyticsRecord["content"]>[number],
  opts?: {
    context?: PerformanceContext;
    accountId?: string;
    asOf?: string;
  }
): PerformanceSnapshot {
  const metrics = metricsFromContentRow(row);
  const window = resolveWindow({
    publishedAt: row.publishedAt,
    asOf: opts?.asOf || record.syncedAt,
  });
  return {
    id: newId("psnap"),
    contentId: row.id,
    platform: record.platform,
    accountId: opts?.accountId || record.platform,
    publicationId: row.id,
    timestamp: opts?.asOf || record.syncedAt || new Date().toISOString(),
    window,
    metrics,
    context: {
      ...opts?.context,
      contentId: row.id,
      publicationId: row.id,
      platform: record.platform,
      publishedAt: row.publishedAt,
    },
    rawProvenance: {
      source: "analyticsPipeline.PlatformAnalyticsRecord.content",
      syncedAt: record.syncedAt,
      recordKey: `${record.platform}:${row.id}`,
    },
    confidence: 0.7,
    completeness: completenessScore(metrics),
  };
}

export function observationsFromSnapshot(snapshot: PerformanceSnapshot): PerformanceObservation[] {
  return snapshot.metrics.map((m) => ({
    id: newId("pobs"),
    snapshotId: snapshot.id,
    metricKey: m.key,
    value: m.value,
    availability: m.availability,
    window: snapshot.window,
    observedAt: snapshot.timestamp,
    contextRefs: {
      productionId: snapshot.productionId || snapshot.context?.productionId,
      contentId: snapshot.contentId || snapshot.context?.contentId,
      platform: snapshot.platform,
      accountId: snapshot.accountId,
      publicationId: snapshot.publicationId,
      creativeStrategyId: snapshot.context?.creativeStrategyId,
      format: snapshot.context?.format,
      hookType: snapshot.context?.hookType,
      durationSec: snapshot.context?.durationSec,
    },
  }));
}

export function buildSeries(snapshots: PerformanceSnapshot[]): PerformanceSeries | null {
  if (!snapshots.length) return null;
  const first = snapshots[0];
  return {
    id: newId("pseries"),
    productionId: first.productionId,
    contentId: first.contentId,
    platform: first.platform,
    accountId: first.accountId,
    snapshots: [...snapshots].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    windowsCovered: [...new Set(snapshots.map((s) => s.window))],
  };
}

/** Ensure every canonical key is represented (as unavailable) when building synthetic tests. */
export function padCanonicalMetrics(partial: PerformanceMetric[]): PerformanceMetric[] {
  const byKey = new Map(partial.map((m) => [m.key, m]));
  for (const key of CANONICAL_METRIC_KEYS) {
    if (!byKey.has(key)) {
      byKey.set(key, makeMetric(key, undefined, { availability: "unavailable" }));
    }
  }
  return [...byKey.values()];
}
