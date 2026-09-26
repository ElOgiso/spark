import test from "node:test";
import assert from "node:assert/strict";
import {
  ANALYTICS_EMPTY_COPY,
  AUTOMATION_USER_LABELS,
  LOCKED_PRIMARY_NAV,
  USER_MODE_COPY,
  allowsUnsafeRetry,
  measuredPerformance,
  presentFromCostEstimate,
  presentInsufficientCredits,
  presentGenerateSpendGate,
  coverFrameIsAvailable,
  presentBrandLock,
  ESTIMATE_REQUIRED_COPY,
  presentLedgerEntry,
  reviewStatusAfterMaster,
  presentLifecycleProgress,
  readAttachedCostEstimate,
  userModePresentation,
  userSafeGenerationMessage,
} from "./userProductionExperience";

test("TEST A — locked navigation keeps the seven product destinations", () => {
  assert.deepEqual(
    LOCKED_PRIMARY_NAV.map((item) => item.label),
    ["SPARK", "MY SPARK", "VIRAL SPARKS", "REVIEW", "CALENDAR", "ANALYTICS", "MORE"],
  );
});

test("TEST C — production mode labels are Narrator, Hybrid, Cinematic only", () => {
  for (const copy of Object.values(USER_MODE_COPY)) {
    assert.match(copy.label, /^(Narrator|Hybrid|Cinematic)$/);
    assert.equal(/\b(express|standard|deep)\b/i.test(copy.description), false);
    assert.equal(/kling|seedance|higgsfield|veo/i.test(copy.description), false);
  }
  assert.equal(userModePresentation("express").label, "Narrator");
  assert.equal(userModePresentation("deep").label, "Cinematic");
  assert.equal(userModePresentation("cinematic").key, "deep");
});

test("TEST H/J — unknown cost is not zero or free", () => {
  assert.equal(presentFromCostEstimate(null).label, "Estimate unavailable");
  assert.equal(presentFromCostEstimate({ amount: null, status: "UNKNOWN" }).label, "Estimate unavailable");
  assert.equal(presentFromCostEstimate({ amount: 0, status: "UNKNOWN" }).kind, "unknown");
  const known = presentFromCostEstimate({ amount: 0.42, status: "EXACT" });
  assert.equal(known.kind, "known");
  if (known.kind === "known") {
    assert.equal(known.credits, 42);
    assert.match(known.label, /42 Spark Credits/);
    assert.equal(known.label.includes("Free"), false);
  }
});

test("TEST I — insufficient credits blocks when the estimate exceeds balance", () => {
  const blocked = presentInsufficientCredits(10, 42);
  assert.equal(blocked.blocked, true);
  if (blocked.blocked) assert.equal(blocked.title, "Not enough Spark Credits");
  assert.equal(presentInsufficientCredits(180, 42).blocked, false);
  assert.equal(presentInsufficientCredits(0, null).blocked, false);
});

test("generate spend stays blocked when the quote is unknown", () => {
  const unknown = presentGenerateSpendGate({ kind: "unknown", label: "Estimate unavailable" }, 200, true);
  assert.equal(unknown.blocked, true);
  if (unknown.blocked) assert.equal(unknown.title, ESTIMATE_REQUIRED_COPY);
  const short = presentGenerateSpendGate(
    { kind: "known", credits: 80, label: "\u2248 80 Spark Credits", disclaimer: "" },
    10,
    true,
  );
  assert.equal(short.blocked, true);
  const ok = presentGenerateSpendGate(
    { kind: "known", credits: 8, label: "\u2248 8 Spark Credits", disclaimer: "" },
    80,
    true,
  );
  assert.equal(ok.blocked, false);
});

test("cover frame waits for an approved or playable film", () => {
  assert.equal(coverFrameIsAvailable({ status: "Drafting" }), false);
  assert.equal(coverFrameIsAvailable({ status: "Ready for Review" }), true);
  assert.equal(coverFrameIsAvailable({ status: "Drafting", videoUrl: "https://cdn.example/master.mp4" }), true);
  assert.equal(coverFrameIsAvailable({ status: "Approved", isGeneratingAssets: true }), false);
});

test("brand lock copy does not invent a mark", () => {
  assert.equal(presentBrandLock(null).locked, false);
  const locked = presentBrandLock({ brandName: "Northstar", brandId: "brand_1" });
  assert.equal(locked.locked, true);
  assert.match(locked.label, /Northstar/);
  assert.match(locked.label, /Do not redraw/);
});

test("TEST Q — unknown submission has no unsafe retry", () => {
  assert.equal(allowsUnsafeRetry("UNKNOWN_SUBMISSION"), false);
  assert.equal(allowsUnsafeRetry("timeout UNKNOWN_SUBMISSION before retry"), false);
  assert.equal(allowsUnsafeRetry("provider failed"), true);
  assert.match(userSafeGenerationMessage("timeout UNKNOWN_SUBMISSION"), /confirming whether this generation completed/);
  assert.equal(userSafeGenerationMessage("Error: at generate (video.ts:10)"), "Visual generation needs another attempt.");
});

test("TEST L/M — progress percent is never invented", () => {
  const missing = presentLifecycleProgress({ stage: "Video", message: "Waiting on the provider" });
  assert.equal(missing.percent, null);
  assert.equal(missing.indeterminate, true);
  assert.equal(missing.stage, "Generating media");
  const known = presentLifecycleProgress({ stage: "Complete", percent: 100 });
  assert.equal(known.percent, 100);
  assert.equal(known.stage, "Ready for review");
});

test("TEST E — automation labels stay independent of production mode", () => {
  assert.deepEqual(Object.values(AUTOMATION_USER_LABELS), [
    "Manual Review Required",
    "Approval Required",
    "Autonomous",
  ]);
  assert.equal(userModePresentation("standard").label, "Hybrid");
});

test("TEST Y — ledger rows use user language and skip empty deltas", () => {
  assert.deepEqual(presentLedgerEntry({ delta: -42, type: "CONSUMPTION" }), {
    label: "Production generation",
    signed: "-42",
  });
  assert.equal(presentLedgerEntry({ delta: 6, type: "REFUND" })?.label, "Refund");
  assert.equal(presentLedgerEntry({ delta: 100, type: "GRANT" })?.label, "Credit purchase/grant");
  assert.equal(presentLedgerEntry({ delta: 0, type: "GRANT" }), null);
});

test("attached cost estimates are not invented", () => {
  assert.equal(readAttachedCostEstimate({ title: "Demo" }), null);
  assert.equal(readAttachedCostEstimate({ estimatedCostUsd: 1.2 }), null);
  const attached = readAttachedCostEstimate({ costEstimate: { amount: null, status: "UNKNOWN" } });
  assert.equal(presentFromCostEstimate(attached).label, "Estimate unavailable");
});

test("TEST R — a master URL alone is not Ready for Review", () => {
  assert.equal(reviewStatusAfterMaster({}), "Checking Quality");
  assert.equal(
    reviewStatusAfterMaster({ generationProgress: { stage: "UNKNOWN_SUBMISSION" } }),
    "Checking Quality",
  );
  assert.equal(
    reviewStatusAfterMaster({ reasoning: { qc: { passed: false }, lifecycle: { deliverableReady: true } } }),
    "Needs Edit",
  );
  assert.equal(
    reviewStatusAfterMaster({ reasoning: { lifecycle: { deliverableReady: true } } }),
    "Ready for Review",
  );
});

test("TEST X — missing analytics stay empty", () => {
  assert.deepEqual(measuredPerformance(null), []);
  assert.match(ANALYTICS_EMPTY_COPY, /Performance data appears/);
});
