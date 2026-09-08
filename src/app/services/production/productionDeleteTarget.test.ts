import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductionDeleteTargetId } from "./productionDeleteTarget";

test("resolveProductionDeleteTargetId never uses the review row id", () => {
  assert.equal(
    resolveProductionDeleteTargetId({
      productionId: "prod-uuid",
      reviewProductionId: "prod-uuid",
      reviewId: "review-uuid",
    }),
    "prod-uuid"
  );
  assert.equal(
    resolveProductionDeleteTargetId({
      productionId: null,
      reviewProductionId: "prod-from-review",
      reviewId: "review-uuid",
    }),
    "prod-from-review"
  );
  assert.equal(
    resolveProductionDeleteTargetId({
      productionId: undefined,
      reviewProductionId: undefined,
      reviewId: "review-uuid",
    }),
    null
  );
});
