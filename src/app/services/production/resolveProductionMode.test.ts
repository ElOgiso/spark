/**
 * Tests for the single source of production-mode truth.
 * Run: tsx --test src/app/services/production/resolveProductionMode.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveProductionMode,
  normalizeModeString,
  getNotionModeLabel,
} from "./resolveProductionMode";
import type { Production, ProductionBrief, ViralSpark, Brand } from "../../domain/types";

test("legacy synonyms normalize to the three canonical modes", () => {
  assert.equal(normalizeModeString("narrator"), "express");
  assert.equal(normalizeModeString("slideshow"), "express");
  assert.equal(normalizeModeString("faceless VO"), "express");
  assert.equal(normalizeModeString("faceless"), undefined); // content-format token, not a mode
  assert.equal(normalizeModeString("vo"), undefined); // bare substring must not flip cinematic
  assert.equal(normalizeModeString("hybrid"), "standard");
  assert.equal(normalizeModeString("host"), undefined); // content-format token, must NOT be treated as standard mode
  assert.equal(normalizeModeString("talking-head"), undefined); // content-format token, must NOT be treated as standard mode
  assert.equal(normalizeModeString("cinematic"), "deep");
  assert.equal(normalizeModeString("one-take filmic"), "deep");
  assert.equal(normalizeModeString("gibberish"), undefined);
  assert.equal(normalizeModeString(""), undefined);
});

test("contentFormat does not contaminate productionMode", () => {
  // Even if spark or brief format is "host" or "talking-head", deep productionMode remains deep!
  const sparkHost = {
    suggestedFormat: "host",
    suggestedMode: "deep",
  } as unknown as ViralSpark;
  assert.equal(resolveProductionMode({ spark: sparkHost }), "deep");

  const brandHost = {
    productionMode: "cinematic",
    formatSettings: { contentFormat: "host" },
  } as unknown as Brand;
  assert.equal(resolveProductionMode({ brand: brandHost }), "deep");

  const sparkTalkingHead = {
    suggestedFormat: "talking-head",
    suggestedMode: "deep",
  } as unknown as ViralSpark;
  assert.equal(resolveProductionMode({ spark: sparkTalkingHead }), "deep");

  const briefTalkingHead = {
    productionMode: "deep",
    formatSettings: { contentFormat: "talking-head" },
  } as unknown as ProductionBrief;
  assert.equal(resolveProductionMode({ brief: briefTalkingHead }), "deep");
});

test("user preference priority: override > production > brand > brief > spark > default", () => {
  const brand = { productionMode: "cinematic" } as unknown as Brand;
  const production = { mode: "hybrid" } as unknown as Production;
  const brief = { productionMode: "narrator" } as unknown as ProductionBrief;
  const spark = { suggestedMode: "express" } as unknown as ViralSpark;

  // Explicit override always wins.
  assert.equal(
    resolveProductionMode({ modeOverride: "narrator", production, brand, brief, spark }),
    "express"
  );
  // production.mode beats brand/brief/spark.
  assert.equal(resolveProductionMode({ production, brand, brief, spark }), "standard");
  // brand preference is honored when production.mode is absent (this was previously dropped).
  assert.equal(resolveProductionMode({ brand, brief, spark }), "deep");
  // brief beats spark when brand absent.
  assert.equal(resolveProductionMode({ brief, spark }), "express");
  // spark suggestion is the last signal before default.
  assert.equal(
    resolveProductionMode({ spark: { suggestedProductionMode: "cinematic" } as unknown as ViralSpark }),
    "deep"
  );
  // Nothing set → standard.
  assert.equal(resolveProductionMode({}), "standard");
});

test("Notion-facing labels map back from any legacy string", () => {
  assert.equal(getNotionModeLabel("narrator"), "Narrator");
  assert.equal(getNotionModeLabel("hybrid"), "Hybrid");
  assert.equal(getNotionModeLabel("cinematic"), "Cinematic");
  assert.equal(getNotionModeLabel(undefined), "Hybrid");
});
