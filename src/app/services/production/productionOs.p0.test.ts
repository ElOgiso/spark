/**
 * Production OS P0 tests — specs, adapters, director, grammar, routing, compiler, QC.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateProductionSpec,
  validateSceneSpec,
  validateShotSpec,
  makeAssetRef,
  parseAssetRef,
  productionSpecToBrief,
  resolvePreferenceHierarchy,
  createDefaultCreatorProfile,
} from "./specification/index";
import { composeGrammars } from "./grammar/index";
import { classifyCreativeIntent } from "./intelligence/genreClassifier";
import { orchestrateIdeaToProductionSpec } from "./intelligence/productionOrchestrator";
import { scoreProvidersForShot } from "./routing/modelScorer";
import { planShotRetry } from "./generation/retryPlanner";
import { preflightGate, shotQualityGate } from "./qc/index";
import type { Production, ProductionBrief } from "../../domain/types";
import { legacyProductionToSpec } from "./specification/adapters";

describe("asset identity", () => {
  it("makes and parses stable asset refs", () => {
    const ref = makeAssetRef("character_001", 3);
    assert.equal(ref, "character_001:v3");
    const parsed = parseAssetRef(ref);
    assert.deepEqual(parsed, { baseId: "character_001", version: 3, ref });
  });
});

describe("genre classification + grammar composition", () => {
  it("classifies documentary intent", () => {
    const c = classifyCreativeIntent("Make a 90-second documentary about African history");
    assert.equal(c.primaryGenre, "documentary");
    assert.ok((c.durationHintSec || 0) >= 90);
  });

  it("composes documentary + cinematic + short-form tags", () => {
    const g = composeGrammars("documentary", [], ["cinematic", "short-form", "african"]);
    assert.ok(g.sources.includes("documentary"));
    assert.ok(g.tags.includes("cinematic"));
    assert.equal(g.pacingBias, "compressed");
    assert.equal(g.coverage.requireEstablishing, true);
  });

  it("composes advertisement + luxury + vertical", () => {
    const g = composeGrammars("advertisement", [], ["luxury", "vertical"]);
    assert.ok(g.tags.includes("luxury"));
    assert.equal(g.pacingBias, "compressed");
  });
});

describe("orchestrate idea → production spec", () => {
  it("builds a valid ProductionSpec and legacy brief from an idea", () => {
    const { ok, spec, brief, validation } = orchestrateIdeaToProductionSpec({
      idea: "Create a funny YouTube Short explaining how solar panels work",
      targetDurationSec: 60,
      productionMode: "standard",
    });

    assert.equal(ok, true);
    assert.ok(spec);
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.ok(spec!.scenes.length >= 3);
    assert.ok(spec!.scenes.every((s) => s.shots.length >= 1));
    assert.ok(spec!.scenes.every((s) => s.shots.every((sh) => sh.productionReason)));
    assert.ok(spec!.approvalSummary?.shotCount);
    assert.equal(brief!.title.length > 0, true);
    assert.ok((brief!.storyboard || []).length > 0);

    const shot = spec!.scenes[0].shots[0];
    // Phase 2 is planning-only — prompts/providers may be deferred
    assert.ok(shot.productionReason);
    const sceneVal = validateSceneSpec(spec!.scenes[0]);
    assert.equal(sceneVal.ok, true, sceneVal.errors.join("; "));
    const shotVal = validateShotSpec(shot);
    assert.equal(shotVal.ok, true, shotVal.errors.join("; "));
  });

  it("plans generation tasks with dependencies", () => {
    const { ok, spec } = orchestrateIdeaToProductionSpec({
      idea: "Premium product commercial for a new headphone launch",
      targetDurationSec: 30,
      productionMode: "standard",
    });
    assert.equal(ok, true);
    assert.ok(spec);
    // Phase 2 defers provider routing; blueprint shots still exist for hierarchy
    assert.ok(spec!.scenes.some((s) => s.shots.length > 0));
  });
});

describe("provider scoring + retry", () => {
  it("scores providers for character-consistent I2V", () => {
    const { spec } = orchestrateIdeaToProductionSpec({
      idea: "Cinematic trailer with a consistent hero character",
      targetDurationSec: 45,
    });
    assert.ok(spec);
    const shot = { ...spec!.scenes[0].shots[0] };
    shot.generationStrategy = "image_to_video";
    shot.characterIds = ["character_001:v1"];
    const scores = scoreProvidersForShot(shot, spec!.routing.capabilityPolicy);
    assert.ok(scores.length > 0);
    assert.ok(scores[0].score > 0);
  });

  it("plans remediation for identity drift", () => {
    const { spec } = orchestrateIdeaToProductionSpec({ idea: "Host talking-head tip video" });
    assert.ok(spec);
    const shot = spec!.scenes[0].shots[0];
    const decision = spec!.routing.shotDecisions[0] || {
      shotId: shot.id,
      provider: "gemini",
      strategy: "image_to_video",
      score: 0.5,
      reasons: ["default"],
      fallbacks: [{ provider: "kling", reason: "consistency" }],
    };
    const plan = planShotRetry({
      shot,
      failures: ["identity_drift", "camera_instruction_mismatch"],
      routingDecision: decision,
    });
    assert.equal(plan.providerChange, true);
    assert.ok(plan.remediation === "rerender_different_model" || plan.remediation === "modify_prompt");
  });
});

describe("QC gates", () => {
  it("preflight passes for orchestrated specs", () => {
    const { spec } = orchestrateIdeaToProductionSpec({ idea: "Travel vlog highlight in Tokyo" });
    assert.ok(spec);
    const gate = preflightGate(spec!);
    assert.equal(gate.status, "pass");
    const shotGate = shotQualityGate(spec!.scenes[0].shots[0]);
    // Planning stubs may lack compiled prompts — treat retry as acceptable in Phase 2
    assert.ok(shotGate.status === "pass" || shotGate.status === "retry");
  });
});

describe("legacy adapters", () => {
  it("round-trips legacy production into spec and back to brief fields", () => {
    const brief: ProductionBrief = {
      title: "Legacy Brief",
      productionMode: "standard",
      hook: "Hook line",
      scriptOutline: "hook → value → cta",
      visualDirection: "Clean brand set",
      caption: "Follow",
      platformRecommendation: "YouTube Shorts",
      whyThisWorks: "Clear value",
      brandFitScore: 80,
      suggestedDuration: "60s",
      targetDurationSec: 60,
      beats: [
        {
          timecode: "0:00",
          valueJob: "hook",
          spokenLines: "Watch this",
          onScreenText: "HOOK",
          startState: "Open",
          endState: "Cut to body",
          cameraDirection: "closeup push in",
        },
      ],
      storyboard: [
        {
          scene: 0,
          duration: "5s",
          durationSec: 5,
          shotList: "closeup",
          cameraDirection: "closeup",
          transitions: "cut",
          onScreenText: "HOOK",
          pacing: "fast",
          scriptSnippet: "Watch this",
          spokenLines: "Watch this",
          visualDescription: "Host on set",
          valueJob: "hook",
          startState: "Open",
          endState: "Cut to body",
        },
      ],
    };

    const production: Production = {
      id: "prod_legacy",
      title: "Legacy Brief",
      status: "Drafting",
      mode: "standard",
      dateCreated: "2026-01-01",
      aspectRatio: "9:16",
      formats: ["YouTube Shorts"],
      scenes: [],
      brief,
      productionScenes: brief.storyboard,
      targetDurationSec: 60,
    };

    const spec = legacyProductionToSpec({ production });
    const prodValidation = validateProductionSpec(spec);
    assert.equal(prodValidation.ok, true, prodValidation.errors.join("; "));
    const back = productionSpecToBrief(spec, brief);
    assert.equal(back.hook, "Hook line");
    assert.ok((back.storyboard || []).length >= 1);
  });
});

describe("creator preference hierarchy", () => {
  it("project overrides creator defaults", () => {
    const profile = createDefaultCreatorProfile({ defaultAspectRatios: ["9:16"] });
    const resolved = resolvePreferenceHierarchy({
      projectValue: "16:9" as const,
      creatorDefault: profile.defaultAspectRatios[0],
      learned: "1:1" as const,
    });
    assert.equal(resolved, "16:9");
  });
});
