/**
 * Phase 12 — Golden end-to-end production scenario (mocked providers).
 * Proves idea → plan → lifecycle → lineage → idempotency without live paid calls.
 */

import type { ProductionSpec } from "../specification";
import { createProductionPlan } from "../intelligence/productionOrchestrator";
import { runProductionLifecycle } from "../execution";
import type { QcRepairLoopResult } from "../qc/qcOrchestrator";
import {
  createMemoryIdempotentLifecycleStore,
  runIdempotentProductionLifecycle,
} from "./idempotentLifecycle";
import {
  buildProductionLineageGraph,
  validateLineageIntegrity,
} from "./lineageIntegrity";
import { evaluateAutonomyGate, DEFAULT_AUTONOMY_POLICY } from "../intelligence/autonomy";

export interface GoldenScenarioResult {
  ok: boolean;
  productionId: string;
  spec: ProductionSpec;
  lifecycleOk: boolean;
  completed: boolean;
  deliverableReady: boolean;
  qcVerdict?: string;
  editorialOk?: boolean;
  masteringOk?: boolean;
  lineageNodes: number;
  lineageEdges: number;
  idempotentReuse: boolean;
  autonomyBudgetHonored: boolean;
  assertions: Array<{ name: string; pass: boolean; detail?: string }>;
  limitations: string[];
}

function readyQc(spec: ProductionSpec): QcRepairLoopResult {
  return {
    report: {
      shotResults: [],
      sceneResults: [],
      productionResult: {
        status: "pass",
        score: 0.92,
        failures: [],
        warnings: [],
        recommendedAction: "continue",
        userMessage: "QC pass",
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

export async function runMockedLifecycle(spec: ProductionSpec) {
  return runProductionLifecycle({
    spec,
    options: {
      dryRun: true,
      enableQc: true,
      enableEditorial: true,
      enableMaster: true,
      allowCompleteWithoutMaster: true,
      automationMode: "autonomous",
      deps: {
        runQcWithRepairLoop: async (s) => readyQc(s),
      },
    },
  });
}

/**
 * Canonical mocked production: coffee-shop idea through full lifecycle + idempotency proof.
 */
export async function runGoldenProductionScenario(opts?: {
  idea?: string;
}): Promise<GoldenScenarioResult> {
  const limitations: string[] = [
    "Generation uses dryRun (no live provider calls)",
    "QC uses deterministic evidence-bearing mock (not live visual analysis)",
    "Mastering may be deferred/degraded when FFmpeg is unavailable in CI",
  ];

  const planned = createProductionPlan({
    idea: opts?.idea ?? "A barista pours espresso; customer smiles; rain on the window",
    targetDurationSec: 20,
  });
  if (!planned.ok || !planned.spec) {
    return {
      ok: false,
      productionId: "none",
      spec: { id: "none" } as ProductionSpec,
      lifecycleOk: false,
      completed: false,
      deliverableReady: false,
      lineageNodes: 0,
      lineageEdges: 0,
      idempotentReuse: false,
      autonomyBudgetHonored: false,
      assertions: [
        {
          name: "plan_created",
          pass: false,
          detail: (planned.errors || []).join("; "),
        },
      ],
      limitations,
    };
  }

  const spec = planned.spec;
  const store = createMemoryIdempotentLifecycleStore();
  const lifecycleOptions = {
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

  const first = await runIdempotentProductionLifecycle({
    spec,
    store,
    options: lifecycleOptions,
  });
  const second = await runIdempotentProductionLifecycle({
    spec,
    store,
    options: lifecycleOptions,
  });

  const report = first.report;
  const approvedAssetIds = Object.values((report.qc as any)?.approvedAssets || {}).map(
    (a: any) => String(a.assetId || a.id)
  );
  const nodes = buildProductionLineageGraph({
    spec,
    approvedAssetIds,
    masterId: (report.editorial as any)?.mastering?.output?.masterId,
  });
  const lineage = validateLineageIntegrity(nodes);

  const budgetGate = evaluateAutonomyGate({
    estimatedCostUsd: 999,
    policy: { ...DEFAULT_AUTONOMY_POLICY, maxEstimatedCostUsd: 10 },
  });

  const assertions: GoldenScenarioResult["assertions"] = [
    { name: "plan_created", pass: planned.ok },
    { name: "scenes_created", pass: (spec.scenes?.length || 0) >= 1 },
    {
      name: "shots_created",
      pass: (spec.scenes || []).some((s) => (s.shots?.length || 0) >= 1),
    },
    { name: "lifecycle_ok", pass: report.ok === true },
    { name: "lifecycle_completed", pass: report.completed === true },
    { name: "deliverable_ready", pass: report.deliverableReady === true },
    {
      name: "qc_executed",
      pass: report.qc?.report?.verdict === "production_ready",
    },
    { name: "editorial_ok", pass: report.editorial?.ok === true },
    {
      name: "master_or_degraded",
      pass:
        report.editorial?.mastering?.ok === true ||
        (report.editorial?.mastering as any)?.deferred === true ||
        report.completed === true,
      detail: (report.editorial?.mastering as any)?.userMessage,
    },
    {
      name: "lineage_preserved",
      pass: lineage.ok && lineage.nodes.length >= 3,
    },
    {
      name: "idempotent_reuse",
      pass: second.reused === true && second.record.runCount >= 2,
      detail: `runCount=${second.record.runCount} billableAttempts=${second.record.billableAttempts}`,
    },
    {
      name: "billable_not_duplicated",
      pass: second.record.billableAttempts === 1,
    },
    {
      name: "autonomy_budget_honored",
      pass: budgetGate.decision === "pause_budget",
    },
  ];

  const ok = assertions.every((a) => a.pass);

  return {
    ok,
    productionId: spec.id,
    spec,
    lifecycleOk: report.ok,
    completed: report.completed,
    deliverableReady: report.deliverableReady,
    qcVerdict: report.qc?.report?.verdict,
    editorialOk: report.editorial?.ok,
    masteringOk: report.editorial?.mastering?.ok,
    lineageNodes: lineage.nodes.length,
    lineageEdges: lineage.nodes.reduce((n, node) => n + node.parentIds.length, 0),
    idempotentReuse: second.reused,
    autonomyBudgetHonored: budgetGate.decision === "pause_budget",
    assertions,
    limitations,
  };
}
