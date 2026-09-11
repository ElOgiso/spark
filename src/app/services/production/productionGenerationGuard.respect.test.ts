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

  it("applies cloud brand.settings as source of truth into localStorage cache", () => {
    // Empty cache defaults ON
    assert.equal(ProductionGenerationGuard.isEnabled(), true);

    // Cloud OFF must win over missing/default local cache
    store.clear();
    const off = ProductionGenerationGuard.applyCloudPreference(false, "brand-1");
    assert.equal(off, false);
    assert.equal(ProductionGenerationGuard.isEnabled("brand-1"), false);
    assert.equal(store.get(STORAGE_KEY), "false");
    assert.equal(store.get(`${STORAGE_KEY}_brand-1`), "false");

    // Cloud ON restores after OFF
    const on = ProductionGenerationGuard.applyCloudPreference(true, "brand-1");
    assert.equal(on, true);
    assert.equal(ProductionGenerationGuard.isEnabled("brand-1"), true);

    // Undefined cloud keeps cache (does not reset to default)
    ProductionGenerationGuard.setEnabled(false, "brand-1");
    const kept = ProductionGenerationGuard.applyCloudPreference(undefined, "brand-1");
    assert.equal(kept, false);
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

  it("allows dryRun lifecycle when Production Generation is OFF (guard does not block)", async () => {
    ProductionGenerationGuard.setEnabled(false);
    const spec = planSpec();
    // dryRun must pass the Generation guard; preflight may still block on missing anchors
    // (Asset Intelligence readiness) — that is separate from the ON/OFF preference.
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
    const errs = Array.isArray(report.errors) ? report.errors : [];
    assert.ok(
      !errs.some((e) => String(e).includes("Production Generation is currently OFF")),
      "dryRun must not be blocked by Production Generation OFF"
    );
    assert.ok(report.preflight || report.ok || errs.length > 0, "lifecycle must run past the generation guard");
  });

  it("credit firewall: Super Spark chat and research intelligence are allowed when OFF; asset generation is blocked", () => {
    ProductionGenerationGuard.setEnabled(false);
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.superSpark", "superSpark")
    );
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.research", "research")
    );
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.videoUnderstanding", "videoUnderstanding")
    );
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.memory", "memory")
    );
    assert.throws(
      () => ProductionGenerationGuard.assertSpendAllowed("modelRouter.storyboardImages", "storyboardImages"),
      /Super Spark chat and research intelligence are the only allowed spend paths/
    );
    assert.throws(
      () => ProductionGenerationGuard.assertSpendAllowed("modelRouter.production", "production"),
      /currently OFF/
    );
    assert.throws(
      () => ProductionGenerationGuard.assertEnabled("createProductionFromSpark"),
      /currently OFF/
    );
  });

  it("blocks ModelRouter spend categories when OFF before any provider call", async () => {
    ProductionGenerationGuard.setEnabled(false);
    const { ModelRouter } = await import("../runtime/modelRouter");
    await assert.rejects(
      () => ModelRouter.executeCategoryRequest("storyboardImages", { prompt: "do not spend" }),
      /currently OFF/
    );
    await assert.rejects(
      () => ModelRouter.executeCategoryRequest("videoGeneration", { prompt: "do not spend" }),
      /currently OFF/
    );
  });

  it("rejects createProductionFromSpark when Production Generation is OFF", async () => {
    ProductionGenerationGuard.setEnabled(false);
    const { productionService } = await import("../productionService");
    await assert.rejects(
      () =>
        productionService.createProductionFromSpark({
          spark: { id: "s1", title: "t", hook: "h", angle: "a", whyNow: "w" } as any,
          brand: { id: "brand-1", name: "B", niche: "N" } as any,
        }),
      /currently OFF/
    );
  });

  it("assertEnabled with brandId uses the scoped toggle", () => {
    ProductionGenerationGuard.setEnabled(true, "brand-on");
    ProductionGenerationGuard.setEnabled(false, "brand-off");
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertEnabled("createProductionFromSpark", "brand-on")
    );
    assert.throws(
      () => ProductionGenerationGuard.assertEnabled("createProductionFromSpark", "brand-off"),
      /currently OFF/
    );
  });
});
