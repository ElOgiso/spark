/**
 * Production Asset Intelligence v2 — anchors, supporting cast, reference packages, readiness.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orchestrateIdeaToProductionSpec } from "./intelligence/productionOrchestrator";
import {
  applyProductionAssetIntelligence,
  assessShotAssetReadiness,
  buildProductionAssetManifest,
  buildReferencePackage,
  buildShotAssetManifest,
  isIdentityAttribute,
  isStateAttribute,
  requiredCharacterSheetViews,
  resolveSupportingCast,
} from "./assets/anchorIntelligence";
import { ProductionAssetRegistry } from "./assets/registry";
import { createCharacterMaster, createLocationMaster } from "./specification/assetSpec";
import { buildProductionSettingsSnapshot } from "./productionSettingsSnapshot";

describe("identity vs state", () => {
  it("never treats expression/wardrobeState as identity", () => {
    assert.equal(isIdentityAttribute("character", "face"), true);
    assert.equal(isStateAttribute("character", "expression"), true);
    assert.equal(isIdentityAttribute("character", "expression"), false);
    assert.equal(isIdentityAttribute("location", "architecture"), true);
    assert.equal(isStateAttribute("location", "timeOfDay"), true);
  });
});

describe("character sheet views — complexity driven", () => {
  it("uses fewer views for host talking-head than cinematic", () => {
    const host = requiredCharacterSheetViews({ role: "host", contentFormat: "host" });
    const cine = requiredCharacterSheetViews({ role: "primary", cinematic: true, contentFormat: "story" });
    assert.ok(host.length < cine.length);
    assert.ok(host.includes("front"));
    assert.ok(cine.includes("full_body"));
  });

  it("requires no sheet views for extras or faceless", () => {
    assert.deepEqual(requiredCharacterSheetViews({ role: "extra" }), []);
    assert.deepEqual(requiredCharacterSheetViews({ role: "host", contentFormat: "faceless" }), []);
  });
});

describe("cinematic narrative — anchors + supporting cast", () => {
  it("infers supporting cast, locked locations, and blocks generation until sheets exist", () => {
    const lead = createCharacterMaster({
      baseId: "character_001",
      version: 3,
      name: "Lead Founder",
      description: "Founder",
      role: "primary",
      referenceUrls: ["https://example.com/lead.png"],
    });
    lead.status = "approved";

    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea:
        "A young Nigerian crypto founder discovers his competitor stole his product and confronts him at a private dinner",
      targetDurationSec: 30,
      productionMode: "cinematic",
      existingMasters: [lead],
      character: {
        id: "c1",
        name: "Lead Founder",
        characterSheetUrl: "https://example.com/lead.png",
      } as any,
    });

    assert.equal(ok, true);
    assert.ok(spec?.meta.assetIntelligence);
    const cast = spec!.meta.assetIntelligence!.supportingCast.members;
    assert.ok(cast.some((m) => /competitor/i.test(m.name)));
    assert.ok(!cast.some((m) => m.castClass === "crowd_group" && m.requiresCharacterSheet));

    const manifest = spec!.meta.assetIntelligence!.manifest;
    assert.ok(manifest.anchors.some((a) => a.isAnchor));
    assert.ok(manifest.locations.length >= 1);

    // Lead with approved sheet should not block; competitor sheet missing should block readiness
    assert.equal(spec!.meta.assetIntelligence!.readiness.ok, false);
    assert.ok(
      spec!.meta.assetIntelligence!.readiness.blockers.some((b) => /Character Sheet|Location Plate/i.test(b))
    );

    const leadChar = spec!.characters.find((c) => c.identity.ref === "character_001:v3");
    assert.ok(leadChar?.identityLocks?.includes("face"));
    assert.ok(leadChar?.variableAttributes?.includes("expression"));
  });
});

describe("vertical short — do not over-assetize", () => {
  it("creates a lean world for one character + one location", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "30-second vertical tip: host explains one crypto tip in the studio",
      targetDurationSec: 30,
      productionMode: "hybrid",
      preferredAspectRatio: "9:16",
    });
    assert.equal(ok, true);
    const intel = spec!.meta.assetIntelligence!;
    assert.ok(intel.manifest.characters.length <= 2);
    assert.ok(intel.manifest.locations.length <= 2);
    assert.ok(intel.supportingCast.members.filter((m) => m.requiresCharacterSheet).length <= 1);
  });
});

describe("documentary / faceless — do not force character sheets", () => {
  it("does not invent principal cast for faceless documentary", () => {
    const brand = {
      id: "b1",
      name: "Docs",
      niche: "history",
      archetype: "documentary",
      purpose: "inform",
      contentPillars: [],
      audience: { primary: "general", painPoints: [], desires: [] },
      tone: [],
      formatSettings: { contentFormat: "faceless", aspectMode: "landscape", targetDurationSec: 60 },
    } as any;

    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Faceless documentary short about the history of Lagos ports with archival B-roll",
      targetDurationSec: 60,
      productionMode: "narrator",
      brand,
      settingsSnapshot: buildProductionSettingsSnapshot({
        brand,
        productionMode: "narrator",
      }),
    });

    assert.equal(ok, true);
    const supportSheets = (spec!.meta.assetIntelligence?.supportingCast.members || []).filter(
      (m) => m.requiresCharacterSheet
    );
    assert.equal(supportSheets.length, 0);
  });
});

describe("reference package + shot manifest", () => {
  it("builds semantic reference package via existing registry authority", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Cinematic founder confronts competitor at dinner",
      targetDurationSec: 30,
      productionMode: "cinematic",
      character: {
        id: "character_001",
        name: "Lead",
        characterSheetUrl: "https://example.com/lead.png",
      } as any,
    });
    assert.equal(ok, true);
    const shot = spec!.scenes[0].shots[0];
    const registry = new ProductionAssetRegistry();
    const lead = spec!.characters[0];
    if (lead) {
      registry.register({
        id: `ra_${lead.identity.baseId}`,
        productionId: spec!.project.id,
        scope: "production",
        category: "character_sheet",
        entityType: "character",
        entityId: lead.identity.baseId,
        roles: ["canonical_identity", "character_sheet"],
        authority: "canonical",
        lifecycle: "canonical",
        referenceEligible: true,
        version: { version: lead.identity.version, createdAt: new Date().toISOString(), status: "canonical" },
        masterRef: lead.identity.ref,
        masterKind: "character",
        storage: { url: "https://example.com/lead.png" },
        provenance: { source: "user_uploaded" },
        relationships: [],
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const pkg = buildReferencePackage({
      registry,
      productionId: spec!.project.id,
      shot,
    });
    assert.ok(pkg.slots.every((s) => s.semantic));
    assert.ok(pkg.bundle.selectionPolicy);

    const shotManifest = buildShotAssetManifest({ spec: spec!, shot, registry });
    assert.equal(shotManifest.shotId, shot.id);
    assert.ok(shotManifest.bindings.length >= 1);
  });
});

describe("animation style propagation", () => {
  it("inherits anime treatment into character identity model + requirements", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Anime story: a hero confronts a rival in a temple courtyard",
      targetDurationSec: 30,
      productionMode: "cinematic",
    });
    assert.equal(ok, true);
    const style = (spec!.meta.assetDirector?.requirements || []).find((r) => r.kind === "style");
    assert.match(String(style?.visualContract.medium || ""), /anime/i);
    assert.ok(spec!.meta.assetIntelligence?.identityModel.characterIdentity.includes("face"));
  });
});

describe("applyProductionAssetIntelligence", () => {
  it("is idempotent enrichment over directed specs", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Hybrid host tip in the office",
      targetDurationSec: 20,
      productionMode: "hybrid",
      applyVisualPlanning: false,
    });
    assert.equal(ok, true);
    const once = applyProductionAssetIntelligence(spec!);
    const twice = applyProductionAssetIntelligence(once);
    assert.equal(
      twice.meta.assetIntelligence?.manifest.characters.length,
      once.meta.assetIntelligence?.manifest.characters.length
    );
  });
});
