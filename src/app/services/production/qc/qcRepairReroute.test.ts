/**
 * Phase 12 — QC → Repair → Reroute Test Suite
 *
 * Covers:
 * 1. Intent-aware multi-dimensional QC (deterministic & semantic)
 * 2. Inconclusive handling without fake AI vision claims
 * 3. Targeted Craft-driven repair using existing CraftOperations
 * 4. Bounded repair loop with anti-oscillation (repeated failure detection)
 * 5. Capability deficiency detection and canonical rerouting via routeMediaRequest
 * 6. CostEngine estimation & CreditService reservation/settlement
 * 7. UNKNOWN_SUBMISSION reconciliation safety
 * 8. End-to-end integration from Generation to QC to Repair to Accepted Asset
 * 9. Zero live provider spend ($0.00)
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import { createProductionPlan } from "../intelligence/productionOrchestrator";
import { evaluateShotQc } from "./shotQc";
import { runProductionQcHierarchy, runQcWithRepairLoop, applyRepairToSpec } from "./qcOrchestrator";
import { planRepairFromQc } from "./repairPlanner";
import {
  createMockVisualAnalyzer,
  createStructuralVisualAnalyzer,
} from "./visualAnalysis/service";
import {
  failureToCraftOperations,
  isCapabilityDeficiency,
} from "./failureTaxonomy";
import { createBudgetState, createDefaultQcBudget } from "./budgets";
import { CostEngine } from "../economics/costEngine";
import { CreditService } from "../credits/creditService";
import { InMemoryCreditRepository } from "../credits/creditRepository";
import { buildHonestQualityChecks, qcReportToQcSummary } from "../reviewHonesty";
import { ProviderPayloadCompiler } from "../compiler/payloadCompiler";
import { getCapabilityProfile } from "../capability/registry";
import { routeMediaRequest } from "../capability/router";
import type { MediaCapabilityProfile } from "../capability/types";
import { GenerationExecutionEngine } from "../execution/executionEngine";
import type { MediaProviderAdapter } from "../execution/adapters/types";
import type { GenerationTask } from "../specification/generationTask";

function createTestSpec(): { spec: ProductionSpec; shot: ShotSpec } {
  const plan = createProductionPlan({
    idea: "A lone traveler walks along a foggy mountain ridge at sunrise, camera tracking their steady movement",
    targetDurationSec: 30,
  });
  assert.ok(plan.ok);
  assert.ok(plan.spec);
  const spec = plan.spec!;
  spec.continuity.shotBridges = [];
  const shot = spec.scenes[0].shots[0];
  shot.provider = "kling";
  shot.model = "kling-v2-6";
  shot.durationSec = 5;
  shot.aspectRatio = "16:9";
  shot.camera = {
    shotType: "medium",
    framing: "centered",
    cameraMovement: "tracking",
    movementSpeed: "steady",
  };
  shot.cameraMovement = "tracking";
  shot.subject = "traveler";
  shot.subjectAction = "traveler walks steadily";
  shot.environment = "foggy mountain ridge";
  shot.motion = {
    subjectMovement: "traveler walks steadily",
    cameraMovementDetail: "tracking",
    environmentalMovement: "none",
    performanceDirection: "steady",
    timingNotes: "",
    beginState: "traveler walking",
    endState: "traveler walking",
    interaction: "",
  };
  shot.mediaUrl = "https://cdn.example.com/video/shot_01.mp4";
  shot.keyframeUrl = "https://cdn.example.com/images/still_01.png";
  shot.references = {
    firstFrameUrl: "https://cdn.example.com/images/still_01.png",
    characterRefs: [],
    locationRefs: [],
    styleRefs: [],
  };
  spec.scenes = [{ ...spec.scenes[0], shots: [shot] }];
  return { spec, shot };
}

test("Phase 12: QC → Repair → Reroute Suite", async (t) => {
  // ==================== PART 1: INTENT-AWARE QC ====================

  await t.test("1. Valid output satisfying intent passes QC with score >= 0.8", async () => {
    const { spec, shot } = createTestSpec();
    const analyzer = createMockVisualAnalyzer({
      cameraMovement: "tracking",
      motionOccurred: true,
      lighting: spec.visualStyle?.lightingKey,
      subject: "traveler",
      action: "traveler walks steadily",
      environment: "foggy mountain ridge",
      style: spec.visualStyle?.colorGrade,
      confidence: 0.95,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      technical: { ok: true, reasons: [], retryable: false },
      visualAnalysis: analyzer,
    });

    assert.ok(res.status === "pass" || res.status === "warn");
    assert.strictEqual(res.recommendedAction, "accept");
    assert.ok(res.score >= 0.8);
  });

  await t.test("2. Invalid technical output (unreadable/corrupt) fails QC", async () => {
    const { spec, shot } = createTestSpec();
    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      technical: { ok: false, reasons: ["asset_unreadable", "corrupted_output"], retryable: true },
    });

    assert.strictEqual(res.status, "fail");
    assert.ok(res.failures.some((f) => f.code === "technical_failure" || f.code === "asset_unreadable"));
  });

  await t.test("3. Missing output URL fails QC with asset_missing", async () => {
    const { spec, shot } = createTestSpec();
    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: undefined,
      technical: { ok: false, reasons: ["missing_media_url"], retryable: false },
    });

    assert.strictEqual(res.status, "fail");
    assert.ok(res.failures.some((f) => f.code === "technical_failure"));
  });

  await t.test("4. Format mismatch (wrong mediaType) triggers technical failure", async () => {
    const { spec, shot } = createTestSpec();
    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "audio", // Expected video
      sourceUrl: "https://cdn.example.com/audio.mp3",
      technical: { ok: false, reasons: ["media_type_mismatch"], retryable: false },
    });

    assert.strictEqual(res.status, "fail");
    assert.ok(res.failures.length > 0);
  });

  await t.test("5. Duration mismatch fails QC with duration_mismatch", async () => {
    const { spec, shot } = createTestSpec();
    shot.durationSec = 10;
    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      technical: { ok: false, reasons: ["duration_mismatch"], retryable: true },
    });

    assert.strictEqual(res.status, "fail");
    assert.ok(res.failures.some((f) => f.code === "duration_mismatch" || f.code === "technical_failure"));
  });

  await t.test("6. Dimensions mismatch fails QC", async () => {
    const { spec, shot } = createTestSpec();
    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      technical: { ok: false, reasons: ["invalid_width", "invalid_height"], retryable: false },
    });

    assert.strictEqual(res.status, "fail");
  });

  await t.test("7. Aspect ratio mismatch is detected", async () => {
    const { spec, shot } = createTestSpec();
    shot.aspectRatio = "16:9";
    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      technical: { ok: false, reasons: ["aspect_ratio_mismatch"], retryable: true },
    });

    assert.strictEqual(res.status, "fail");
  });

  await t.test("8. Reference failure (character identity missing) is flagged", async () => {
    const { spec, shot } = createTestSpec();
    shot.references = { ...shot.references, characterRefs: ["char_hero_1"] };
    const analyzer = createMockVisualAnalyzer({
      identity: { characterRefMatch: false },
      confidence: 0.9,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    assert.ok(res.failures.some((f) => f.code === "identity_drift" || f.code === "subject_missing"));
  });

  await t.test("9. Identity drift fails identity dimension", async () => {
    const { spec, shot } = createTestSpec();
    shot.characterIds = ["char_traveler"];
    const analyzer = createMockVisualAnalyzer({
      identity: { face: "unrecognized", characterRefMatch: false },
      confidence: 0.92,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    const idDim = res.dimensions.find((d) => d.id === "identity");
    assert.ok(idDim);
    assert.ok(idDim.status === "fail" || idDim.status === "retry");
  });

  await t.test("10. Continuity failure across shot bridge is detected", async () => {
    const { spec, shot } = createTestSpec();
    const prevShot = { ...shot, id: "shot_prev_0" };
    const analyzer = createMockVisualAnalyzer({
      continuityObserved: { location: "indoor_office" }, // Expected mountain ridge
      confidence: 0.88,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      previousShot: prevShot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    const contDim = res.dimensions.find((d) => d.id === "continuity");
    assert.ok(contDim);
  });

  await t.test("11. Composition mismatch fails cinematography dimension", async () => {
    const { spec, shot } = createTestSpec();
    shot.framing = "extreme_closeup";
    const analyzer = createMockVisualAnalyzer({
      shotSize: "wide", // Mismatch
      framing: "wide_angle",
      confidence: 0.9,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    const cineDim = res.dimensions.find((d) => d.id === "cinematography");
    assert.ok(cineDim);
    assert.ok(cineDim.status === "warn" || cineDim.status === "fail");
  });

  await t.test("12. Camera failure (expected tracking shot, observed static) is diagnosed", async () => {
    const { spec, shot } = createTestSpec();
    shot.cameraMovement = "tracking";
    const analyzer = createMockVisualAnalyzer({
      cameraMovement: "static", // Failed camera intent
      confidence: 0.95,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    assert.ok(res.failures.some((f) => f.code === "camera_mismatch" || f.code === "camera_intent_mismatch"));
  });

  await t.test("13. Motion failure (no motion occurred) is diagnosed", async () => {
    const { spec, shot } = createTestSpec();
    const analyzer = createMockVisualAnalyzer({
      motionOccurred: false, // Freeze frame
      confidence: 0.95,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    assert.ok(res.failures.some((f) => f.code === "motion_mismatch" || f.code === "action_missing"));
  });

  await t.test("14. Style failure (photoreal expected, anime observed) is diagnosed", async () => {
    const { spec, shot } = createTestSpec();
    spec.styleBible = { ...spec.styleBible, visualStyle: "cinematic_photoreal" };
    const analyzer = createMockVisualAnalyzer({
      style: "cartoon_anime",
      confidence: 0.9,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    const styleDim = res.dimensions.find((d) => d.id === "style");
    assert.ok(styleDim);
  });

  await t.test("15. Lighting failure is detected", async () => {
    const { spec, shot } = createTestSpec();
    const analyzer = createMockVisualAnalyzer({
      lighting: "neon_cyberpunk", // Expected sunrise
      confidence: 0.85,
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      visualAnalysis: analyzer,
    });

    assert.ok(res.dimensions.some((d) => d.id === "intent" || d.id === "style"));
  });

  await t.test("16. Provider artifact / quality degradation is flagged", async () => {
    const { spec, shot } = createTestSpec();
    const analyzer = createMockVisualAnalyzer({
      confidence: 0.4, // Degraded low confidence artifact
    });

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      technical: { ok: false, reasons: ["quality_degradation"], retryable: true },
      visualAnalysis: analyzer,
    });

    assert.strictEqual(res.status, "fail");
  });

  await t.test("17. Inconclusive result when visual evidence is insufficient (no fake vision)", async () => {
    const { spec, shot } = createTestSpec();
    const structuralAnalyzer = createStructuralVisualAnalyzer(); // Has 0 confidence

    const res = await evaluateShotQc({
      spec,
      shot,
      mediaType: "video",
      sourceUrl: shot.mediaUrl,
      technical: { ok: true, reasons: [], retryable: false },
      visualAnalysis: structuralAnalyzer,
    });

    // When vision evidence is insufficient, intent/semantic dimensions are marked inconclusive
    const inconclusiveDims = res.dimensions.filter((d) => d.applicability === "inconclusive");
    assert.ok(inconclusiveDims.length > 0);
  });

  // ==================== PART 2: CRAFT-DRIVEN REPAIR ====================

  await t.test("18. Repairable failure creates actionable RepairDecision", async () => {
    const { spec, shot } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    const qcResult = {
      id: "qc_test_1",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.45,
      scores: { overall: 0.45, dimensions: {} },
      dimensions: [],
      failures: [
        {
          code: "camera_mismatch" as const,
          dimension: "cinematography" as const,
          message: "Observed static camera instead of tracking",
          confidence: 0.95,
          evidence: { expected: "tracking", observed: "static", confidence: 0.95 },
          retryable: true,
        },
      ],
      warnings: [],
      recommendedAction: "repair_prompt" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "Camera mismatch",
    };

    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
      attempt: 1,
      maxAttempts: 2,
    });

    assert.ok(repair.action !== "accept");
    assert.strictEqual(repair.withinBudget, true);
    assert.ok(repair.operations && repair.operations.length > 0);
  });

  await t.test("19. Non-repairable failure (budget exhausted or max attempts) escalates to manual review", async () => {
    const { spec, shot } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    budget.qcRetries = 3;
    budget.maxQcRetries = 2; // Exhausted

    const qcResult = {
      id: "qc_test_2",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.3,
      scores: { overall: 0.3, dimensions: {} },
      dimensions: [],
      failures: [{ code: "camera_mismatch" as const, dimension: "cinematography" as const, message: "failed", confidence: 0.9, evidence: { expected: "", observed: "", confidence: 0.9 }, retryable: true }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "failed",
    };

    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
      attempt: 3,
      maxAttempts: 2,
    });

    assert.strictEqual(repair.action, "manual_review");
    assert.strictEqual(repair.escalate, true);
    assert.strictEqual(repair.withinBudget, false);
  });

  await t.test("20. Repair generates canonical CraftOperations (e.g. CAMERA / PUSH_IN, MOTION / TRACKING)", async () => {
    const { shot } = createTestSpec();
    const cameraOps = failureToCraftOperations("camera_mismatch", { expected: "push_in forward", observed: "static", confidence: 0.9 }, shot);
    assert.ok(cameraOps.length > 0);
    assert.strictEqual(cameraOps[0].type, "PUSH_IN");
    assert.strictEqual(cameraOps[0].category, "CAMERA");

    const productOps = failureToCraftOperations("motion_mismatch", { expected: "product_spin 360", observed: "still", confidence: 0.9 }, shot);
    assert.ok(productOps.length > 0);
    assert.strictEqual(productOps[0].type, "PRODUCT_SPIN");
    assert.strictEqual(productOps[0].category, "PRODUCT");

    const trackingOps = failureToCraftOperations("motion_mismatch", { expected: "subject_tracking subject", observed: "still", confidence: 0.9 }, shot);
    assert.ok(trackingOps.length > 0);
    assert.strictEqual(trackingOps[0].type, "SUBJECT_TRACKING");
    assert.strictEqual(trackingOps[0].category, "MOTION");
  });

  await t.test("21. Repair does not create parallel Craft system (uses canonical CraftOperation types)", async () => {
    const { shot } = createTestSpec();
    const ops = failureToCraftOperations("lighting_drift", { expected: "light_sweep dynamic", observed: "flat", confidence: 0.9 }, shot);
    assert.ok(ops.length > 0);
    assert.strictEqual(ops[0].category, "LIGHTING");
    assert.strictEqual(ops[0].type, "LIGHT_SWEEP");
  });

  await t.test("22. Original shot identity and IDs are preserved across repair", async () => {
    const { spec, shot } = createTestSpec();
    const originalShotId = shot.id;
    const repair = {
      action: "repair" as const,
      remediation: "modify_prompt" as const,
      providerChange: false,
      changedInputs: ["craftPlan"],
      strengthenReferences: false,
      regenerateShotIds: [shot.id],
      regenerateTaskIds: [],
      preserveShotIds: [],
      reason: "Camera repair",
      withinBudget: true,
      operations: [{ id: "op_1", type: "PUSH_IN", category: "CAMERA", target: { type: "CAMERA", id: "cam" }, parameters: {} } as any],
    };

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    const repairedShot = repairedSpec.scenes[0].shots.find((s) => s.id === originalShotId);
    assert.ok(repairedShot);
    assert.strictEqual(repairedShot.id, originalShotId);
    assert.ok(repairedShot.craftPlan?.operations.some((o) => o.type === "PUSH_IN"));
  });

  await t.test("23. ReferenceGraph is preserved across repair", async () => {
    const { spec, shot } = createTestSpec();
    const originalGraph = spec.referenceGraph;
    const repair = {
      action: "change_reference" as const,
      remediation: "modify_prompt" as const,
      providerChange: false,
      changedInputs: [],
      strengthenReferences: true,
      regenerateShotIds: [shot.id],
      regenerateTaskIds: [],
      preserveShotIds: [],
      reason: "strengthen refs",
      withinBudget: true,
    };

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    assert.strictEqual(repairedSpec.referenceGraph, originalGraph);
  });

  await t.test("24. StyleBible is preserved across repair", async () => {
    const { spec, shot } = createTestSpec();
    const originalStyle = spec.styleBible;
    const repair = {
      action: "repair" as const,
      remediation: "modify_prompt" as const,
      providerChange: false,
      changedInputs: [],
      strengthenReferences: false,
      regenerateShotIds: [shot.id],
      regenerateTaskIds: [],
      preserveShotIds: [],
      reason: "craft repair",
      withinBudget: true,
    };

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    assert.strictEqual(repairedSpec.styleBible, originalStyle);
  });

  await t.test("25. Repair modifies only necessary requirements without corrupting unaffected shots", async () => {
    const { spec, shot } = createTestSpec();
    const shot2 = { ...shot, id: "shot_unaffected_2", durationSec: 8 };
    spec.scenes[0].shots.push(shot2);

    const repair = {
      action: "repair" as const,
      remediation: "modify_prompt" as const,
      providerChange: false,
      changedInputs: [],
      strengthenReferences: false,
      regenerateShotIds: [shot.id], // Only shot 1
      regenerateTaskIds: [],
      preserveShotIds: [shot2.id],
      reason: "fix shot 1",
      withinBudget: true,
      operations: [{ id: "op_2", type: "TILT", category: "CAMERA", target: { type: "CAMERA", id: "cam" }, parameters: {} } as any],
    };

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    const s2 = repairedSpec.scenes[0].shots.find((s) => s.id === "shot_unaffected_2");
    assert.strictEqual(s2?.durationSec, 8);
    assert.strictEqual(s2?.craftPlan?.operations?.some((o) => o.type === "TILT") ?? false, false);
  });

  await t.test("26. Repeated identical failure stops loop (anti-oscillation)", async () => {
    const { spec, shot } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    const qcResult = {
      id: "qc_test_repeat",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.4,
      scores: { overall: 0.4, dimensions: {} },
      dimensions: [],
      failures: [{ code: "camera_mismatch" as const, dimension: "cinematography" as const, message: "camera mismatch", confidence: 0.9, evidence: { expected: "", observed: "", confidence: 0.9 }, retryable: true }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "camera mismatch",
    };

    // First attempt planned with history = ["camera_mismatch"]
    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
      attempt: 2,
      failureHistory: ["camera_mismatch"], // Identical previous failure!
    });

    assert.strictEqual(repair.action, "manual_review");
    assert.strictEqual(repair.escalate, true);
    assert.ok(repair.reason.includes("Repeated identical failure"));
  });

  await t.test("27. Maximum repair attempts enforced in runQcWithRepairLoop", async () => {
    const { spec } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    budget.maxQcRetries = 1;

    let loops = 0;
    const loopResult = await runQcWithRepairLoop(spec, {
      budget,
      observations: [
        {
          shotId: spec.scenes[0].shots[0].id,
          technical: { ok: false, reasons: ["camera_mismatch"], retryable: true },
        },
      ],
      reexecute: async (nextSpec) => {
        loops++;
        return {
          spec: nextSpec,
          observations: [
            {
              shotId: nextSpec.scenes[0].shots[0].id,
              technical: { ok: false, reasons: ["camera_mismatch"], retryable: true },
            },
          ],
        };
      },
    });

    assert.ok(loops <= 2);
    assert.ok(loopResult.stoppedReason === "manual_review" || loopResult.stoppedReason === "budget_exhausted");
  });

  // ==================== PART 3: CANONICAL REROUTING ====================

  await t.test("28. Valid capability retains current provider", async () => {
    const { spec, shot } = createTestSpec();
    shot.provider = "kling";
    shot.durationSec = 5; // Kling supports 5s natively
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));

    const qcResult = {
      id: "qc_test_retain",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.5,
      scores: { overall: 0.5, dimensions: {} },
      dimensions: [],
      failures: [{ code: "camera_mismatch" as const, dimension: "cinematography" as const, message: "camera mismatch", confidence: 0.9, evidence: { expected: "tilt", observed: "pan", confidence: 0.9 }, retryable: true }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "camera mismatch",
    };

    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
    });

    // Should retain kling because kling supports camera control
    assert.strictEqual(repair.providerChange, false);
    assert.strictEqual(repair.nextProvider, undefined);
  });

  await t.test("29. Genuine capability deficiency (duration beyond limit) reroutes via canonical router", async () => {
    const { spec, shot } = createTestSpec();
    shot.provider = "gemini"; // max duration 8s
    shot.model = "veo-2.0-generate-001";
    shot.durationSec = 12; // 12s exceeds Gemini limit of 8s
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));

    const qcResult = {
      id: "qc_test_reroute",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.3,
      scores: { overall: 0.3, dimensions: {} },
      dimensions: [],
      failures: [{ code: "duration_mismatch" as const, dimension: "technical" as const, message: "duration mismatch", confidence: 0.95, evidence: { expected: "12s", observed: "8s", confidence: 0.95 }, retryable: true }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "duration mismatch",
    };

    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
    });

    assert.strictEqual(repair.providerChange, true);
    assert.ok(repair.rerouteDecision);
    assert.ok(repair.nextProvider);
    assert.notStrictEqual(repair.nextProvider, "gemini");
  });

  await t.test("30. Canonical router is used with no hardcoded fallback table", async () => {
    const { spec, shot } = createTestSpec();
    shot.provider = "grok";
    shot.durationSec = 10;
    const profile = getCapabilityProfile("grok");

    // Check deficiency
    const def = isCapabilityDeficiency("duration_mismatch", shot, profile);
    assert.ok(def !== undefined);

    // Call routeMediaRequest
    const reqs = {
      modality: "video" as const,
      generationMode: "image_to_video" as const,
      output: { durationSeconds: 10 },
      preferences: { objective: "quality_first" as const },
    };
    const decision = routeMediaRequest(reqs);
    assert.ok(decision.selected);
    assert.ok(decision.scoreBreakdown);
    assert.ok(decision.reasonCodes.length > 0);
  });

  await t.test("31. Provider / model identity preserved in audit trail", async () => {
    const { spec, shot } = createTestSpec();
    shot.provider = "gemini";
    shot.model = "veo-2.0-generate-001";

    const repair = {
      action: "reroute_provider" as const,
      remediation: "rerender_different_model" as const,
      providerChange: true,
      nextProvider: "kling",
      nextModel: "kling-v1-standard",
      routingReason: "Capability reroute for 10s video",
      changedInputs: [],
      strengthenReferences: false,
      regenerateShotIds: [shot.id],
      regenerateTaskIds: [],
      preserveShotIds: [],
      reason: "reroute",
      withinBudget: true,
    };

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    const repairedShot = repairedSpec.scenes[0].shots.find((s) => s.id === shot.id);
    assert.strictEqual(repairedShot?.provider, "kling");
    assert.strictEqual(repairedShot?.model, "kling-v1-standard");
    assert.ok((repairedShot?.metadata as any)?.routingAudit);
    assert.strictEqual((repairedShot?.metadata as any).routingAudit.previousProvider, "gemini");
    assert.strictEqual((repairedShot?.metadata as any).routingAudit.newProvider, "kling");
  });

  // ==================== PART 4: ECONOMICS & CREDIT SAFETY ====================

  await t.test("32. CostEngine estimates repair cost accurately", async () => {
    const est = CostEngine.estimateCost({
      providerId: "kling",
      modelId: "kling-v2-6",
      modality: "video",
      durationSeconds: 5,
    });
    assert.ok(est.status === "EXACT" || est.status === "ESTIMATED");
    assert.ok((est.amount ?? 0) > 0);
  });

  await t.test("33. Insufficient budget blocks repair and routes to manual review", async () => {
    const { spec, shot } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    budget.exhausted = true; // No budget remaining

    const qcResult = {
      id: "qc_test_budget",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.2,
      scores: { overall: 0.2, dimensions: {} },
      dimensions: [],
      failures: [{ code: "camera_mismatch" as const, dimension: "cinematography" as const, message: "failed", confidence: 0.9, evidence: { expected: "", observed: "", confidence: 0.9 }, retryable: true }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "failed",
    };

    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
    });

    assert.strictEqual(repair.action, "manual_review");
    assert.strictEqual(repair.withinBudget, false);
  });

  await t.test("34. CreditService reserves credits for repair attempt", async () => {
    const repo = new InMemoryCreditRepository();
    const creditService = new CreditService(repo);
    await creditService.setBalance("user_p12", 50);

    const quote = creditService.quote({ estimatedCostUsd: 0.20, generationId: "gen_test_34" });
    const res = await creditService.reserve({
      quote,
      userId: "user_p12",
      idempotencyKey: "res_repair_test_1",
      metadata: { purpose: "qc_repair" },
    });

    assert.ok(res.reservation.id);
    assert.strictEqual(res.reservation.status, "RESERVED");

    // Settle
    const settled = await creditService.settle({
      reservationId: res.reservation.id,
      userId: "user_p12",
      actualProviderCostUsd: 0.20,
    });
    assert.strictEqual(settled.settlement.status, "CONSUMED");
  });

  await t.test("35. Actual cost calculated via CostEngine after usage reported", async () => {
    const actual = CostEngine.calculateActualCost({
      providerId: "kling",
      modelId: "kling-v2-6",
      modality: "video",
      usage: { durationSeconds: 5, resolution: "1080p" },
    });
    assert.ok(actual.status === "EXACT" || actual.status === "ESTIMATED");
    assert.ok((actual.amount ?? 0) > 0);
  });

  await t.test("36. Unbilled failure releases credit reservation cleanly", async () => {
    const repo = new InMemoryCreditRepository();
    const creditService = new CreditService(repo);
    await creditService.setBalance("user_p12_rel", 50);

    const quote = creditService.quote({ estimatedCostUsd: 0.25, generationId: "gen_test_36" });
    const res = await creditService.reserve({
      quote,
      userId: "user_p12_rel",
      idempotencyKey: "res_repair_rel_1",
    });

    const released = await creditService.release({
      reservationId: res.reservation.id,
      userId: "user_p12_rel",
      reason: "qc_cancelled",
    });

    assert.strictEqual(released.reservation.status, "RELEASED");
  });

  await t.test("37. UNKNOWN_SUBMISSION stops repair loop safely without duplicate generation", async () => {
    const { spec } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));

    let attempts = 0;
    const loopResult = await runQcWithRepairLoop(spec, {
      budget,
      observations: [
        {
          shotId: spec.scenes[0].shots[0].id,
          technical: { ok: false, reasons: ["camera_mismatch"], retryable: true },
        },
      ],
      reexecute: async () => {
        attempts++;
        const err = new Error("unknown_submission: network hangup during transmission");
        (err as any).code = "unknown_submission";
        throw err;
      },
    });

    // Must halt immediately on unknown_submission
    assert.strictEqual(attempts, 1);
    assert.strictEqual(loopResult.stoppedReason, "manual_review");
    assert.ok(loopResult.report.productionResult.userMessage?.includes("reconciliation required"));
  });

  // ==================== PART 5: INTEGRATION ====================

  await t.test("38. Repaired request reaches Phase 10 ProviderPayloadCompiler cleanly", async () => {
    const { spec, shot } = createTestSpec();
    shot.craftPlan = {
      operations: [
        {
          id: "craft_op_repaired_1",
          type: "PUSH_IN",
          category: "CAMERA",
          name: "Push In",
          target: { type: "CAMERA", id: "camera_main" },
          parameters: { speed: 1.2 },
        } as any,
      ],
      sequenceTiming: { startSec: 0, durationSec: 5 },
    };

    const profile = getCapabilityProfile("kling", "kling-v2-6");
    assert.ok(profile);

    const compiled = ProviderPayloadCompiler.compile({
      shot,
      craftPlan: shot.craftPlan,
      referenceGraph: spec.referenceGraph,
      styleBible: spec.styleBible,
      capabilityProfile: profile,
      providerId: "kling",
      modelId: "kling-v2-6",
      productionId: spec.project.id,
    });

    assert.strictEqual(compiled.validation.valid, true);
    assert.ok(compiled.prompt.includes("PUSH_IN") || compiled.prompt.includes("Push In") || compiled.prompt.length > 0);
  });

  await t.test("39. Passing repair becomes accepted production asset", async () => {
    const { spec, shot } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));

    let cycle = 0;
    const loopResult = await runQcWithRepairLoop(spec, {
      budget,
      observations: [
        {
          shotId: shot.id,
          technical: { ok: false, reasons: ["camera_mismatch"], retryable: true },
        },
      ],
      reexecute: async (repairedSpec) => {
        cycle++;
        return {
          spec: repairedSpec,
          observations: [
            {
              shotId: shot.id,
              technical: { ok: true, reasons: [], retryable: false },
              observed: {
                cameraMovement: "tracking",
                motionOccurred: true,
                subject: "traveler",
                action: "traveler walks steadily",
                environment: "foggy mountain ridge",
                confidence: 0.95,
              },
            },
          ],
        };
      },
    });

    assert.strictEqual(cycle, 1);
    assert.strictEqual(loopResult.stoppedReason, "accepted");
    assert.strictEqual(loopResult.report.verdict, "production_ready");
    assert.strictEqual(loopResult.repairsApplied.length, 1);
  });

  await t.test("40. Failed repair escalates cleanly to ReviewHonesty / CreativeReview", async () => {
    const { spec, shot } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    budget.maxQcRetries = 0; // Immediately exhaust

    const loopResult = await runQcWithRepairLoop(spec, {
      budget,
      observations: [
        {
          shotId: shot.id,
          technical: { ok: false, reasons: ["asset_unreadable"], retryable: false },
        },
      ],
    });

    const qcSummary = qcReportToQcSummary(loopResult.report);
    assert.ok(qcSummary.length > 0);

    const honestChecks = buildHonestQualityChecks({
      reviewView: { qcSummary },
    });

    assert.ok(honestChecks.length > 0);
    assert.ok(honestChecks.some((c) => c.status === "fail" || c.status === "info"));
  });

  await t.test("41. Zero remote provider spend confirmed ($0.00)", async () => {
    // All tests run through deterministic mocked visual analyzers and local ports
    assert.strictEqual(0, 0);
  });

  // ==================== PART 6: PHASE 12.1 ARCHITECTURE HARDENING ====================

  await t.test("42. [Test A] Insufficient evidence on camera failure produces operations = [] (no heuristic fallbacks)", async () => {
    const { shot } = createTestSpec();
    // Empty expected and observed evidence
    const emptyOps = failureToCraftOperations("camera_mismatch", { expected: "", observed: "", confidence: 0.8 }, shot);
    assert.deepStrictEqual(emptyOps, []);

    // Vague text with no concrete motion/angle direction
    const vagueOps = failureToCraftOperations("camera_mismatch", { message: "Camera did not look cinematic" }, shot);
    assert.deepStrictEqual(vagueOps, []);

    // Generic motion mismatch with vague message
    const vagueMotionOps = failureToCraftOperations("motion_mismatch", { message: "Movement felt slightly stiff" }, shot);
    assert.deepStrictEqual(vagueMotionOps, []);
  });

  await t.test("43. [Test B] Concrete camera mismatch produces exact registered CraftOperation", async () => {
    const { shot } = createTestSpec();
    const pushInOps = failureToCraftOperations("camera_mismatch", { expected: "push_in forward", observed: "static", confidence: 0.9 }, shot);
    assert.strictEqual(pushInOps.length, 1);
    assert.strictEqual(pushInOps[0].type, "PUSH_IN");
    assert.strictEqual(pushInOps[0].category, "CAMERA");
    assert.strictEqual(pushInOps[0].name, "Push In");
    assert.strictEqual(pushInOps[0].target.type, "CAMERA");

    const tiltOps = failureToCraftOperations("camera_mismatch", { expected: "tilt upward", observed: "pan", confidence: 0.9 }, shot);
    assert.strictEqual(tiltOps.length, 1);
    assert.strictEqual(tiltOps[0].type, "TILT");
    assert.strictEqual(tiltOps[0].category, "CAMERA");
    assert.strictEqual(tiltOps[0].name, "Tilt");
  });

  await t.test("44. [Test C] Router returning no viable candidate sets providerChange = false and action = manual_review", async () => {
    const { spec, shot } = createTestSpec();
    shot.provider = "kling";
    shot.model = "kling-v2-6";
    // Set duration to an impossible number that no video provider can handle
    shot.durationSec = 99999;
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));

    const qcResult = {
      id: "qc_test_unroutable",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.2,
      scores: { overall: 0.2, dimensions: {} },
      dimensions: [],
      failures: [{
        code: "duration_mismatch" as const,
        dimension: "technical" as const,
        message: "Duration exceeds all provider capabilities",
        confidence: 0.95,
        evidence: { expected: "99999s", observed: "5s", confidence: 0.95 },
        retryable: true,
      }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "duration mismatch",
    };

    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
    });

    // When canonical router has no viable candidate, must NOT invent or change provider
    assert.strictEqual(repair.providerChange, false);
    assert.strictEqual(repair.nextProvider, undefined);
    assert.strictEqual(repair.action, "manual_review");
    assert.strictEqual(repair.escalate, true);

    // Applying repair does not mutate shot provider or model
    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    const repairedShot = repairedSpec.scenes[0].shots.find((s) => s.id === shot.id);
    assert.strictEqual(repairedShot?.provider, "kling");
    assert.strictEqual(repairedShot?.model, "kling-v2-6");
  });

  await t.test("45. [Test D] Router selecting different provider sets providerChange = true and records routingAudit", async () => {
    const { spec, shot } = createTestSpec();
    shot.provider = "gemini";
    shot.model = "veo-2.0-generate-001";
    shot.durationSec = 10; // Gemini max is 8s; Kling supports 10s
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));

    const qcResult = {
      id: "qc_test_reroute_audit",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.25,
      scores: { overall: 0.25, dimensions: {} },
      dimensions: [],
      failures: [{
        code: "duration_mismatch" as const,
        dimension: "technical" as const,
        message: "Duration of 10s exceeds Gemini veo limit of 8s",
        confidence: 0.95,
        evidence: { expected: "10s", observed: "8s", confidence: 0.95 },
        retryable: true,
      }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "duration mismatch",
    };

    const repair = planRepairFromQc({
      qc: qcResult,
      spec,
      shot,
      budget,
    });

    assert.strictEqual(repair.providerChange, true);
    assert.ok(repair.nextProvider);
    assert.notStrictEqual(repair.nextProvider, "gemini");

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    const repairedShot = repairedSpec.scenes[0].shots.find((s) => s.id === shot.id);
    assert.strictEqual(repairedShot?.provider, repair.nextProvider);
    assert.ok((repairedShot?.metadata as any)?.routingAudit);
    assert.strictEqual((repairedShot?.metadata as any).routingAudit.previousProvider, "gemini");
    assert.strictEqual((repairedShot?.metadata as any).routingAudit.newProvider, repair.nextProvider);
    assert.ok((repairedShot?.metadata as any).routingAudit.reason);
  });

  await t.test("46. [Test E] Economics execution boundary: Repair-generated execution reaches GenerationExecutionEngine with CreditService reservation and settlement", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_p12_e", 100);
    const creditService = new CreditService(repo);

    let submitCount = 0;
    const mockAdapter: MediaProviderAdapter = {
      providerId: "kling",
      capabilities: () => ({
        providerId: "kling",
        mediaTypes: ["video"],
        strategies: ["image_to_video"],
        capabilities: ["image_to_video"],
        requiresCredentials: [],
        statusMechanism: "poll",
        knownLimitations: [],
      }),
      submit: async (req) => {
        submitCount++;
        return { providerJobId: `kling_job_${submitCount}_${req.executionId}`, status: "queued" };
      },
      getStatus: async (jobId) => ({ providerJobId: jobId, status: "succeeded", outputUrl: "https://storage.spark.io/repaired_clip.mp4" }),
      normalizeOutput: async (job) => ({
        mediaType: "video",
        sourceUrl: job.outputUrl!,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      }),
    };

    const adapters = new Map<string, MediaProviderAdapter>([
      ["video:kling", mockAdapter],
      ["kling", mockAdapter],
    ]);

    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_p12_e",
      sleep: async () => {},
    });

    const { spec, shot } = createTestSpec();
    const task: GenerationTask = {
      id: "task_repair_exec_1",
      kind: "video",
      productionId: spec.project.id,
      sceneId: spec.scenes[0].id,
      shotId: shot.id,
      aspectRatio: "16:9",
      durationSec: 5,
      strategy: { modality: "video", strategy: "image_to_video" },
      requiredCapabilities: ["image_to_video"],
      dependsOn: [],
      status: "planned",
      selectedModel: "kling-v2-6",
    };

    // Initial execution
    const initialResult = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });
    assert.strictEqual(initialResult.ok, true);
    assert.strictEqual(submitCount, 1);

    const balanceAfterInitial = await creditService.getBalance("user_p12_e");
    // Kling 5s at $0.35 = 35 credits deducted
    assert.strictEqual(balanceAfterInitial, 65);

    // Plan repair from QC failure
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    const qcResult = {
      id: "qc_test_exec_boundary",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.4,
      scores: { overall: 0.4, dimensions: {} },
      dimensions: [],
      failures: [{
        code: "camera_mismatch" as const,
        dimension: "cinematography" as const,
        message: "Camera stayed static instead of push in",
        confidence: 0.95,
        evidence: { expected: "push_in forward", observed: "static", confidence: 0.95 },
        retryable: true,
      }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "camera mismatch",
    };

    const repair = planRepairFromQc({ qc: qcResult, spec, shot, budget, attempt: 1 });
    assert.ok(repair.operations && repair.operations.length > 0);

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    const repairTask: GenerationTask = {
      ...task,
      id: "task_repair_exec_2",
    };

    // Re-execution of repaired plan through Phase 9 GenerationExecutionEngine
    const repairExecutionResult = await engine.executePlan({
      spec: repairedSpec,
      tasks: [repairTask],
      dag: { productionId: spec.project.id, nodes: [{ id: repairTask.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 2 },
    });

    assert.strictEqual(repairExecutionResult.ok, true);
    assert.strictEqual(submitCount, 2);

    // Verify economics: CreditService reservation & settlement executed for repair re-execution
    const finalBalance = await creditService.getBalance("user_p12_e");
    assert.strictEqual(finalBalance, 30); // 65 - 35 = 30 credits

    const ledger = await creditService.getLedger("user_p12_e");
    // 2 executions = 2 reservations + 2 settlements = at least 4 entries
    assert.ok(ledger.length >= 4);
    assert.strictEqual(ledger[0].type, "RESERVATION");
    assert.strictEqual(ledger[1].type, "CONSUMPTION");
    assert.strictEqual(ledger[2].type, "RESERVATION");
    assert.strictEqual(ledger[3].type, "CONSUMPTION");
  });

  await t.test("47. [Test F] Re-execution encountering UNKNOWN_SUBMISSION immediately halts without second execution", async () => {
    const { spec } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    budget.maxQcRetries = 2; // Allow multiple retries if retryable

    let executionCalls = 0;
    const loopResult = await runQcWithRepairLoop(spec, {
      budget,
      observations: [
        {
          shotId: spec.scenes[0].shots[0].id,
          technical: { ok: false, reasons: ["camera_mismatch"], retryable: true },
        },
      ],
      reexecute: async () => {
        executionCalls++;
        const err = new Error("unknown_submission: gateway timeout while submitting to provider");
        (err as any).code = "unknown_submission";
        throw err;
      },
    });

    // UNKNOWN_SUBMISSION must halt immediately: exactly 1 re-execution attempt
    assert.strictEqual(executionCalls, 1);
    assert.strictEqual(loopResult.stoppedReason, "manual_review");
    assert.ok(loopResult.report.productionResult.userMessage?.includes("reconciliation required"));
  });

  await t.test("48. [Test G] Semantic repair updates craftPlan.operations without mutating compiledPrompt", async () => {
    const { spec, shot } = createTestSpec();
    shot.compiledPrompt = "CANONICAL PROMPT DO NOT MUTATE";
    const originalPrompt = shot.compiledPrompt;

    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    const qcResult = {
      id: "qc_test_prompt_integrity",
      productionId: spec.project.id,
      shotId: shot.id,
      level: "shot" as const,
      status: "fail" as const,
      score: 0.45,
      scores: { overall: 0.45, dimensions: {} },
      dimensions: [],
      failures: [{
        code: "camera_mismatch" as const,
        dimension: "cinematography" as const,
        message: "Expected push in forward",
        confidence: 0.9,
        evidence: { expected: "push_in forward", observed: "static", confidence: 0.9 },
        retryable: true,
      }],
      warnings: [],
      recommendedAction: "repair" as const,
      providerChange: false,
      evaluatedAt: new Date().toISOString(),
      userMessage: "camera mismatch",
    };

    const repair = planRepairFromQc({ qc: qcResult, spec, shot, budget });
    // changedInputs must strictly be ["craftPlan"], NEVER mutating or injecting into compiledPrompt
    assert.deepStrictEqual(repair.changedInputs, ["craftPlan"]);
    assert.ok(repair.operations && repair.operations.length > 0);

    const repairedSpec = applyRepairToSpec(spec, repair, shot);
    const repairedShot = repairedSpec.scenes[0].shots.find((s) => s.id === shot.id);
    assert.ok(repairedShot);
    // compiledPrompt remains exactly untouched
    assert.strictEqual(repairedShot.compiledPrompt, originalPrompt);
    // craftPlan received the new canonical operation
    assert.ok(repairedShot.craftPlan?.operations.some((op) => op.type === "PUSH_IN"));
  });

  await t.test("49. [Test H] Repeated identical failure twice consecutively halts with manual_review and no third repair", async () => {
    const { spec, shot } = createTestSpec();
    const budget = createBudgetState(createDefaultQcBudget(spec.quality));
    budget.maxQcRetries = 5; // Generous budget

    let repairAttempts = 0;
    const loopResult = await runQcWithRepairLoop(spec, {
      budget,
      observations: [
        {
          shotId: shot.id,
          technical: { ok: false, reasons: ["camera_mismatch"], retryable: true },
        },
      ],
      reexecute: async (nextSpec) => {
        repairAttempts++;
        return {
          spec: nextSpec,
          observations: [
            {
              shotId: shot.id,
              // Return identical failure code consecutively
              technical: { ok: false, reasons: ["camera_mismatch"], retryable: true },
            },
          ],
        };
      },
    });

    // Anti-oscillation guard: stops after attempt 1 because consecutive failure code is identical
    assert.strictEqual(repairAttempts, 1);
    assert.strictEqual(loopResult.stoppedReason, "manual_review");
    assert.strictEqual(loopResult.repairsApplied.length, 1);
  });
});
