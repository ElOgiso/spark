import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  recordProductionTombstone,
  clearProductionTombstones,
  isProductionTombstoned,
  filterTombstonedProductions,
  filterTombstonedReviews,
} from "./productionTombstone";

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
  return store;
}

describe("production tombstones", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });
  afterEach(() => {
    delete (globalThis as any).localStorage;
  });

  it("hides tombstoned productions and reviews from hydrate arrays", () => {
    recordProductionTombstone("prod-1", "rev-1");
    assert.equal(isProductionTombstoned("prod-1"), true);
    assert.equal(isProductionTombstoned("rev-1"), true);
    assert.equal(isProductionTombstoned("prod-2"), false);

    const productions = filterTombstonedProductions([{ id: "prod-1" }, { id: "prod-2" }]);
    assert.deepEqual(productions.map((p) => p.id), ["prod-2"]);

    const reviews = filterTombstonedReviews([
      { id: "rev-1", productionId: "prod-1" },
      { id: "rev-2", productionId: "prod-2" },
      { id: "rev-3", productionId: "prod-1" },
    ]);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].id, "rev-2");
  });

  it("clears tombstones so restore can show rows again", () => {
    recordProductionTombstone("prod-1");
    clearProductionTombstones("prod-1");
    assert.equal(isProductionTombstoned("prod-1"), false);
  });
});
