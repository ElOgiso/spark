import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateScriptForProduction,
  factCheckNarrativeScript,
  computeReferenceContentOverlapScore,
  computeGenericityScore,
  extractClaimBearingSentences,
  MAX_REFERENCE_OVERLAP_SCORE,
  MAX_GENERICITY_SCORE,
  MAX_UNVERIFIED_OR_FALSE_CLAIMS,
} from "./scriptQualityGates";
import { applyNarrativeScriptToSparkAndBrief } from "./applyNarrativeScript";
import { ensureViralSparkProductionReady } from "../viralSparkGate";
import { ProductionAssetService } from "../productionAssetService";
import { productionService } from "../../productionService";
import type { NarrativeScript, ViralSpark, Brand, ProductionBrief } from "../../../domain/types";

describe("Script Quality Gates (Prompt 6)", () => {
  const mockBrand: Brand = {
    name: "Apex Engineering",
    niche: "Structural Engineering & Architecture",
    contentFormat: "faceless",
    archetype: "Educator",
    purpose: "Deconstruct engineering marvels",
    contentPillars: [{ label: "Civil Engineering", active: true }],
    audience: { primary: "Engineers and curious thinkers", painPoints: [], desires: [] },
    tone: [{ label: "Authoritative", active: true }],
  };

  test("Fixture 1: Pompeii-like script with a false date -> blocked", async () => {
    const rawScript: NarrativeScript = {
      title: "The Destruction of Pompeii",
      logline: "How Mount Vesuvius buried Pompeii under volcanic ash",
      premise: "The geological forces that caught Roman citizens by surprise in 1980 AD",
      targetDurationSec: 60,
      format: "faceless",
      hook: {
        spoken: "In 1980 AD, a catastrophic explosion wiped Pompeii off the map.",
        opensOnPayoff: true,
        backstoryDeferred: true,
      },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "The Eruption",
          durationSec: 30,
          job: "hook",
          spoken: "Mount Vesuvius erupted and destroyed Pompeii in 1980 AD, burying 20,000 citizens.",
          visualIntent: "Pyroclastic surge cloud towering over ancient Roman rooftops",
        },
      ],
      fullSpokenScript: "In 1980 AD, a catastrophic explosion wiped Pompeii off the map. Mount Vesuvius erupted and destroyed Pompeii in 1980 AD, burying 20,000 citizens.",
      openLoops: { plantedAtSec: [0], resolvedAtSec: [45] },
      cta: { spoken: "Follow Apex Engineering for more structural breakdowns." },
      contentSource: "ai",
      mustNotCopy: [],
    };

    // Run fact checking pass
    const checkedScript = await factCheckNarrativeScript(rawScript, mockBrand);
    assert.ok(checkedScript.claims && checkedScript.claims.length > 0, "Should extract or check claims");
    const falseClaim = checkedScript.claims.find((c) => c.verified === false);
    assert.ok(falseClaim, "Should detect 1980 AD eruption date as false");

    // Evaluate for production readiness
    const evaluation = evaluateScriptForProduction(checkedScript, null, mockBrand, []);
    assert.equal(evaluation.ok, false, "Script with false historical date must be blocked from production");
    assert.ok(evaluation.scores.falseClaimsCount >= 1, "Must record at least 1 false claim");
    assert.ok(
      evaluation.reasons.some((r) => r.toLowerCase().includes("false") || r.toLowerCase().includes("verified facts")),
      "Reason must state that educational scripts require verified facts"
    );
  });

  test("Fixture 2: Title cloned from a source video -> overlap blocked", () => {
    const referenceTitles = [
      "The Secrets of the Deep Sea Trenches: Mariana Expedition",
      "Why Roman Concrete Outlasts Modern Ports",
    ];

    const clonedScript: NarrativeScript = {
      title: "The Secrets of the Deep Sea Trenches: Mariana Expedition",
      logline: "Exploring the Mariana trench secrets",
      premise: "A journey into the deep sea trenches",
      targetDurationSec: 60,
      format: "faceless",
      hook: {
        spoken: "At 36,000 feet below sea level, pressure would crush a nuclear submarine.",
        opensOnPayoff: true,
        backstoryDeferred: true,
      },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "The Descent",
          durationSec: 30,
          job: "hook",
          spoken: "We descend into the Mariana Trench to uncover deep sea trench secrets.",
          visualIntent: "Submersible lights cutting through ink-black abyssal water",
        },
      ],
      fullSpokenScript: "At 36,000 feet below sea level, pressure would crush a nuclear submarine. We descend into the Mariana Trench to uncover deep sea trench secrets.",
      openLoops: { plantedAtSec: [0], resolvedAtSec: [45] },
      cta: { spoken: "Subscribe for deep ocean deep dives." },
      contentSource: "ai",
      mustNotCopy: referenceTitles,
    };

    const evaluation = evaluateScriptForProduction(clonedScript, null, mockBrand, referenceTitles);
    assert.equal(evaluation.ok, false, "Script cloned from reference video title must be blocked");
    assert.ok(
      evaluation.scores.referenceContentOverlapScore >= MAX_REFERENCE_OVERLAP_SCORE,
      `Overlap score (${evaluation.scores.referenceContentOverlapScore}) must exceed threshold (${MAX_REFERENCE_OVERLAP_SCORE})`
    );
    assert.ok(
      evaluation.reasons.includes("This story is too close to a reference video. Borrow the format, write a new episode."),
      "Must return exact prompt error message for reference overlap"
    );
  });

  test("Fixture 3: Original on-niche premise -> ok", () => {
    const referenceTitles = [
      "The Pyramids of Giza Explained",
      "How Roman Aqueducts Worked",
    ];

    const originalScript: NarrativeScript = {
      title: "Why Incan Stone Joints Withstand 8.0 Magnitude Earthquakes",
      logline: "How Incan dry-stone masonry dissipates seismic shockwaves without mortar",
      premise: "The interlocking ashlar masonry of Machu Picchu absorbs seismic energy through controlled harmonic vibration rather than rigid resistance.",
      targetDurationSec: 60,
      format: "faceless",
      hook: {
        spoken: "When a massive earthquake leveled Cusco in 1950, modern buildings collapsed while Incan walls barely moved.",
        opensOnPayoff: true,
        backstoryDeferred: true,
      },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "Seismic Damping",
          durationSec: 30,
          job: "hook",
          spoken: "Incan engineers carved multi-ton granite blocks with L-shaped bevels that lock together under ground movement.",
          visualIntent: "Cross section diagram of interlocking granite blocks vibrating during seismic wave",
        },
      ],
      fullSpokenScript: "When a massive earthquake leveled Cusco in 1950, modern buildings collapsed while Incan walls barely moved. Incan engineers carved multi-ton granite blocks with L-shaped bevels that lock together under ground movement.",
      openLoops: { plantedAtSec: [0], resolvedAtSec: [45] },
      cta: { spoken: "Subscribe to Apex Engineering for more historical structural analysis." },
      claims: [
        {
          claim: "Incan ashlar masonry used mortarless interlocking precision stones",
          verified: true,
          source: "Architectural History Review",
        },
      ],
      contentSource: "ai",
      mustNotCopy: referenceTitles,
    };

    const evaluation = evaluateScriptForProduction(originalScript, null, mockBrand, referenceTitles);
    assert.equal(evaluation.ok, true, "Original on-niche premise must pass quality gates");
    assert.ok(evaluation.scores.referenceContentOverlapScore < MAX_REFERENCE_OVERLAP_SCORE);
    assert.ok(evaluation.scores.genericityScore < MAX_GENERICITY_SCORE);
    assert.equal(evaluation.reasons.length, 0);
  });

  test("Fixture 4: Script with generic slop and empty premise -> blocked", () => {
    const slopScript: NarrativeScript = {
      title: "Something Amazing About Science",
      logline: "In this video we will explore science",
      premise: "A video about science",
      targetDurationSec: 60,
      format: "faceless",
      hook: {
        spoken: "Today we are going to explore something amazing that will change your life forever without further ado.",
        opensOnPayoff: false,
        backstoryDeferred: false,
      },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "Introduction",
          durationSec: 30,
          job: "hook",
          spoken: "In this video let's dive in because there are many reasons and you won't believe what happens next.",
          visualIntent: "Abstract particles moving",
        },
      ],
      fullSpokenScript: "Today we are going to explore something amazing that will change your life forever without further ado. In this video let's dive in because there are many reasons and you won't believe what happens next.",
      openLoops: { plantedAtSec: [0], resolvedAtSec: [45] },
      cta: { spoken: "Like and subscribe." },
      contentSource: "ai",
      mustNotCopy: [],
    };

    const evaluation = evaluateScriptForProduction(slopScript, null, mockBrand, []);
    assert.equal(evaluation.ok, false, "Generic filler with empty payoff must be blocked");
    assert.ok(
      evaluation.reasons.includes("Script has no specific payoff. SPARK will not generate filler."),
      "Must return exact prompt error message for genericity slop"
    );
  });

  test("Fixture 5: applyNarrativeScriptToSparkAndBrief keeps status as draft when evaluation fails", () => {
    const failingScript: NarrativeScript = {
      title: "The Secrets of the Deep Sea Trenches: Mariana Expedition",
      logline: "Clone story",
      premise: "Same story",
      targetDurationSec: 60,
      format: "faceless",
      hook: { spoken: "Deep sea trench hook line.", opensOnPayoff: true, backstoryDeferred: true },
      chapters: [{ id: "c1", order: 1, title: "Beat 1", durationSec: 30, job: "hook", spoken: "Deep ocean trench descent.", visualIntent: "Ocean" }],
      fullSpokenScript: "Deep ocean trench descent with enough words to exceed the minimum threshold if it were evaluated on word count alone, but the quality gate should block it.",
      openLoops: { plantedAtSec: [0], resolvedAtSec: [45] },
      cta: { spoken: "Subscribe" },
      contentSource: "ai",
      mustNotCopy: ["The Secrets of the Deep Sea Trenches: Mariana Expedition"],
    };

    const spark: ViralSpark = {
      id: "spark-fail-1",
      title: "The Secrets of the Deep Sea Trenches: Mariana Expedition",
      hook: "Deep sea trench hook line.",
      views: "100k",
      velocity: "High",
      platformFit: "YouTube Shorts",
      brandFitScore: 90,
      category: "hot",
      timeWindow: "24h",
      productionTime: "fast",
      whyNow: "Trending",
      angle: "Deep sea",
      audienceEmotion: "Curiosity",
      expectedRetention: "80%",
      difficulty: "Low",
      riskLevel: "Low",
      suggestedFormat: "YouTube Shorts",
      suggestedProductionMode: "standard",
      status: "draft",
    };

    const { sparkPatch, brief, evaluation } = applyNarrativeScriptToSparkAndBrief(
      failingScript,
      spark,
      {},
      { brand: mockBrand, referenceTitles: ["The Secrets of the Deep Sea Trenches: Mariana Expedition"] }
    );

    assert.equal(evaluation.ok, false, "Evaluation should fail on reference overlap");
    assert.equal(sparkPatch.status, "draft", "sparkPatch status must remain 'draft' when evaluation fails");
    assert.ok(sparkPatch.lastError, "sparkPatch must record lastError");
    assert.ok(brief.lastError, "brief must record lastError");
    assert.ok(brief.genericityScore !== undefined, "brief must record genericityScore");
    assert.ok(brief.referenceContentOverlapScore !== undefined, "brief must record referenceContentOverlapScore");
  });

  test("Fixture 6: ensureViralSparkProductionReady blocks ready when narrativeScript fails gate", () => {
    const failingSpark: ViralSpark = {
      id: "spark-gate-fail",
      title: "Cloned Source Title",
      hook: "This is a legitimate spoken host hook with enough characters to pass meta check.",
      views: "100k",
      velocity: "High",
      platformFit: "YouTube Shorts",
      brandFitScore: 90,
      category: "hot",
      timeWindow: "24h",
      productionTime: "fast",
      whyNow: "Trending",
      angle: "Angle",
      audienceEmotion: "Curiosity",
      expectedRetention: "80%",
      difficulty: "Low",
      riskLevel: "Low",
      suggestedFormat: "Vertical 9:16 (Shorts)",
      suggestedProductionMode: "standard",
      status: "draft",
      narrativeScriptObj: {
        title: "Cloned Source Title",
        logline: "Logline",
        premise: "Premise",
        targetDurationSec: 60,
        format: "faceless",
        hook: { spoken: "This is a legitimate spoken host hook with enough characters.", opensOnPayoff: true, backstoryDeferred: true },
        chapters: [{ id: "c1", order: 1, title: "1", durationSec: 30, job: "hook", spoken: "Words", visualIntent: "Visual" }],
        fullSpokenScript: "Words words words",
        openLoops: { plantedAtSec: [], resolvedAtSec: [] },
        cta: { spoken: "Subscribe" },
        contentSource: "ai",
        mustNotCopy: ["Cloned Source Title"],
      },
    };

    const res = ensureViralSparkProductionReady(failingSpark, mockBrand);
    assert.equal(res.ok, false, "ensureViralSparkProductionReady must fail when narrative script fails quality gate");
    assert.equal(res.spark.status, "draft", "Spark status must stay draft");
    assert.ok(res.reasons.length > 0, "Reasons must be provided");
  });

  test("Fixture 7: ProductionAssetService.generateProductionAssets does not generate when script gate fails", async () => {
    const briefWithFailedScript: ProductionBrief = {
      title: "Mariana Expedition",
      productionMode: "standard",
      hook: "At 36,000 feet below sea level, pressure crushes steel.",
      scriptOutline: "Outline",
      visualDirection: "Guided",
      caption: "",
      platformRecommendation: "YouTube Shorts",
      whyThisWorks: "Deep sea",
      brandFitScore: 90,
      suggestedDuration: "60s",
      narrativeScript: {
        title: "The Secrets of the Deep Sea Trenches: Mariana Expedition",
        logline: "Mariana",
        premise: "Deep sea",
        targetDurationSec: 60,
        format: "faceless",
        hook: { spoken: "At 36,000 feet below sea level.", opensOnPayoff: true, backstoryDeferred: true },
        chapters: [{ id: "c1", order: 1, title: "Deep", durationSec: 30, job: "hook", spoken: "At 36,000 feet.", visualIntent: "Sea" }],
        fullSpokenScript: "At 36,000 feet below sea level, pressure would crush a nuclear submarine.",
        openLoops: { plantedAtSec: [], resolvedAtSec: [] },
        cta: { spoken: "Subscribe" },
        contentSource: "ai",
        mustNotCopy: ["The Secrets of the Deep Sea Trenches: Mariana Expedition"],
      },
    };

    const production: any = {
      id: "prod-gate-test",
      title: "The Secrets of the Deep Sea Trenches: Mariana Expedition",
      status: "Drafting",
      brief: briefWithFailedScript,
    };

    // 1. Verify productionService blocks generation
    const { production: gatedProd, brief: gatedBrief } = await productionService.generateAssetsForProduction({
      production,
      brand: mockBrand,
    });

    assert.equal(gatedProd.isGeneratingAssets, false, "Production isGeneratingAssets must be false when script gate fails");
    assert.ok(gatedBrief.lastError, "Asset generation must return lastError when script quality gate fails");
    assert.ok(
      gatedBrief.lastError.includes("This story is too close to a reference video"),
      "Error must explain reference story overlap"
    );

    // 2. Verify ProductionAssetService blocks generation directly
    const directResult = await ProductionAssetService.generateAssets({
      production,
      brief: briefWithFailedScript,
      brand: mockBrand,
    });

    assert.ok(directResult.brief.lastError, "Direct asset generation must return lastError when script quality gate fails");
    assert.ok(
      directResult.brief.lastError.includes("This story is too close to a reference video"),
      "Direct error must explain reference story overlap"
    );
  });
});
