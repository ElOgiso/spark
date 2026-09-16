import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveLockedProductionReferences } from "./lockedProductionReferences";
import { productionRowToDomain } from "../../backend/mappers/workspaceMappers";

test("deriveLockedProductionReferences returns empty array when production has zero references", () => {
  const refs = deriveLockedProductionReferences({
    activeProd: { id: "p1", title: "Blank Production" },
    brief: { format: "faceless" },
  });
  assert.equal(refs.length, 0);
});

test("deriveLockedProductionReferences extracts character sheet, location plate, and props", () => {
  const refs = deriveLockedProductionReferences({
    activeProd: {
      id: "p2",
      title: "Hero Production",
      generatedAssets: {
        propSheets: {
          "@prop_sword": "https://spark.storage/sword.png",
          "@prop_camera": "https://spark.storage/camera.png",
        },
        locationPlates: {
          "@loc_cabin": "https://spark.storage/cabin.png",
        },
      },
    },
    brief: {
      locationPlateUrl: "https://spark.storage/cabin.png",
      characterSheetUrl: "https://spark.storage/hero-sheet.png",
    },
    character: {
      name: "Hero",
    },
  });

  assert.equal(refs.length, 4);
  assert.equal(refs[0].label, "Character");
  assert.equal(refs[0].url, "https://spark.storage/hero-sheet.png");
  assert.equal(refs[0].role, "character");

  const cabinRef = refs.find((r) => r.url === "https://spark.storage/cabin.png");
  assert.ok(cabinRef);
  assert.equal(cabinRef.role, "location");

  const swordRef = refs.find((r) => r.tag === "@prop_sword");
  assert.ok(swordRef);
  assert.equal(swordRef.label, "@prop_sword");
  assert.equal(swordRef.url, "https://spark.storage/sword.png");
  assert.equal(swordRef.role, "prop");

  const cameraRef = refs.find((r) => r.tag === "@prop_camera");
  assert.ok(cameraRef);
  assert.equal(cameraRef.label, "@prop_camera");
  assert.equal(cameraRef.url, "https://spark.storage/camera.png");
  assert.equal(cameraRef.role, "prop");
});

test("deriveLockedProductionReferences deduplicates identical URLs", () => {
  const refs = deriveLockedProductionReferences({
    activeProd: {
      id: "p3",
      generatedAssets: {
        locationPlates: {
          "@loc_studio": "https://spark.storage/studio.png",
        },
      },
    },
    brief: {
      locationPlateUrl: "https://spark.storage/studio.png",
    },
  });

  assert.equal(refs.filter((r) => r.url === "https://spark.storage/studio.png").length, 1);
});

test("deriveLockedProductionReferences extracts wardrobe variants", () => {
  const refs = deriveLockedProductionReferences({
    activeProd: {
      id: "p4",
      generatedAssets: {
        wardrobeSheets: {
          "@wardrobe_tux": "https://spark.storage/tux.png",
        },
      },
    },
    brief: { format: "faceless" },
  });

  assert.equal(refs.length, 1);
  assert.equal(refs[0].label, "@wardrobe_tux");
  assert.equal(refs[0].url, "https://spark.storage/tux.png");
  assert.equal(refs[0].role, "wardrobe");
});

test("productionRowToDomain hydrates propSheets, locationPlates, and wardrobeSheets onto production", () => {
  const mockRow: any = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Hydration Test",
    status: "ready_for_review",
    created_at: new Date().toISOString(),
    brief: {
      briefObject: {
        title: "Hydration Test",
        generatedAssets: {
          propSheets: {
            "@prop_mic": "https://spark.storage/mic.png",
          },
        },
      },
    },
    assets: {
      locationPlates: {
        "@loc_stage": "https://spark.storage/stage.png",
      },
      wardrobeSheets: {
        "@wardrobe_jacket": "https://spark.storage/jacket.png",
      },
    },
  };

  const domainProd = productionRowToDomain(mockRow);
  assert.ok(domainProd.generatedAssets);
  assert.equal(domainProd.generatedAssets.propSheets?.["@prop_mic"], "https://spark.storage/mic.png");
  assert.equal(domainProd.generatedAssets.locationPlates?.["@loc_stage"], "https://spark.storage/stage.png");
  assert.equal(domainProd.generatedAssets.wardrobeSheets?.["@wardrobe_jacket"], "https://spark.storage/jacket.png");

  assert.ok(domainProd.brief?.generatedAssets);
  assert.equal(domainProd.brief.generatedAssets.propSheets?.["@prop_mic"], "https://spark.storage/mic.png");
  assert.equal(domainProd.brief.generatedAssets.locationPlates?.["@loc_stage"], "https://spark.storage/stage.png");
  assert.equal(domainProd.brief.generatedAssets.wardrobeSheets?.["@wardrobe_jacket"], "https://spark.storage/jacket.png");
});
