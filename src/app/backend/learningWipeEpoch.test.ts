import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_LEARNING_WIPE_TABLES,
  applyLearningWipeToArrays,
  hasUserAddedSourceSinceWipe,
  isLearningRowBeforeWipe,
  learningRowCreatedAt,
  markUserAddedSourceSinceWipe,
  persistLearningWipeAtLocal,
  rememberSuccessfulLearningWipe,
  requiredWipeDeleteError,
  resolveLearningWipeAt,
  shouldNoOpLearningPersist,
  shouldSkipBackgroundResearchSync,
} from "./learningWipeEpoch";
import { isInMemorySettingsNewer, stampSettingsWrittenAt } from "./brandSettingsFreshness";

function installMemoryStorage() {
  const ls = new Map<string, string>();
  const ss = new Map<string, string>();
  const api = (store: Map<string, string>) => ({
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  });
  (globalThis as any).localStorage = api(ls);
  (globalThis as any).sessionStorage = api(ss);
  return { ls, ss };
}

const BRAND = "brand-wipe-1";
const WIPE_AT = "2026-09-08T12:00:00.000Z";

describe("learning wipe fail-closed + epoch", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    delete (globalThis as any).localStorage;
    delete (globalThis as any).sessionStorage;
  });

  it("required wipe DELETE error on viral_sparks is not ok", () => {
    const error = requiredWipeDeleteError({
      viral_sparks: { error: { message: "RLS denied delete" } },
      research_sources: { error: null },
      research_patterns: { error: null },
      memory_items: { error: null },
    });
    assert.ok(error);
    assert.match(error!, /viral_sparks/);
    assert.match(error!, /RLS denied delete/);
  });

  it("missing required table result is not ok", () => {
    const error = requiredWipeDeleteError({
      research_sources: { error: null },
      research_patterns: { error: null },
      memory_items: { error: null },
    });
    assert.ok(error);
    assert.match(error!, /viral_sparks/);
  });

  it("all required deletes without error is ok", () => {
    const error = requiredWipeDeleteError({
      viral_sparks: { error: null },
      research_sources: { error: null },
      research_patterns: { error: null },
      memory_items: { error: null },
    });
    assert.equal(error, null);
    assert.deepEqual([...REQUIRED_LEARNING_WIPE_TABLES], [
      "viral_sparks",
      "research_sources",
      "research_patterns",
      "memory_items",
    ]);
  });

  it("hydrate cannot refill pre-wipe sparks after epoch", () => {
    persistLearningWipeAtLocal(BRAND, WIPE_AT);
    const filtered = applyLearningWipeToArrays({
      brandId: BRAND,
      brandSettings: { learning_wipe_at: WIPE_AT },
      viralSparks: [
        { id: "old", created_at: "2026-09-07T10:00:00.000Z", title: "pre-wipe" },
        { id: "new", createdAt: "2026-09-08T13:00:00.000Z", title: "post-wipe" },
      ],
      researchSources: [{ id: "src-old", createdAt: "2026-09-01T00:00:00.000Z" }],
      memoryItems: [{ id: "m-old", created_at: "2026-09-07T23:00:00.000Z" }],
      researchPatterns: [{ id: "p-old", createdAt: "2026-09-07T00:00:00.000Z" }],
    });
    assert.equal(filtered.viralSparks.length, 1);
    assert.equal(filtered.viralSparks[0].id, "new");
    assert.equal(filtered.researchSources.length, 0);
    assert.equal(filtered.memoryItems.length, 0);
    assert.equal(filtered.researchPatterns.length, 0);
  });

  it("this-session wipe treats snap learning as empty until user adds a source", () => {
    rememberSuccessfulLearningWipe(BRAND, WIPE_AT);
    const filtered = applyLearningWipeToArrays({
      brandId: BRAND,
      brandSettings: { learning_wipe_at: WIPE_AT },
      viralSparks: [{ id: "stale", createdAt: "2026-09-08T18:00:00.000Z" }],
      researchSources: [{ id: "stale-src", createdAt: "2026-09-08T18:00:00.000Z" }],
      memoryItems: [],
      researchPatterns: [],
    });
    assert.deepEqual(filtered.viralSparks, []);
    assert.deepEqual(filtered.researchSources, []);

    markUserAddedSourceSinceWipe(BRAND);
    assert.equal(hasUserAddedSourceSinceWipe(BRAND), true);
    const afterSource = applyLearningWipeToArrays({
      brandId: BRAND,
      brandSettings: { learning_wipe_at: WIPE_AT },
      viralSparks: [{ id: "fresh", createdAt: "2026-09-08T18:00:00.000Z" }],
      researchSources: [{ id: "fresh-src", createdAt: "2026-09-08T18:00:00.000Z" }],
      memoryItems: [],
      researchPatterns: [],
    });
    assert.equal(afterSource.viralSparks[0].id, "fresh");
    assert.equal(afterSource.researchSources[0].id, "fresh-src");
  });

  it("persistViralSparkCreate no-ops when session wipe is active and no new source", () => {
    rememberSuccessfulLearningWipe(BRAND, WIPE_AT);
    assert.equal(
      shouldNoOpLearningPersist({
        brandId: BRAND,
        kind: "viral_spark",
        rowCreatedAt: "2026-09-08T18:00:00.000Z",
      }),
      true
    );
    assert.equal(
      shouldNoOpLearningPersist({
        brandId: BRAND,
        kind: "memory",
        rowCreatedAt: "2026-09-08T18:00:00.000Z",
      }),
      true
    );
    assert.equal(
      shouldNoOpLearningPersist({
        brandId: BRAND,
        kind: "research_source",
        rowCreatedAt: "2026-09-08T18:00:00.000Z",
      }),
      false
    );
  });

  it("persist no-ops when wipe_at is newer than the row after re-login (no session flag)", () => {
    persistLearningWipeAtLocal(BRAND, WIPE_AT);
    assert.equal(
      shouldNoOpLearningPersist({
        brandId: BRAND,
        kind: "viral_spark",
        rowCreatedAt: "2026-09-07T09:00:00.000Z",
        brandSettings: { learning_wipe_at: WIPE_AT },
      }),
      true
    );
    assert.equal(
      shouldNoOpLearningPersist({
        brandId: BRAND,
        kind: "viral_spark",
        rowCreatedAt: "2026-09-08T13:00:00.000Z",
        brandSettings: { learning_wipe_at: WIPE_AT },
      }),
      false
    );
  });

  it("background research sync skips empty sources and active wipe with empty live sources", () => {
    assert.equal(
      shouldSkipBackgroundResearchSync({ brandId: BRAND, researchSources: [] }),
      true
    );
    rememberSuccessfulLearningWipe(BRAND, WIPE_AT);
    assert.equal(
      shouldSkipBackgroundResearchSync({
        brandId: BRAND,
        brandSettings: { learning_wipe_at: WIPE_AT },
        researchSources: [],
      }),
      true
    );
    assert.equal(
      shouldSkipBackgroundResearchSync({
        brandId: BRAND,
        brandSettings: { learning_wipe_at: WIPE_AT },
        researchSources: [{ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }],
      }),
      true
    );
  });

  it("resolveLearningWipeAt prefers newer of cloud vs local", () => {
    persistLearningWipeAtLocal(BRAND, "2026-09-01T00:00:00.000Z");
    assert.equal(
      resolveLearningWipeAt(BRAND, { learning_wipe_at: WIPE_AT }),
      WIPE_AT
    );
  });

  it("missing created_at is pre-wipe when epoch exists", () => {
    assert.equal(isLearningRowBeforeWipe(null, WIPE_AT), true);
    assert.equal(isLearningRowBeforeWipe("2026-09-08T13:00:00.000Z", WIPE_AT), false);
    assert.equal(learningRowCreatedAt({ firstSeenAt: "2026-09-08T11:00:00.000Z" }), "2026-09-08T11:00:00.000Z");
  });

  it("hydrate keeps in-memory settings when they are newer than the snap", () => {
    const written = stampSettingsWrittenAt(BRAND, "2026-09-08T15:00:00.000Z");
    assert.equal(isInMemorySettingsNewer(written, "2026-09-08T14:00:00.000Z"), true);
    assert.equal(isInMemorySettingsNewer(written, "2026-09-08T16:00:00.000Z"), false);
    assert.equal(isInMemorySettingsNewer(null, WIPE_AT), false);
  });
});
