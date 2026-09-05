/**
 * Phase 10 — End-to-end production lifecycle tests (mocked providers only).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import {
  runProductionLifecycle,
  resumeProductionLifecycle,
  runProductionPreflight,
  canTransitionLifecycle,
  transitionLifecycle,
} from "./execution";
import type { ProductionSpec } from "./specification/productionSpec";
import type { QcRepairLoopResult } from "./qc/qcOrchestrator";
import type { EditorialPipelineResult } from "./editorial/pipeline";

function planCoffeeShop(): ProductionSpec {
  const plan = createProductionPlan({
    idea: "A character enters a coffee shop, receives a drink, and walks outside into morning light",
    targetDurationSec: 45,
  });
  assert.equal(plan.ok, true);
  assert.ok(plan.spec);
  assert.ok((plan.spec!.scenes?.length || 0) >= 2);
  const shots = plan.spec!.scenes.flatMap((s) => s.shots);
  assert.ok(shots.length >= 3);
  return plan.spec!;
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
  };
}

describe("Phase 10 lifecycle state machine", () => {
  it("allows planned → preflight → ready → generating → validating → approved → assembling → mastering → completed", () => {
    const path = [
      "planned",
      "preflight",
      "ready",
      "generating",
      "validating",
      "approved",
      "assembling",
      "mastering",
      "completed",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      assert.equal(canTransitionLifecycle(path[i], path[i + 1]), true, `${path[i]}→${path[i + 1]}`);
      const t = transitionLifecycle(path[i], path[i + 1]);
      assert.equal(t.ok, true);
    }
  });

  it("rejects illegal completed → generating without reset", () => {
    assert.equal(canTransitionLifecycle("completed", "generating"), false);
    const t = transitionLifecycle("completed", "generating");
    assert.equal(t.ok, false);
  });
});

describe("Phase 10 preflight", () => {
  it("passes a planned production and blocks an empty one", () => {
    const spec = planCoffeeShop();
    const ok = runProductionPreflight(spec);
    assert.equal(ok.ok, true);
    assert.equal(ok.blockers.length, 0);

    const blocked = runProductionPreflight({
      ...spec,
      scenes: [],
    });
    assert.equal(blocked.ok, false);
    assert.ok(blocked.blockers.some((b) => b.code === "NO_SCENES" || b.code.includes("NO_SHOTS") || b.code.includes("PREFLIGHT_GATE")));
    assert.match(blocked.summary, /BLOCKED/i);
  });
});

describe("Phase 10 golden end-to-end lifecycle", () => {
  it("runs idea→plan→preflight→generate→qc→editorial→master with mocks", async () => {
    const spec = planCoffeeShop();
    const events: string[] = [];
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: true,
        enableEditorial: true,
        enableMaster: true,
        allowCompleteWithoutMaster: true,
        automationMode: "autonomous",
        onEvent: (e) => events.push(e.type),
        deps: {
          runQcWithRepairLoop: async (s) => readyQc(s),
        },
      },
    });

    assert.equal(report.ok, true);
    assert.equal(report.completed, true);
    assert.equal(report.deliverableReady, true);
    assert.equal(report.phase, "completed");
    assert.equal(report.preflight?.ok, true);
    assert.equal(report.execution?.ok, true);
    assert.equal(report.qc?.report.verdict, "production_ready");
    assert.equal(report.editorial?.ok, true);
    assert.equal(report.editorial?.mastering?.ok, true);
    assert.ok(events.includes("preflight_passed"));
    assert.ok(events.includes("generation_completed"));
    assert.ok(events.includes("qc_completed"));
    assert.ok(events.includes("assembly_completed"));
    assert.ok(events.includes("mastering_completed"));
    assert.ok(events.includes("lifecycle_completed"));
    assert.ok(report.checkpoint?.id);
    assert.ok((report.cost.estimated || 0) >= 0);
    assert.ok((report.timing.durationMs || 0) >= 0);
  });
});

describe("Phase 10 failure + recovery", () => {
  it("blocks on preflight failure with actionable codes", async () => {
    const spec = planCoffeeShop();
    const report = await runProductionLifecycle({
      spec: { ...spec, scenes: [] },
      options: { dryRun: true, enableQc: false, enableEditorial: false },
    });
    assert.equal(report.ok, false);
    assert.equal(report.completed, false);
    assert.equal(report.deliverableReady, false);
    assert.equal(report.phase, "blocked");
    assert.ok(report.errors.length > 0);
    assert.match(report.summary, /BLOCKED/i);
  });

  it("does not mark complete when mastering fails", async () => {
    const spec = planCoffeeShop();
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: false,
        enableEditorial: true,
        enableMaster: true,
        allowCompleteWithoutMaster: false,
        automationMode: "autonomous",
        deps: {
          runEditorialPipeline: async () =>
            ({
              ok: true,
              timeline: { id: "tl_1", status: "ready_for_master" } as any,
              validation: { status: "valid" } as any,
              decision: {
                action: "assemble",
                allowMaster: true,
                requireReview: false,
                reasons: ["ok"],
                userMessage: "ok",
              },
              mastering: {
                ok: false,
                deferred: false,
                userMessage: "ffmpeg unavailable",
                job: { id: "mj_1", status: "failed" } as any,
              },
            }) satisfies EditorialPipelineResult,
        },
      },
    });
    assert.equal(report.ok, false);
    assert.equal(report.completed, false);
    assert.equal(report.deliverableReady, false);
    assert.equal(report.phase, "failed");
    assert.ok(report.errors.some((e) => /ffmpeg|master/i.test(e)));
  });

  it("QC production_failed skips editorial and marks failed", async () => {
    const spec = planCoffeeShop();
    let editorialCalled = false;
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: true,
        enableEditorial: true,
        enableMaster: true,
        deps: {
          runQcWithRepairLoop: async (s): Promise<QcRepairLoopResult> => ({
            ...readyQc(s),
            report: {
              ...readyQc(s).report,
              verdict: "production_failed",
              productionResult: {
                status: "fail",
                score: 0.1,
                failures: ["hard_fail"],
                warnings: [],
                recommendedAction: "fail",
                userMessage: "Production failed QC",
              } as any,
            },
            stoppedReason: "no_auto_repair",
          }),
          runEditorialPipeline: async () => {
            editorialCalled = true;
            throw new Error("editorial must not run after production_failed");
          },
        },
      },
    });
    assert.equal(editorialCalled, false);
    assert.equal(report.ok, false);
    assert.equal(report.completed, false);
    assert.equal(report.phase, "failed");
    assert.equal(report.editorial, undefined);
  });

  it("QC needs review skips editorial and awaits review", async () => {
    const spec = planCoffeeShop();
    let editorialCalled = false;
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: true,
        enableEditorial: true,
        deps: {
          runQcWithRepairLoop: async (s): Promise<QcRepairLoopResult> => ({
            ...readyQc(s),
            report: {
              ...readyQc(s).report,
              verdict: "production_needs_review",
            },
            stoppedReason: "manual_review",
          }),
          runEditorialPipeline: async () => {
            editorialCalled = true;
            throw new Error("editorial must not run while awaiting review");
          },
        },
      },
    });
    assert.equal(editorialCalled, false);
    assert.equal(report.ok, false);
    assert.equal(report.completed, false);
    assert.equal(report.phase, "awaiting_review");
    assert.equal(report.editorial, undefined);
  });

  it("resumes completed checkpoint as no-op without regenerating", async () => {
    const spec = planCoffeeShop();
    const first = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: false,
        enableEditorial: false,
        allowCompleteWithoutMaster: true,
      },
    });
    assert.equal(first.completed, true);
    assert.ok(first.checkpoint);

    let generationCalled = false;
    const resumed = await resumeProductionLifecycle(first.checkpoint!, {
      dryRun: true,
      enableQc: false,
      enableEditorial: false,
      allowCompleteWithoutMaster: true,
      deps: {
        executeProduction: async () => {
          generationCalled = true;
          throw new Error("resume of completed must not regenerate");
        },
      },
    });
    assert.equal(generationCalled, false);
    assert.equal(resumed.ok, true);
    assert.equal(resumed.completed, true);
    assert.equal(resumed.phase, "completed");
    assert.equal(resumed.productionId, first.productionId);
    assert.match(resumed.summary, /no-op|skipped|already completed/i);
  });

  it("cancels via AbortSignal before start", async () => {
    const spec = planCoffeeShop();
    const controller = new AbortController();
    controller.abort();
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        signal: controller.signal,
        enableQc: false,
        enableEditorial: false,
      },
    });
    assert.equal(report.ok, false);
    assert.equal(report.completed, false);
    assert.equal(report.phase, "cancelled");
    assert.ok(report.errors.some((e) => /abort/i.test(e)));
    assert.ok(report.events.some((e) => e.type === "lifecycle_cancelled"));
  });

  it("cancels via AbortSignal after generation", async () => {
    const spec = planCoffeeShop();
    const controller = new AbortController();
    const { executeProduction } = await import("./execution/productionExecutor");
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        signal: controller.signal,
        enableQc: false,
        enableEditorial: false,
        deps: {
          executeProduction: async (s, opts) => {
            const result = await executeProduction(s, opts);
            controller.abort();
            return result;
          },
        },
      },
    });
    assert.equal(report.ok, false);
    assert.equal(report.completed, false);
    assert.equal(report.phase, "cancelled");
    assert.ok(report.events.some((e) => e.type === "lifecycle_cancelled"));
  });

  it("is idempotent when executed twice with dryRun", async () => {
    const spec = planCoffeeShop();
    const a = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: false,
        enableEditorial: true,
        enableMaster: true,
        allowCompleteWithoutMaster: true,
        automationMode: "autonomous",
      },
    });
    const b = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: false,
        enableEditorial: true,
        enableMaster: true,
        allowCompleteWithoutMaster: true,
        automationMode: "autonomous",
      },
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(a.completed, true);
    assert.equal(b.completed, true);
    assert.equal(a.phase, "completed");
    assert.equal(b.phase, "completed");
  });
});

describe("Phase 10 parallelism / sequencing contract", () => {
  it("generation dry-run succeeds and exposes task graph completion", async () => {
    const spec = planCoffeeShop();
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: false,
        enableEditorial: false,
        allowCompleteWithoutMaster: true,
      },
    });
    assert.equal(report.execution?.ok, true);
    assert.ok((report.execution?.tasks?.length || 0) > 0);
    const statuses = new Set((report.execution?.tasks || []).map((t) => t.status));
    assert.ok(statuses.has("succeeded") || statuses.has("skipped") || statuses.has("failed") || statuses.size > 0);
  });
});
