import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SPARK_SKILLS,
  SPARK_SKILL_IDS,
  UPSTREAM_SKILL_AUDIT,
  productStillCraft,
  resolveSparkSkill,
} from "./sparkSkills";
import { orchestrateIdeaToProductionSpec } from "../intelligence/productionOrchestrator";
import { applyFilmmakingSkillsToProduction } from "../knowledge";

describe("Spark skills", () => {
  it("accounts for every upstream playbook and keeps six Spark jobs", () => {
    assert.equal(UPSTREAM_SKILL_AUDIT.length, 9);
    assert.deepEqual(
      UPSTREAM_SKILL_AUDIT.filter((item) => item.needed).map((item) => item.sparkSkill),
      ["generate", "character_identity", "narrated_explainer", "product_still", "brand_lock", "cover_frame"]
    );
    assert.deepEqual(
      UPSTREAM_SKILL_AUDIT.filter((item) => !item.needed).map((item) => item.id),
      ["higgsfield-marketplace-cards", "higgsfield-websites", "higgsfield-game-generation"]
    );
    assert.deepEqual(SPARK_SKILL_IDS.length, 6);
  });

  it("routes the needed jobs and leaves ordinary films on generate", () => {
    assert.equal(resolveSparkSkill("Make a 20 second film about Lagos rain").id, "generate");
    assert.equal(resolveSparkSkill("Train my face as a digital twin").id, "character_identity");
    assert.equal(resolveSparkSkill("Explain this as a narrated explainer").id, "narrated_explainer");
    assert.equal(resolveSparkSkill("A cinematic photoreal explainer").id, "generate");
    assert.equal(resolveSparkSkill("Product photo on a white background").id, "product_still");
    assert.equal(resolveSparkSkill("Lock our visual identity and logo system").id, "brand_lock");
    assert.equal(resolveSparkSkill("YouTube thumbnail for the approved film").id, "cover_frame");
  });

  it("uses Spark systems and forbids the provider CLI and copied prompts", () => {
    for (const id of SPARK_SKILL_IDS) {
      const skill = SPARK_SKILLS[id];
      assert.ok(skill.uses.length > 0);
      assert.ok(skill.sequence.length > 0);
      assert.ok(skill.forbids.some((rule) => rule.includes("higgsfield CLI")));
      const blob = JSON.stringify(skill);
      assert.equal(blob.includes("gpt_image"), false);
      assert.equal(blob.includes("IDENTITY LOCK"), false);
      assert.equal(blob.includes("explainer_video"), false);
    }
  });

  it("maps a product still onto an existing craft purpose", () => {
    assert.equal(productStillCraft("catalog product on a white background"), "FLATLAY");
    assert.equal(productStillCraft("macro close-up of the cap"), "MACRO_DETAIL");
    assert.equal(productStillCraft("restyle this product for Christmas"), "STYLE_TRANSFORMATION");
    assert.equal(productStillCraft("hero banner of the bottle"), "HERO_SHOT");
  });

  it("records the job on the spec and does not change production mode", () => {
    const narrated = orchestrateIdeaToProductionSpec({
      idea: "Explain this as a narrated explainer",
      targetDurationSec: 30,
      productionMode: "deep",
      applyVisualPlanning: false,
    });
    assert.equal(narrated.ok, true, narrated.errors.join("; "));
    assert.equal(narrated.spec?.meta.sparkSkill?.id, "narrated_explainer");
    assert.equal(narrated.spec?.project.productionMode, "deep");
    assert.ok(narrated.spec?.meta.sparkSkill?.sequence.includes("generate every voice take before any picture"));

    const cinematic = orchestrateIdeaToProductionSpec({
      idea: "A cinematic photoreal explainer",
      targetDurationSec: 30,
      productionMode: "deep",
      applyVisualPlanning: false,
    });
    assert.equal(cinematic.spec?.meta.sparkSkill?.id, "generate");
  });

  it("uses the existing craft planner for a product still and teaches that shot", () => {
    const plan = orchestrateIdeaToProductionSpec({
      idea: "Product photo on a white background",
      targetDurationSec: 12,
      productionMode: "standard",
    });
    assert.equal(plan.ok, true, plan.errors.join("; "));
    assert.equal(plan.spec?.meta.sparkSkill?.id, "product_still");
    const shots = plan.spec!.scenes.flatMap((scene) => scene.shots);
    assert.ok(shots.some((shot) => shot.craftPlan?.operations.some((op) => op.type === "FLATLAY")));
    assert.ok(
      shots.some((shot) => shot.filmmakingGuidance?.skillIds.includes("product-still-purpose"))
    );
    assert.ok(shots.some((shot) => (shot.compiledPrompt || "").includes("still.purpose:")));
    const withSkills = applyFilmmakingSkillsToProduction(plan.spec!);
    assert.ok(withSkills.meta.sparkSkill?.id === "product_still");
  });
});
