import test from "node:test";
import assert from "node:assert/strict";
import { legacyProductionToSpec } from "../specification/adapters";
import { resolveHealthSnapshot } from "../capability/registry";
import { ServiceHealthMonitor } from "../../runtime/serviceHealthMonitor";
import { observationsFromAssets } from "../execution/productionLifecycleRunner";
import { submitMeteredStoryboardImage } from "../studioImageSubmit";
import type { ProductionSpec } from "../specification/productionSpec";
import type { ProductionAsset } from "../../../domain/types";

test("legacy spec seeds character sheet, source video, and brand look", () => {
  const spec = legacyProductionToSpec({
    production: {
      id: "prod_wire",
      title: "Wire",
      brief: {
        visualDirection: "ink wash night market",
        storyboard: [{ scene: 1, durationSec: 4, visualDescription: "stall" }],
      },
    } as any,
    character: {
      name: "Ada",
      characterSheetUrl: "https://cdn.example/ada.png",
      traits: ["calm"],
    } as any,
    spark: {
      id: "spk",
      title: "Source",
      hook: "hook",
      sourceUrl: "https://example.com/watch",
      researchContext: {
        title: "Watched",
        hookPattern: "open fast",
        visualActions: ["holds the product"],
        understandingProvider: "VideoUnderstandingProvider",
      },
    } as any,
  });
  const sheet = spec.referenceGraph?.nodes.find((n) => n.type === "CHARACTER_SHEET");
  const source = spec.referenceGraph?.nodes.find((n) => n.type === "SOURCE_VIDEO");
  assert.equal(sheet?.url, "https://cdn.example/ada.png");
  assert.equal(source?.url, "https://example.com/watch");
  assert.match(source?.description || "", /open fast/);
  assert.equal(spec.styleBible?.visualLanguage.aesthetic, "ink wash night market");
  assert.equal(spec.styleBible?.provenanceMap?.visualLanguage, "BRAND");
});

test("unobserved provider health is unknown until an execution is recorded", () => {
  const unseen = `wire_${Date.now()}`;
  assert.equal(resolveHealthSnapshot(unseen).status, "unknown");
  ServiceHealthMonitor.getInstance().recordOutcome(unseen, { ok: false, latencyMs: 1200 });
  assert.equal(resolveHealthSnapshot(unseen).status, "degraded");
  assert.equal(resolveHealthSnapshot(unseen).latencyMs, 1200);
});

test("QC does not treat a bare media URL as a technical pass", () => {
  const spec = {
    scenes: [{ id: "sc", shots: [{ id: "sh", mediaUrl: "https://cdn.example/clip.mp4" }] }],
  } as ProductionSpec;
  const bare = observationsFromAssets(spec, []);
  assert.equal(bare[0]?.technical, undefined);
  const pending = observationsFromAssets(
    {
      scenes: [{ id: "sc", shots: [{ id: "sh2", keyframeUrl: "https://cdn.example/pending.png" }] }],
    } as ProductionSpec,
    []
  );
  assert.equal(pending[0]?.technical?.ok, false);
  const measured = observationsFromAssets(spec, [
    {
      id: "a1",
      productionId: "p",
      shotId: "sh",
      assetType: "video",
      publicUrl: "https://cdn.example/clip.mp4",
      mimeType: "video/mp4",
      status: "completed",
    } as ProductionAsset,
  ]);
  assert.equal(measured[0]?.technical?.ok, true);
});

test("studio image refuses submit without a user", async () => {
  await assert.rejects(
    () => submitMeteredStoryboardImage({ prompt: "a cup", tag: "cup", userId: null }),
    /signed-in user/
  );
});
