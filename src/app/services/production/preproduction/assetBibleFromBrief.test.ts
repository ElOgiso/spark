/**
 * SPARK Preproduction — Asset Bible Planner Unit Tests
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { planAssetBibleFromBrief } from "./assetBibleFromBrief";
import type { ProductionBrief } from "../../../domain/types";

test("planAssetBibleFromBrief extracts character, location, prop, and wardrobe variant tags from brief", () => {
  const brief: ProductionBrief = {
    title: "The Santiago Dilemma",
    productionMode: "standard",
    niche: "Psychological Thriller",
    visualDirection: "Mid-century consulting office with warm practicals and walnut paneling",
    hook: "The tape recorder clicked off, but the session had barely started.",
    scriptOutline: "Flashback reveals childhood memory with young Santiago.",
    beats: [
      {
        timecode: "00:00-00:05",
        valueJob: "hook",
        spokenLines: "Listen closely to what follows.",
        physicalAction: "Psychologist inspects the tape recorder on the mahogany desk.",
        cameraDirection: "Slow push-in on desk",
        onScreenText: "",
      },
      {
        timecode: "00:05-00:10",
        valueJob: "problem",
        spokenLines: "Years ago, before the trial, everything was different.",
        physicalAction: "Young Santiago in childhood flashback stares out the rain-streaked window.",
        cameraDirection: "Whip-pan to window",
        onScreenText: "",
      },
    ],
  };

  const heroCharacter = {
    id: "char-santiago-1",
    name: "Santiago",
    role: "protagonist",
    style: "Cinematic Thriller",
    traits: ["intense", "observant"],
    voice: { name: "v", language: "en", tone: "intense", locked: true },
  };

  const supportingCharacter = {
    id: "char-psychologist-2",
    name: "Dr. Elena",
    role: "psychologist",
    style: "Clinical and composed",
    traits: ["measured"],
    voice: { name: "v2", language: "en", tone: "calm", locked: true },
  };

  const entries = planAssetBibleFromBrief(brief, {
    heroCharacter,
    characters: [heroCharacter, supportingCharacter],
  });

  // 1. Primary character
  const mainEntry = entries.find((e) => e.role === "character_main");
  assert.ok(mainEntry, "Must include character_main");
  assert.equal(mainEntry.tag, "@santiago");
  assert.equal(mainEntry.sheetKind, "character");
  assert.match(mainEntry.notes, /3-panel grey seamless turnaround/i);

  // 2. Supporting character
  const suppEntry = entries.find((e) => e.role === "character_support");
  assert.ok(suppEntry, "Must include character_support");
  assert.equal(suppEntry.tag, "@support_dr_elena");
  assert.equal(suppEntry.sheetKind, "character");

  // 3. Wardrobe / Age Variant (Childhood / Flashback)
  const variantEntry = entries.find((e) => e.sheetKind === "wardrobe_variant");
  assert.ok(variantEntry, "Must detect childhood/flashback variant from beats");
  assert.match(variantEntry.tag, /@wardrobe_santiago/);
  assert.equal(variantEntry.variantOf, "@santiago");

  // 4. Locations (office from visualDirection and mentions)
  const locEntries = entries.filter((e) => e.sheetKind === "location");
  assert.ok(locEntries.length >= 1, "Must contain at least one location plate");
  assert.ok(locEntries.some((l) => l.tag.includes("mid_century") || l.tag.includes("office")));
  assert.match(locEntries[0].notes, /empty.*3\/4 depth angle/i);

  // 5. Props (recorder)
  const propEntry = entries.find((e) => e.sheetKind === "prop");
  assert.ok(propEntry, "Must detect tape recorder as prop");
  assert.equal(propEntry.tag, "@prop_recorder");
  assert.match(propEntry.notes, /no real-world brand IP/i);
});

test("planAssetBibleFromBrief handles minimal brief with brand fallback cleanly", () => {
  const brief: ProductionBrief = {
    title: "Quick Spark Tip",
    productionMode: "express",
  };

  const entries = planAssetBibleFromBrief(brief, {
    brand: { id: "b1", name: "NovaTech", niche: "AI Software" } as any,
  });

  assert.ok(entries.length >= 2);
  const main = entries.find((e) => e.role === "character_main");
  assert.ok(main);
  assert.equal(main.tag, "@novatech");

  const loc = entries.find((e) => e.sheetKind === "location");
  assert.ok(loc);
  assert.match(loc.tag, /@loc_/);
});

test("planAssetBibleFromBrief extracts extended heuristics: stadium, bathroom, perfume, watch, trophy", () => {
  const brief: ProductionBrief = {
    title: "Championship Finale",
    productionMode: "standard",
    visualDirection: "Crowded stadium tunnel leading into the locker room bathroom",
    hook: "The luxury perfume bottle shattered on the stadium floor.",
    beats: [
      {
        timecode: "00:00-00:05",
        valueJob: "hook",
        spokenLines: "Check your gold watch before lifting the trophy.",
        physicalAction: "Athlete polishes the championship trophy in the stadium tunnel.",
        cameraDirection: "Low angle tilt",
      },
    ],
  };

  const entries = planAssetBibleFromBrief(brief, {
    brand: { id: "b-sports", name: "Apex Athletics" } as any,
  });

  const tags = entries.map((e) => e.tag);
  assert.ok(tags.some((t) => t.includes("stadium")), "Should detect stadium location");
  assert.ok(tags.some((t) => t.includes("bathroom")), "Should detect bathroom location");
  assert.ok(tags.some((t) => t.includes("perfume")), "Should detect perfume prop");
  assert.ok(tags.some((t) => t.includes("watch")), "Should detect watch prop");
  assert.ok(tags.some((t) => t.includes("trophy")), "Should detect trophy prop");
});

test("inferNeededTagsFromScene extracts matching tags from scene text against asset bible", async () => {
  const { inferNeededTagsFromScene } = await import("./assetBibleFromBrief");

  const bible = [
    { tag: "@santiago", role: "character_main", sheetKind: "character", label: "Santiago", notes: "" },
    { tag: "@support_dr_elena", role: "character_support", sheetKind: "character", label: "Dr. Elena", notes: "" },
    { tag: "@loc_office", role: "location", sheetKind: "location", label: "Consulting Office", notes: "" },
    { tag: "@prop_recorder", role: "prop", sheetKind: "prop", label: "Hero Recorder", notes: "" },
  ] as const;

  // 1. Scene matching recorder and office
  const scene1 = {
    shotList: "Scene 1",
    physicalAction: "Dr. Elena leans over the recorder on the office desk",
    spokenLines: "Is this thing recording?",
  };
  const matched1 = inferNeededTagsFromScene(scene1, bible as any);
  assert.ok(matched1, "Must find matching tags");
  assert.ok(matched1.includes("@support_dr_elena"));
  assert.ok(matched1.includes("@loc_office"));
  assert.ok(matched1.includes("@prop_recorder"));

  // 2. Scene with no mentions returns undefined (enabling subjectType default)
  const sceneEmpty = {
    shotList: "Scene 2",
    physicalAction: "Sunlight glints through abstract window blinds",
  };
  const matchedEmpty = inferNeededTagsFromScene(sceneEmpty, bible as any);
  assert.equal(matchedEmpty, undefined);
});

test("ProductionBriefService.generateBrief automatically attaches planned assetBible to brief", async () => {
  const { ProductionBriefService } = await import("../productionBriefService");
  const { ProductionGenerationGuard } = await import("../ProductionGenerationGuard");
  const { ModelRouter } = await import("../../runtime/modelRouter");

  ProductionGenerationGuard.setEnabled(true);

  const spark = {
    id: "spk-wired-1",
    title: "The Great Awakening",
    hook: "You won't believe what happened in the lab today.",
    whyNow: "Sudden breakthrough",
    brandFitScore: 92,
    score: 92,
    views: "100k",
    velocity: "10k/day",
    researchContext: { coreInsight: "Lab breakthrough", recommendedAngle: "scientific curiosity" },
  } as any;

  const brand = {
    id: "brand-wired-1",
    name: "QuantumCore",
    niche: "Deep Tech",
    contentPillars: [{ id: "p1", label: "Science", active: true }],
  } as any;

  const character = {
    id: "char-lead-1",
    name: "Professor Vance",
    role: "Lead Scientist",
  } as any;

  const originalExecute = ModelRouter.executeCategoryRequest;
  ModelRouter.executeCategoryRequest = async () => {
    return JSON.stringify({
      title: "The Great Awakening",
      hook: "You will not believe the massive discovery we made inside our secret laboratory today.",
      scriptOutline: "A walk through the laboratory reveals a strange device that defies all known physics.",
      beats: [
        {
          timecode: "00:00-00:05",
          valueJob: "hook",
          spokenLines: "You will not believe the massive discovery we made inside our secret laboratory today.",
          physicalAction: "Professor Vance checks the glowing device in the laboratory.",
          cameraDirection: "Push in on Professor Vance",
        },
        {
          timecode: "00:05-00:10",
          valueJob: "proof",
          spokenLines: "Every instrument confirmed the reaction is stable and ready for full scale industrial deployment immediately.",
          physicalAction: "Professor Vance points to the glowing terminal monitors.",
          cameraDirection: "Over the shoulder on monitor",
        },
        {
          timecode: "00:10-00:15",
          valueJob: "cta",
          spokenLines: "Subscribe now to follow our real time experiments and download the complete engineering whitepaper today.",
          physicalAction: "Professor Vance addresses the camera directly.",
          cameraDirection: "Direct to lens medium close-up",
        },
      ],
      visualDirection: "High-tech sterile research laboratory with stainless steel benches",
      whyThisWorks: "Curiosity gap and scientific proof",
    });
  };

  try {
    const brief = await ProductionBriefService.generateBrief({
      spark,
      brand,
      character,
      productionMode: "standard",
      targetDurationSec: 15,
    });

    assert.ok(brief.assetBible, "generateBrief must attach assetBible to brief");
    assert.ok(Array.isArray(brief.assetBible), "assetBible must be an array");
    assert.ok(brief.assetBible.length >= 2, "assetBible should contain at least character and location entries");

    const heroEntry = brief.assetBible.find((e) => e.role === "character_main");
    assert.ok(heroEntry, "assetBible must have hero character");
    assert.equal(heroEntry.tag, "@professor_vance");

    const locEntry = brief.assetBible.find((e) => e.sheetKind === "location" && (e.tag.includes("lab") || e.tag.includes("high_tech")));
    assert.ok(locEntry, `assetBible must have laboratory location: ${JSON.stringify(brief.assetBible)}`);
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
  }
});

test("buildProductionElementPack aligns tags with assetBible and gracefully succeeds without it", async () => {
  const { buildProductionElementPack } = await import("../elements/productionElements");

  const character = {
    id: "char-1",
    name: "Dr. Elena",
    characterSheetUrl: "https://example.com/elena.png",
  } as any;

  const brand = {
    id: "brand-1",
    name: "Santiago Lab",
    locationPlateUrl: "https://example.com/plate.png",
  } as any;

  // With asset bible
  const packWithBible = buildProductionElementPack({
    character,
    brand,
    locationPlateUrl: "https://example.com/plate.png",
    directorPropUrl: "https://example.com/recorder.png",
    assetBible: [
      { tag: "@elena_prime", role: "character_main", sheetKind: "character", label: "Dr. Elena Prime", notes: "" },
      { tag: "@loc_consulting_suite", role: "location", sheetKind: "location", label: "Consulting Suite", notes: "" },
      { tag: "@prop_audio_recorder", role: "prop", sheetKind: "prop", label: "Tape Recorder Model", notes: "" },
    ],
  });

  const elenaEl = packWithBible.find((e) => e.role === "character_main");
  assert.equal(elenaEl?.tag, "@elena_prime");
  assert.equal(elenaEl?.label, "Dr. Elena Prime");

  const locEl = packWithBible.find((e) => e.role === "location");
  assert.equal(locEl?.tag, "@loc_consulting_suite");
  assert.equal(locEl?.label, "Consulting Suite");

  const propEl = packWithBible.find((e) => e.role === "prop");
  assert.equal(propEl?.tag, "@prop_audio_recorder");

  // Without asset bible (backward compatibility)
  const packWithoutBible = buildProductionElementPack({
    character,
    brand,
    locationPlateUrl: "https://example.com/plate.png",
    directorPropUrl: "https://example.com/recorder.png",
  });
  assert.equal(packWithoutBible.find((e) => e.role === "character_main")?.tag, "@dr_elena");
  assert.ok(packWithoutBible.find((e) => e.role === "location")?.tag.includes("loc_santiago"));
  assert.equal(packWithoutBible.find((e) => e.role === "prop")?.tag, "@prop_hero");
});
