/**
 * Phase 4 — Reference & Asset Intelligence tests.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { ProductionAsset } from "../../domain/types";
import {
  ProductionAssetRegistry,
  normalizeProductionAsset,
  fingerprintFromString,
  fingerprintFromBytes,
  fingerprintFromUrlAndMeta,
  resolveReferenceBundle,
  buildReferenceRequirementsFromShot,
  referenceBundleToCapabilityNeeds,
  toCapabilityReferenceRequirements,
  hasValidCharacterIdentityAnchor,
  assetsFromMaster,
  SELECTION_POLICY,
  type RegisteredAsset,
} from "./assets/index";
import { createCharacterMaster, createLocationMaster } from "./specification/assetSpec";
import { canStartAssetGeneration, hasValidCharacterSheet } from "./characterSheetGate";

function makeRegistered(partial: Partial<RegisteredAsset> & Pick<RegisteredAsset, "id" | "productionId">): RegisteredAsset {
  const now = new Date().toISOString();
  return {
    scope: "production",
    category: "character",
    roles: ["canonical_identity"],
    authority: "approved",
    lifecycle: "approved",
    referenceEligible: true,
    version: { version: 1, createdAt: now, status: "approved" },
    storage: { url: `https://cdn.example.com/${partial.id}.png`, persistenceStatus: "durable" },
    provenance: { source: "unknown", createdAt: now },
    relationships: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    entityType: "character",
    entityId: "char_a",
    ...partial,
  };
}

describe("Phase 4 fingerprints", () => {
  it("produces equal fingerprints for identical string/bytes input", () => {
    const a = fingerprintFromString("same-content");
    const b = fingerprintFromString("same-content");
    assert.equal(a, b);
    assert.ok(a.startsWith("fnv1a64:"));
    const bytes = new TextEncoder().encode("same-content");
    assert.equal(fingerprintFromBytes(bytes), a);
  });

  it("fingerprint is not identity — different meta differ", () => {
    const a = fingerprintFromUrlAndMeta({ url: "https://x/a.png", mimeType: "image/png" });
    const b = fingerprintFromUrlAndMeta({ url: "https://x/a.png", mimeType: "image/jpeg" });
    assert.notEqual(a, b);
  });
});

describe("Phase 4 normalize + masters", () => {
  it("normalizes legacy ProductionAsset without inventing approval", () => {
    const legacy: ProductionAsset = {
      id: "pa-1",
      productionId: "prod-1",
      assetType: "image",
      publicUrl: "https://cdn.example.com/sheet.png",
      storageBucket: "assets",
      storagePath: "prod-1/sheet.png",
      provider: "openai",
      generationPrompt: "character sheet",
      status: "completed",
      createdAt: "2026-01-01T00:00:00.000Z",
      masterRef: "character_001:v1",
      version: 2,
      variant: "front",
      role: "character_sheet",
      fingerprint: "fnv1a64:abc",
    };
    const reg = normalizeProductionAsset(legacy, {
      entityType: "character",
      entityId: "character_001",
    });
    assert.equal(reg.id, "pa-1");
    assert.equal(reg.authority, "candidate");
    assert.equal(reg.masterRef, "character_001:v1");
    assert.equal(reg.version.version, 2);
    assert.equal(reg.variant?.variantKey, "front");
    assert.equal(reg.roles[0], "character_sheet");
    assert.equal(reg.storage.url, legacy.publicUrl);
    assert.equal(reg.storage.storageKey, legacy.storagePath);
    assert.equal(reg.provenance.source, "generated_by_spark");
    assert.equal(reg.fingerprint, "fnv1a64:abc");
    assert.equal(reg.referenceEligible, true);
    assert.equal(reg.legacy?.generationPrompt, "character sheet");
  });

  it("maps master draft/approved/retired statuses correctly", () => {
    const approved = createCharacterMaster({
      baseId: "character_001",
      name: "Ayo",
      description: "Host",
      referenceUrls: ["https://cdn.example.com/ayo.png"],
    });
    approved.status = "approved";
    const draft = { ...approved, status: "draft" as const, identity: { ...approved.identity, ref: "character_001:v1" } };
    const retired = { ...approved, status: "retired" as const };

    const a = assetsFromMaster(approved, "prod-1");
    const d = assetsFromMaster(draft, "prod-1");
    const r = assetsFromMaster(retired, "prod-1");
    assert.equal(a[0].authority, "approved");
    assert.equal(d[0].authority, "candidate");
    assert.equal(r[0].authority, "deprecated");
    assert.equal(r[0].lifecycle, "deprecated");
    assert.equal(a[0].masterRef, approved.identity.ref);
  });
});

describe("Phase 4 registry + resolution", () => {
  let registry: ProductionAssetRegistry;

  beforeEach(() => {
    registry = new ProductionAssetRegistry();
    registry.resetForTests();
  });

  it("resolves character canonical reference", () => {
    registry.register(
      makeRegistered({
        id: "c-can",
        productionId: "prod-1",
        entityId: "char_a",
        authority: "canonical",
        lifecycle: "canonical",
        roles: ["canonical_identity"],
      })
    );
    registry.register(
      makeRegistered({
        id: "c-app",
        productionId: "prod-1",
        entityId: "char_a",
        authority: "approved",
        roles: ["canonical_identity"],
      })
    );

    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "character",
          entityId: "char_a",
          roles: ["canonical_identity"],
          required: true,
        },
      ],
    });
    assert.equal(bundle.references.length, 1);
    assert.equal(bundle.references[0].assetId, "c-can");
    assert.equal(bundle.references[0].source, "canonical");
    assert.equal(bundle.selectionPolicy, SELECTION_POLICY);
  });

  it("resolves location night variant", () => {
    registry.register(
      makeRegistered({
        id: "loc-day",
        productionId: "prod-1",
        category: "location_plate",
        entityType: "location",
        entityId: "loc_market",
        roles: ["location_anchor"],
        authority: "canonical",
        lifecycle: "canonical",
        variant: { variantKey: "day" },
      })
    );
    registry.register(
      makeRegistered({
        id: "loc-night",
        productionId: "prod-1",
        category: "location_plate",
        entityType: "location",
        entityId: "loc_market",
        roles: ["location_anchor"],
        authority: "canonical",
        lifecycle: "canonical",
        variant: { variantKey: "night" },
      })
    );

    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "location",
          entityId: "loc_market",
          roles: ["location_anchor"],
          variant: "night",
          required: true,
        },
      ],
    });
    assert.equal(bundle.references[0].assetId, "loc-night");
    assert.equal(bundle.references[0].variant, "night");
  });

  it("reports missing canonical / required unresolved", () => {
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "character",
          entityId: "missing",
          roles: ["canonical_identity"],
          required: true,
        },
      ],
    });
    assert.equal(bundle.references.length, 0);
    assert.ok(bundle.issues.some((i) => i.code === "REFERENCE_MISSING"));
  });

  it("never selects deprecated or rejected assets", () => {
    registry.register(
      makeRegistered({
        id: "dep",
        productionId: "prod-1",
        authority: "deprecated",
        lifecycle: "deprecated",
        referenceEligible: false,
      })
    );
    registry.register(
      makeRegistered({
        id: "rej",
        productionId: "prod-1",
        authority: "rejected",
        lifecycle: "rejected",
        referenceEligible: false,
      })
    );
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    assert.equal(bundle.references.length, 0);
    assert.ok(bundle.issues.some((i) => i.code === "REFERENCE_MISSING"));
  });

  it("conflicts when two canonicals share entity+role+variant", () => {
    registry.register(
      makeRegistered({
        id: "c1",
        productionId: "prod-1",
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    registry.register(
      makeRegistered({
        id: "c2",
        productionId: "prod-1",
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    assert.equal(bundle.references.length, 0);
    assert.ok(bundle.issues.some((i) => i.code === "REFERENCE_AUTHORITY_CONFLICT"));
    assert.deepEqual(
      bundle.issues.find((i) => i.code === "REFERENCE_AUTHORITY_CONFLICT")!.candidateAssetIds?.sort(),
      ["c1", "c2"]
    );
  });

  it("setAuthority demotes previous canonical without deleting", () => {
    registry.register(
      makeRegistered({
        id: "old",
        productionId: "prod-1",
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    registry.register(
      makeRegistered({
        id: "neu",
        productionId: "prod-1",
        authority: "approved",
      })
    );
    registry.promoteToCanonical("neu", "canonical_identity");
    assert.equal(registry.get("neu")!.authority, "canonical");
    assert.equal(registry.get("old")!.authority, "approved");
    assert.ok(registry.get("old"));
  });

  it("versioning: higher version preferred within same authority band", () => {
    registry.register(
      makeRegistered({
        id: "v1",
        productionId: "prod-1",
        authority: "approved",
        version: { version: 1, createdAt: "2026-01-01T00:00:00.000Z", status: "approved" },
      })
    );
    registry.register(
      makeRegistered({
        id: "v3",
        productionId: "prod-1",
        authority: "approved",
        version: { version: 3, createdAt: "2026-01-03T00:00:00.000Z", status: "approved" },
      })
    );
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    assert.equal(bundle.references[0].assetId, "v3");
  });

  it("derived lineage A→B→C oldest-first", () => {
    registry.register(makeRegistered({ id: "A", productionId: "prod-1", entityId: "char_a" }));
    registry.register(
      makeRegistered({ id: "B", productionId: "prod-1", entityId: "char_a", parentAssetId: "A" })
    );
    registry.register(
      makeRegistered({ id: "C", productionId: "prod-1", entityId: "char_a", parentAssetId: "B" })
    );
    const now = new Date().toISOString();
    registry.addRelationship({
      type: "derived_from",
      fromAssetId: "B",
      toAssetId: "A",
      createdAt: now,
    });
    registry.addRelationship({
      type: "derived_from",
      fromAssetId: "C",
      toAssetId: "B",
      createdAt: now,
    });
    const lineage = registry.getLineage("C");
    assert.deepEqual(
      lineage.map((a) => a.id),
      ["A", "B"]
    );
  });

  it("rejects derived_from cycles", () => {
    registry.register(makeRegistered({ id: "A", productionId: "prod-1" }));
    registry.register(makeRegistered({ id: "B", productionId: "prod-1", parentAssetId: "A" }));
    const now = new Date().toISOString();
    registry.addRelationship({
      type: "derived_from",
      fromAssetId: "B",
      toAssetId: "A",
      createdAt: now,
    });
    assert.throws(
      () =>
        registry.addRelationship({
          type: "derived_from",
          fromAssetId: "A",
          toAssetId: "B",
          createdAt: now,
        }),
      /ASSET_LINEAGE_CYCLE/
    );
  });

  it("builds reference bundle from shot and reuses asset across shots", () => {
    registry.register(
      makeRegistered({
        id: "shared",
        productionId: "prod-1",
        entityId: "char_a",
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    const shot1 = {
      id: "shot-1",
      sceneId: "scene-1",
      references: {
        characterRefs: ["char_a"],
        locationRefs: [],
        styleRefs: [],
      },
      characterIds: ["char_a"],
    };
    const shot2 = { ...shot1, id: "shot-2" };
    const reqs1 = buildReferenceRequirementsFromShot(shot1);
    const reqs2 = buildReferenceRequirementsFromShot(shot2);
    const b1 = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      shotId: "shot-1",
      requirements: reqs1,
    });
    const b2 = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      shotId: "shot-2",
      requirements: reqs2,
    });
    assert.equal(b1.references[0].assetId, "shared");
    assert.equal(b2.references[0].assetId, "shared");
    registry.recordUsage({
      assetId: "shared",
      productionId: "prod-1",
      shotId: "shot-1",
      createdAt: new Date().toISOString(),
    });
    registry.recordUsage({
      assetId: "shared",
      productionId: "prod-1",
      shotId: "shot-2",
      createdAt: new Date().toISOString(),
    });
    assert.equal(registry.getUsages("shared").length, 2);
  });

  it("capability needs stay provider-neutral", () => {
    registry.register(
      makeRegistered({
        id: "c-can",
        productionId: "prod-1",
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    const needs = toCapabilityReferenceRequirements(bundle);
    const alt = referenceBundleToCapabilityNeeds(bundle);
    assert.deepEqual(needs, alt);
    const json = JSON.stringify(needs);
    assert.equal(/kling|veo|seedance|grok|runway|luma/i.test(json), false);
    assert.ok(needs[0].modalityHints.includes("image"));
    assert.ok(needs[0].assetIds.includes("c-can"));
  });

  it("isolates assets across productions", () => {
    registry.register(makeRegistered({ id: "p1a", productionId: "prod-1" }));
    registry.register(makeRegistered({ id: "p2a", productionId: "prod-2" }));
    assert.deepEqual(
      registry.list({ productionId: "prod-1" }).map((a) => a.id),
      ["p1a"]
    );
    assert.deepEqual(
      registry.list({ productionId: "prod-2" }).map((a) => a.id),
      ["p2a"]
    );
  });

  it("honors explicitAssetId override", () => {
    registry.register(
      makeRegistered({
        id: "c-can",
        productionId: "prod-1",
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    registry.register(
      makeRegistered({
        id: "c-explicit",
        productionId: "prod-1",
        authority: "supporting",
        roles: ["canonical_identity"],
      })
    );
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "character",
          entityId: "char_a",
          roles: ["canonical_identity"],
          explicitAssetId: "c-explicit",
          required: true,
        },
      ],
    });
    assert.equal(bundle.references[0].assetId, "c-explicit");
    assert.equal(bundle.references[0].source, "explicit");
  });

  it("flags wrong entity and wrong role", () => {
    registry.register(
      makeRegistered({
        id: "loc",
        productionId: "prod-1",
        entityType: "location",
        entityId: "loc_1",
        roles: ["location_anchor"],
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    const wrongEntity = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "character",
          entityId: "char_a",
          roles: ["canonical_identity"],
          explicitAssetId: "loc",
          required: true,
        },
      ],
    });
    assert.ok(wrongEntity.issues.some((i) => i.code === "REFERENCE_WRONG_ENTITY"));

    registry.register(
      makeRegistered({
        id: "face-only",
        productionId: "prod-1",
        entityId: "char_a",
        roles: ["face"],
        authority: "approved",
      })
    );
    const wrongRole = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "character",
          entityId: "char_a",
          roles: ["wardrobe"],
          required: true,
        },
      ],
    });
    assert.ok(wrongRole.issues.some((i) => i.code === "REFERENCE_WRONG_ROLE"));
  });

  it("variant fallback emits REFERENCE_FALLBACK_USED when allowed", () => {
    registry.register(
      makeRegistered({
        id: "day",
        productionId: "prod-1",
        entityType: "location",
        entityId: "loc_1",
        roles: ["location_anchor"],
        authority: "approved",
        variant: { variantKey: "day" },
      })
    );
    const withFallback = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "location",
          entityId: "loc_1",
          roles: ["location_anchor"],
          variant: "night",
          allowVariantFallback: true,
          required: true,
        },
      ],
    });
    assert.equal(withFallback.references[0].assetId, "day");
    assert.ok(withFallback.issues.some((i) => i.code === "REFERENCE_FALLBACK_USED" && i.fallbackUsed));

    const noFallback = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        {
          entityType: "location",
          entityId: "loc_1",
          roles: ["location_anchor"],
          variant: "night",
          allowVariantFallback: false,
          required: true,
        },
      ],
    });
    assert.equal(noFallback.references.length, 0);
    assert.ok(noFallback.issues.some((i) => i.code === "REFERENCE_VARIANT_UNAVAILABLE"));
  });

  it("prefers approved over candidate; candidate only when allowed", () => {
    registry.register(
      makeRegistered({
        id: "cand",
        productionId: "prod-1",
        authority: "candidate",
        lifecycle: "candidate",
      })
    );
    registry.register(
      makeRegistered({
        id: "app",
        productionId: "prod-1",
        authority: "approved",
      })
    );
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      allowCandidate: true,
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    assert.equal(bundle.references[0].assetId, "app");

    registry.deprecate("app");
    const onlyCandidateBlocked = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      allowCandidate: false,
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    assert.equal(onlyCandidateBlocked.references.length, 0);

    const onlyCandidateAllowed = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      allowCandidate: true,
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    assert.equal(onlyCandidateAllowed.references[0].assetId, "cand");
  });

  it("deprecated canonical falls through to approved B", () => {
    registry.register(
      makeRegistered({
        id: "A",
        productionId: "prod-1",
        authority: "canonical",
        lifecycle: "canonical",
      })
    );
    registry.register(
      makeRegistered({
        id: "B",
        productionId: "prod-1",
        authority: "approved",
      })
    );
    registry.deprecate("A");
    const bundle = resolveReferenceBundle(registry, {
      productionId: "prod-1",
      requirements: [
        { entityType: "character", entityId: "char_a", roles: ["canonical_identity"], required: true },
      ],
    });
    assert.equal(bundle.references[0].assetId, "B");
    assert.equal(bundle.references[0].source, "approved");
  });

  it("registerProductionAsset + registerMasterAssets + findByFingerprint", () => {
    const masters = [
      createCharacterMaster({
        baseId: "character_001",
        name: "Ayo",
        description: "Host",
        referenceUrls: ["https://cdn.example.com/ayo.png"],
      }),
      createLocationMaster({
        baseId: "location_001",
        name: "Market",
        description: "Lagos market",
        referenceUrls: ["https://cdn.example.com/market.png"],
      }),
    ];
    const registered = registry.registerMasterAssets(masters, "prod-1", "brand-1");
    assert.ok(registered.length >= 2);

    const pa: ProductionAsset = {
      id: "pa-legacy",
      productionId: "prod-1",
      assetType: "image",
      publicUrl: "https://cdn.example.com/ayo.png",
      status: "completed",
    };
    const norm = registry.registerProductionAsset(pa, {
      entityType: "character",
      entityId: "character_001",
      roles: ["character_sheet"],
      authority: "approved",
      lifecycle: "approved",
    });
    assert.equal(norm.legacy?.publicUrl, pa.publicUrl);
    const hits = registry.findByFingerprint(norm.fingerprint!, "prod-1");
    assert.ok(hits.some((h) => h.id === "pa-legacy"));
  });

  it("identity anchor prefers registry; gate accepts registry path", () => {
    registry.register(
      makeRegistered({
        id: "sheet",
        productionId: "prod-1",
        entityId: "char_a",
        authority: "canonical",
        lifecycle: "canonical",
        roles: ["character_sheet"],
      })
    );
    const anchor = hasValidCharacterIdentityAnchor({
      registry,
      productionId: "prod-1",
      entityId: "char_a",
      character: { id: "char_a" },
    });
    assert.equal(anchor.valid, true);
    assert.equal(anchor.assetId, "sheet");
    assert.equal(anchor.authority, "canonical");

    const gate = canStartAssetGeneration({
      production: { id: "prod-1", contentFormat: "host" } as any,
      character: { id: "char_a" },
      registry,
      productionId: "prod-1",
      entityId: "char_a",
    });
    assert.equal(gate.allowed, true);

    // URL fallback still works without registry
    assert.equal(hasValidCharacterSheet({ characterSheetUrl: "https://cdn.example.com/x.png" }).hasSheet, true);
    const urlGate = canStartAssetGeneration({
      character: { characterSheetUrl: "https://cdn.example.com/x.png" },
      formatSettings: { contentFormat: "host" },
    });
    assert.equal(urlGate.allowed, true);
  });
});
