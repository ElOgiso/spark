/**
 * Phase 8 — Performance Learning & Adaptive Content Intelligence tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  makeMetric,
  normalizeForComparison,
  availableValue,
  PERFORMANCE_WINDOWS,
  resolveWindow,
  inferWindowFromAge,
  windowsAreComparable,
  snapshotFromPlatformRecord,
  snapshotFromContentRow,
  observationsFromSnapshot,
  padCanonicalMetrics,
  creativeDnaFromStrategy,
  analyzePerformance,
  analyzeRetention,
  accumulateLearnings,
  createLearning,
  applyDecay,
  supersedeLearning,
  selectLearningsForContext,
  computeLearningConfidence,
  detectSeriesPattern,
  defineExperiment,
  evaluateExperiment,
  buildAdaptiveAdvice,
  applyLearningsToStrategy,
  summarizeReliability,
  reliabilityToLearning,
  relateProductionIssueToPerformance,
  learningToMemoryItem,
  parseLearningHintsFromMemory,
  opportunityBoostFromLearning,
  mergeConflictingEvidence,
  buildCreativeStrategy,
  directCreativeIntent,
} from "./intelligence";
import type { PlatformAnalyticsRecord } from "../analyticsPipeline";
import type { Brand } from "../../domain/types";

const brand: Brand = {
  name: "Spark Demo",
  niche: "AI filmmaking",
  archetype: "Guide",
  purpose: "Help creators ship better video",
  contentPillars: [{ label: "craft", active: true }],
  audience: { primary: "indie creators", painPoints: ["inconsistency"], desires: ["retention"] },
  tone: [{ label: "clear", active: true }],
  style: [{ label: "cinematic", active: true }],
  automation_mode: "balanced",
};

function mockRecord(partial: Partial<PlatformAnalyticsRecord> = {}): PlatformAnalyticsRecord {
  return {
    platform: "YouTube",
    available: true,
    followers: 1000,
    views: 50000,
    postsCount: 12,
    engagementRate: 4.2,
    growthPercent: 1.5,
    syncedAt: new Date().toISOString(),
    ...partial,
  } as PlatformAnalyticsRecord;
}

describe("metrics normalization", () => {
  it("marks missing metrics unavailable and never fabricates values", () => {
    const m = makeMetric("watch_time", undefined);
    assert.equal(m.availability, "unavailable");
    assert.equal(m.value, undefined);
    const est = makeMetric("engagement_rate", 5, { availability: "estimated" });
    assert.equal(est.availability, "estimated");
    assert.equal(est.value, 5);
  });

  it("distinguishes absolute vs comparable rates", () => {
    const views = makeMetric("views", 1000, { kind: "platform_native" });
    const eng = makeMetric("engagement_rate", 5, { kind: "rate" });
    const nv = normalizeForComparison(views);
    const ne = normalizeForComparison(eng);
    assert.equal(nv.comparable, false);
    assert.equal(ne.comparable, true);
  });

  it("maps platform records without inventing completion/retention", () => {
    const snap = snapshotFromPlatformRecord(mockRecord());
    assert.equal(availableValue(snap.metrics, "views"), 50000);
    assert.equal(availableValue(snap.metrics, "completion_rate"), undefined);
    assert.ok(snap.metrics.some((m) => m.key === "completion_rate" && m.availability === "unavailable"));
    assert.equal(snap.rawProvenance?.source.includes("analyticsPipeline"), true);
  });

  it("handles sync failure as unavailable metrics", () => {
    const snap = snapshotFromPlatformRecord(mockRecord({ available: false, syncFailure: true }));
    assert.ok(snap.confidence < 0.5);
    assert.equal(availableValue(snap.metrics, "views"), undefined);
  });
});

describe("performance windows", () => {
  it("supports hourly through lifetime windows", () => {
    const ids = PERFORMANCE_WINDOWS.map((w) => w.id);
    assert.ok(ids.includes("first_hour"));
    assert.ok(ids.includes("first_24_hours"));
    assert.ok(ids.includes("first_7_days"));
    assert.ok(ids.includes("lifetime"));
  });

  it("infers window from age and compares only matching windows", () => {
    assert.equal(inferWindowFromAge(30 * 60 * 1000), "first_hour");
    assert.equal(inferWindowFromAge(2 * 24 * 60 * 60 * 1000), "first_3_days");
    assert.equal(inferWindowFromAge(40 * 24 * 60 * 60 * 1000), "lifetime");
    assert.equal(windowsAreComparable("first_24_hours", "first_24_hours"), true);
    assert.equal(windowsAreComparable("first_24_hours", "lifetime"), false);
    const w = resolveWindow({
      publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(w, "first_6_hours");
  });
});

describe("creative DNA", () => {
  it("associates strategy hook/format/duration", () => {
    const { strategy } = buildCreativeStrategy({
      idea: "Educational short on lighting",
      genre: "educational",
      durationSec: 45,
      brand,
      requiresNarration: true,
    });
    const dna = creativeDnaFromStrategy(strategy);
    assert.equal(dna.strategyId, strategy.id);
    assert.ok(dna.hookType);
    assert.ok(dna.format);
    assert.equal(dna.durationSec, 45);
    assert.ok(dna.dimensions.hookType);
  });
});

describe("performance analysis", () => {
  it("classifies strong, weak, mixed, and insufficient evidence", () => {
    const strongSnap = {
      id: "s1",
      platform: "TikTok",
      accountId: "acc1",
      publicationId: "p1",
      timestamp: new Date().toISOString(),
      window: "first_7_days" as const,
      metrics: padCanonicalMetrics([
        makeMetric("engagement_rate", 8, { kind: "rate" }),
        makeMetric("completion_rate", 0.6, { kind: "rate" }),
        makeMetric("views", 10000, { kind: "platform_native" }),
        makeMetric("shares", 400),
        makeMetric("likes", 900),
      ]),
      confidence: 0.8,
      completeness: 0.5,
    };
    const strong = analyzePerformance({
      snapshot: strongSnap,
      dna: { dimensions: {}, hookType: "curiosity_gap", format: "educational_short", durationSec: 40 },
      baseline: { engagementRate: 3, completionRate: 0.35 },
    });
    assert.equal(strong.audiencePerformance.label, "strong");
    assert.ok(strong.diagnoses.some((d) => d.code === "strong_engagement" || d.code === "strong_hook"));

    const weak = analyzePerformance({
      snapshot: {
        ...strongSnap,
        id: "s2",
        metrics: padCanonicalMetrics([
          makeMetric("engagement_rate", 0.5, { kind: "rate" }),
          makeMetric("completion_rate", 0.1, { kind: "rate" }),
          makeMetric("views", 1000, { kind: "platform_native" }),
          makeMetric("shares", 1),
        ]),
      },
      dna: { dimensions: {}, hookType: "curiosity_gap", format: "educational_short", durationSec: 120 },
      baseline: { engagementRate: 3, completionRate: 0.35 },
    });
    assert.equal(weak.audiencePerformance.label, "weak");
    assert.ok(weak.underperformed.length);

    const mixed = analyzePerformance({
      snapshot: {
        ...strongSnap,
        id: "s3",
        metrics: padCanonicalMetrics([
          makeMetric("engagement_rate", 3, { kind: "rate" }),
          makeMetric("completion_rate", 0.35, { kind: "rate" }),
          makeMetric("views", 5000, { kind: "platform_native" }),
        ]),
      },
      baseline: { engagementRate: 3, completionRate: 0.35 },
    });
    assert.ok(["mixed", "strong", "weak"].includes(mixed.audiencePerformance.label));

    const insufficient = analyzePerformance({
      snapshot: {
        ...strongSnap,
        id: "s4",
        metrics: padCanonicalMetrics([]),
        completeness: 0,
      },
    });
    assert.equal(insufficient.evidenceStrength, "insufficient_data");
    assert.ok(insufficient.diagnoses.some((d) => d.code === "insufficient_evidence"));
  });

  it("keeps production quality distinct from audience performance", () => {
    const analysis = analyzePerformance({
      snapshot: {
        id: "s5",
        platform: "YouTube",
        accountId: "a",
        publicationId: "p",
        timestamp: new Date().toISOString(),
        window: "lifetime",
        metrics: padCanonicalMetrics([
          makeMetric("engagement_rate", 0.4, { kind: "rate" }),
          makeMetric("completion_rate", 0.12, { kind: "rate" }),
          makeMetric("views", 200),
        ]),
        confidence: 0.7,
        completeness: 0.4,
      },
      productionQuality: { label: "high", score: 0.95, issueCodes: [], notes: ["QC passed"] },
      baseline: { engagementRate: 3, completionRate: 0.35 },
    });
    assert.equal(analysis.productionQuality?.label, "high");
    assert.equal(analysis.audiencePerformance.label, "weak");
    assert.ok(analysis.uncertain.some((u) => /separate|quality/i.test(u)));
  });
});

describe("retention intelligence", () => {
  it("detects early drop, mid drop, and strong completion", () => {
    const early = analyzeRetention({
      durationSec: 60,
      curve: [
        { atSec: 3, retentionRate: 0.55 },
        { atSec: 15, retentionRate: 0.5 },
        { atSec: 30, retentionRate: 0.45 },
        { atSec: 60, retentionRate: 0.4 },
      ],
    });
    assert.ok((early.openingDropOff || 0) >= 0.25);
    assert.ok(early.interestLossHints.some((h) => /opening/i.test(h)));

    const mid = analyzeRetention({
      durationSec: 60,
      curve: [
        { atSec: 3, retentionRate: 0.9 },
        { atSec: 15, retentionRate: 0.85 },
        { atSec: 30, retentionRate: 0.55 },
        { atSec: 60, retentionRate: 0.5 },
      ],
    });
    assert.ok((mid.midVideoDrop || 0) >= 0.15 || mid.interestLossHints.some((h) => /mid/i.test(h)));

    const strong = analyzeRetention({
      durationSec: 45,
      curve: [
        { atSec: 3, retentionRate: 0.92 },
        { atSec: 15, retentionRate: 0.8 },
        { atSec: 45, retentionRate: 0.7 },
      ],
      completionRate: 0.7,
    });
    assert.ok((strong.completionRate || 0) >= 0.55);
  });
});

describe("learning memory confidence and decay", () => {
  it("accumulates account/platform/global learnings with evidence thresholds", () => {
    const analyses = [];
    const snapshots = [];
    const dnaBySnapshotId: Record<string, { dimensions: Record<string, string>; hookType: string; format: string; durationSec: number }> = {};
    for (let i = 0; i < 5; i++) {
      const id = `snap_${i}`;
      snapshots.push({
        id,
        platform: "TikTok",
        accountId: "acc1",
        publicationId: `p${i}`,
        timestamp: new Date().toISOString(),
        window: "first_7_days" as const,
        metrics: padCanonicalMetrics([makeMetric("engagement_rate", 8, { kind: "rate" }), makeMetric("completion_rate", 0.6)]),
        confidence: 0.8,
        completeness: 0.5,
      });
      dnaBySnapshotId[id] = {
        dimensions: {},
        hookType: "direct_address_claim",
        format: "educational_short",
        durationSec: 40,
      };
      analyses.push(
        analyzePerformance({
          snapshot: snapshots[i],
          dna: dnaBySnapshotId[id],
          baseline: { engagementRate: 3, completionRate: 0.35 },
        })
      );
    }
    const account = accumulateLearnings({
      analyses,
      snapshots,
      dnaBySnapshotId,
      scope: "account",
      scopeKey: "acc1",
      minEvidence: 3,
    });
    assert.ok(account.some((l) => l.kind === "hook_pattern"));
    assert.ok(account.every((l) => l.confidence.evidenceCount >= 3));
    assert.ok(account.every((l) => l.provenance.snapshotIds.length > 0));

    const platform = accumulateLearnings({
      analyses,
      snapshots,
      dnaBySnapshotId,
      scope: "platform",
      scopeKey: "TikTok",
      minEvidence: 3,
    });
    assert.ok(platform.length >= 1);

    const oneOff = accumulateLearnings({
      analyses: analyses.slice(0, 1),
      snapshots: snapshots.slice(0, 1),
      dnaBySnapshotId,
      scope: "global",
      minEvidence: 3,
    });
    assert.equal(oneOff.length, 0);
  });

  it("decays stale learning and supports superseding", () => {
    const old = createLearning({
      kind: "hook_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: 'Hook type "old" correlates with stronger audience response in this account scope',
      evidenceCount: 10,
      consistency: 0.8,
      timestamps: [new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()],
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: ["a"] },
      now: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
    });
    const decayed = applyDecay(old, new Date());
    assert.ok(decayed.confidence.recency < old.confidence.recency || decayed.stale);

    const newer = createLearning({
      kind: "hook_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: 'Hook type "new" correlates with stronger audience response in this account scope',
      evidenceCount: 12,
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: ["b"] },
    });
    const { prior, current } = supersedeLearning(old, newer);
    assert.equal(prior.supersededBy, current.id);
    assert.equal(prior.stale, true);
  });

  it("prefers narrowest reliable scope", () => {
    const learnings = [
      createLearning({
        kind: "format_pattern",
        scope: "global",
        claim: 'Format "montage" correlates with stronger outcomes for this global',
        evidenceCount: 20,
        provenance: { evidenceType: "mixed", observationIds: [], snapshotIds: [] },
      }),
      createLearning({
        kind: "format_pattern",
        scope: "account",
        scopeKey: "acc1",
        claim: 'Format "educational_short" correlates with stronger outcomes for this account',
        evidenceCount: 5,
        provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: [] },
      }),
    ];
    const selected = selectLearningsForContext(learnings, { accountId: "acc1", platform: "TikTok" });
    assert.equal(selected[0].scope, "account");
  });

  it("maps learnings into MemoryItem without separate store", () => {
    const l = createLearning({
      kind: "hook_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: 'Hook type "curiosity_gap" correlates with stronger audience response in this account scope',
      recommendation: 'Prefer testing "curiosity_gap" openings when objectives align',
      evidenceCount: 6,
      provenance: { evidenceType: "account_specific", observationIds: ["o1"], snapshotIds: ["s1"] },
    });
    const mem = learningToMemoryItem(l);
    assert.equal(mem.type, "learned");
    assert.equal(mem.category, "Winning hooks");
    const hints = parseLearningHintsFromMemory([mem]);
    assert.ok(hints.strongHooks.includes("curiosity_gap"));
  });
});

describe("series and experiments", () => {
  it("detects series patterns only with enough evidence", () => {
    assert.equal(
      detectSeriesPattern({
        seriesId: "ser1",
        episodeIds: ["e1"],
        hookTypes: ["curiosity_gap"],
        subjects: ["lighting"],
        structures: ["explainer"],
        performanceLabels: ["strong"],
      }),
      null
    );
    const pattern = detectSeriesPattern({
      seriesId: "ser1",
      episodeIds: ["e1", "e2", "e3", "e4"],
      hookTypes: ["curiosity_gap", "curiosity_gap", "curiosity_gap", "direct"],
      subjects: ["lighting", "lighting", "sound", "lighting"],
      structures: ["explainer", "explainer", "explainer", "story"],
      performanceLabels: ["strong", "strong", "strong", "mixed"],
    });
    assert.ok(pattern);
    assert.ok(pattern!.recurringHookTypes.includes("curiosity_gap"));
  });

  it("evaluates experiment hypothesis/control/variant without false significance", () => {
    const exp = defineExperiment({
      hypothesis: "Curiosity gap hooks improve completion",
      variable: "hook_type",
      controlValue: "direct_statement",
      variantValue: "curiosity_gap",
      targetMetric: "completion_rate",
      scope: "account",
      scopeKey: "acc1",
    });
    assert.equal(exp.control.isControl, true);
    assert.equal(exp.variants.length, 1);

    const early = evaluateExperiment({
      experiment: exp,
      controlValues: [0.3, 0.32],
      variantValues: { [exp.variants[0].id]: [0.4] },
      minSamplesForSignificance: 8,
    });
    assert.equal(early.result.statisticallyJustified, false);
    assert.match(early.conclusion, /enough evidence|directional|Early/i);

    const full = evaluateExperiment({
      experiment: exp,
      controlValues: [0.3, 0.31, 0.29, 0.32],
      variantValues: { [exp.variants[0].id]: [0.45, 0.44, 0.46, 0.43] },
      minSamplesForSignificance: 8,
    });
    assert.equal(full.result.statisticallyJustified, true);
    assert.ok(full.winnerVariantId);
  });
});

describe("adaptive creative director", () => {
  it("lets learning influence strategy without creating v2", () => {
    const learning = createLearning({
      kind: "hook_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: 'Hook type "direct_address_claim" correlates with stronger audience response in this account scope',
      recommendation: 'Prefer testing "direct_address_claim" openings when objectives align',
      evidenceCount: 8,
      consistency: 0.85,
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: ["1", "2", "3"] },
    });
    const { strategy } = buildCreativeStrategy({
      idea: "How AI filmmaking helps creators ship consistent shorts",
      genre: "educational",
      platforms: ["youtube_shorts"],
      durationSec: 45,
      brand,
      accountId: "acc1",
      creativeLearnings: [learning],
      requiresNarration: true,
    });
    assert.ok(strategy.explanations.some((e) => e.decision === "performance_learning"));
    assert.equal(strategy.hook.type, "direct_address_claim");
  });

  it("does not let weak evidence override explicit user instructions", () => {
    const learning = createLearning({
      kind: "hook_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: 'Hook type "pattern_interrupt" correlates with stronger audience response in this account scope',
      recommendation: 'Prefer testing "pattern_interrupt" openings when objectives align',
      evidenceCount: 8,
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: [] },
    });
    const { strategy } = buildCreativeStrategy({
      idea: "Product demo",
      genre: "advertisement",
      brand,
      accountId: "acc1",
      creativeLearnings: [learning],
      explicitObjective: "Use a calm explanatory opening only",
      performanceHints: { explicitUserInstructions: ["Must use calm explanatory opening"] },
    });
    assert.ok(strategy.rationale.some((r) => /explicit/i.test(r)) || strategy.explanations.some((e) => e.reasons.some((r) => /explicit/i.test(r))));
    // Hook should not be force-switched to pattern_interrupt when explicit wins
    assert.notEqual(strategy.hook.type, "pattern_interrupt");
  });

  it("handles conflicting evidence safely", () => {
    const a = createLearning({
      kind: "hook_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: "A",
      evidenceCount: 10,
      consistency: 0.9,
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: [] },
    });
    const b = createLearning({
      kind: "hook_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: "B",
      evidenceCount: 3,
      consistency: 0.4,
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: [] },
    });
    const { resolved, conflicts } = mergeConflictingEvidence([a, b]);
    assert.equal(resolved.length, 1);
    assert.ok(conflicts.length >= 1);
  });

  it("wires through directCreativeIntent", () => {
    const learning = createLearning({
      kind: "format_pattern",
      scope: "brand",
      scopeKey: brand.name,
      claim: 'Format "educational_short" correlates with stronger outcomes for this brand',
      recommendation: 'Weight "educational_short" higher among credible formats',
      evidenceCount: 6,
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: [] },
    });
    const result = directCreativeIntent({
      idea: "Teach creators about color grading",
      brand,
      creativeLearnings: [learning],
    });
    assert.ok(result.strategy);
    assert.ok(result.strategyBundle);
  });
});

describe("production reliability", () => {
  it("summarizes retry/QC patterns into learnings", () => {
    const signals = summarizeReliability([
      {
        strategyKey: "quality_first_cinematic",
        generationStrategy: "multi_shot_i2v",
        attempts: 10,
        successes: 6,
        retries: 5,
        qcFailureCodes: ["identity_drift"],
      },
      {
        strategyKey: "balanced_talking_head",
        generationStrategy: "single_pass",
        attempts: 10,
        successes: 9,
        retries: 1,
        qcFailureCodes: [],
      },
    ]);
    assert.ok(signals[0].retryRate >= 0.4);
    assert.ok(signals[1].firstPassSuccessRate >= 0.8);
    const learning = reliabilityToLearning(signals[1], brand.name);
    assert.equal(learning.kind, "reliability_pattern");
    const linked = relateProductionIssueToPerformance({
      issueCode: "identity_drift",
      performanceLabel: "weak",
      snapshotId: "snap_x",
    });
    assert.match(linked.claim, /identity_drift/);
    assert.match(linked.recommendation || "", /causation/i);
  });
});

describe("content row snapshots and opportunity boost", () => {
  it("builds observations from content rows with windows", () => {
    const record = mockRecord({
      content: [
        {
          id: "vid1",
          title: "Test",
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          views: 1000,
          likes: 50,
          comments: 10,
          shares: 5,
        },
      ],
    });
    const snap = snapshotFromContentRow(record, record.content![0]);
    assert.ok(snap.window);
    const obs = observationsFromSnapshot(snap);
    assert.ok(obs.length > 0);
    assert.equal(availableValue(snap.metrics, "likes"), 50);
    const eng = snap.metrics.find((m) => m.key === "engagement_rate");
    assert.equal(eng?.availability, "estimated");
  });

  it("separates market vs account evidence for opportunities", () => {
    const learning = createLearning({
      kind: "format_pattern",
      scope: "account",
      scopeKey: "acc1",
      claim: 'Format "educational_short" correlates with stronger outcomes for this account',
      evidenceCount: 5,
      provenance: { evidenceType: "account_specific", observationIds: [], snapshotIds: ["1", "2", "3"] },
    });
    const boost = opportunityBoostFromLearning({
      opportunityFormat: "educational_short",
      accountLearnings: [learning],
    });
    assert.ok(boost.scoreDelta > 0);
    assert.equal(boost.evidenceSource, "account_specific");

    const marketOnly = opportunityBoostFromLearning({
      opportunityFormat: "educational_short",
      accountLearnings: [],
      marketNotes: ["Short educational is trending globally"],
    });
    assert.equal(marketOnly.scoreDelta, 0);
    assert.equal(marketOnly.evidenceSource, "market");
  });
});

describe("confidence helper", () => {
  it("computes learning confidence with recency and scope", () => {
    const conf = computeLearningConfidence({
      evidenceCount: 10,
      timestamps: [new Date().toISOString()],
      consistency: 0.9,
      scope: "account",
    });
    assert.ok(conf.score > 0.5);
    assert.equal(conf.evidenceCount, 10);
  });
});
