/**
 * Location plate storage + set-still reuse.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  needsLocationPlateStorageUpload,
  resolveLocationPlateUrl,
  shouldReuseLocationPlateAsStill,
} from "./locationPlatePersistence";

test("needsLocationPlateStorageUpload: fal/data/blob/http need upload; supabase does not", () => {
  assert.equal(needsLocationPlateStorageUpload("https://fal.media/files/abc.png"), true);
  assert.equal(needsLocationPlateStorageUpload("data:image/png;base64,aaa"), true);
  assert.equal(needsLocationPlateStorageUpload("blob:https://app/uuid"), true);
  assert.equal(needsLocationPlateStorageUpload("https://cdn.example.com/plate.jpg"), true);
  assert.equal(
    needsLocationPlateStorageUpload(
      "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/b1/set/location_plate.png"
    ),
    false
  );
  assert.equal(needsLocationPlateStorageUpload(""), false);
  assert.equal(needsLocationPlateStorageUpload(null), false);
});

test("shouldReuseLocationPlateAsStill: only set subjects with valid plate", () => {
  const plate = "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/b1/set/location_plate.png";
  assert.equal(shouldReuseLocationPlateAsStill({ resolvedSubject: "set", locationPlateUrl: plate }), true);
  assert.equal(shouldReuseLocationPlateAsStill({ resolvedSubject: "establishing", locationPlateUrl: plate }), true);
  assert.equal(shouldReuseLocationPlateAsStill({ resolvedSubject: "main", locationPlateUrl: plate }), false);
  assert.equal(shouldReuseLocationPlateAsStill({ resolvedSubject: "insert", locationPlateUrl: plate }), false);
  assert.equal(shouldReuseLocationPlateAsStill({ resolvedSubject: "set", locationPlateUrl: "" }), false);
  assert.equal(shouldReuseLocationPlateAsStill({ resolvedSubject: "set", locationPlateUrl: "pending" }), false);
});

test("resolveLocationPlateUrl prefers snapshot then brand then settings", () => {
  assert.equal(
    resolveLocationPlateUrl({
      snapshotPlateUrl: "https://snap/plate.png",
      brandPlateUrl: "https://brand/plate.png",
      brandSettings: { locationPlateUrl: "https://settings/plate.png" },
    }),
    "https://snap/plate.png"
  );
  assert.equal(
    resolveLocationPlateUrl({
      brandPlateUrl: "https://brand/plate.png",
      brandSettings: { location_plate_url: "https://settings/plate.png" },
    }),
    "https://brand/plate.png"
  );
  assert.equal(
    resolveLocationPlateUrl({
      brandSettings: { locationPlateUrl: "https://settings/plate.png" },
    }),
    "https://settings/plate.png"
  );
});
