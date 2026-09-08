import assert from "node:assert/strict";
import test from "node:test";
import { brandProductionStoragePath, brandProductionStoragePrefix } from "./brandProductionStoragePath";

test("brandProductionStoragePath always prefixes brands/{brandId}/{productionId}", () => {
  assert.equal(
    brandProductionStoragePath("brand-1", "prod-1", "scenes/scene-01.png"),
    "brands/brand-1/prod-1/scenes/scene-01.png"
  );
  assert.equal(
    brandProductionStoragePath("brand-1", "prod-1", "/audio/voice.mp3"),
    "brands/brand-1/prod-1/audio/voice.mp3"
  );
  assert.ok(brandProductionStoragePath("b", "p", "scenes/x.png").startsWith("brands/"));
  assert.equal(brandProductionStoragePrefix("brand-1", "prod-1"), "brands/brand-1/prod-1");
});

test("brandProductionStoragePath falls back to default-brand when brand id is missing", () => {
  assert.equal(
    brandProductionStoragePath(undefined, "prod-1", "video/master.mp4"),
    "brands/default-brand/prod-1/video/master.mp4"
  );
  assert.equal(
    brandProductionStoragePath("  ", "prod-1", "thumbnails/a.png"),
    "brands/default-brand/prod-1/thumbnails/a.png"
  );
});
