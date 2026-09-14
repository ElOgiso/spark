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
