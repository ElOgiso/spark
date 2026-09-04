/**
 * Metric vocabulary helpers — never fabricate missing values.
 */

import type {
  CanonicalMetricKey,
  MetricAvailability,
  MetricKind,
  PerformanceMetric,
} from "./types";

export const CANONICAL_METRIC_KEYS: CanonicalMetricKey[] = [
  "impressions",
  "reach",
  "views",
  "watch_time",
  "average_view_duration",
  "completion_rate",
  "retention",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers_gained",
  "clicks",
  "conversions",
  "engagement_rate",
];

const KIND_BY_KEY: Record<CanonicalMetricKey, MetricKind> = {
  impressions: "absolute",
  reach: "absolute",
  views: "platform_native",
  watch_time: "absolute",
  average_view_duration: "absolute",
  completion_rate: "rate",
  retention: "rate",
  likes: "absolute",
  comments: "absolute",
  shares: "absolute",
  saves: "absolute",
  followers_gained: "absolute",
  clicks: "absolute",
  conversions: "absolute",
  engagement_rate: "rate",
};

/** Metrics that are defensible for cautious cross-platform comparison (rates only). */
export const CROSS_PLATFORM_COMPARABLE: Set<CanonicalMetricKey> = new Set([
  "engagement_rate",
  "completion_rate",
]);

export function metricKindFor(key: CanonicalMetricKey | string): MetricKind {
  if (key in KIND_BY_KEY) return KIND_BY_KEY[key as CanonicalMetricKey];
  return "platform_native";
}

export function makeMetric(
  key: CanonicalMetricKey | string,
  value: number | undefined | null,
  opts?: {
    availability?: MetricAvailability;
    sourceKey?: string;
    kind?: MetricKind;
    confidence?: number;
    unit?: string;
  }
): PerformanceMetric {
  const hasValue = value != null && Number.isFinite(Number(value));
  const availability: MetricAvailability =
    opts?.availability ?? (hasValue ? "available" : "unavailable");

  return {
    key,
    value: hasValue ? Number(value) : undefined,
    unit: opts?.unit,
    availability,
    kind: opts?.kind ?? metricKindFor(key),
    sourceKey: opts?.sourceKey,
    confidence: opts?.confidence ?? (availability === "available" ? 0.9 : availability === "estimated" ? 0.4 : 0),
  };
}

export function getMetric(
  metrics: PerformanceMetric[],
  key: CanonicalMetricKey | string
): PerformanceMetric | undefined {
  return metrics.find((m) => m.key === key);
}

export function availableValue(
  metrics: PerformanceMetric[],
  key: CanonicalMetricKey | string
): number | undefined {
  const m = getMetric(metrics, key);
  if (!m || m.availability === "unavailable" || m.availability === "not_applicable") return undefined;
  if (m.value == null || !Number.isFinite(m.value)) return undefined;
  return m.value;
}

export function completenessScore(metrics: PerformanceMetric[]): number {
  if (!metrics.length) return 0;
  const available = metrics.filter((m) => m.availability === "available" || m.availability === "estimated").length;
  return available / metrics.length;
}

/**
 * Normalize a rate into a comparable 0–1 or percent-aware value for analysis only.
 * Absolute platform views are NOT cross-normalized.
 */
export function normalizeForComparison(
  metric: PerformanceMetric
): { value?: number; comparable: boolean; reason: string } {
  if (metric.availability === "unavailable" || metric.availability === "not_applicable") {
    return { comparable: false, reason: "metric_unavailable" };
  }
  if (metric.value == null) {
    return { comparable: false, reason: "missing_value" };
  }
  if (metric.kind === "absolute" || metric.kind === "platform_native") {
    return {
      value: metric.value,
      comparable: false,
      reason: "absolute_or_platform_native_not_cross_comparable",
    };
  }
  if (
    metric.kind === "rate" ||
    metric.kind === "ratio" ||
    metric.kind === "cross_platform_comparable" ||
    CROSS_PLATFORM_COMPARABLE.has(metric.key as CanonicalMetricKey)
  ) {
    // Engagement often stored as percent 0–100
    const v = metric.key === "engagement_rate" && metric.value > 1 ? metric.value / 100 : metric.value;
    return { value: v, comparable: true, reason: "rate_or_ratio" };
  }
  return { value: metric.value, comparable: false, reason: "unknown_kind" };
}
