/**
 * Stage 4 — Asset Director masters → live pixel refs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeDirectorIdentityForLock,
  resolveDirectorPixelRefs,
} from "./resolveLiveDirectorRefs";
import {
  buildVisualLockRefs,
  buildVisualLockRefsFromDirector,
} from "./productionAssetService";
import type { ProductionSpec } from "./specification/productionSpec";
import { createCharacterMaster, createLocationMaster, createPropMaster } from "./specification/assetSpec";

function makeSpecWithMasters(): ProductionSpec {
  const lead = createCharacterMaster({
    baseId: "character_001",
    name: "Maya Host",
    description: "Lead host",
    role: "host",
    referenceUrls: ["https://cdn.example.test/sheets/maya-sheet.png"],
  });
  const support = createCharacterMaster({
    baseId: "character_002",
    name: "Rival Alex",
    description: "Support",
    role: "support",
    referenceUrls: ["https://cdn.example.test/sheets/alex-sheet.png"],
  });
  const location = createLocationMaster({
    baseId: "location_001",
    name: "Loft Studio",
    description: "Locked loft",
    referenceUrls: ["https://cdn.example.test/plates/loft-plate.png"],
  });
  const prop = createPropMaster({
    baseId: "prop_001",
    name: "Budget Chart",
    description: "Chart prop",
    referenceUrls: ["https://cdn.example.test/props/chart.png"],
  });

  return {
    id: "prod_dir_1",
    version: 1,
    project: { id: "prod_dir_1", title: "Director pixels", productionMode: "standard" } as any,
    creative: {} as any,
    world: { locations: [{ id: location.identity.ref, name: location.name }] } as any,
    characters: [lead, support],
    assets: [location, prop],
    narrative: {} as any,
    scenes: [
      {
        id: "scene_01",
        index: 0,
        shots: [{ id: "shot_01", sceneId: "scene_01", index: 0 } as any],
      } as any,
    ],
    audio: {} as any,
    visualStyle: {} as any,
    continuity: { shotBridges: [] } as any,
    routing: {} as any,
    quality: {} as any,
    researchRequirements: {} as any,
    meta: {
      specVersion: "1",
      compilerVersion: "1",
      createdFrom: "idea",
      grammarIds: [],
      contentFormat: "host",
      assetDirector: {
        requirementCount: 3,
        stats: {
          characterCount: 2,
          locationCount: 1,
          propCount: 1,
          wardrobeCount: 0,
          reusedCount: 0,
          generateNowCount: 0,
          requiredOnlyCount: 3,
        },
        notes: ["test"],
        requirements: [],
      },
    },
  } as ProductionSpec;
}

describe("Stage 4 Asset Director → pixels", () => {
  it("resolveDirectorPixelRefs prefers Spec master URLs over domain", () => {
    const spec = makeSpecWithMasters();
    const production = { id: "prod_dir_1", reasoning: { productionSpec: spec } };
    const resolved = resolveDirectorPixelRefs({
      production,
      subjectType: "main",
      contentFormat: "host",
      sceneId: "scene_01",
      shotId: "shot_01",
      character: {
        name: "Domain Maya",
        characterSheetUrl: "https://cdn.example.test/domain/maya.png",
      } as any,
      runtimeLocationPlateUrl: "https://cdn.example.test/domain/brand-plate.png",
    });

    assert.equal(resolved.source.usedSpecIdentity, true);
    assert.equal(resolved.source.usedSpecLocation, true);
    assert.ok(resolved.identityUrls[0].includes("maya-sheet"));
    assert.ok(resolved.locationPlateUrl?.includes("loft-plate"));
  });

  it("support subject uses Spec support sheet", () => {
    const spec = makeSpecWithMasters();
    const resolved = resolveDirectorPixelRefs({
      production: { reasoning: { productionSpec: spec } },
      subjectType: "support",
      contentFormat: "story",
    });
    assert.ok(resolved.supportUrls[0].includes("alex-sheet"));
  });

  it("insert subject surfaces Spec prop URL and clears host for faceless", () => {
    const spec = makeSpecWithMasters();
    spec.meta.contentFormat = "faceless";
    const resolved = resolveDirectorPixelRefs({
      production: { reasoning: { productionSpec: spec } },
      subjectType: "insert",
      contentFormat: "faceless",
      character: { characterSheetUrl: "https://cdn.example.test/sheets/maya-sheet.png" } as any,
    });
    assert.equal(resolved.identityUrls.length, 0);
    assert.ok(resolved.propUrl?.includes("chart.png"));
    assert.equal(resolved.source.usedSpecProp, true);
  });

  it("buildVisualLockRefsFromDirector stacks Spec identity into ModelRouter refs", () => {
    const spec = makeSpecWithMasters();
    const lock = buildVisualLockRefsFromDirector({
      production: { reasoning: { productionSpec: spec } },
      character: { name: "Maya" } as any,
      subjectType: "main",
      contentFormat: "host",
      storyboardGridUrl: "https://cdn.example.test/grid/sheet.png",
      sceneId: "scene_01",
      shotId: "shot_01",
    });
    assert.ok(lock.imageUrls.some((u) => u.includes("maya-sheet")));
    assert.ok(lock.imageUrls.some((u) => u.includes("loft-plate")));
    assert.ok(lock.imageUrls.some((u) => u.includes("grid/sheet")));
    assert.ok(lock.directorNotes.some((n) => /Spec lead identity/i.test(n)));
  });

  it("buildVisualLockRefs respects explicit main on faceless (no blanket insert)", () => {
    const lock = buildVisualLockRefs({
      character: {
        name: "Optional",
        characterSheetUrl: "https://cdn.example.test/sheets/optional.png",
      } as any,
      subjectType: "main",
      contentFormat: "faceless",
      directorIdentityUrls: ["https://cdn.example.test/sheets/optional.png"],
    });
    assert.ok(lock.charSheetUrls.length >= 1);
    assert.ok(lock.imageUrls[0].includes("optional.png"));
  });

  it("mergeDirectorIdentityForLock caps identity sheets", () => {
    const merged = mergeDirectorIdentityForLock({
      director: {
        identityUrls: [
          "https://cdn.example.test/a.png",
          "https://cdn.example.test/b.png",
          "https://cdn.example.test/c.png",
        ],
        supportUrls: [],
        notes: [],
        source: { usedSpecIdentity: true, usedSpecLocation: false, usedSpecProp: false },
      },
      maxIdentitySheets: 2,
    });
    assert.equal(merged.identityUrls.length, 2);
  });
});
