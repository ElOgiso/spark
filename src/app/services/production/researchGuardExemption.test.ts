import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { VideoUnderstandingProvider } from "../research/providers/VideoUnderstandingProvider";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as any).window = { dispatchEvent: () => true };
  return store;
}

describe("Production Generation OFF Research Exemption & Resilience", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });
  it("exempts videoUnderstanding, research, memory, and analytics when Production Generation is OFF", () => {
    ProductionGenerationGuard.setEnabled(false);
    assert.equal(ProductionGenerationGuard.isEnabled(), false);

    // Exempt categories must NOT throw
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.videoUnderstanding", "videoUnderstanding")
    );
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.research", "research")
    );
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.memory", "memory")
    );
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.analytics", "analytics")
    );
    assert.doesNotThrow(() =>
      ProductionGenerationGuard.assertSpendAllowed("modelRouter.superSpark", "superSpark")
    );

    // Non-exempt categories MUST throw
    assert.throws(
      () => ProductionGenerationGuard.assertSpendAllowed("modelRouter.storyboardImages", "storyboardImages"),
      /currently OFF/
    );
    assert.throws(
      () => ProductionGenerationGuard.assertSpendAllowed("modelRouter.videoGeneration", "videoGeneration"),
      /currently OFF/
    );
    assert.throws(
      () => ProductionGenerationGuard.assertSpendAllowed("modelRouter.production", "production"),
      /currently OFF/
    );
  });

  it("extracts videoId and ensures platform routing in VideoUnderstandingProvider", () => {
    const res = VideoUnderstandingProvider.extractVideoId("https://www.youtube.com/watch?v=Uqz_jmpXIG8");
    assert.equal(res.platform, "youtube");
    assert.equal(res.videoId, "Uqz_jmpXIG8");

    const shortsRes = VideoUnderstandingProvider.extractVideoId("https://www.youtube.com/shorts/Uqz_jmpXIG8");
    assert.equal(shortsRes.platform, "youtube");
    assert.equal(shortsRes.videoId, "Uqz_jmpXIG8");
  });
});
