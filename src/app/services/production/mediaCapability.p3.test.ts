/**
 * Phase 3 — Media Capability / Provider Intelligence tests.
 * No live provider calls. Facts ≠ preferences ≠ invented prices.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildCapabilityRequirements,
  capabilityRequirementsFromShot,
  listProviderModelCandidates,
  resetCapabilityRegistryForTests,
  resolveEffectiveCapability,
  routeMediaCapability,
  assertExecutableCapability,
  validateCapabilityRequirements,
  getCapabilityProfile,
  MEDIA_CAPABILITY_PROFILES,
  provenance,
  isStale,
  getAdapterClaim,
} from "./capability";
import { ServiceHealthMonitor } from "../runtime/serviceHealthMonitor";
import type { ShotSpec } from "./specification/shotSpec";

function baseShot(partial: Partial<ShotSpec> = {}): ShotSpec {
  return {
    id: "shot_1",
    sceneId: "scene_1",
    index: 0,
    purpose: "test",
    productionReason: "capability test",
    timingStartSec: 0,
    durationSec: 8,
    camera: {
      shotType: "medium",
      framing: "subject centered",
      composition: "rule of thirds",
      cameraPosition: "eye level",
      cameraMovement: "static",
    },
    subject: "subject",
    subjectAction: "stands",
    environment: "studio",
    lighting: {},
    motion: {
      subjectMovement: "subtle",
      cameraMovementDetail: "locked",
      beginState: "start",
      endState: "end",
    },
    references: {
      characterRefs: [],
      locationRefs: [],
      styleRefs: [],
      firstFrameUrl: "https://example.com/start.jpg",
    },
    continuityRequirements: [],
    characterIds: [],
    propIds: [],
    assetIds: [],
    generationStrategy: "image_to_video",
    generationStatus: "planned",
    qcStatus: "pending",
    aspectRatio: "16:9",
    ...partial,
  };
}

beforeEach(() => {
  resetCapabilityRegistryForTests();
});

afterEach(() => {
  // Restore health defaults used by other suites
  const health = ServiceHealthMonitor.getInstance();
  for (const id of ["kling", "seedance", "grok", "gemini", "runway", "luma"]) {
    health.setMetrics(id, {
      status: "healthy",
      latencyMs: 45,
      errorRate: 0.001,
      lastCheck: new Date().toISOString(),
    });
  }
});

describe("A — simple I2V 8s 16:9 selects compatible", () => {
  it("routes to an adapter-backed I2V provider", () => {
    const req = capabilityRequirementsFromShot(baseShot());
    const decision = routeMediaCapability(req);
    assert.ok(decision.selected, "expected a selection");
    assert.ok(
      ["kling", "seedance", "grok", "gemini"].includes(decision.selected!.providerId),
      `unexpected provider ${decision.selected!.providerId}`
    );
    assert.ok(decision.selected!.effective.adapterSupported);
    assert.ok(decision.reasonCodes.includes("CAPABILITY_MATCH"));
  });
});

describe("B — start frame required rejects missing start support", () => {
  it("rejects effective profiles without start frame", () => {
    const openai = listProviderModelCandidates({ providerIds: ["openai"] })[0];
    assert.ok(openai);
    const req = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: { requiresStartFrame: true },
    });
    const match = validateCapabilityRequirements(req, openai.effective);
    assert.equal(match.compatible, false);
    assert.ok(match.reasonCodes.includes("REJECTED_MISSING_START_FRAME") || match.reasonCodes.includes("REJECTED_UNSUPPORTED_MODE"));
  });
});

describe("C — start+end rejects grok (start only)", () => {
  it("hard-rejects grok for start+end requirements", () => {
    const req = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: {
        requiresStartFrame: true,
        requiresEndFrame: true,
        requiresStartAndEnd: true,
      },
      output: { durationSeconds: 8, aspectRatio: "16:9" },
    });
    const guard = assertExecutableCapability(req, "grok");
    assert.equal(guard.ok, false);
    if (!guard.ok) {
      assert.ok(
        guard.decision.reasonCodes.some((c) =>
          ["REJECTED_MISSING_END_FRAME", "REJECTED_MISSING_START_AND_END"].includes(c)
        )
      );
    }
    const decision = routeMediaCapability(req);
    assert.ok(decision.selected);
    assert.notEqual(decision.selected!.providerId, "grok");
    assert.ok(["kling", "seedance"].includes(decision.selected!.providerId));
  });
});

describe("D — character reference", () => {
  it("selects a provider that supports character refs", () => {
    const shot = baseShot({
      references: {
        characterRefs: ["char_a"],
        locationRefs: [],
        styleRefs: [],
        firstFrameUrl: "https://example.com/start.jpg",
      },
    });
    const decision = routeMediaCapability(capabilityRequirementsFromShot(shot));
    assert.ok(decision.selected);
    assert.ok(decision.selected!.effective.references.supportedTypes.includes("character"));
  });
});

describe("E — multi reference character+environment+style", () => {
  it("prefers seedance-class multi-typed reference support", () => {
    const shot = baseShot({
      generationStrategy: "multi_reference",
      references: {
        characterRefs: ["c1"],
        locationRefs: ["loc1"],
        styleRefs: ["style1"],
        firstFrameUrl: "https://example.com/start.jpg",
      },
    });
    const decision = routeMediaCapability(capabilityRequirementsFromShot(shot));
    assert.ok(decision.selected);
    assert.equal(decision.selected!.providerId, "seedance");
    const types = decision.selected!.effective.references.supportedTypes;
    assert.ok(types.includes("character"));
    assert.ok(types.includes("environment") || types.includes("location"));
    assert.ok(types.includes("style"));
  });
});

describe("F — duration 12s rejects max 8", () => {
  it("rejects gemini for 12s", () => {
    const gemini = listProviderModelCandidates({ providerIds: ["gemini"] })[0];
    assert.ok(gemini);
    const req = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: { requiresStartFrame: true },
      output: { durationSeconds: 12, aspectRatio: "16:9" },
    });
    const match = validateCapabilityRequirements(req, gemini.effective);
    assert.equal(match.compatible, false);
    assert.ok(match.reasonCodes.includes("REJECTED_UNSUPPORTED_DURATION"));
  });
});

describe("G — adapter limitation (runway claims, no SPARK adapter)", () => {
  it("rejects runway via adapterSupported false", () => {
    const runway = listProviderModelCandidates({ providerIds: ["runway"], requireAdapter: false })[0];
    assert.ok(runway);
    assert.equal(runway.effective.adapterSupported, false);
    const req = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: { requiresStartFrame: true },
      output: { durationSeconds: 5, aspectRatio: "16:9" },
    });
    const match = validateCapabilityRequirements(req, runway.effective);
    assert.equal(match.compatible, false);
    assert.ok(match.reasonCodes.includes("REJECTED_ADAPTER_UNSUPPORTED"));

    const decision = routeMediaCapability(req);
    assert.ok(!decision.selected || decision.selected.providerId !== "runway");
  });
});

describe("H — unhealthy provider loses to healthy when both capable", () => {
  it("prefers healthy over error status", () => {
    const health = ServiceHealthMonitor.getInstance();
    health.setMetrics("seedance", {
      status: "error",
      latencyMs: 9999,
      errorRate: 1,
      lastCheck: new Date().toISOString(),
    });
    health.setMetrics("grok", {
      status: "healthy",
      latencyMs: 40,
      errorRate: 0,
      lastCheck: new Date().toISOString(),
    });
    health.setMetrics("kling", {
      status: "error",
      latencyMs: 9999,
      errorRate: 1,
      lastCheck: new Date().toISOString(),
    });
    health.setMetrics("gemini", {
      status: "error",
      latencyMs: 9999,
      errorRate: 1,
      lastCheck: new Date().toISOString(),
    });

    const req = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: { requiresStartFrame: true },
      output: { durationSeconds: 8, aspectRatio: "16:9" },
    });
    const decision = routeMediaCapability(req);
    assert.ok(decision.selected);
    assert.equal(decision.selected!.providerId, "grok");
    assert.ok(decision.reasonCodes.includes("HEALTHY_PROVIDER"));
  });
});

describe("I — cost_first vs quality_first with unknown economics", () => {
  it("keeps cost neutral and does not invent prices", () => {
    const reqCost = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: { requiresStartFrame: true },
      output: { durationSeconds: 8, aspectRatio: "16:9" },
      preferences: { objective: "cost_first" },
    });
    const reqQuality = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: { requiresStartFrame: true },
      output: { durationSeconds: 8, aspectRatio: "16:9" },
      preferences: { objective: "quality_first" },
    });
    const dCost = routeMediaCapability(reqCost);
    const dQuality = routeMediaCapability(reqQuality);
    assert.ok(dCost.selected && dQuality.selected);
    assert.ok(dCost.selected!.economics == null || dCost.selected!.economics.known === false);
    assert.equal(dCost.scoreBreakdown?.cost, 0.5);
    assert.equal(dQuality.scoreBreakdown?.cost, 0.5);
    // Preference labels may appear but must not invent LOWER_COST from unknown prices alone
    for (const p of MEDIA_CAPABILITY_PROFILES) {
      assert.equal(p.economics?.known, false);
      assert.equal(p.economics?.estimatedUsdPerGeneration, undefined);
    }
  });
});

describe("J — manual override incompatible → structured rejection", () => {
  it("does not silently switch providers", () => {
    const req = buildCapabilityRequirements({
      modality: "video",
      generationMode: "image_to_video",
      temporal: {
        requiresStartFrame: true,
        requiresEndFrame: true,
        requiresStartAndEnd: true,
      },
      output: { durationSeconds: 8, aspectRatio: "16:9" },
      preferences: {
        objective: "balanced",
        preferredProviderId: "grok",
        manualOverride: true,
      },
    });
    const decision = routeMediaCapability(req, { manualProviderId: "grok" });
    assert.equal(decision.selected, undefined);
    assert.ok(decision.reasonCodes.includes("REJECTED_MANUAL_MISMATCH"));
    assert.ok(
      decision.rejected.some((r) =>
        r.reasonCodes.some((c) =>
          ["REJECTED_MISSING_END_FRAME", "REJECTED_MISSING_START_AND_END", "REJECTED_MANUAL_MISMATCH"].includes(c)
        )
      )
    );
  });
});

describe("effective capability conflict detection", () => {
  it("surfaces conflicts when profile facts lack an adapter", () => {
    const profile = getCapabilityProfile("luma")!;
    const { effective, conflicts, adapterPresent } = resolveEffectiveCapability(profile, null);
    assert.equal(adapterPresent, false);
    assert.equal(effective.adapterSupported, false);
    assert.equal(effective.generationModes.length, 0);
    assert.ok(conflicts.some((c) => c.code === "CAPABILITY_CONFLICT"));
  });

  it("intersects end-frame when adapter disagrees with profile claim", () => {
    const profile = getCapabilityProfile("kling")!;
    const claim = getAdapterClaim("kling")!;
    const forced = { ...claim, supportsEndFrame: false };
    const { effective, conflicts } = resolveEffectiveCapability(profile, forced);
    assert.equal(effective.temporal.supportsEndFrame, false);
    assert.equal(effective.temporal.supportsStartAndEndFrame, false);
    assert.ok(conflicts.some((c) => c.requirement === "endFrame"));
  });
});

describe("version / stale provenance", () => {
  it("marks old verifiedAt as stale", () => {
    const p = provenance("provider_documentation", "probable", "old", "2020-01-01T00:00:00.000Z");
    assert.equal(p.staleAfterDays, 90);
    assert.equal(isStale(p, Date.parse("2026-09-05T00:00:00.000Z")), true);
    const fresh = provenance("adapter", "verified", "fresh", "2026-09-01T00:00:00.000Z");
    assert.equal(isStale(fresh, Date.parse("2026-09-05T00:00:00.000Z")), false);
  });
});

describe("provider neutrality", () => {
  it("does not always select kling", () => {
    const selections = new Set<string>();
    // start-only + character multi-ref favors non-kling paths
    const multi = routeMediaCapability(
      capabilityRequirementsFromShot(
        baseShot({
          generationStrategy: "multi_reference",
          durationSec: 12,
          references: {
            characterRefs: ["c1"],
            locationRefs: ["e1"],
            styleRefs: ["s1"],
            firstFrameUrl: "https://example.com/a.jpg",
          },
        })
      )
    );
    if (multi.selected) selections.add(multi.selected.providerId);

    const t2v = routeMediaCapability(
      buildCapabilityRequirements({
        modality: "video",
        generationMode: "text_to_video",
        output: { durationSeconds: 8, aspectRatio: "16:9" },
      })
    );
    if (t2v.selected) selections.add(t2v.selected.providerId);

    assert.ok(selections.size >= 1);
    assert.ok(!(selections.size === 1 && selections.has("kling")), "must not hard-code kling");
  });
});
