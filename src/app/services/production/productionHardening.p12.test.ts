/**
 * Phase 12 — Production validation, hardening & readiness gates.
 * Mocked providers only — no live paid calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import { buildProductionDag, validateProductionDag } from "./dag/productionDag";
import {
  validateProductionContracts,
  buildProductionLineageGraph,
  validateLineageIntegrity,
  assertCandidateLineagePreserved,
  assertApprovedAssetsProtected,
  normalizeProductionError,
  unknownMetric,
  createMemoryIdempotentLifecycleStore,
  runIdempotentProductionLifecycle,
  createFailureInjector,
  withInjectedFailure,
  expectedPolicyFor,
  looksLikeSecretKey,
  findForbiddenClientSecretKeys,
  scrubSecrets,
  assertNoClientSecrets,
  buildProductionReadinessReport,
  gate,
  runGoldenProductionScenario,
  evaluateQcEvidence,
  assertNoFakePass,
} from "./hardening";
import { evaluateAutonomyGate, DEFAULT_AUTONOMY_POLICY } from "./intelligence/autonomy";
import { runProductionLifecycle } from "./execution";
import type { ProductionSpec } from "./specification";
import type { QcRepairLoopResult } from "./qc/qcOrchestrator";

function planFixture(
  idea = "A barista pours espresso; customer smiles; rain on glass"
): ProductionSpec {
  const plan = createProductionPlan({ idea, targetDurationSec: 20 });
  assert.equal(plan.ok, true);
  assert.ok(plan.spec);
  return plan.spec!;
}

function readyQc(spec: ProductionSpec): QcRepairLoopResult {
  return {
    report: {
      shotResults: [],
      sceneResults: [],
      productionResult: {
        status: "pass",
        score: 0.91,
        failures: [],
        warnings: [],
        recommendedAction: "continue",
        userMessage: "QC pass with evidence",
      } as any,
      verdict: "production_ready",
    },
    budget: {
      qcRetries: 0,
      maxQcRetries: 2,
      providerChanges: 0,
      maxProviderChanges: 1,
      exhausted: false,
    } as any,
    repairsApplied: [],
    automation: [],
    stoppedReason: "accepted",
    finalSpec: spec,
  } as QcRepairLoopResult;
}

const mockedLifecycleOptions = {
  dryRun: true,
  enableQc: true,
  enableEditorial: true,
  enableMaster: true,
  allowCompleteWithoutMaster: true,
  automationMode: "autonomous" as const,
  deps: {
    runQcWithRepairLoop: async (s: ProductionSpec) => readyQc(s),
  },
};

describe("Phase 12 contracts", () => {
  it("validates ProductionSpec → SceneSpec → ShotSpec construction (G1)", () => {
    const spec = planFixture();
    const report = validateProductionContracts(spec);
    assert.equal(report.ok, true, report.errors.map((e) => e.message).join("; "));
    assert.ok((spec.scenes?.length || 0) >= 1);
    assert.ok(spec.scenes.some((s) => (s.shots?.length || 0) >= 1));
  });

  it("flags duplicate scene ids", () => {
    const spec = planFixture();
    const scene = spec.scenes[0];
    const broken = { ...spec, scenes: [scene, { ...scene }] };
    const report = validateProductionContracts(broken);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.code === "DUPLICATE_SCENE_ID"));
  });
});

describe("Phase 12 lineage integrity", () => {
  it("builds production→scene→shot lineage without orphans", () => {
    const spec = planFixture();
    const nodes = buildProductionLineageGraph({
      spec,
      approvedAssetIds: ["asset_a", "asset_b"],
      masterId: "master_1",
    });
    const report = validateLineageIntegrity(nodes);
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.ok(nodes.some((n) => n.kind === "production"));
    assert.ok(nodes.some((n) => n.kind === "scene"));
    assert.ok(nodes.some((n) => n.kind === "shot"));
  });

  it("preserves candidates and protects approved assets (G8)", () => {
    assert.equal(
      assertCandidateLineagePreserved({
        priorCandidateIds: ["c1", "c2", "c3"],
        nextCandidateIds: ["c1", "c2", "c3", "c4"],
      }).ok,
      true
    );
    assert.deepEqual(
      assertCandidateLineagePreserved({
        priorCandidateIds: ["c1", "c2"],
        nextCandidateIds: ["c1"],
      }).missing,
      ["c2"]
    );

    assert.equal(
      assertApprovedAssetsProtected({
        approvedAssetIds: ["a1"],
        currentAssetIds: ["a1", "a2"],
      }).ok,
      true
    );
    const silent = assertApprovedAssetsProtected({
      approvedAssetIds: ["a1"],
      currentAssetIds: ["a2"],
      replacements: { a1: "a2" },
    });
    assert.equal(silent.ok, false);
    assert.ok(silent.violations[0].includes("silently replaced"));
  });
});

describe("Phase 12 DAG safety (G4)", () => {
  it("accepts a valid DAG and rejects cycles", () => {
    const spec = planFixture();
    const dag = buildProductionDag(spec);
    const ok = validateProductionDag(dag);
    assert.equal(ok.ok, true, JSON.stringify(ok.issues));

    const cyclic = {
      ...dag,
      nodes: [
        { ...dag.nodes[0], id: "n1", dependsOn: ["n2"] },
        { ...(dag.nodes[1] || dag.nodes[0]), id: "n2", dependsOn: ["n1"] },
      ],
    };
    assert.equal(validateProductionDag(cyclic as any).ok, false);
  });
});

describe("Phase 12 idempotency (G5)", () => {
  it("executeProduction x3 does not duplicate billable attempts", async () => {
    const spec = planFixture();
    const store = createMemoryIdempotentLifecycleStore();
    const r1 = await runIdempotentProductionLifecycle({
      spec,
      store,
      options: mockedLifecycleOptions,
    });
    const r2 = await runIdempotentProductionLifecycle({
      spec,
      store,
      options: mockedLifecycleOptions,
    });
    const r3 = await runIdempotentProductionLifecycle({
      spec,
      store,
      options: mockedLifecycleOptions,
    });
    assert.equal(r1.reused, false);
    assert.equal(r2.reused, true);
    assert.equal(r3.reused, true);
    assert.equal(r3.record.billableAttempts, 1);
    assert.equal(r3.record.runCount, 3);
    assert.equal(r1.report.ok, true);
    assert.equal(r1.report.completed, true);
  });
});

describe("Phase 12 failure injection (G6)", () => {
  it("classifies provider failures without flattening taxonomy", async () => {
    const kinds = [
      "provider_unavailable",
      "provider_timeout",
      "rate_limited",
      "invalid_response",
      "missing_asset_url",
      "qc_fail",
      "budget_exceeded",
      "mastering_unavailable",
      "webhook_duplicate",
    ] as const;

    for (const kind of kinds) {
      const injector = createFailureInjector({
        kind,
        stage: "provider",
        times: 1,
      });
      const policy = expectedPolicyFor(kind);
      assert.equal(policy.mustNotCorruptState, true);
      assert.equal(policy.mustNotDoubleCharge, true);

      await assert.rejects(async () => {
        await withInjectedFailure(injector, "provider", async () => "ok");
      });

      injector.reset();
      const produced = injector.consume();
      assert.ok(produced);
      assert.notEqual(produced.code, "generation_failed");
      const normalized = normalizeProductionError({
        code: produced.code,
        message: produced.message,
        category: produced.category,
      });
      assert.ok(normalized.category);
      assert.ok(normalized.recoverability);
    }
  });
});

describe("Phase 12 QC evidence gates (G7)", () => {
  it("never marks PASS without evidence; catches drift; honors intentional breaks", () => {
    const noEvidence = evaluateQcEvidence({
      dimension: "identity",
      expected: "CHAR_001",
      evidenceAvailable: false,
    });
    assert.equal(noEvidence.status, "UNVERIFIED");

    const characterDrift = evaluateQcEvidence({
      dimension: "identity",
      expected: "CHAR_001",
      observed: "different_face",
      evidenceAvailable: true,
      matches: false,
    });
    assert.equal(characterDrift.status, "FAIL");

    const wardrobeDrift = evaluateQcEvidence({
      dimension: "wardrobe",
      expected: "black jacket",
      observed: "white jacket",
      evidenceAvailable: true,
      matches: false,
    });
    assert.equal(wardrobeDrift.status, "FAIL");

    const spatial = evaluateQcEvidence({
      dimension: "spatial",
      expected: "screen-left",
      observed: "screen-right",
      evidenceAvailable: true,
      matches: false,
    });
    assert.equal(spatial.status, "FAIL");

    const intentional = evaluateQcEvidence({
      dimension: "wardrobe",
      expected: "black jacket",
      observed: "white jacket",
      evidenceAvailable: true,
      matches: false,
      intentionalChange: true,
    });
    assert.equal(intentional.status, "PASS");

    const montage = evaluateQcEvidence({
      dimension: "continuity",
      expected: "same location",
      observed: "montage cut",
      evidenceAvailable: true,
      matches: false,
      intentionalChange: true,
    });
    assert.equal(montage.status, "PASS");

    assert.equal(assertNoFakePass([noEvidence, characterDrift, intentional]).ok, true);
  });
});

describe("Phase 12 autonomy bounds (G10)", () => {
  it("stops when estimated cost exceeds budget", () => {
    const result = evaluateAutonomyGate({
      estimatedCostUsd: 999,
      policy: { ...DEFAULT_AUTONOMY_POLICY, maxEstimatedCostUsd: 10 },
    });
    assert.equal(result.decision, "pause_budget");
  });

  it("keeps unknown metrics as UNKNOWN (not 0)", () => {
    assert.equal(unknownMetric(), undefined);
    assert.notEqual(unknownMetric(), 0);
  });
});

describe("Phase 12 secrets boundary (G11)", () => {
  it("detects secrets that must not reach client code", () => {
    assert.equal(looksLikeSecretKey("SUPABASE_SERVICE_ROLE_KEY"), true);
    assert.equal(looksLikeSecretKey("OPENAI_API_KEY"), true);

    const offenders = findForbiddenClientSecretKeys({
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      VITE_PUBLIC_ANON_KEY: "public",
      OPENAI_API_KEY: "sk",
    });
    assert.ok(offenders.includes("SUPABASE_SERVICE_ROLE_KEY"));
    assert.ok(offenders.includes("OPENAI_API_KEY"));

    const scrubbed = scrubSecrets({ OPENAI_API_KEY: "sk-test", productionId: "p1" });
    assert.equal("OPENAI_API_KEY" in scrubbed, false);
    assert.equal(scrubbed.productionId, "p1");

    assert.equal(
      assertNoClientSecrets({
        filePath: "src/app/components/Foo.tsx",
        exportedEnvKeys: ["SUPABASE_SERVICE_ROLE_KEY"],
      }).ok,
      false
    );
  });
});

describe("Phase 12 golden E2E (G12)", () => {
  it("runs idea→plan→lifecycle→lineage→idempotency without live providers", async () => {
    const result = await runGoldenProductionScenario();
    assert.equal(result.ok, true, JSON.stringify(result.assertions.filter((a) => !a.pass)));
    assert.equal(result.completed, true);
    assert.equal(result.deliverableReady, true);
    assert.equal(result.idempotentReuse, true);
    assert.equal(result.autonomyBudgetHonored, true);
    assert.ok(result.lineageNodes >= 3);
  });
});

describe("Phase 12 readiness scorecard", () => {
  it("reports PRODUCTION_READY_WITH_LIMITATIONS when gates pass with limitations", () => {
    const report = buildProductionReadinessReport({
      gates: [
        gate("G1_SPEC_CONSTRUCTION", "PASS", ["contracts ok"]),
        gate("G2_STORYBOARD_SHOT_MAPPING", "PASS_WITH_LIMITATIONS", ["mapping present"]),
        gate("G3_CONTINUITY_PROPAGATION", "PASS", ["continuity engine present"]),
        gate("G4_DAG_SAFETY", "PASS", ["dag validator present"]),
        gate("G5_IDEMPOTENT_EXECUTION", "PASS", ["idempotent lifecycle"]),
        gate("G6_PROVIDER_FAILURE_ISOLATION", "PASS", ["failure injection"]),
        gate("G7_QC_EVIDENCE", "PASS", ["no fake PASS"]),
        gate("G8_APPROVED_ASSET_PROTECTION", "PASS", ["approved assets protected"]),
        gate("G9_MASTER_VALIDATION", "PASS_WITH_LIMITATIONS", ["ffmpeg may be unavailable"]),
        gate("G10_AUTONOMY_BOUNDS", "PASS", ["budget gate"]),
        gate("G11_SECRET_BOUNDARY", "PASS", ["secret scrubbing"]),
        gate("G12_GOLDEN_E2E", "PASS", ["golden scenario"]),
      ],
      knownLimitations: [
        "dryRun generation in CI",
        "mocked QC evidence path",
        "FFmpeg mastering may be unavailable",
      ],
    });
    assert.equal(report.overall, "PASS_WITH_LIMITATIONS");
    assert.equal(report.verdict, "PRODUCTION_READY_WITH_LIMITATIONS");
    assert.equal(report.remainingBlockers.length, 0);
    assert.equal(report.architectureIntegrity.singleOrchestrator, true);
  });

  it("blocks overall verdict when a hard gate is BLOCKED", () => {
    const report = buildProductionReadinessReport({
      gates: [
        gate("G5_IDEMPOTENT_EXECUTION", "BLOCKED", [], ["duplicate billable generation"]),
      ],
    });
    assert.equal(report.overall, "BLOCKED");
    assert.equal(report.verdict, "NOT_PRODUCTION_READY");
    assert.ok(report.remainingBlockers.length >= 1);
  });
});

describe("Phase 12 concurrency / race idempotency", () => {
  it("parallel lifecycle invocations share one billable attempt once first completes", async () => {
    const spec = planFixture("Parallel race: barista pour; smile; rain");
    const store = createMemoryIdempotentLifecycleStore();
    const first = await runIdempotentProductionLifecycle({
      spec,
      store,
      options: mockedLifecycleOptions,
    });
    const [a, b] = await Promise.all([
      runIdempotentProductionLifecycle({ spec, store, options: mockedLifecycleOptions }),
      runIdempotentProductionLifecycle({ spec, store, options: mockedLifecycleOptions }),
    ]);
    assert.equal(first.reused, false);
    assert.equal(a.reused, true);
    assert.equal(b.reused, true);
    assert.equal(a.record.billableAttempts, 1);
    assert.equal(b.record.billableAttempts, 1);
  });
});

describe("Phase 12 direct lifecycle smoke", () => {
  it("runProductionLifecycle dryRun completes with mocked QC", async () => {
    const spec = planFixture();
    const report = await runProductionLifecycle({
      spec,
      options: mockedLifecycleOptions,
    });
    assert.equal(report.ok, true);
    assert.equal(report.completed, true);
    assert.equal(report.deliverableReady, true);
  });
});
