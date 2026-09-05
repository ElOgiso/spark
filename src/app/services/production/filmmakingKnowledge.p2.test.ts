/**
 * Phase 2 — Filmmaking Knowledge & Skill Runtime tests.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  ensureFilmmakingSkillLibrary,
  resetFilmmakingSkillLibraryForTests,
  FILMMAKING_SKILL_CATALOG,
  FILMMAKING_SKILL_IDS,
  resolveSkillIds,
  resolveSkills,
  deriveContextTags,
  composeSkillOutputs,
  applySkill,
  getSkill,
  getSkillVersion,
  runFilmmakingSkills,
  applyFilmmakingSkillsToProduction,
  listSkills,
  registerSkill,
  type FilmmakingSkill,
  type FilmmakingSkillContext,
} from "./knowledge";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import { compileProductionPrompts } from "./generation/promptCompiler";
import { applyVisualPlanningPipeline } from "./generation/visualPlanningPipeline";

beforeEach(() => {
  resetFilmmakingSkillLibraryForTests();
  ensureFilmmakingSkillLibrary();
});

afterEach(() => {
  resetFilmmakingSkillLibraryForTests();
});

describe("filmmaking skill library", () => {
  it("loads a coherent initial catalog without vendor hardcoding", () => {
    assert.ok(FILMMAKING_SKILL_CATALOG.length >= 15);
    assert.equal(FILMMAKING_SKILL_IDS.length, FILMMAKING_SKILL_CATALOG.length);
    assert.ok(listSkills({ status: ["active", "experimental"] }).length >= 15);

    const blob = JSON.stringify(FILMMAKING_SKILL_CATALOG).toLowerCase();
    for (const vendor of ["veo", "kling", "grok", "runway", "luma", "sora", "minimax"]) {
      assert.equal(blob.includes(`always use ${vendor}`), false);
      assert.equal(blob.includes(`must use ${vendor}`), false);
    }

    for (const skill of FILMMAKING_SKILL_CATALOG) {
      assert.ok(skill.version.length > 0, skill.id);
      assert.ok(skill.evidenceLevel, skill.id);
      assert.ok(skill.sourceType, skill.id);
      assert.ok(skill.status, skill.id);
    }
  });
});

describe("skill discovery", () => {
  it("selects character skills for recurring characters", () => {
    const ids = resolveSkillIds({
      hasRecurringCharacter: true,
      characterCount: 1,
    });
    assert.ok(ids.includes("character-visual-contract"));
    assert.ok(ids.includes("character-sheet"));
    assert.ok(ids.includes("reference-first-visual-continuity"));
  });

  it("selects location skills for recurring locations", () => {
    const ids = resolveSkillIds({ hasRecurringLocation: true });
    assert.ok(ids.includes("location-anchor"));
    assert.ok(ids.includes("reference-first-visual-continuity"));
  });

  it("selects motion skills for image_to_video", () => {
    const ids = resolveSkillIds({
      generationStrategy: "image_to_video",
      requiresMotion: true,
    });
    assert.ok(ids.includes("motion-prompting"));
    assert.ok(deriveContextTags({ generationStrategy: "image_to_video" }).includes("i2v"));
  });

  it("selects handoff/continuity skills for dependent shots", () => {
    const ids = resolveSkillIds({ dependsOnPreviousShot: true });
    assert.ok(ids.includes("shot-handoff"));
    assert.ok(ids.includes("continuity-first-generation"));
  });

  it("does not activate every character/continuity skill for an isolated establishing shot", () => {
    const ids = resolveSkillIds({
      isEstablishingShot: true,
      isIsolatedShot: true,
      shotType: "establishing",
      shotPurpose: "Establish empty coastline at dawn",
      cameraMovement: "static",
      generationStrategy: "text_to_image",
      characterCount: 0,
      hasRecurringCharacter: false,
      hasRecurringLocation: false,
      dependsOnPreviousShot: false,
    });
    assert.equal(ids.includes("character-visual-contract"), false);
    assert.equal(ids.includes("character-sheet"), false);
    assert.equal(ids.includes("shot-handoff"), false);
    assert.equal(ids.includes("previous-video-continuation"), false);
    assert.equal(ids.includes("location-anchor"), false);
    assert.ok(ids.includes("shot-purpose"));
  });
});

describe("skill composition and conflicts", () => {
  it("composes character + location + motion + continuity without destroying outputs", () => {
    const skills = resolveSkills({
      hasRecurringCharacter: true,
      hasRecurringLocation: true,
      characterCount: 1,
      dependsOnPreviousShot: true,
      generationStrategy: "image_to_video",
      requiresMotion: true,
    });
    const composed = composeSkillOutputs(skills, {
      hasRecurringCharacter: true,
      hasRecurringLocation: true,
      dependsOnPreviousShot: true,
      generationStrategy: "image_to_video",
    });
    assert.ok(composed.skillIds.length >= 4);
    assert.ok(composed.constraints.length + composed.recommendations.length > 0);
    const joined = [...composed.constraints, ...composed.recommendations].join(" ").toLowerCase();
    assert.equal(/static tracking/.test(joined), false);
  });

  it("detects camera movement conflicts between optional static and tracking bias", () => {
    const staticSkill = getSkill("camera-movement-purpose");
    const trackingSkill = getSkill("camera-movement-tracking-bias");
    assert.ok(staticSkill);
    assert.ok(trackingSkill);
    const composed = composeSkillOutputs([staticSkill!, trackingSkill!], {
      cameraMovement: "tracking",
      tags: ["camera_move", "motivated_camera_move"],
    });
    assert.ok(composed.conflicts.length >= 1);
    const cam = composed.conflicts.find((c) => c.topic.includes("camera"));
    assert.ok(cam, JSON.stringify(composed.conflicts));
    assert.ok(
      cam!.resolution === "optional_ignored" ||
        cam!.resolution === "higher_priority" ||
        cam!.resolution === "needs_review"
    );
    if (cam!.resolution === "optional_ignored" || cam!.resolution === "higher_priority") {
      assert.ok(cam!.winnerSkillId);
    }
  });
});

describe("versioning and classification", () => {
  it("exposes skill versions and keeps classification distinguishable", () => {
    const version = getSkillVersion("shot-purpose");
    assert.ok(version);
    assert.match(version!, /^\d+\.\d+\.\d+/);

    const skill = getSkill("shot-purpose")!;
    assert.ok(
      ["verified", "heuristic", "experimental", "provider-specific", "deprecated"].includes(
        skill.evidenceLevel
      )
    );

    const heuristic = FILMMAKING_SKILL_CATALOG.filter((s) => s.evidenceLevel === "heuristic");
    const verified = FILMMAKING_SKILL_CATALOG.filter((s) => s.evidenceLevel === "verified");
    assert.ok(heuristic.length > 0);
    assert.ok(verified.length > 0);
  });

  it("changing a skill version is observable via getSkillVersion", () => {
    const before = getSkillVersion("motion-prompting");
    assert.ok(before);
    const mutated: FilmmakingSkill = {
      ...getSkill("motion-prompting")!,
      version: "9.9.9",
    };
    registerSkill(mutated);
    assert.equal(getSkillVersion("motion-prompting"), "9.9.9");
    assert.notEqual(getSkillVersion("motion-prompting"), before);
  });
});

describe("provider neutrality", () => {
  it("filmmaking skills do not auto-select a vendor", () => {
    const composed = runFilmmakingSkills({
      hasRecurringCharacter: true,
      generationStrategy: "image_to_video",
      requiresMotion: true,
      dependsOnPreviousShot: true,
    });
    const text = JSON.stringify(composed).toLowerCase();
    assert.equal(text.includes('"provider":"kling"'), false);
    assert.equal(text.includes("use veo"), false);
    assert.equal(text.includes("use kling"), false);
    assert.equal(text.includes("use grok"), false);
  });
});

describe("production integration", () => {
  it("attaches filmmakingGuidance onto shots and reaches prompt compilation", () => {
    const plan = createProductionPlan({
      idea: "A recurring host walks through the same workshop explaining a craft tip",
      targetDurationSec: 45,
      applyVisualPlanning: false,
    });
    assert.equal(plan.ok, true, plan.errors.join("; "));
    assert.ok(plan.spec);

    const withSkills = applyFilmmakingSkillsToProduction(plan.spec!);
    const shot = withSkills.scenes.flatMap((s) => s.shots)[0];
    assert.ok(shot);
    assert.ok(shot.filmmakingGuidance);
    assert.ok(shot.filmmakingGuidance!.skillIds.length > 0);
    assert.ok(shot.observability?.filmmakingSkillIds?.length);

    const compiled = compileProductionPrompts(withSkills);
    const compiledShot = compiled.scenes.flatMap((s) => s.shots)[0];
    assert.ok(compiledShot.compiledPrompt);
    if (shot.filmmakingGuidance!.constraints.length) {
      assert.ok(
        /FILMMAKING CONSTRAINTS|FILMMAKING GUIDANCE|SKILL CONTEXT/i.test(
          compiledShot.compiledPrompt || ""
        )
      );
    }
  });

  it("visual planning pipeline still produces compiled prompts with skills wired in", () => {
    const blueprint = createProductionPlan({
      idea: "Documentary about ocean exploration with a recurring presenter",
      targetDurationSec: 60,
      applyVisualPlanning: false,
    });
    assert.equal(blueprint.ok, true, blueprint.errors.join("; "));
    const visual = applyVisualPlanningPipeline(blueprint.spec!, {
      grammar: blueprint.grammar!,
      preferI2V: true,
    });
    assert.ok(visual.stats.shotCount >= 1);
    const anyGuidance = visual.spec.scenes.some((s) =>
      s.shots.some((sh) => (sh.filmmakingGuidance?.skillIds.length || 0) > 0)
    );
    assert.equal(anyGuidance, true);
    assert.ok(visual.spec.scenes[0].shots[0].compiledPrompt);
  });
});

describe("applySkill structured output", () => {
  it("returns structured fields rather than prose-only", () => {
    const skill = getSkill("reference-first-visual-continuity");
    assert.ok(skill);
    const out = applySkill(skill!, {
      hasRecurringCharacter: true,
    } as FilmmakingSkillContext);
    assert.equal(out.skillId, skill!.id);
    assert.ok(Array.isArray(out.constraints));
    assert.ok(Array.isArray(out.recommendations));
    assert.equal(typeof out.promptContext, "object");
    assert.ok(Array.isArray(out.qualityCriteria));
  });
});
