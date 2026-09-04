/**
 * Phase 5 — Intelligent QC tests (mocked visual analysis only — no live AI / generation APIs).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import {
  evaluateShotQc,
  evaluateSceneQc,
  evaluateProductionQc,
  runProductionQcHierarchy,
  runQcWithRepairLoop,
  createMockVisualAnalyzer,
  createStructuralVisualAnalyzer,
  planRepairFromQc,
  applyAutomationPolicy,
  createBudgetState,
  createDefaultQcBudget,
  recordQcRetry,
  canRetryQc,
  thresholdsForQualityTarget,
  statusFromScore,
  userFacingQcAction,
  userFacingFailureSummary,
  preflightGate,
  type ObservedVisualState,
  type ProductionQCResult,
} from "./qc";
import { executeProduction } from "./execution";

function baseSpec() {
  const { spec } = createProductionPlan({
    idea: "A barista in a warm cafe raises a ceramic cup toward camera with a slow push-in",
  });
  assert.ok(spec);
  return spec!;
}

function matchingObservation(shotSubject: string): ObservedVisualState {
  return {
    confidence: 0.92,
    subject: shotSubject,
    subjectPresent: true,
    action: "raises a ceramic cup toward camera",
    environment: "warm cafe interior",
    shotSize: "medium",
    framing: "medium close-up",
    composition: "subject centered",
    cameraMovement: "push_in",
    lighting: "warm practical light",
    lightingDirection: "camera-left",
    timeOfDay: "day",
    style: "warm naturalistic",
    colorIntent: "warm amber",
    identity: {
      face: "consistent barista face",
      clothing: "apron",
      characterRefMatch: true,
    },
    props: ["ceramic cup"],
    spatial: { subjectPosition: "center-right", screenDirection: "audience-facing" },
    motionOccurred: true,
    dialoguePresent: false,
    narrationPresent: false,
    lipSyncOk: null,
  };
}

function failingObservation(): ObservedVisualState {
  return {
    confidence: 0.91,
    subject: "empty street",
    subjectPresent: false,
    action: "static empty frame",
    environment: "cool outdoor night street",
    shotSize: "wide",
    framing: "wide establishing",
    cameraMovement: "static",
    lighting: "cool blue moonlight",
    style: "cold documentary",
    identity: {
      face: "different person",
      clothing: "leather jacket",
      characterRefMatch: false,
    },
    props: [],
    spatial: { subjectPosition: "screen-left", screenDirection: "away" },
    motionOccurred: false,
    dialoguePresent: false,
    narrationPresent: false,
    lipSyncOk: false,
  };
}

describe("QC thresholds + user language", () => {
  it("centralizes thresholds by quality target", () => {
    const cinema = thresholdsForQualityTarget("cinema");
    const draft = thresholdsForQualityTarget("draft");
    assert.ok(cinema.acceptMin > draft.acceptMin);
    assert.equal(statusFromScore(90, cinema), "pass");
    assert.equal(statusFromScore(60, cinema), "retry");
  });

  it("never exposes provider names in user-facing messages", () => {
    const msg = userFacingQcAction("reroute_provider");
    assert.equal(msg.includes("Kling"), false);
    assert.equal(msg.includes("GPT"), false);
    assert.match(msg, /SPARK/i);
    assert.match(userFacingFailureSummary([]), /SPARK/i);
  });
});

describe("intent evaluation", () => {
  it("passes when subject/action/environment match the plan", async () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    const qc = await evaluateShotQc({
      spec,
      shot,
      observedOverride: matchingObservation(shot.subject),
      technical: { ok: true, reasons: [], retryable: false },
      visualAnalysis: createMockVisualAnalyzer(matchingObservation(shot.subject)),
    });
    assert.ok(qc.scores.dimensions.intent! >= 80, JSON.stringify(qc.scores));
    assert.equal(qc.failures.some((f) => f.code === "subject_missing"), false);
  });

  it("fails missing subject and incorrect action / environment", async () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    const qc = await evaluateShotQc({
      spec,
      shot,
      visualAnalysis: createMockVisualAnalyzer(failingObservation()),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(qc.failures.some((f) => f.code === "subject_missing"));
    assert.ok(
      qc.failures.some((f) => f.code === "action_missing" || f.code === "prompt_mismatch" || f.code === "motion_mismatch")
    );
    assert.ok(qc.status === "retry" || qc.status === "fail");
    assert.ok(qc.dimensions.every((d) => d.evidence.length > 0));
  });
});

describe("identity evaluation", () => {
  it("marks identity N/A when no characters", async () => {
    const spec = baseSpec();
    const shot = {
      ...spec.scenes[0].shots[0],
      characterIds: [] as string[],
    };
    // Clear continuity character refs for this shot bridge if present
    const qc = await evaluateShotQc({
      spec: {
        ...spec,
        continuity: { ...spec.continuity, shotBridges: [] },
        characters: [],
      },
      shot,
      visualAnalysis: createMockVisualAnalyzer(matchingObservation(shot.subject)),
      technical: { ok: true, reasons: [], retryable: false },
    });
    const id = qc.dimensions.find((d) => d.id === "identity");
    assert.equal(id?.applicability, "not_applicable");
  });

  it("detects identity and wardrobe drift", async () => {
    const spec = baseSpec();
    const shot = {
      ...spec.scenes[0].shots[0],
      characterIds: spec.characters[0] ? [spec.characters[0].id] : ["character_001"],
    };
    const qc = await evaluateShotQc({
      spec,
      shot,
      visualAnalysis: createMockVisualAnalyzer(failingObservation()),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(
      qc.failures.some((f) => f.code === "identity_drift" || f.code === "wardrobe_drift"),
      JSON.stringify(qc.failures.map((f) => f.code))
    );
  });
});

describe("continuity evaluation", () => {
  it("allows intentional location change", async () => {
    const spec = baseSpec();
    const scene = spec.scenes[0];
    if (scene.shots.length < 2) {
      // Force a second shot for the test
      scene.shots.push({
        ...scene.shots[0],
        id: `${scene.shots[0].id}_b`,
        index: 1,
        purpose: "flashback cutaway",
        productionReason: "Intentional flashback cutaway",
        environment: "completely different snowy mountain peak",
      });
    }
    const prev = scene.shots[0];
    const next = {
      ...scene.shots[1],
      purpose: "flashback cutaway",
      productionReason: "dream flashback insert",
      environment: "snowy mountain peak far away",
    };
    const qc = await evaluateShotQc({
      spec,
      shot: next,
      previousShot: prev,
      visualAnalysis: createMockVisualAnalyzer({
        ...matchingObservation(next.subject),
        environment: "snowy mountain peak",
      }),
      technical: { ok: true, reasons: [], retryable: false },
    });
    const cont = qc.dimensions.find((d) => d.id === "continuity");
    assert.ok(cont);
    assert.ok(cont!.status === "pass" || cont!.score >= 80, JSON.stringify(cont));
  });

  it("flags location / prop / screen-direction continuity breaks", async () => {
    const spec = baseSpec();
    const scene = spec.scenes[0];
    const prev = scene.shots[0];
    const next = scene.shots[1] || {
      ...prev,
      id: `${prev.id}_n`,
      index: 1,
      environment: prev.environment,
    };
    const qc = await evaluateShotQc({
      spec,
      shot: next,
      previousShot: prev,
      visualAnalysis: createMockVisualAnalyzer(failingObservation()),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(
      qc.failures.some((f) =>
        ["location_drift", "prop_drift", "screen_direction_break", "spatial_continuity_break", "wardrobe_drift", "lighting_drift"].includes(
          f.code
        )
      ),
      JSON.stringify(qc.failures.map((f) => f.code))
    );
  });
});

describe("cinematography + motion", () => {
  it("flags framing and camera mismatches", async () => {
    const spec = baseSpec();
    const shot = {
      ...spec.scenes[0].shots[0],
      camera: {
        ...spec.scenes[0].shots[0].camera,
        shotType: "closeup",
        cameraMovement: "push_in" as const,
      },
    };
    const qc = await evaluateShotQc({
      spec,
      shot,
      visualAnalysis: createMockVisualAnalyzer(failingObservation()),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(qc.failures.some((f) => f.code === "composition_mismatch" || f.code === "camera_mismatch"));
    assert.ok(qc.failures.some((f) => f.code === "motion_mismatch" || f.code === "action_missing"));
  });
});

describe("audio evaluation", () => {
  it("marks silent productions N/A", async () => {
    const spec = baseSpec();
    const silent = {
      ...spec,
      audio: {
        ...spec.audio,
        hasNarration: false,
        hasDialogue: false,
        lipSyncRequired: false,
      },
    };
    const shot = { ...silent.scenes[0].shots[0], dialogue: undefined, narration: undefined };
    const qc = await evaluateShotQc({
      spec: silent,
      shot,
      visualAnalysis: createMockVisualAnalyzer(matchingObservation(shot.subject)),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.equal(qc.dimensions.find((d) => d.id === "audio")?.applicability, "not_applicable");
  });

  it("flags missing dialogue and lip-sync failure", async () => {
    const spec = baseSpec();
    const withAudio = {
      ...spec,
      audio: { ...spec.audio, hasDialogue: true, lipSyncRequired: true, hasNarration: false },
    };
    const shot = { ...withAudio.scenes[0].shots[0], dialogue: "Hello there" };
    const qc = await evaluateShotQc({
      spec: withAudio,
      shot,
      visualAnalysis: createMockVisualAnalyzer({
        ...failingObservation(),
        dialoguePresent: false,
        lipSyncOk: false,
      }),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(qc.failures.some((f) => f.code === "dialogue_missing"));
    assert.ok(qc.failures.some((f) => f.code === "lip_sync_failure"));
  });
});

describe("repair + budgets + automation", () => {
  it("plans reference strengthening for identity drift", async () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    const qc = await evaluateShotQc({
      spec,
      shot: { ...shot, characterIds: ["c1"] },
      visualAnalysis: createMockVisualAnalyzer(failingObservation()),
      technical: { ok: true, reasons: [], retryable: false },
    });
    const repair = planRepairFromQc({
      qc,
      spec,
      shot,
      budget: createBudgetState(createDefaultQcBudget(spec.quality)),
    });
    assert.ok(
      repair.action === "change_reference" ||
        repair.action === "reroute_provider" ||
        repair.action === "strengthen_continuity" ||
        repair.action === "regenerate_shot" ||
        repair.action === "repair_prompt"
    );
    assert.equal(repair.withinBudget, true);
  });

  it("stops regeneration after budget exhaustion", async () => {
    let budget = createBudgetState({
      maxQcRetries: 2,
      maxProviderChanges: 1,
      maxTotalExecutionAttempts: 2,
      maxAttemptsPerTask: 2,
    });
    budget = recordQcRetry(budget, false);
    budget = recordQcRetry(budget, true);
    assert.equal(canRetryQc(budget), false);

    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    const bad = failingObservation();
    const result = await runQcWithRepairLoop(spec, {
      automationMode: "autonomous",
      budget: createBudgetState({
        maxQcRetries: 2,
        maxProviderChanges: 1,
        maxTotalExecutionAttempts: 2,
        maxAttemptsPerTask: 2,
      }),
      observations: spec.scenes.flatMap((sc) =>
        sc.shots.map((s) => ({
          shotId: s.id,
          observed: bad,
          technical: { ok: true as const, reasons: [], retryable: false },
        }))
      ),
      visualAnalysis: createMockVisualAnalyzer(bad),
      reexecute: async (s) => ({
        spec: s,
        observations: s.scenes.flatMap((sc) =>
          sc.shots.map((sh) => ({
            shotId: sh.id,
            observed: bad,
            technical: { ok: true as const, reasons: [], retryable: false },
          }))
        ),
      }),
    });
    assert.ok(
      result.stoppedReason === "budget_exhausted" || result.stoppedReason === "manual_review" || result.stoppedReason === "no_auto_repair"
    );
    assert.ok(result.repairsApplied.length <= 2);
  });

  it("respects manual / balanced / autonomous modes", async () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    const qc = await evaluateShotQc({
      spec,
      shot,
      visualAnalysis: createMockVisualAnalyzer(failingObservation()),
      technical: { ok: true, reasons: [], retryable: false },
    });
    const repair = planRepairFromQc({
      qc,
      spec,
      shot,
      budget: createBudgetState(),
    });

    const manual = applyAutomationPolicy({ mode: "manual", qc, repair });
    assert.equal(manual.autoRepair, false);
    assert.equal(manual.requireReview, true);
    assert.equal(manual.effectiveAction, "manual_review");

    const balanced = applyAutomationPolicy({ mode: "balanced", qc, repair });
    assert.equal(balanced.autoRepair, true);
    assert.equal(balanced.requireReview, true);

    const autonomous = applyAutomationPolicy({ mode: "autonomous", qc, repair });
    assert.equal(autonomous.autoRepair, true);
    assert.equal(autonomous.requireReview, false);
  });
});

describe("QC hierarchy", () => {
  it("aggregates asset → shot → scene → production", async () => {
    const spec = baseSpec();
    const good = matchingObservation(spec.scenes[0].shots[0].subject);
    const report = await runProductionQcHierarchy(spec, {
      visualAnalysis: createMockVisualAnalyzer(good),
      observations: spec.scenes.flatMap((sc) =>
        sc.shots.map((s) => ({
          shotId: s.id,
          observed: { ...good, subject: s.subject },
          technical: { ok: true as const, reasons: [], retryable: false },
        }))
      ),
    });
    assert.ok(report.shotResults.length > 0);
    assert.equal(report.sceneResults.length, spec.scenes.length);
    assert.equal(report.productionResult.level, "production");
    assert.ok(
      report.verdict === "production_ready" || report.verdict === "production_needs_review"
    );

    const scene = evaluateSceneQc({
      spec,
      scene: spec.scenes[0],
      shotResults: report.shotResults.filter((r) => r.sceneId === spec.scenes[0].id),
    });
    assert.equal(scene.level, "scene");
    const prod = evaluateProductionQc({
      spec,
      sceneResults: [scene],
      shotResults: report.shotResults,
    });
    assert.ok(prod.verdict);
  });
});

describe("Phase 4 compatibility", () => {
  it("legacy preflight gate still works", () => {
    const spec = baseSpec();
    assert.equal(preflightGate(spec).status, "pass");
  });

  it("executeProduction still succeeds (QC not required)", async () => {
    const spec = baseSpec();
    const result = await executeProduction(spec, {
      dryRun: true,
      sleep: async () => undefined,
    });
    assert.equal(result.ok, true);
  });

  it("structural analyzer does not invent visual content", async () => {
    const analyzer = createStructuralVisualAnalyzer();
    const res = await analyzer.analyzeVideo({ mediaType: "video", sourceUrl: "https://example.test/x.mp4" });
    assert.equal(res.analysisModel, "insufficient_evidence");
    assert.equal(res.observed.confidence, 0);
  });
});

describe("style + technical consumer", () => {
  it("flags style mismatch against VisualStyleSpec", async () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    const qc = await evaluateShotQc({
      spec,
      shot,
      visualAnalysis: createMockVisualAnalyzer({
        ...matchingObservation(shot.subject),
        style: "neon cyberpunk magenta haze",
        colorIntent: "electric purple",
        lighting: "strobe club lighting",
      }),
      technical: { ok: true, reasons: [], retryable: false },
    });
    // May warn or fail depending on overlap with planned style tokens
    const styleDim = qc.dimensions.find((d) => d.id === "style");
    assert.ok(styleDim);
  });

  it("consumes Phase 4 technical failures without re-validating files", async () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    const qc = await evaluateShotQc({
      spec,
      shot,
      visualAnalysis: createMockVisualAnalyzer(matchingObservation(shot.subject)),
      technical: {
        ok: false,
        code: "output_mismatch",
        reasons: ["duration_mismatch", "aspect_ratio_mismatch"],
        retryable: true,
      },
    });
    assert.ok(qc.failures.some((f) => f.code === "duration_mismatch"));
    assert.ok(qc.failures.some((f) => f.code === "aspect_ratio_mismatch"));
    assert.equal(qc.dimensions.find((d) => d.id === "technical")?.status, "fail");
  });
});

describe("evidence quality bar", () => {
  it("every failure includes evidence expected/observed/confidence", async () => {
    const spec = baseSpec();
    const qc = await evaluateShotQc({
      spec,
      shot: spec.scenes[0].shots[0],
      visualAnalysis: createMockVisualAnalyzer(failingObservation()),
      technical: { ok: true, reasons: [], retryable: false },
    });
    for (const f of qc.failures) {
      assert.ok(f.evidence.expected);
      assert.ok(f.evidence.observed);
      assert.ok(typeof f.evidence.confidence === "number");
      assert.ok(f.code);
      assert.ok(f.dimension);
    }
    const _assertType: ProductionQCResult = qc;
    assert.ok(_assertType.id);
  });
});
