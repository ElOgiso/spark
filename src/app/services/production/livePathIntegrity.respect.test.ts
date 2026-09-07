/**
 * Live-path integrity: memory category CHECK + production toggle cloud key.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMemoryCategoryForDb,
  domainMemoryToInsert,
} from "../../backend/mappers/workspaceMappers";

test("normalizeMemoryCategoryForDb maps UI labels to CHECK-safe snake_case", () => {
  assert.equal(normalizeMemoryCategoryForDb("Winning hooks"), "winning_hooks");
  assert.equal(normalizeMemoryCategoryForDb("Brand"), "brand");
  assert.equal(normalizeMemoryCategoryForDb("Strategy"), "brand"); // unknown → brand
  assert.equal(normalizeMemoryCategoryForDb("winning_hooks"), "winning_hooks");
  assert.equal(normalizeMemoryCategoryForDb(undefined), "brand");
});

test("domainMemoryToInsert never emits raw UI category labels", () => {
  const row = domainMemoryToInsert("00000000-0000-4000-8000-000000000001", {
    id: "m1",
    type: "rule",
    text: "Always keep high-contrast framing",
    dateAdded: "2026-09-07",
    category: "Winning hooks" as any,
    pinned: true,
    fingerprint: "fp-hooks-1",
  });
  assert.equal(row.category, "winning_hooks");
  assert.equal((row.evidence as any)?.pinned, true);
  assert.equal((row.evidence as any)?.fingerprint, "fp-hooks-1");
});

test("domainMemoryToInsert maps Strategy (chat) to brand for CHECK", () => {
  const row = domainMemoryToInsert("00000000-0000-4000-8000-000000000001", {
    id: "m2",
    type: "rule",
    text: "Stay in balanced automation",
    dateAdded: "2026-09-07",
    category: "Strategy" as any,
  });
  assert.equal(row.category, "brand");
});
