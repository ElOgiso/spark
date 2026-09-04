/**
 * Phase 7 — Autonomous Creative Director / Creative Strategy tests (mocks only).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createProductionPlan,
  directCreativeIntent,
  buildCreativeStrategy,
  understandIntent,
  estimateProductionComplexity,
  runCreativePreflight,
  resolveOptimizationProfile,
  aggregateFailurePatterns,
  diagnoseCreativeFailures,
  applyCreativeDiagnosis,
  planMasterReuse,
} from "./intelligence";
import { createDefaultCreatorProfile } from "./specification/creatorProfile";
import { createCharacterMaster } from "./specification/assetSpec";
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

describe("intent understanding", () => {
  it("separates subject from objective and handles explicit intent", () => {
    const r = understandIntent({
      idea: "Make a video about discipline",
      brand,
      explicitObjective: "Make creators curious enough to watch to the end",
    });
    assert.equal(r.objective.subjectProvenance, "explicit");
    assert.equal(r.objective.objectiveProvenance, "explicit");
    assert.match(r.objective.objective, /curious|watch/i);
    assert.ok(r.explanation.confidence >= 0.9);
  });

  it("infers objective from brand and keeps optional clarification for ambiguity", () => {
    const r = understandIntent({ idea: "Make a video about discipline" });
    assert.ok(r.candidateInterpretations.length >= 2);
    assert.ok(r.objective.objective.length > 0);
    // May or may not clarify — must not questionnaire-spam
    assert.ok(r.clarificationRequests.length <= 1);
  });
});

describe("creative strategy", () => {
  it("builds objective, audience, format, hook, pacing, payoff", () => {
    const { strategy, preflight } = buildCreativeStrategy({
      idea: "How AI filmmaking helps creators ship consistent shorts",
      genre: "educational",
      styleTags: ["faceless"],
      platforms: ["youtube_shorts"],
      durationSec: 45,
      brand,
      creativeControl: "auto",
      requiresNarration: true,
    });
    assert.ok(strategy.objective.subject);
    assert.ok(strategy.audience.primaryAudience);
    assert.ok(strategy.format);
    assert.ok(strategy.hook.type);
    assert.ok(strategy.hook.expectedPayoff);
    assert.ok(strategy.pacing.model);
    assert.ok(strategy.payoff);
    assert.ok(strategy.explanations.length > 0);
    assert.ok(["ready", "improve", "clarify", "blocked"].includes(preflight.status));
    assert.equal(strategy.userFacingSummary.toLowerCase().includes("kling"), false);
    assert.equal(strategy.userFacingSummary.toLowerCase().includes("ffmpeg"), false);
  });

  it("produces limited meaningful alternatives", () => {
    const { strategy } = buildCreativeStrategy({
      idea: "Cinematic short about a lonely lighthouse keeper",
      genre: "narrative_film",
      durationSec: 90,
      creativeControl: "director",
    });
    assert.ok(strategy.alternatives.length <= 2);
    assert.ok(strategy.alternatives.length >= 1);
  });
});

describe("complexity intelligence", () => {
  it("estimates simple vs complex productions", () => {
    const simple = estimateProductionComplexity({
      durationSec: 30,
      format: "talking_head",
      requiresCharacters: true,
      characterCount: 1,
      locationCount: 1,
      hasDialogue: false,
      hasAction: false,
      hasVfx: false,
      optimizationProfile: "balanced",
    });
    assert.equal(simple.complexity.level, "simple");
    assert.ok(simple.complexity.estimatedShots <= 8);

    const complex = estimateProductionComplexity({
      durationSec: 300,
      format: "cinematic_narrative",
      requiresCharacters: true,
      characterCount: 3,
      locationCount: 4,
      wardrobeChanges: 3,
      hasDialogue: true,
      hasAction: true,
      hasVfx: true,
      continuitySensitive: true,
      optimizationProfile: "quality_first",
    });
    assert.ok(
      complex.complexity.level === "complex" || complex.complexity.level === "high_complexity"
    );
    assert.equal(complex.complexity.continuityRisk, "high");
  });

  it("reduces unnecessary complexity for cost/speed profiles", () => {
    const r = estimateProductionComplexity({
      durationSec: 120,
      format: "explainer",
      requiresCharacters: false,
      locationCount: 1,
      hasDialogue: false,
      hasAction: false,
      hasVfx: false,
      optimizationProfile: "cost_sensitive",
    });
    assert.ok(r.complexity.estimatedScenes <= 8);
  });
});

describe("character/world reuse", () => {
  it("reuses existing masters and preserves refs", () => {
    const existing = [
      createCharacterMaster({
        baseId: "character_001",
        name: "Host",
        description: "Primary",
        version: 3,
      }),
    ];
    const plan = planMasterReuse({
      requiresCharacters: true,
      existingMasters: existing,
    });
    assert.ok(plan.plan.reuseRefs.some((r) => r.includes("character_001:v3")));
    assert.equal(plan.plan.createNew.includes("character_001"), false);
  });
});

describe("production modes + optimization", () => {
  it("adapts detail for auto / director / studio", () => {
    const auto = buildCreativeStrategy({
      idea: "Product tip for creators",
      genre: "social",
      creativeControl: "auto",
      durationSec: 30,
    });
    const studio = buildCreativeStrategy({
      idea: "Product tip for creators",
      genre: "social",
      creativeControl: "studio",
      durationSec: 30,
    });
    assert.equal(auto.strategy.productionModeDetail, "concise");
    assert.equal(studio.strategy.productionModeDetail, "rich");
    assert.ok(studio.strategy.explanations.length >= auto.strategy.explanations.length);
  });

  it("resolves optimization profiles", () => {
    assert.equal(
      resolveOptimizationProfile({
        creatorProfile: createDefaultCreatorProfile({ priorities: ["speed"] }),
      }).profile,
      "speed_first"
    );
    assert.equal(resolveOptimizationProfile({ productionMode: "deep" }).profile, "quality_first");
    assert.equal(resolveOptimizationProfile({ explicit: "balanced" }).profile, "balanced");
  });
});

describe("creative preflight", () => {
  it("returns ready/improve/clarify/blocked statuses", () => {
    const ready = buildCreativeStrategy({
      idea: "How to write a cold open that retains viewers",
      genre: "educational",
      brand,
      durationSec: 45,
      platforms: ["youtube_shorts"],
      explicitObjective: "Teach one retention tactic and prove it with an example",
    });
    assert.ok(["ready", "improve"].includes(ready.preflight.status));
    assert.ok(ready.preflight.score > 0);

    const blocked = runCreativePreflight({
      ...ready.strategy,
      objective: {
        subject: "",
        objective: "",
        subjectProvenance: "unknown",
        objectiveProvenance: "unknown",
        confidence: 0,
      },
    });
    assert.equal(blocked.status, "blocked");
  });
});

describe("QC feedback loop", () => {
  it("aggregates patterns and adjusts strategy within budget", () => {
    const patterns = aggregateFailurePatterns([
      { code: "identity_drift", shotId: "s1" },
      { code: "identity_drift", shotId: "s2" },
      { code: "camera_mismatch", shotId: "s1" },
      { code: "camera_mismatch", shotId: "s3" },
    ]);
    assert.ok(patterns.find((p) => p.code === "identity_drift")!.count >= 2);

    const base = buildCreativeStrategy({
      idea: "Character-led story",
      genre: "narrative_film",
      durationSec: 60,
      requiresCharacters: true,
    }).strategy;

    const diagnosis = diagnoseCreativeFailures({
      patterns,
      strategy: base,
      qcRetriesUsed: 0,
      maxQcRetries: 2,
    });
    assert.equal(diagnosis.withinBudget, true);
    assert.ok(diagnosis.adjustments.some((a) => a.kind === "strengthen_references"));

    const adjusted = applyCreativeDiagnosis(base, diagnosis);
    assert.match(adjusted.characterStrategy, /strengthen|Reuse|character/i);

    const exhausted = diagnoseCreativeFailures({
      patterns,
      strategy: base,
      qcRetriesUsed: 2,
      maxQcRetries: 2,
    });
    assert.equal(exhausted.withinBudget, false);
  });
});

describe("orchestrator integration", () => {
  it("extends existing createProductionPlan without a V2 orchestrator", () => {
    const plan = createProductionPlan({
      idea: "Explain why consistent character sheets improve AI video",
      brand,
      productionMode: "standard",
      automationMode: "balanced",
      targetDurationSec: 50,
      preferredAspectRatio: "9:16",
    });
    assert.equal(plan.ok, true);
    assert.ok(plan.directed.strategy);
    assert.ok(plan.directed.preflight);
    assert.equal(plan.trace.creativeStrategyId, plan.directed.strategy!.id);
    assert.ok(plan.trace.creativeFormat);
    assert.ok(plan.trace.userFacingCreativeSummary);
    assert.ok(plan.spec);
    // Downstream Phase 3 still ran
    assert.ok((plan.trace.shotCount || 0) > 0);
  });

  it("directCreativeIntent exposes strategy + respects automation mode field", () => {
    const directed = directCreativeIntent({
      idea: "Short ad for a creator tool",
      brand,
      productionMode: "express",
      automationMode: "autonomous",
      optimizationProfile: "speed_first",
    });
    assert.ok(directed.strategy);
    assert.equal(directed.strategy!.automationMode, "autonomous");
    assert.equal(directed.strategy!.optimizationProfile, "speed_first");
  });
});
