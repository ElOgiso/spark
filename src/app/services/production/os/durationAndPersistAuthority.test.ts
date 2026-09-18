import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getEffectiveFormatSettings } from "../../../domain/types";
import { resolveDurationPolicy, allocateClipDurations } from "../durationPolicy";
import {
  domainViralSparkToInsert,
  viralSparkRowToDomain,
  domainProductionToInsert,
  productionRowToDomain,
} from "../../../backend/mappers/workspaceMappers";
import type { NarrativeScript, Production, ProductionBrief, ViralSpark } from "../../../domain/types";

describe("SPARK — Duration Authority and Aspect Defaults", () => {
  it("defaults aspect to portrait when targetDurationSec <= 60 and aspect is unset", () => {
    const fmt15 = getEffectiveFormatSettings({ targetDurationSec: 15 });
    assert.equal(fmt15.aspectMode, "portrait");

    const fmt60 = getEffectiveFormatSettings({ targetDurationSec: 60 });
    assert.equal(fmt60.aspectMode, "portrait");
  });

  it("defaults aspect to landscape when targetDurationSec > 60 and aspect is unset", () => {
    const fmt180 = getEffectiveFormatSettings({ targetDurationSec: 180 });
    assert.equal(fmt180.aspectMode, "landscape");

    const fmt300 = getEffectiveFormatSettings({ targetDurationSec: 300 });
    assert.equal(fmt300.aspectMode, "landscape");
  });

  it("preserves user explicit aspect override (e.g. 15s landscape Shorts or 180s portrait)", () => {
    const landscapeShort = getEffectiveFormatSettings({
      targetDurationSec: 15,
      aspectMode: "landscape",
    });
    assert.equal(landscapeShort.aspectMode, "landscape", "15s landscape Shorts must be preserved");

    const portraitLong = getEffectiveFormatSettings({
      targetDurationSec: 180,
      aspectMode: "portrait",
    });
    assert.equal(portraitLong.aspectMode, "portrait", "180s portrait must be preserved");
  });

  it("detectMode in durationPolicy does NOT derive mode from duration or contentFormat", () => {
    // <= 60s should NOT force shorts mode when mode is standard/unset
    const shortStandard = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 30 },
      productionMode: "standard",
    });
    assert.equal(shortStandard.mode, "standard", "30s duration must not force shorts mode");

    // >= 180s should NOT force cinematic mode when mode is standard/unset
    const longStandard = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 300 },
      productionMode: "standard",
    });
    assert.equal(longStandard.mode, "standard", "300s duration must not force cinematic mode");

    // Faceless format <= 60s should NOT force shorts mode
    const facelessShort = resolveDurationPolicy({
      formatSettings: { targetDurationSec: 45, contentFormat: "faceless" },
      contentFormat: "faceless",
      productionMode: "standard",
    });
    assert.equal(facelessShort.mode, "standard", "Faceless <= 60s must not force shorts mode");

    // Explicit mode override is still honored
    const explicitCinematic = resolveDurationPolicy({
      productionMode: "cinematic",
      formatSettings: { targetDurationSec: 30 },
    });
    assert.equal(explicitCinematic.mode, "cinematic");

    const explicitShorts = resolveDurationPolicy({
      productionMode: "express",
      formatSettings: { targetDurationSec: 300 },
    });
    assert.equal(explicitShorts.mode, "shorts");
  });
});

