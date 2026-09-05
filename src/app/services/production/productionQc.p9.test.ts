/**
 * Phase 9 — Generation QA + Automated Repair tests.
 * Deterministic / mocked visual analysis only — no live providers.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import {
  evaluateShotQc,
  planRepairFromQc,
  createBudgetState,
  createDefaultQcBudget,
  canRetryQc,
  recordQcRetry,
  rankCandidates,
  selectBestValidCandidate,
  planDownstreamRevalidation,
  continuityFeedbackFromQc,
  createMockVisualAnalyzer,
  partitionFailures,
  gateDecisionFromQc,
  type ObservedVisualState,
  type ProductionQCResult,
} from "./qc";
import { buildProductionDag, dependentTaskIds } from "./dag/productionDag";

function baseCoffeeSpec() {
  const { spec } = createProductionPlan({
    idea:
      "John enters a coffee shop in a blue jacket, approaches the counter, receives a cup, walks to the window, and drinks coffee.",
  });
  assert.ok(spec);
  // Ensure at least 5 shots for handoff tests
  const scene = spec.scenes[0];
  while (scene.shots.length < 5) {
    const prev = scene.shots[scene.shots.length - 1];
    scene.shots.push({
      ...prev,
      id: `shot_${scene.shots.length + 1}`,
      index: scene.shots.length,
      purpose: scene.shots.length === 2 ? "coverage medium" : prev.purpose,
      subjectAction: ["enters shop", "approaches counter", "receives cup", "walks to window", "drinks coffee"][
        scene.shots.length
      ] || prev.subjectAction,
      motion: {
        ...prev.motion,
        beginState: prev.motion.endState || prev.subjectAction,
        endState: ["at door", "at counter", "holds cup", "at window", "drinks"][scene.shots.length] || prev.motion.endState,
      },
    });
  }
  return spec!;
}

function goodObservation(shotSubject: string): ObservedVisualState {
  return {
    confidence: 0.92,
    subject: shotSubject || "John",
    subjectPresent: true,
    action: "holds ceramic cup",
    environment: "warm coffee shop interior",
    shotSize: "medium",
    framing: "medium close-up",
    composition: "subject centered",
    cameraMovement: "static",
    lighting: "warm practical light",
    identity: {
      face: "consistent john face",
      clothing: "blue jacket white shirt",
      characterRefMatch: true,
    },
    props: ["ceramic cup"],
    heldProps: ["ceramic cup"],
    beginState: "john standing with cup",
    endState: "john standing with cup",
    spatial: { subjectPosition: "center", screenDirection: "left-to-right" },
    cameraSide: "camera-left of axis",
    eyelineTarget: "toward window",
    motionOccurred: true,
  };
}

describe("Phase 9 technical / structural QA", () => {
  it("fails missing media", async () => {
    const spec = baseCoffeeSpec();
    const shot = { ...spec.scenes[0].shots[0], mediaUrl: undefined, keyframeUrl: undefined };
    const qc = await evaluateShotQc({
      spec,
      shot,
      sourceUrl: undefined,
      visualAnalysis: createMockVisualAnalyzer(goodObservation(shot.subject)),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(qc.failures.some((f) => f.code === "asset_missing"));
    assert.equal(qc.hardFailurePresent, true);
    assert.equal(qc.gateDecision, "reject");
  });

  it("fails invalid duration / resolution from technical validation", async () => {
    const spec = baseCoffeeSpec();
    const shot = spec.scenes[0].shots[0];
    const qc = await evaluateShotQc({
      spec,
      shot,
      sourceUrl: "https://example.test/clip.mp4",
      visualAnalysis: createMockVisualAnalyzer(goodObservation(shot.subject)),
      technical: {
        ok: false,
        reasons: ["duration_mismatch: expected 4s got 1s", "resolution_mismatch: 640x360"],
        retryable: true,
      },
    });
    assert.ok(qc.failures.some((f) => f.code === "duration_mismatch"));
    assert.ok(qc.failures.some((f) => f.code === "resolution_mismatch"));
    assert.ok(qc.hardFailurePresent);
  });
});

describe("Phase 9 character / product / continuity QA", () => {
  it("rejects wrong wardrobe with wardrobe_mismatch", async () => {
    const spec = baseCoffeeSpec();
    const shot = spec.scenes[0].shots[1] || spec.scenes[0].shots[0];
    // Seed continuity bridge wardrobe expectation
    if (!spec.continuity.shotBridges.find((b) => b.shotId === shot.id)) {
      const empty = {
        identity: { definingCharacteristics: [], characterRefs: [] },
        wardrobe: { clothing: "blue jacket white shirt" },
        props: [{ propId: "cup", identity: "ceramic cup" }],
        location: { environment: "coffee shop" },
        lighting: {},
        time: {},
        spatial: { screenDirection: "left-to-right", cameraRelationship: "camera-left of axis" },
        summary: "john in blue jacket with cup",
      } as any;
      spec.continuity.shotBridges.push({
        shotId: shot.id,
        continuityIn: empty,
        continuityOut: { ...empty, summary: "john holds cup" },
      });
    } else {
      const b = spec.continuity.shotBridges.find((b) => b.shotId === shot.id)!;
      b.continuityIn.wardrobe = { clothing: "blue jacket white shirt" };
      b.continuityOut.wardrobe = { clothing: "blue jacket white shirt" };
    }

    const bad = {
      ...goodObservation(shot.subject),
      identity: { face: "john", clothing: "red leather jacket", characterRefMatch: true },
    };
    const qc = await evaluateShotQc({
      spec,
      shot,
      previousShot: spec.scenes[0].shots[0],
      sourceUrl: "https://example.test/a.mp4",
      visualAnalysis: createMockVisualAnalyzer(bad),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(
      qc.failures.some((f) => f.code === "wardrobe_mismatch" || f.code === "wardrobe_drift"),
      JSON.stringify(qc.failures.map((f) => f.code))
    );
    assert.equal(qc.gateDecision, "reject");
  });

  it("rejects missing prop continuity", async () => {
    const spec = baseCoffeeSpec();
    const shot = spec.scenes[0].shots[2] || spec.scenes[0].shots[0];
    const bridge = {
      shotId: shot.id,
      continuityIn: {
        identity: { definingCharacteristics: [], characterRefs: [] },
        wardrobe: { clothing: "blue jacket" },
        props: [{ propId: "cup", identity: "ceramic cup", state: "held" }],
        location: { environment: "coffee shop" },
        lighting: {},
        time: {},
        spatial: {},
        summary: "john holds ceramic cup",
      },
      continuityOut: {
        identity: { definingCharacteristics: [], characterRefs: [] },
        wardrobe: { clothing: "blue jacket" },
        props: [{ propId: "cup", identity: "ceramic cup", state: "held" }],
        location: { environment: "coffee shop" },
        lighting: {},
        time: {},
        spatial: {},
        summary: "john holds ceramic cup at window",
      },
    } as any;
    spec.continuity.shotBridges = [
      ...spec.continuity.shotBridges.filter((b) => b.shotId !== shot.id),
      bridge,
    ];
    const bad = {
      ...goodObservation(shot.subject),
      props: [],
      heldProps: [],
      endState: "john empty hands at window",
      action: "stands empty handed",
    };
    const qc = await evaluateShotQc({
      spec,
      shot,
      previousShot: spec.scenes[0].shots[1] || spec.scenes[0].shots[0],
      sourceUrl: "https://example.test/b.mp4",
      visualAnalysis: createMockVisualAnalyzer(bad),
      technical: { ok: true, reasons: [], retryable: false },
      frames: [
        { role: "begin", description: "john holds cup" },
        { role: "end", description: "john empty hands" },
      ],
    });
    assert.ok(
      qc.failures.some((f) => f.code === "prop_missing" || f.code === "prop_drift" || f.code === "end_state_mismatch"),
      JSON.stringify(qc.failures.map((f) => f.code))
    );
  });
});

describe("Phase 9 cinematic / handoff / ranking", () => {
  it("flags cinematic purpose mismatch for establish vs ECU", async () => {
    const spec = baseCoffeeSpec();
    const shot = {
      ...spec.scenes[0].shots[0],
      purpose: "establish location",
      productionReason: "open on coffee shop master",
      camera: { ...spec.scenes[0].shots[0].camera, shotType: "wide", cameraMovement: "static" },
    };
    const bad = {
      ...goodObservation(shot.subject),
      shotSize: "extreme close-up",
      framing: "ecu face",
    };
    const qc = await evaluateShotQc({
      spec,
      shot,
      sourceUrl: "https://example.test/c.mp4",
      visualAnalysis: createMockVisualAnalyzer(bad),
      technical: { ok: true, reasons: [], retryable: false },
    });
    assert.ok(
      qc.failures.some((f) => f.code === "cinematic_purpose_mismatch" || f.code === "framing_mismatch" || f.code === "composition_mismatch"),
      JSON.stringify(qc.failures.map((f) => f.code))
    );
  });

  it("detects handoff failure between shot N end and N+1 start", async () => {
    const spec = baseCoffeeSpec();
    const shots = spec.scenes[0].shots;
    const shot = shots[3];
    const next = shots[4];
    shot.motion = { ...shot.motion, beginState: "john holds cup", endState: "john holds cup at window" };
    next.motion = { ...next.motion, beginState: "john holds cup at window", endState: "john drinks" };
    const obs = {
      ...goodObservation(shot.subject),
      beginState: "john holds cup",
      endState: "john empty-handed walking toward exit door",
      action: "puts cup down and walks away empty handed",
      props: [],
      heldProps: [],
    };
    const qc = await evaluateShotQc({
      spec,
      shot,
      nextShot: next,
      previousShot: shots[2],
      sourceUrl: "https://example.test/d.mp4",
      visualAnalysis: createMockVisualAnalyzer(obs),
      technical: { ok: true, reasons: [], retryable: false },
      frames: [
        { role: "begin", description: "john holds cup" },
        { role: "end", description: "john empty-handed walking toward exit door" },
      ],
    });
    assert.ok(
      qc.failures.some((f) => f.code === "handoff_failure" || f.code === "end_state_mismatch"),
      JSON.stringify(qc.failures.map((f) => f.code))
    );
  });

  it("ranks hard-valid candidate above prettier hard-fail candidate", () => {
    const prettyFail: ProductionQCResult = {
      id: "a",
      productionId: "p",
      shotId: "s1",
      level: "shot",
      status: "fail",
      score: 95,
      scores: { overall: 95, dimensions: { style: 99, cinematography: 98, identity: 20 } },
      dimensions: [],
      failures: [
        {
          code: "wardrobe_mismatch",
          dimension: "identity",
          message: "wrong jacket",
          confidence: 0.95,
          evidence: { expected: "blue", observed: "red", confidence: 0.95 },
          retryable: true,
          severity: "fail",
          requirementStrength: "hard",
        },
      ],
      warnings: [],
      recommendedAction: "change_reference",
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "x",
      hardFailurePresent: true,
      gateDecision: "reject",
    };
    const valid: ProductionQCResult = {
      ...prettyFail,
      id: "b",
      status: "pass",
      score: 82,
      scores: { overall: 82, dimensions: { style: 80, cinematography: 81, identity: 90 } },
      failures: [],
      hardFailurePresent: false,
      gateDecision: "approve",
      recommendedAction: "accept",
    };
    const ranked = rankCandidates([
      { candidateId: "pretty", qc: prettyFail, aestheticScore: 99 },
      { candidateId: "valid", qc: valid, aestheticScore: 80 },
    ]);
    assert.equal(ranked[0].candidateId, "valid");
    assert.equal(ranked[0].eligible, true);
    assert.equal(ranked.find((r) => r.candidateId === "pretty")?.eligible, false);
    assert.equal(selectBestValidCandidate([
      { candidateId: "pretty", qc: prettyFail, aestheticScore: 99 },
      { candidateId: "valid", qc: valid, aestheticScore: 80 },
    ])?.candidateId, "valid");
  });
});

describe("Phase 9 repair loop + DAG invalidation", () => {
  it("plans localized repair with finite attempts and escalate", () => {
    const spec = baseCoffeeSpec();
    const shot = spec.scenes[0].shots[3];
    const qc: ProductionQCResult = {
      id: "qc1",
      productionId: spec.project.id,
      shotId: shot.id,
      sceneId: shot.sceneId,
      level: "shot",
      status: "fail",
      score: 40,
      scores: { overall: 40, dimensions: { identity: 30 } },
      dimensions: [],
      failures: [
        {
          code: "wardrobe_mismatch",
          dimension: "identity",
          message: "wrong jacket",
          confidence: 0.93,
          evidence: { expected: "blue jacket", observed: "red jacket", confidence: 0.93 },
          retryable: true,
          severity: "fail",
          requirementStrength: "hard",
        },
      ],
      warnings: [],
      recommendedAction: "change_reference",
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "x",
      hardFailurePresent: true,
      gateDecision: "reject",
    };
    let budget = createBudgetState(createDefaultQcBudget(spec.quality));
    const repair1 = planRepairFromQc({ qc, spec, shot, budget, attempt: 1, maxAttempts: 2 });
    assert.ok(repair1.regenerateShotIds.includes(shot.id));
    assert.ok(repair1.regenerateShotIds.length <= 3);
    assert.equal(repair1.escalate, false);
    assert.ok(repair1.strategy === "change_reference_set" || repair1.strengthenReferences);

    budget = recordQcRetry(budget, false);
    budget = recordQcRetry(budget, false);
    assert.equal(canRetryQc(budget), false);
    const exhausted = planRepairFromQc({
      qc,
      spec,
      shot,
      budget,
      attempt: 3,
      maxAttempts: 2,
      forceManualReview: true,
    });
    assert.equal(exhausted.escalate || exhausted.action === "manual_review", true);
  });

  it("marks dependents for revalidation without regenerating entire production", () => {
    const spec = baseCoffeeSpec();
    const dag = buildProductionDag(spec);
    const shot = spec.scenes[0].shots[3];
    const seed = dag.nodes.find((n) => n.shotId === shot.id);
    assert.ok(seed);
    const deps = dependentTaskIds(dag, seed!.id);
    const plan = planDownstreamRevalidation({
      spec,
      replacedShotId: shot.id,
      replacedAssetVersion: "v2",
      dag,
      qc: {
        id: "q",
        productionId: spec.project.id,
        shotId: shot.id,
        level: "shot",
        status: "fail",
        score: 30,
        scores: { overall: 30, dimensions: {} },
        dimensions: [],
        failures: [
          {
            code: "end_state_mismatch",
            dimension: "handoff",
            message: "bad end",
            confidence: 0.9,
            evidence: { expected: "cup", observed: "empty", confidence: 0.9 },
            retryable: true,
          },
        ],
        warnings: [],
        recommendedAction: "regenerate_shot",
        providerChange: false,
        evaluatedAt: new Date().toISOString(),
        userMessage: "x",
      },
    });
    assert.ok(plan.revalidateShotIds.length >= 0);
    assert.ok(plan.regenerateShotIds.length <= plan.revalidateShotIds.length);
    const allShotIds = spec.scenes.flatMap((s) => s.shots.map((sh) => sh.id));
    assert.ok(plan.regenerateShotIds.length < allShotIds.length);
    const feedback = continuityFeedbackFromQc({
      id: "q",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot",
      status: "fail",
      score: 30,
      scores: { overall: 30, dimensions: {} },
      dimensions: [],
      failures: [
        {
          code: "prop_missing",
          dimension: "continuity",
          message: "cup missing",
          confidence: 0.9,
          evidence: { expected: "cup", observed: "none", confidence: 0.9 },
          retryable: true,
        },
      ],
      warnings: [],
      recommendedAction: "strengthen_continuity",
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "x",
    });
    assert.equal(feedback.mutatesContinuityState, false);
    assert.ok(feedback.findings.length >= 1);
    assert.ok(deps.includes(seed!.id));
  });

  it("partitionFailures + gateDecision keep hard fails dominant", () => {
    const failures = [
      {
        code: "wardrobe_mismatch" as const,
        dimension: "identity" as const,
        message: "bad",
        confidence: 0.9,
        evidence: { expected: "blue", observed: "red", confidence: 0.9 },
        retryable: true,
        severity: "fail" as const,
        requirementStrength: "hard" as const,
      },
      {
        code: "style_mismatch" as const,
        dimension: "style" as const,
        message: "bg",
        confidence: 0.6,
        evidence: { expected: "warm", observed: "cool", confidence: 0.6 },
        retryable: true,
        severity: "warning" as const,
        requirementStrength: "soft" as const,
      },
    ];
    const part = partitionFailures(failures);
    assert.equal(part.hardFailurePresent, true);
    assert.equal(gateDecisionFromQc({ status: "pass", failures, hardFailurePresent: true }), "reject");
  });
});
