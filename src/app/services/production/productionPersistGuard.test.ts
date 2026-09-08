import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { recordProductionTombstone, isProductionTombstoned } from "./productionTombstone";
import {
  planProductionCreatePersist,
  planProductionUpdatePersist,
  planReviewCreatePersist,
  planReviewUpdatePersist,
  productionWriteHalted,
  productionDeleteCloudSucceeded,
  isCancelOrStatusPatch,
} from "./productionPersistGuard";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  return store;
}

describe("production persist guards", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    ProductionGenerationGuard.setEnabled(true, "brand-1");
  });

  afterEach(() => {
    delete (globalThis as any).localStorage;
    delete (globalThis as any).window;
  });

  it("late persist after delete is skip_tombstone even when Production is ON", () => {
    recordProductionTombstone("prod-1", "rev-1");
    assert.equal(isProductionTombstoned("prod-1"), true);
    assert.equal(planProductionCreatePersist({ productionId: "prod-1", brandId: "brand-1" }), "skip_tombstone");
    assert.equal(planProductionUpdatePersist({ productionId: "prod-1", brandId: "brand-1" }), "skip_tombstone");
    assert.equal(
      planReviewCreatePersist({ reviewId: "rev-1", productionId: "prod-1", brandId: "brand-1" }),
      "skip_tombstone"
    );
    assert.equal(
      planReviewUpdatePersist({ reviewId: "rev-1", productionId: "prod-1", brandId: "brand-1" }),
      "skip_tombstone"
    );
  });

  it("does not clear tombstones on persist skip — restore is not implied", () => {
    recordProductionTombstone("prod-1");
    planProductionCreatePersist({ productionId: "prod-1", brandId: "brand-1" });
    assert.equal(isProductionTombstoned("prod-1"), true);
  });

  it("skips create when Production is OFF; update is status_only", () => {
    ProductionGenerationGuard.setEnabled(false, "brand-1");
    assert.equal(planProductionCreatePersist({ productionId: "prod-2", brandId: "brand-1" }), "skip_off");
    assert.equal(planProductionUpdatePersist({ productionId: "prod-2", brandId: "brand-1" }), "status_only");
    assert.equal(planReviewCreatePersist({ reviewId: "rev-2", productionId: "prod-2", brandId: "brand-1" }), "skip_off");
    assert.equal(planReviewUpdatePersist({ reviewId: "rev-2", productionId: "prod-2", brandId: "brand-1" }), "status_only");
    assert.equal(isCancelOrStatusPatch("Cancelled"), true);
    assert.equal(isCancelOrStatusPatch("Generating"), false);
  });

  it("halts writes when aborted, tombstoned, or OFF", () => {
    const aborted = { aborted: true } as AbortSignal;
    assert.equal(productionWriteHalted({ productionId: "p", brandId: "brand-1", signal: aborted }), true);

    recordProductionTombstone("p-dead");
    assert.equal(productionWriteHalted({ productionId: "p-dead", brandId: "brand-1" }), true);

    ProductionGenerationGuard.setEnabled(false, "brand-1");
    assert.equal(productionWriteHalted({ productionId: "p-live", brandId: "brand-1" }), true);

    ProductionGenerationGuard.setEnabled(true, "brand-1");
    assert.equal(productionWriteHalted({ productionId: "p-live", brandId: "brand-1" }), false);
  });

  it("cloud delete succeeds when the productions row is already gone", () => {
    assert.equal(productionDeleteCloudSucceeded(false), true);
    assert.equal(productionDeleteCloudSucceeded(true), false);
  });

  it("threads brandId: scoped OFF blocks even if a different brand is ON", () => {
    ProductionGenerationGuard.setEnabled(true, "brand-on");
    ProductionGenerationGuard.setEnabled(false, "brand-off");
    assert.equal(ProductionGenerationGuard.isEnabled("brand-off"), false);
    assert.equal(planProductionCreatePersist({ productionId: "p", brandId: "brand-off" }), "skip_off");
    assert.equal(planProductionUpdatePersist({ productionId: "p", brandId: "brand-off" }), "status_only");
  });
});
