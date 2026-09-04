/**
 * Phase 2 — Creative Director + Production Intelligence tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyCreativeIntent, registerGenreClassificationRule } from "./intelligence/genreClassifier";
import { directCreativeIntent } from "./intelligence/creativeDirector";
import { composeGrammars } from "./grammar";
import { planNarrative, structureForGenre } from "./intelligence/narrativePlanner";
import { createProductionPlan, orchestrateIdeaToProductionSpec } from "./intelligence/productionOrchestrator";
import { resolveProductionPreferences } from "./intelligence/preferenceResolver";
import { createDefaultCreatorProfile } from "./specification/creatorProfile";
import { validateProductionSpec } from "./specification";
import { productionSpecToBrief } from "./specification/adapters";

describe("genre classifier", () => {
  it("classifies documentary + cinematic tags", () => {
    const c = classifyCreativeIntent("Create a 90-second cinematic documentary about an ancient African kingdom");
    assert.equal(c.primaryGenre, "documentary");
    assert.ok(c.styleTags.includes("cinematic") || c.styleTags.includes("african"));
    assert.ok((c.durationHintSec || 0) >= 90);
  });

  it("classifies education / bitcoin explainer", () => {
    const c = classifyCreativeIntent("Make a 5-minute YouTube video explaining Bitcoin");
    assert.equal(c.primaryGenre, "educational");
    assert.ok((c.durationHintSec || 0) >= 300);
  });

  it("classifies luxury advertisement", () => {
    const c = classifyCreativeIntent("Create a luxury commercial for this watch");
    assert.ok(c.primaryGenre === "advertisement" || c.primaryGenre === "product_demo");
    assert.ok(c.styleTags.includes("luxury") || c.tone === "premium" || c.tone === "clear");
  });

  it("classifies funny animated short", () => {
    const c = classifyCreativeIntent("Make a funny animated short");
    assert.ok(c.primaryGenre === "animation" || c.primaryGenre === "comedy");
  });

  it("marks empty ideas as ambiguous with unknown fields", () => {
    const c = classifyCreativeIntent("");
    assert.equal(c.ambiguous, true);
    assert.ok(c.unknownFields.includes("genre"));
  });

  it("allows registering future grammar rules without rewrite", () => {
    registerGenreClassificationRule({
      id: "test_mythic",
      genre: "custom",
      words: ["mythic-xyz-unique"],
      boost: 0.9,
      tone: "mythic",
    });
    const c = classifyCreativeIntent("A mythic-xyz-unique tale");
    assert.equal(c.primaryGenre, "custom");
    assert.equal(c.tone, "mythic");
  });
});

describe("grammar composition", () => {
  it("composes documentary + cinematic + african", () => {
    const g = composeGrammars("documentary", [], ["cinematic", "african"]);
    assert.ok(g.sources.includes("documentary"));
    assert.ok(g.tags.includes("cinematic"));
  });

  it("composes advertisement + luxury", () => {
    const g = composeGrammars("advertisement", [], ["luxury", "vertical"]);
    assert.equal(g.pacingBias, "compressed");
    assert.ok(g.tags.includes("luxury"));
  });

  it("composes anime + comedy style tags", () => {
    const g = composeGrammars("anime", ["comedy"], ["comedy"]);
    assert.ok(g.sources.includes("anime"));
  });
});

describe("narrative structures by genre", () => {
  it("uses educational structure not film acts", () => {
    const s = structureForGenre("educational", composeGrammars("educational"));
    assert.ok(s.includes("example") || s.includes("context"));
    assert.ok(!s.includes("confrontation"));
  });

  it("uses advertisement attention→product→cta shape", () => {
    const s = structureForGenre("advertisement", composeGrammars("advertisement"));
    assert.ok(s.includes("product") || s.includes("hook"));
    assert.ok(s.includes("cta"));
  });

  it("does not force CTA onto narrative film", () => {
    const creative = directCreativeIntent({
      idea: "Create a 60-second cinematic story about a young explorer discovering a hidden city",
      targetDurationSec: 60,
    }).creative;
    const { beats } = planNarrative({
      idea: creative.intent,
      creative,
      grammar: composeGrammars(creative.genre),
      targetDurationSec: 60,
    });
    assert.ok(beats.length >= 3);
    if (creative.genre === "narrative_film") {
      assert.ok(!beats.some((b) => b.narrativeFunction === "cta"));
    }
  });
});

describe("creative director", () => {
  it("returns structured direction with explicit unknowns when ambiguous", () => {
    const r = directCreativeIntent({ idea: "something vaguely media related maybe" });
    assert.ok(r.direction);
    assert.ok(typeof r.direction.confidence === "number");
    assert.ok(r.creative.intent.includes("vaguely") || r.creative.intent.length > 0);
  });

  it("honors project duration over creator defaults", () => {
    const creator = createDefaultCreatorProfile({
      defaultAspectRatios: ["9:16"],
    });
    const r = directCreativeIntent({
      idea: "Make a youtube explainer about solar panels",
      creatorProfile: creator,
      projectOverrides: { targetDurationSec: 300, aspectRatio: "16:9" },
    });
    assert.equal(r.direction.durationSec, 300);
    assert.equal(r.direction.aspectRatio, "16:9");
    assert.ok(r.preferences.precedenceNotes.some((n) => n.includes("project")));
  });

  it("fails empty idea with error", () => {
    const r = directCreativeIntent({ idea: "" });
    assert.ok(r.errors.includes("empty_idea"));
  });
});

describe("preference hierarchy", () => {
  it("project wins over creator and learned", () => {
    const resolved = resolveProductionPreferences({
      project: { aspectRatio: "16:9", creativeControl: "studio" },
      creator: createDefaultCreatorProfile({
        defaultAspectRatios: ["9:16"],
        creativeControlDefault: "auto",
      }),
      learned: { aspectRatio: "1:1", creativeControl: "director" },
    });
    assert.equal(resolved.aspectRatio, "16:9");
    assert.equal(resolved.creativeControl, "studio");
  });
});

describe("production orchestrator", () => {
  const cases: Array<{ idea: string; expectGenre?: string }> = [
    { idea: "Make a video about X.", expectGenre: undefined },
    { idea: "Create a 90-second cinematic video about an ancient African kingdom.", expectGenre: "documentary" },
    { idea: "Make a 5-minute YouTube video explaining Bitcoin.", expectGenre: "educational" },
    { idea: "Create a luxury commercial for this watch.", expectGenre: "advertisement" },
    { idea: "Make a funny animated short.", expectGenre: "animation" },
    { idea: "Create a 60-second cinematic story about a young explorer discovering a hidden city.", expectGenre: "narrative_film" },
    { idea: "Short social tip about saving money on TikTok", expectGenre: "social" },
    { idea: "Create a 60 second product commercial for a luxury watch.", expectGenre: "advertisement" },
    { idea: "Create a 10 minute documentary about the history of Benin.", expectGenre: "documentary" },
  ];

  for (const c of cases) {
    it(`plans ProductionSpec for: ${c.idea.slice(0, 48)}`, () => {
      const result = createProductionPlan({ idea: c.idea });
      assert.equal(result.ok, true, result.errors.join("; "));
      assert.ok(result.spec);
      assert.ok(result.brief);
      assert.ok(result.trace.creativeDirection);
      assert.ok(result.trace.selectedGrammarIds.length >= 1);
      assert.ok(result.trace.narrativeBeats.length >= 2);
      assert.ok(result.spec!.scenes.length >= 2);
      assert.ok(result.spec!.scenes.every((s) => s.shots.length >= 1));
      const v = validateProductionSpec(result.spec!);
      assert.equal(v.ok, true, v.errors.join("; "));
      if (c.expectGenre) {
        assert.equal(result.spec!.creative.genre, c.expectGenre);
      }
      // No media generation in planning phase
      assert.ok(result.spec!.approvalSummary?.generationStrategy.includes("Planning"));
      // Brief compatibility for existing UI
      const brief = productionSpecToBrief(result.spec!);
      assert.ok(brief.storyboard && brief.storyboard.length > 0);
      assert.ok(brief.hook || brief.title);
    });
  }

  it("createProductionPlan is the public entry point", () => {
    const a = createProductionPlan({ idea: "Make an educational explainer about solar panels", targetDurationSec: 90 });
    const b = orchestrateIdeaToProductionSpec({ idea: "Make an educational explainer about solar panels", targetDurationSec: 90 });
    assert.equal(a.ok, b.ok);
    assert.equal(a.spec?.creative.genre, b.spec?.creative.genre);
    assert.ok((a.spec?.scenes.length || 0) >= 2);
  });

  it("luxury watch commercial sets product-oriented requirements", () => {
    const result = createProductionPlan({
      idea: "Create a 60 second product commercial for a luxury watch.",
    });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.spec!.creative.genre, "advertisement");
    assert.equal(result.spec!.creative.requiresProductShots, true);
    assert.ok(result.directed.direction.visualStyle.toLowerCase().includes("luxury") || result.spec!.creative.grammarTags.includes("luxury"));
  });

  it("Benin history documentary requires research", () => {
    const result = createProductionPlan({
      idea: "Create a 10 minute documentary about the history of Benin.",
    });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.spec!.creative.genre, "documentary");
    assert.equal(result.spec!.creative.requiresResearch, true);
    assert.ok((result.spec!.project.targetDurationSec || 0) >= 600);
  });

  it("rejects empty ideas without malformed spec", () => {
    const result = createProductionPlan({ idea: "" });
    assert.equal(result.ok, false);
    assert.equal(result.spec, undefined);
    assert.ok(result.errors.includes("empty_idea"));
  });

  it("preserves intermediate trace roles without secrets", () => {
    const result = createProductionPlan({
      idea: "Documentary about African history for YouTube",
      targetDurationSec: 120,
    });
    assert.ok(result.trace.roles.some((r) => r.role === "creativeDirection"));
    assert.ok(result.trace.roles.some((r) => r.role === "productionPlanning"));
    const blob = JSON.stringify(result.trace);
    assert.ok(!/api[_-]?key/i.test(blob));
    assert.ok(!/secret/i.test(blob));
  });

  it("supports long-form duration scene scaling", () => {
    const result = createProductionPlan({
      idea: "Make a 20-minute documentary about ocean exploration",
      targetDurationSec: 1200,
    });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.ok(result.spec!.project.targetDurationSec >= 1200);
    assert.ok(result.spec!.scenes.length >= 3);
  });
});
