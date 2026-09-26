import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  SPARK_OPERATING_SKILLS,
  applyFilmmakingSkillsToProduction,
  ensureFilmmakingSkillLibrary,
  resetFilmmakingSkillLibraryForTests,
  resolveSkillIds,
  sparkOperatingTags,
} from "./index";
import { orchestrateIdeaToProductionSpec } from "../intelligence/productionOrchestrator";
import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";

const REJECTED = ["branded-presenter", "finished-video-attention-review", "marketplace", "website", "game-generation"];

describe("Spark operating skills", () => {
  beforeEach(() => {
    resetFilmmakingSkillLibraryForTests();
    ensureFilmmakingSkillLibrary();
  });

  afterEach(() => {
    resetFilmmakingSkillLibraryForTests();
  });

  it("keeps one operating skill per Spark job and nothing Spark rejected", () => {
    assert.deepEqual(
      SPARK_OPERATING_SKILLS.map((skill) => skill.id),
      [
        "generation-media-roles",
        "durable-character-identity",
        "product-still-purpose",
        "brand-lock",
        "narrated-explainer-order",
        "publish-cover",
      ]
    );
    const blob = JSON.stringify(SPARK_OPERATING_SKILLS).toLowerCase();
    for (const rejected of REJECTED) {
      assert.equal(blob.includes(rejected), false, rejected);
    }
    assert.equal(blob.includes("gpt_image"), false);
    assert.equal(blob.includes("explainer_video"), false);
    assert.equal(blob.includes("higgsfield"), false);
  });

  it("selects the operating skill only for the recorded job", () => {
    const narrated = plan("Explain this as a narrated explainer");
    const shot = narrated.scenes[0].shots[0];
    assert.ok(sparkOperatingTags(narrated, narrated.scenes[0], shot).includes("narrated_explainer"));
    const guided = applyFilmmakingSkillsToProduction(narrated);
    assert.ok(guided.scenes[0].shots[0].filmmakingGuidance?.skillIds.includes("narrated-explainer-order"));

    const ordinary = plan("Make a 20 second film about Lagos rain");
    const ordinaryGuided = applyFilmmakingSkillsToProduction(ordinary);
    assert.equal(
      ordinaryGuided.scenes[0].shots[0].filmmakingGuidance?.skillIds.includes("narrated-explainer-order"),
      false
    );
  });

  it("selects character, brand, cover, and media-role lessons from Spark facts", () => {
    const character = plan("Train my face as a digital twin");
    const characterShot = character.scenes[0].shots[0];
    characterShot.characterIds = ["char_me"];
    const characterIds = resolveSkillIds({
      hasRecurringCharacter: true,
      characterCount: 1,
      tags: sparkOperatingTags(character, character.scenes[0], characterShot),
    });
    assert.ok(characterIds.includes("durable-character-identity"));

    const brand = plan("Lock our visual identity and logo system");
    const brandIds = resolveSkillIds({
      tags: sparkOperatingTags(brand, brand.scenes[0], brand.scenes[0].shots[0]),
    });
    assert.ok(brandIds.includes("brand-lock"));

    const cover = plan("YouTube thumbnail for the approved film");
    const coverIds = resolveSkillIds({
      tags: sparkOperatingTags(cover, cover.scenes[0], cover.scenes[0].shots[0]),
    });
    assert.ok(coverIds.includes("publish-cover"));
    assert.equal(coverIds.includes("product-still-purpose"), false);

    const collision = plan("Make a 20 second film about Lagos rain");
    const collisionShot = {
      ...collision.scenes[0].shots[0],
      characterIds: ["char_host"],
      references: {
        ...collision.scenes[0].shots[0].references,
        characterRefs: ["char_host"],
        firstFrameUrl: "https://cdn.example.com/open.jpg",
      },
    } as ShotSpec;
    assert.ok(sparkOperatingTags(collision, collision.scenes[0], collisionShot).includes("media_roles"));
    const mediaIds = resolveSkillIds({
      tags: sparkOperatingTags(collision, collision.scenes[0], collisionShot),
    });
    assert.ok(mediaIds.includes("generation-media-roles"));
  });
});

function plan(idea: string): ProductionSpec {
  const result = orchestrateIdeaToProductionSpec({
    idea,
    targetDurationSec: 20,
    productionMode: "standard",
    applyVisualPlanning: false,
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.ok(result.spec);
  assert.ok(result.spec.scenes[0]?.shots[0], idea);
  return result.spec;
}
