/**
 * Phase 11 — Autonomous production + learning.
 * Reuses Phase 8 performance learning; no second Creative Director / analytics engine.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createLearning,
  applyDecay,
  buildAdaptiveAdvice,
  DEFAULT_AUTONOMY_POLICY,
  evaluateAutonomyGate,
  filterLearningsByHardConstraints,
  preferExplicitUserPreferences,
  buildAutonomousPlan,
  runLearningUpdatePipeline,
  adviceFingerprint,
  deriveProviderPreferences,
  applyProviderPreferenceBonuses,
  deriveRepairPreferences,
  preferRepairStrategy,
  captureLearningSnapshot,
} from "./intelligence";

function learning(partial: {
  claim: string;
  recommendation?: string;
  evidenceCount: number;
  scope?: "global" | "account" | "series" | "platform" | "brand";
  scopeKey?: string;
  kind?: string;
  consistency?: number;
}) {
  return createLearning({
    kind: (partial.kind as any) || "hook_pattern",
    scope: partial.scope || "account",
    scopeKey: partial.scopeKey || "acc1",
    claim: partial.claim,
    recommendation: partial.recommendation,
    evidenceCount: partial.evidenceCount,
    consistency: partial.consistency ?? 0.8,
    provenance: {
      evidenceType: "account_specific",
      observationIds: [],
      snapshotIds: Array.from({ length: Math.max(1, partial.evidenceCount) }, (_, i) => `s${i}`),
    },
  });
}

describe("Phase 11 — insufficient sample stays quarantined", () => {
  it("does not promote a single success into validated learning", () => {
    const weak = learning({
      claim: "One viral short used a curiosity-gap hook",
      recommendation: "Always use curiosity-gap hooks",
      evidenceCount: 1,
    });
    const update = runLearningUpdatePipeline({
      productionId: "prod_single",
      snapshots: [],
      priorLearnings: [weak],
      productionQualityScore: 0.9,
    });
    assert.equal(update.learnings.length, 0);
    assert.equal(update.quarantined.length, 1);
    assert.equal(update.quarantined[0].evidenceCount, 1);
  });
});

describe("Phase 11 — hard constraint protection", () => {
  it("rejects learnings that would alter locked character appearance", () => {
    const soft = learning({
      claim: "Close-up openings correlate with stronger early retention",
      recommendation: "Prefer close-up openings",
      evidenceCount: 8,
    });
    const identity = learning({
      kind: "character_pattern",
      claim: "Change the character appearance to a different face",
      recommendation: "Alter approved appearance",
      evidenceCount: 12,
    });
    const { allowed, blocked } = filterLearningsByHardConstraints([soft, identity], {
      lockedCharacterAppearance: true,
      lockedCharacterIds: ["CHAR_001"],
    });
    assert.equal(allowed.length, 1);
    assert.equal(blocked.length, 1);
    assert.match(blocked[0].reasons.join(" "), /character visual identity|appearance|identity/i);

    const plan = buildAutonomousPlan({
      objective: "Continue series episode",
      learnings: [soft, identity],
      policy: { level: "balanced" },
      estimatedCostUsd: 8,
      explorationDraw: 0.9,
      hardConstraints: {
        lockedCharacterAppearance: true,
        lockedCharacterIds: ["CHAR_001"],
      },
    });
    assert.equal(plan.relevantLearning.length, 1);
    assert.ok(
      plan.decisions.some((d) => /blocked_hard_constraint|hard_constraint/i.test(d.decision))
    );
  });
});

describe("Phase 11 — explicit user preference protection", () => {
  it("keeps explicit creator preference above inferred style learning", () => {
    const merged = preferExplicitUserPreferences({
      explicitPreferences: ["Prefer cinematic realism"],
      inferredRecommendations: [
        "Avoid cinematic realism; prefer neon hyper-stylized look instead of cinematic realism",
      ],
    });
    assert.equal(merged[0], "Prefer cinematic realism");
    assert.ok(!merged.some((r) => /avoid cinematic realism/i.test(r)));

    const advice = buildAdaptiveAdvice({
      learnings: [
        learning({
          kind: "format_pattern",
          claim: "Neon hyper-stylized look correlates with clicks in unrelated accounts",
          recommendation: "Avoid cinematic realism; prefer neon hyper-stylized look",
          evidenceCount: 9,
        }),
      ],
      accountId: "acc1",
      explicitUserInstructions: ["Prefer cinematic realism"],
    });
    assert.equal(advice.overriddenByExplicitUserIntent, true);
    assert.deepEqual(advice.recommendations, []);
  });
});

describe("Phase 11 — autonomy budget / exploration guards", () => {
  it("pauses when estimated cost exceeds policy max", () => {
    const gate = evaluateAutonomyGate({
      policy: { level: "autonomous", maxEstimatedCostUsd: 10 },
      estimatedCostUsd: 14,
    });
    assert.equal(gate.decision, "pause_budget");
    assert.match(gate.reasons.join(" "), /exceeds max/i);
  });

  it("explores within configured ratio without abandoning exploit path", () => {
    const explore = evaluateAutonomyGate({
      policy: { level: "balanced", explorationRatio: 0.2 },
      estimatedCostUsd: 5,
      explorationDraw: 0.05,
    });
    assert.equal(explore.decision, "explore");

    const exploit = evaluateAutonomyGate({
      policy: { level: "balanced", explorationRatio: 0.2 },
      estimatedCostUsd: 5,
      explorationDraw: 0.9,
    });
    assert.equal(exploit.decision, "proceed");
    assert.equal(DEFAULT_AUTONOMY_POLICY.explorationRatio, 0.2);
  });
});

describe("Phase 11 — learning replay is deterministic", () => {
  it("produces identical adaptive advice fingerprints for the same snapshot", () => {
    const learnings = [
      learning({
        claim: "Curiosity-gap hooks correlate with higher median first-5s retention",
        recommendation: "Prefer curiosity-gap openings for this series",
        evidenceCount: 8,
        scope: "series",
        scopeKey: "ser1",
      }),
    ];
    const snap = captureLearningSnapshot(learnings, { notes: ["replay"] });
    const planA = buildAutonomousPlan({
      objective: "Next episode",
      learnings: snap.learnings,
      policy: { level: "balanced", explorationRatio: 0 },
      estimatedCostUsd: 6,
      explorationDraw: 0.99,
      seriesId: "ser1",
    });
    const planB = buildAutonomousPlan({
      objective: "Next episode",
      learnings: snap.learnings,
      policy: { level: "balanced", explorationRatio: 0 },
      estimatedCostUsd: 6,
      explorationDraw: 0.99,
      seriesId: "ser1",
    });
    assert.equal(adviceFingerprint(planA.advice), adviceFingerprint(planB.advice));
    assert.equal(planA.gate.decision, planB.gate.decision);
    assert.equal(snap.version, 1);
  });
});

describe("Phase 11 — quality ≠ audience performance", () => {
  it("keeps missing audience metrics UNKNOWN (undefined), never zero", () => {
    const update = runLearningUpdatePipeline({
      productionId: "prod_q",
      snapshots: [],
      priorLearnings: [
        learning({
          claim: "Strong QC pass rate for this format",
          recommendation: "Keep current lighting package",
          evidenceCount: 6,
        }),
      ],
      productionQualityScore: 0.92,
    });
    assert.equal(update.outcome.qualityScore, 0.92);
    assert.equal(update.outcome.audiencePerformanceScore, undefined);
    assert.notEqual(update.outcome.audiencePerformanceScore, 0);
  });
});

describe("Phase 11 — provider learning is capability + version scoped", () => {
  it("adapts preference only for the matching capability profile / model version", () => {
    const prefs = deriveProviderPreferences([
      {
        strategyKey: "i2v",
        generationStrategy: "photoreal_i2v_character_ref",
        attempts: 12,
        successes: 11,
        retries: 0,
        providerId: "provA",
        modelId: "m1",
        modelVersion: "v1",
      },
      {
        strategyKey: "i2v",
        generationStrategy: "photoreal_i2v_character_ref",
        attempts: 12,
        successes: 4,
        retries: 3,
        providerId: "provB",
        modelId: "m2",
        modelVersion: "v1",
      },
    ]);
    const ranked = applyProviderPreferenceBonuses(
      [
        { providerId: "provA", score: 0.5 },
        { providerId: "provB", score: 0.5 },
      ],
      prefs,
      { capabilityProfile: "photoreal_i2v_character_ref", modelVersion: "v1" }
    );
    assert.equal(ranked[0].providerId, "provA");
    assert.ok(ranked[0].score > ranked[1].score);

    const v2 = applyProviderPreferenceBonuses(
      [
        { providerId: "provA", score: 0.5 },
        { providerId: "provB", score: 0.5 },
      ],
      prefs,
      { capabilityProfile: "photoreal_i2v_character_ref", modelVersion: "v2" }
    );
    assert.equal(v2[0].score, v2[1].score);
  });
});

describe("Phase 11 — repair learning feeds planner soft prefs", () => {
  it("prefers the repair strategy with stronger evidence for a failure class", () => {
    const prefs = deriveRepairPreferences([
      { failureCode: "CONTINUITY_FAILURE", repairStrategy: "reanchor_refs", success: true },
      { failureCode: "CONTINUITY_FAILURE", repairStrategy: "reanchor_refs", success: true },
      { failureCode: "CONTINUITY_FAILURE", repairStrategy: "reanchor_refs", success: true },
      { failureCode: "CONTINUITY_FAILURE", repairStrategy: "regen_blind", success: false },
      { failureCode: "CONTINUITY_FAILURE", repairStrategy: "regen_blind", success: false },
    ]);
    const preferred = preferRepairStrategy(prefs, "CONTINUITY_FAILURE");
    assert.equal(preferred?.repairStrategy, "reanchor_refs");
  });
});

describe("Phase 11 — closed observe → learn → advice loop", () => {
  it("accumulates comparable evidence into director-facing advice with provenance", () => {
    const prior = [
      learning({
        claim: "Curiosity-gap hooks correlate with higher median first-5s retention",
        recommendation: "Prefer curiosity-gap openings for this series",
        evidenceCount: 7,
        scope: "series",
        scopeKey: "ser1",
        consistency: 0.86,
      }),
    ];
    const update = runLearningUpdatePipeline({
      productionId: "prod_loop",
      snapshots: [],
      priorLearnings: prior,
      seriesId: "ser1",
      productionQualityScore: 0.88,
      outcome: { audiencePerformanceScore: 0.71 },
      reliability: [
        {
          strategyKey: "hook_open",
          generationStrategy: "curiosity_gap",
          attempts: 8,
          successes: 7,
          retries: 1,
          providerId: "provA",
          modelId: "m1",
          modelVersion: "v1",
        },
      ],
    });
    assert.ok(update.learnings.length >= 1);
    assert.ok(update.advice.recommendations.length >= 1 || update.advice.notes.length >= 1);
    assert.ok(update.snapshot.version >= 1);
    assert.ok(update.decisions.length >= 1);
    assert.equal(update.outcome.qualityScore, 0.88);
    assert.equal(update.outcome.audiencePerformanceScore, 0.71);
    assert.notEqual(update.outcome.qualityScore, update.outcome.audiencePerformanceScore);
    assert.ok(update.memoryItems.length >= 0);
  });
});

describe("Phase 11 — decay reduces influence without deleting evidence", () => {
  it("lowers confidence for aged learnings while retaining the record", () => {
    const base = learning({
      claim: "Old pacing pattern",
      recommendation: "Prefer faster cuts",
      evidenceCount: 10,
    });
    const aged = applyDecay(base, new Date("2027-06-01T00:00:00.000Z"));
    assert.ok(aged.confidence.score < base.confidence.score);
    assert.equal(aged.id, base.id);
    assert.equal(aged.claim, base.claim);
  });
});
