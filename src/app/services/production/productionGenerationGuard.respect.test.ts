/**
 * Preference / settings audit — Production Generation ON/OFF must gate live spend paths.
 * dryRun remains allowed so planning + CI can still run when OFF.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { executeProduction } from "./execution/productionExecutor";
import { runProductionLifecycle } from "./execution/productionLifecycleRunner";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import type { ProductionSpec } from "./specification/productionSpec";

const STORAGE_KEY = "spark_production_generation_enabled";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as any).localStorage = localStorage;
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  return store;
}

function planSpec(): ProductionSpec {
  const plan = createProductionPlan({
    idea: "Barista pours espresso; customer smiles; rain on glass",
    targetDurationSec: 20,
  });
  assert.equal(plan.ok, true);
  assert.ok(plan.spec);
  return plan.spec!;
}

describe("Production Generation ON/OFF preference respect", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installMemoryLocalStorage();
    ProductionGenerationGuard.setEnabled(true);
  });

  afterEach(() => {
    store.clear();
    delete (globalThis as any).localStorage;
    delete (globalThis as any).window;
  });

  it("UI storage key defaults to ON and flips OFF via setEnabled", () => {
    assert.equal(ProductionGenerationGuard.isEnabled(), true);
    ProductionGenerationGuard.setEnabled(false);
    assert.equal(store.get(STORAGE_KEY), "false");
    assert.equal(ProductionGenerationGuard.isEnabled(), false);
    ProductionGenerationGuard.setEnabled(true);
    assert.equal(ProductionGenerationGuard.isEnabled(), true);
  });

  it("blocks live executeProduction when Production Generation is OFF", async () => {
    ProductionGenerationGuard.setEnabled(false);
    const spec = planSpec();
    await assert.rejects(
      () => executeProduction(spec, { dryRun: false }),
      /Production Generation is currently OFF/
    );
  });

  it("allows dryRun executeProduction when Production Generation is OFF", async () => {
    ProductionGenerationGuard.setEnabled(false);
    const spec = planSpec();
    const result = await executeProduction(spec, { dryRun: true });
    assert.ok(result);
  });

  it("blocks live runProductionLifecycle when Production Generation is OFF", async () => {
    ProductionGenerationGuard.setEnabled(false);
    const spec = planSpec();
    await assert.rejects(
      () =>
        runProductionLifecycle({
          spec,
          options: {
            dryRun: false,
            enableQc: false,
            enableEditorial: false,
            enableMaster: false,
          },
        }),
      /Production Generation is currently OFF/
    );
  });

  it("allows dryRun lifecycle when Production Generation is OFF", async () => {
    ProductionGenerationGuard.setEnabled(false);
    const spec = planSpec();
    const report = await runProductionLifecycle({
      spec,
      options: {
        dryRun: true,
        enableQc: true,
        enableEditorial: true,
        enableMaster: true,
        allowCompleteWithoutMaster: true,
        automationMode: "autonomous",
        deps: {
          runQcWithRepairLoop: async (s) =>
            ({
              report: {
                shotResults: [],
                sceneResults: [],
                productionResult: {
                  status: "pass",
                  score: 0.9,
                  failures: [],
                  warnings: [],
                  recommendedAction: "continue",
                  userMessage: "ok",
                },
                verdict: "production_ready",
              },
              budget: {
                qcRetries: 0,
                maxQcRetries: 2,
                providerChanges: 0,
                maxProviderChanges: 1,
                exhausted: false,
              },
              repairsApplied: [],
              automation: [],
              stoppedReason: "accepted",
              finalSpec: s,
            }) as any,
        },
      },
    });
    assert.equal(report.ok, true);
  });
});
