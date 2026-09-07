/**
 * Honest Review helpers — no invented QC / narrative.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHonestNarrativeBlueprint,
  buildHonestPlatformStrategy,
  buildHonestQualityChecks,
  buildHonestThumbnails,
  resolveReviewAspectMode,
  reviewMediaFrameClass,
} from "./reviewHonesty";

test("resolveReviewAspectMode respects 16:9 and 9:16", () => {
  assert.equal(resolveReviewAspectMode({ aspectRatio: "16:9" }), "landscape");
  assert.equal(resolveReviewAspectMode({ aspectRatio: "9:16" }), "portrait");
  assert.equal(resolveReviewAspectMode({ formatSettings: { aspectMode: "landscape" } }), "landscape");
});

test("reviewMediaFrameClass uses contain-friendly aspect boxes", () => {
  assert.ok(reviewMediaFrameClass("landscape").includes("aspect-video"));
  assert.ok(reviewMediaFrameClass("portrait").includes("aspect-[9/16]"));
});

test("buildHonestNarrativeBlueprint omits invented conflict/reveal", () => {
  const rows = buildHonestNarrativeBlueprint({
    brief: { hook: "Here is the real spoken hook.", beats: [{ valueJob: "proof", spokenLines: "Proof line" }] },
  });
  assert.ok(rows.some((r) => r.key === "hook"));
  assert.ok(rows.some((r) => r.key === "beat_1"));
  assert.equal(rows.some((r) => /conflict|reveal|payoff/i.test(r.key)), false);
});

test("buildHonestQualityChecks marks pipeline QC as info when not evaluated", () => {
  const checks = buildHonestQualityChecks({
    reviewView: { qcSummary: [{ label: "Continuity", status: "not_evaluated" }] },
    mediaView: { scenes: [{ imageUrl: "https://x/s.png" }], storyboardGridUrl: "https://x/sheet.png" },
    brief: { hook: "A ready to speak host line for the audience." },
  });
  assert.ok(checks.some((c) => c.label === "Scene stills" && c.status === "pass"));
  assert.ok(checks.some((c) => /Pipeline QC/i.test(c.label) && c.status === "info"));
});

test("buildHonestPlatformStrategy only lists real formats", () => {
  const rows = buildHonestPlatformStrategy({
    production: { formats: ["YouTube Shorts"], aspectRatio: "9:16", mode: "standard", targetDurationSec: 45 },
    brief: {},
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "YouTube Shorts");
  assert.ok(!rows.some((r) => /tiktok/i.test(r.label)));
});

test("buildHonestThumbnails ignores fake concept-only entries", () => {
  assert.equal(buildHonestThumbnails({ generatedAssets: { thumbnails: [{ concept: "A" }] } }).length, 0);
  assert.equal(
    buildHonestThumbnails({
      generatedAssets: { thumbnails: [{ concept: "A", image: "https://x/t.png", variant: "A" }] },
    }).length,
    1
  );
});