describe("SPARK — Script and Evidence Persistence", () => {
  const sampleScript: NarrativeScript = {
    hook: "The future of space travel.",
    targetDurationSec: 45,
    fullSpokenScript: "The future of space travel begins right now with commercial propulsion.",
    chapters: [
      {
        index: 1,
        title: "Hook",
        durationSec: 15,
        job: "hook",
        spoken: "The future of space travel begins right now.",
        visualIntent: "Rocket launch pad at sunrise",
      },
      {
        index: 2,
        title: "Propulsion",
        durationSec: 30,
        job: "proof",
        spoken: "Commercial propulsion changes everything about reaching orbit.",
        visualIntent: "Engine testing telemetry",
      },
    ],
  };

  it("viral_sparks round-trips script fields and merges existing evidence", () => {
    const brandId = "brand-uuid-1";
    const initialSpark: ViralSpark = {
      id: "spark-uuid-1",
      title: "Space Travel",
      hook: "The future of space travel",
      views: "10k",
      velocity: "Fast",
      platformFit: "YouTube",
      brandFitScore: 90,
      category: "rising",
      timeWindow: "Open",
      productionTime: "6h",
      whyNow: "Launch coming up",
      angle: "Engineering",
      audienceEmotion: "Awe",
      expectedRetention: "High",
      difficulty: "Medium",
      riskLevel: "Low",
      suggestedFormat: "Short-form",
      suggestedProductionMode: "Autonomous",
      narrativeScript: sampleScript,
      suggestedScript: sampleScript.fullSpokenScript,
      spoken_beats: sampleScript.chapters.map((c) => c.spoken),
      opening_line: sampleScript.chapters[0].spoken,
      targetDurationSec: 45,
    };

    const row = domainViralSparkToInsert(brandId, initialSpark);
    assert.ok(row.evidence, "Evidence must exist on row");
    const evidence = row.evidence as any;
    assert.deepEqual(evidence.narrativeScript, sampleScript);
    assert.equal(evidence.suggestedScript, sampleScript.fullSpokenScript);
    assert.equal(evidence.targetDurationSec, 45);

    // Simulate partial update without narrativeScript passed — must merge existingEvidence
    const partialSpark: ViralSpark = {
      ...initialSpark,
      narrativeScript: undefined,
      suggestedScript: undefined,
    };
    const updatedRow = domainViralSparkToInsert(brandId, partialSpark, evidence);
    const updatedEvidence = updatedRow.evidence as any;
    assert.deepEqual(updatedEvidence.narrativeScript, sampleScript, "Existing narrativeScript must not be wiped by partial update");

    // Hydrate back to domain
    const hydrated = viralSparkRowToDomain({
      id: "spark-uuid-1",
      brand_id: brandId,
      title: "Space Travel",
      evidence: updatedEvidence,
      status: "ready",
    } as any);

    assert.deepEqual(hydrated.narrativeScript, sampleScript);
    assert.equal(hydrated.suggestedScript, sampleScript.fullSpokenScript);
    assert.equal(hydrated.targetDurationSec, 45);
  });

  it("productions round-trips brief.narrativeScript without dropping script data", () => {
    const brandId = "brand-uuid-1";
    const brief: ProductionBrief = {
      title: "Space Travel Production",
      productionMode: "standard",
      hook: "The future of space travel",
      scriptOutline: "Hook -> Proof",
      visualDirection: "Cinematic industrial",
      caption: "Space travel",
      platformRecommendation: "YouTube",
      whyThisWorks: "Inspiring",
      brandFitScore: 95,
      suggestedDuration: "45s",
      targetDurationSec: 45,
      narrativeScript: sampleScript,
    };

    const production: Production = {
      id: "prod-uuid-1",
      title: "Space Travel Production",
      status: "Drafting",
      mode: "standard",
      dateCreated: "2026-09-18",
      aspectRatio: "9:16",
      formats: ["Short-form"],
      scenes: [],
      brief,
    };

    const insertRow = domainProductionToInsert(brandId, production);
    const briefJson = insertRow.brief as any;
    assert.ok(briefJson.briefObject.narrativeScript, "briefObject must contain narrativeScript");
    assert.deepEqual(briefJson.briefObject.narrativeScript, sampleScript);

    // Hydrate row back to Production domain
    const hydratedProd = productionRowToDomain({
      id: "prod-uuid-1",
      brand_id: brandId,
      title: "Space Travel Production",
      status: "drafting",
      production_mode: "hybrid",
      brief: briefJson,
      created_at: "2026-09-18T00:00:00Z",
    } as any);

    assert.ok(hydratedProd.brief, "Brief must exist on hydrated production");
    assert.deepEqual(hydratedProd.brief.narrativeScript, sampleScript);
    assert.equal(hydratedProd.brief.narrativeScript?.fullSpokenScript, sampleScript.fullSpokenScript);
  });
});
