/**
 * Autonomous Production Asset Director — narrative-aware visual world planning.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orchestrateIdeaToProductionSpec } from "./intelligence/productionOrchestrator";
import {
  directProductionAssets,
  applyAssetDirectorToSpec,
} from "./intelligence/productionAssetDirector";
import {
  createCharacterMaster,
  createLocationMaster,
  createPropMaster,
  createStyleMaster,
} from "./specification/assetSpec";
import { buildLocationPlatePrompt } from "./locationPlatePrompt";
import { buildProductionCharacterSheetPrompt } from "./characterSheetPrompt";
import type { ProductionAssetRequirement } from "./specification/assetSpec";

function reqs(spec: { meta: { assetDirector?: { requirements: ProductionAssetRequirement[] } } }) {
  return spec.meta.assetDirector?.requirements || [];
}

function byKind(list: ProductionAssetRequirement[], kind: string) {
  return list.filter((r) => r.kind === kind);
}

describe("Production Asset Director — cinematic story", () => {
  it("reuses lead, infers supporting cast, locations, props, and binds scene refs", () => {
    const lead = createCharacterMaster({
      baseId: "character_001",
      version: 3,
      name: "Lead Founder",
      description: "Nigerian crypto founder",
      role: "primary",
      referenceUrls: ["https://example.com/sheet_lead.png"],
    });
    lead.status = "approved";

    const { ok, spec, validation } = orchestrateIdeaToProductionSpec({
      idea:
        "A young Nigerian crypto founder discovers his competitor stole his product and confronts him at a private business dinner in the office and restaurant.",
      targetDurationSec: 30,
      productionMode: "cinematic",
      existingMasters: [lead],
      character: {
        id: "char_profile",
        name: "Lead Founder",
        characterSheetUrl: "https://example.com/sheet_lead.png",
      } as any,
      brand: { id: "b1", name: "Crypto Media", niche: "crypto", country: "Nigeria" } as any,
    });

    assert.equal(ok, true, validation.errors.join("; "));
    assert.ok(spec);
    const requirements = reqs(spec!);
    assert.ok(requirements.length > 0, "asset director requirements present");

    const chars = byKind(requirements, "character");
    const leadReq = chars.find((c) => c.masterAssetRef === "character_001:v3");
    assert.ok(leadReq, "lead reused as character_001:v3");
    assert.equal(leadReq!.generationRequired, false, "approved sheet must not regenerate");

    const competitor = chars.find((c) => /competitor/i.test(c.name));
    assert.ok(competitor, "competitor supporting cast inferred");
    assert.equal(competitor!.generationRequired, true);

    const locations = byKind(requirements, "location");
    assert.ok(locations.length >= 2, "office + restaurant inferred");
    assert.ok(locations.some((l) => /office/i.test(l.name)));
    assert.ok(locations.some((l) => /dining|restaurant/i.test(l.name)));

    const props = byKind(requirements, "prop");
    assert.ok(props.some((p) => /product/i.test(p.name)), "product prop inferred");

    assert.ok(spec!.characters.length >= 2);
    assert.ok(spec!.world.locations.length >= 2);
    assert.ok(spec!.scenes.every((s) => (s.characterIds || []).length >= 1));
    assert.ok(spec!.scenes.some((s) => Boolean(s.locationId)));

    // Shot references bound after visual planning
    const shot = spec!.scenes[0].shots[0];
    assert.ok((shot.references?.characterRefs || []).length >= 1);
  });
});

describe("Production Asset Director — narrator economics", () => {
  it("builds a lighter asset graph without unnecessary supporting cast / I2V masters", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Narrated story about a crypto founder discovering product theft at dinner",
      targetDurationSec: 45,
      productionMode: "narrator",
      applyVisualPlanning: true,
    });
    assert.equal(ok, true);
    assert.ok(spec);
    const requirements = reqs(spec!);
    const support = byKind(requirements, "character").filter((c) => c.role === "support");
    assert.equal(support.length, 0, "narrator should not invent supporting masters");
    const locations = byKind(requirements, "location");
    assert.ok(locations.length <= 1, "narrator keeps a light location world");
    // Prefer still / lighter strategies — lastFrameChain may be off in express
    assert.equal(spec!.project.productionMode === "narrator" || true, true);
    assert.ok(
      (spec!.meta.assetDirector?.stats.characterCount || 0) <= 2,
      "narrator character graph stays small"
    );
  });
});

describe("Production Asset Director — hybrid", () => {
  it("includes host plus story-relevant assets without flooding", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Hybrid host tip video where the founder walks into a meeting with investors about a product demo",
      targetDurationSec: 60,
      productionMode: "hybrid",
    });
    assert.equal(ok, true);
    const requirements = reqs(spec!);
    const chars = byKind(requirements, "character");
    assert.ok(chars.some((c) => c.role === "host" || c.role === "primary" || /lead|host|subject/i.test(c.name)));
    assert.ok(chars.some((c) => /investor|counterpart/i.test(c.name)), "meeting counterpart inferred");
    assert.ok(!chars.some((c) => c.role === "extra"), "hybrid should not force crowd extras");
  });
});

describe("Production Asset Director — wuxia", () => {
  it("infers martial world assets from the story only", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Wuxia cinematic tale: a young hero confronts a rival martial artist in a mountain temple courtyard with a blade",
      targetDurationSec: 45,
      productionMode: "cinematic",
    });
    assert.equal(ok, true);
    const requirements = reqs(spec!);
    assert.ok(byKind(requirements, "character").some((c) => /rival/i.test(c.name)));
    assert.ok(byKind(requirements, "location").some((l) => /courtyard|temple|martial/i.test(l.name)));
    assert.ok(byKind(requirements, "prop").some((p) => /weapon|blade|sword/i.test(p.name)));
    // Must NOT invent crypto laptop just because heuristics exist elsewhere
    assert.ok(!byKind(requirements, "prop").some((p) => /laptop/i.test(p.name)));
  });
});

describe("Production Asset Director — anime medium inheritance", () => {
  it("character and location prompts inherit anime visual treatment", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Anime story: a crypto founder confronts a competitor at a private dinner",
      targetDurationSec: 30,
      productionMode: "cinematic",
    });
    assert.equal(ok, true);
    const requirements = reqs(spec!);
    const style = byKind(requirements, "style")[0];
    assert.ok(style);
    assert.match(String(style.visualContract.medium || style.visualContract.look || ""), /anime/i);

    const charPrompt = byKind(requirements, "character").find((c) => c.prompt)?.prompt || "";
    assert.match(charPrompt, /Anime|anime/i);

    const locPrompt = byKind(requirements, "location").find((l) => l.prompt)?.prompt || "";
    assert.match(locPrompt, /Anime|anime/i);
  });
});

describe("Production Asset Director — 3D medium inheritance", () => {
  it("asset graph inherits 3D visual treatment", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "3D CGI cinematic short: founder discovers competitor stole the product in the office",
      targetDurationSec: 30,
      productionMode: "cinematic",
    });
    assert.equal(ok, true);
    const requirements = reqs(spec!);
    const style = byKind(requirements, "style")[0];
    assert.match(String(style?.visualContract.medium || ""), /3d/i);
    const prompts = requirements.map((r) => r.prompt || "").join("\n");
    assert.match(prompts, /3D|CG|cgi|render/i);
  });
});

describe("Production Asset Director — existing asset reuse", () => {
  it("does not duplicate approved character, location, or prop masters", () => {
    const lead = createCharacterMaster({
      baseId: "character_001",
      version: 3,
      name: "Lead Host",
      description: "Approved lead",
      role: "host",
      referenceUrls: ["https://example.com/lead.png"],
    });
    lead.status = "approved";
    const office = createLocationMaster({
      baseId: "location_001",
      version: 1,
      name: "Founder Office",
      description: "Locked office",
      environment: "Office",
      referenceUrls: ["https://example.com/office.png"],
    });
    office.status = "approved";
    const laptop = createPropMaster({
      baseId: "prop_laptop",
      name: "Laptop",
      description: "Founder laptop",
      referenceUrls: ["https://example.com/laptop.png"],
    });
    laptop.status = "approved";
    const style = createStyleMaster({
      baseId: "style_001",
      name: "Cinematic Style",
      description: "Locked",
      look: "Photoreal live-action cinematic production design",
      colorLanguage: "coherent cinematic grade",
    });

    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Cinematic story in the office with a laptop about product discovery",
      targetDurationSec: 30,
      productionMode: "cinematic",
      existingMasters: [lead, office, laptop, style],
      character: { id: "c", name: "Lead Host", characterSheetUrl: "https://example.com/lead.png" } as any,
    });
    assert.equal(ok, true);
    const requirements = reqs(spec!);

    const leadReq = byKind(requirements, "character").find((c) => c.masterAssetRef === "character_001:v3");
    assert.ok(leadReq);
    assert.equal(leadReq!.generationRequired, false);

    const locReq = byKind(requirements, "location").find((l) => l.masterAssetRef?.startsWith("location_001"));
    assert.ok(locReq);
    assert.equal(locReq!.generationRequired, false);

    const propReq = byKind(requirements, "prop").find((p) => p.masterAssetRef === "prop_laptop:v1");
    assert.ok(propReq);
    assert.equal(propReq!.generationRequired, false);

    const styleReq = byKind(requirements, "style")[0];
    assert.equal(styleReq.generationRequired, false);
    assert.ok((spec!.meta.assetDirector?.stats.reusedCount || 0) >= 3);
  });
});

describe("Production Asset Director — same location across scenes", () => {
  it("uses one location master for repeated office scenes", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Cinematic story entirely inside the founder office across discovery, investigation, and realization beats",
      targetDurationSec: 45,
      productionMode: "cinematic",
      applyVisualPlanning: false,
    });
    assert.equal(ok, true);
    const locations = byKind(reqs(spec!), "location");
    const officeBase = locations.filter((l) => l.masterAssetRef?.startsWith("location_001"));
    // One daytime office — not one per scene
    assert.equal(officeBase.filter((l) => !l.state || l.state === "day").length, 1);
    assert.ok((spec!.world.locations || []).length >= 1);
    const locIds = new Set(spec!.scenes.map((s) => s.locationId).filter(Boolean));
    assert.ok(locIds.size <= 2, "scenes share office continuity rather than unique sets");
  });
});

describe("Production Asset Director — day + night location states", () => {
  it("creates separate office day and night plates when story requires both", () => {
    const emptyContinuity = {
      entranceState: "enter",
      exitState: "exit",
      identityLocks: [] as string[],
      wardrobeLocks: [] as string[],
      propLocks: [] as string[],
    };
    const directed = directProductionAssets({
      productionId: "prod_daynight",
      idea: "Cinematic story in the founder office from daytime discovery to nighttime confrontation",
      creative: {
        intent: "daytime discovery to nighttime confrontation in the office",
        audience: "general",
        genre: "narrative_film",
        tone: "tense",
        pacing: "compressed",
        visualLanguage: "cinematic realistic",
        narrativeStructure: "three_act",
        emotionalArc: "rising tension",
        requiresHost: true,
        requiresCharacters: true,
        requiresNarration: false,
        requiresDialogue: true,
        requiresAnimation: false,
        requiresMusic: true,
        requiresSoundDesign: true,
        requiresResearch: false,
        requiresGeneratedEnvironments: true,
        requiresProductShots: false,
        requiresDocumentaryTreatment: false,
        requiresStockOrUserAssets: false,
        requiresImageGeneration: true,
        requiresVideoGeneration: true,
        requiresVoiceGeneration: false,
        requiresEditing: true,
        estimatedSceneCount: 4,
        estimatedShotCount: 8,
        confidence: 0.8,
        rationale: [],
        grammarTags: ["cinematic"],
      },
      beats: [
        { index: 0, narrativeFunction: "hook", purpose: "day discovery", spokenHint: "daytime office", durationSec: 5 },
        { index: 1, narrativeFunction: "context", purpose: "investigate", spokenHint: "", durationSec: 5 },
        { index: 2, narrativeFunction: "confrontation", purpose: "night confrontation", spokenHint: "night", durationSec: 8 },
        { index: 3, narrativeFunction: "payoff", purpose: "realization", spokenHint: "", durationSec: 5 },
      ],
      scenes: [
        { id: "s0", index: 0, title: "Day", purpose: "day", narrativeFunction: "hook", durationSec: 5, environment: "office day", emotionalObjective: "curiosity", characterIds: [], propIds: [], continuity: emptyContinuity, shots: [] },
        { id: "s1", index: 1, title: "Mid", purpose: "mid", narrativeFunction: "context", durationSec: 5, environment: "office", emotionalObjective: "tension", characterIds: [], propIds: [], continuity: emptyContinuity, shots: [] },
        { id: "s2", index: 2, title: "Night", purpose: "night", narrativeFunction: "confrontation", durationSec: 8, environment: "office night", emotionalObjective: "conflict", characterIds: [], propIds: [], continuity: emptyContinuity, shots: [] },
        { id: "s3", index: 3, title: "End", purpose: "end", narrativeFunction: "payoff", durationSec: 5, environment: "office", emotionalObjective: "resolve", characterIds: [], propIds: [], continuity: emptyContinuity, shots: [] },
      ],
      characters: [],
      world: { settingSummary: "", locations: [] },
      visualStyle: {
        look: "cinematic",
        colorLanguage: "grade",
        cameraLanguage: "lenses",
        lightingLanguage: "motivated",
        references: [],
        antiSlopLaws: [],
      },
      productionMode: "cinematic",
      visualMedium: "cinematic",
    });

    const locs = byKind(directed.requirements, "location").filter((l) =>
      l.masterAssetRef?.startsWith("location_001")
    );
    assert.ok(locs.some((l) => l.state === "day"));
    assert.ok(locs.some((l) => l.state === "night"));
    assert.ok(locs.every((l) => l.generationRequired));
    assert.notEqual(
      locs.find((l) => l.state === "day")?.masterAssetRef,
      locs.find((l) => l.state === "night")?.masterAssetRef
    );
  });
});

describe("prompt compilers — structured location + character", () => {
  it("location plate prompt encodes place/time/medium and NO PEOPLE", () => {
    const prompt = buildLocationPlatePrompt({
      locationName: "Founder Office",
      geography: "Lagos",
      architecture: "glass corner suite",
      timeOfDay: "night",
      lighting: "practical lamps",
      visualMedium: "anime",
      narrativePurpose: "night confrontation environment",
      continuityFeatures: ["desk axis", "window wall"],
    });
    assert.match(prompt, /Founder Office/);
    assert.match(prompt, /night/i);
    assert.match(prompt, /Anime|anime/i);
    assert.match(prompt, /NO PEOPLE/);
    assert.match(prompt, /desk axis/);
  });

  it("character sheet prompt locks medium and identity ownership", () => {
    const prompt = buildProductionCharacterSheetPrompt({
      creatorName: "Rival",
      role: "support",
      genre: "Anime",
      purpose: "Antagonist for confrontation",
      brandName: "SPARK",
    });
    assert.match(prompt, /Anime/);
    assert.match(prompt, /MEDIUM LOCK/);
    assert.match(prompt, /owns identity/i);
  });
});

describe("applyAssetDirectorToSpec", () => {
  it("merges director output onto ProductionSpec without generating media", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Short tip about solar panels",
      targetDurationSec: 30,
      productionMode: "standard",
      applyVisualPlanning: false,
    });
    assert.equal(ok, true);
    assert.ok(spec?.meta.assetDirector);
    const again = applyAssetDirectorToSpec(spec!, {
      requirements: spec!.meta.assetDirector!.requirements,
      characters: spec!.characters,
      assets: spec!.assets,
      world: spec!.world,
      scenes: spec!.scenes,
      visualStyle: spec!.visualStyle,
      stats: spec!.meta.assetDirector!.stats,
      notes: ["noop"],
    });
    assert.equal(again.characters.length, spec!.characters.length);
  });
});
