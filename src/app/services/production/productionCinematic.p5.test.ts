/**
 * Phase 5 — Cinematic look development + shot-direction intelligence.
 * Deterministic unit tests. No media generation / network.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CINEMATIC_PRINCIPLES,
  developVisualTreatment,
  applyVisualTreatmentOverride,
  treatmentToVisualStyle,
  lookSignature,
  planCoverage,
  dramaticPurposeFor,
  planMotivatedMovement,
  buildTemporalBeats,
  buildShotCinematicIntelligence,
  validateCinematicShot,
  evaluateCinematicGate,
  type VisualTreatment,
  type ShotCinematicIntelligence,
} from "./cinematography/cinematicIntelligence";
import { planShotsForScene } from "./cinematography/shotPlanner";
import { composeGrammars } from "./grammar/compose";
import { resolveProductionMode } from "./resolveProductionMode";
import { legacyProductionToSpec, productionSpecToBrief } from "./specification/adapters";
import type { CreativeSpec, ProjectSpec } from "./specification/productionSpec";
import type { SceneSpec } from "./specification/sceneSpec";

const creative: CreativeSpec = {
  intent: "spy thriller short",
  genre: "narrative_film",
  grammarTags: ["narrative_film"],
  tone: "tense thriller",
  audience: "festival",
  narrativeStructure: "three_act",
  visualLanguage: "controlled thriller",
  pacing: "compressed",
  emotionalArc: "paranoia to revelation",
  requiresHost: false,
  requiresCharacters: true,
  requiresNarration: false,
  requiresDialogue: true,
  requiresAnimation: false,
  requiresProductShots: false,
  requiresDocumentaryTreatment: false,
  requiresResearch: false,
  requiresGeneratedEnvironments: true,
  requiresStockOrUserAssets: false,
  requiresImageGeneration: true,
  requiresVideoGeneration: true,
  requiresVoiceGeneration: false,
  requiresMusic: true,
  requiresSoundDesign: true,
  requiresEditing: true,
  estimatedSceneCount: 3,
  estimatedShotCount: 12,
  confidence: 0.8,
  rationale: ["thriller short"],
};

const project: ProjectSpec = {
  id: "pr_axis",
  title: "Axis",
  idea: "A spy faces the truth",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  productionMode: "standard",
  creativeControl: "guided",
  targetDurationSec: 90,
  platforms: ["youtube"],
  aspectRatio: "16:9",
  formats: ["short"],
  status: "planning",
};

function makeScene(partial?: Partial<SceneSpec>): SceneSpec {
  return {
    id: "sc_corridor",
    index: 0,
    title: "Corridor",
    purpose: "Confrontation",
    narrativeFunction: "confrontation",
    locationId: "loc_corridor",
    locationName: "Hotel corridor",
    environment: "Long corridor, fluorescent flicker",
    timeOfDay: "night",
    durationSec: 20,
    characterIds: ["char_a", "char_b"],
    propIds: [],
    emotionalObjective: "Unease",
    visualDescription: "A walks the corridor; B appears; A reacts",
    continuity: {
      entranceState: "A enters from elevator",
      exitState: "A flees toward stairwell",
      identityLocks: ["char_a", "char_b"],
      wardrobeLocks: [],
      propLocks: [],
    },
    shots: [],
    ...partial,
  };
}

describe("Phase 5 cinematic intelligence", () => {
  it("defines systemic cinematic principles A–J", () => {
    assert.equal(CINEMATIC_PRINCIPLES.length, 10);
    assert.equal(CINEMATIC_PRINCIPLES.map((p) => p.id).join(""), "ABCDEFGHIJ");
    assert.ok(CINEMATIC_PRINCIPLES.some((p) => /systemic|system/i.test(`${p.title} ${p.text}`)));
    assert.ok(CINEMATIC_PRINCIPLES.some((p) => /purpose/i.test(`${p.title} ${p.text}`)));
    assert.ok(CINEMATIC_PRINCIPLES.some((p) => /motivat/i.test(`${p.title} ${p.text}`)));
  });

  it("develops project visual treatment with look signature", () => {
    const t = developVisualTreatment({ productionId: "p1", creative, project });
    assert.equal(t.lookPreset, "high_contrast_thriller");
    assert.ok(t.palette.length > 0);
    assert.ok(t.lightingMood.length > 0);
    assert.ok(t.aspectRatioIntent);
    assert.ok(lookSignature(t).includes("high_contrast_thriller"));
    const style = treatmentToVisualStyle(t);
    assert.ok(style.look.length > 0);
    assert.ok(style.antiSlopLaws.length >= 1);
    assert.ok(style.antiSlopLaws.some((l) => /aspect ratio|cinematic quality/i.test(l)));
  });

  it("inherits look and applies intentional scene override with reason", () => {
    const base = developVisualTreatment({ productionId: "p1", creative, project });
    const cold = applyVisualTreatmentOverride(base, {
      patch: { lookPreset: "cold_clinical", lightingMood: "hostile fluorescent" },
      reason: "Protagonist enters hostile territory",
      scope: "scene",
      confidence: 0.75,
    });
    assert.equal(cold.lookPreset, "cold_clinical");
    assert.match(cold.provenance, /hostile territory/);
    assert.match(cold.provenance, /scene/);
    assert.notEqual(lookSignature(base), lookSignature(cold));
  });

  it("rejects treatment override without an explicit reason", () => {
    const base = developVisualTreatment({ productionId: "p1", creative, project });
    assert.throws(
      () =>
        applyVisualTreatmentOverride(base, {
          patch: { lookPreset: "cold_clinical" },
          reason: "   ",
          scope: "scene",
          confidence: 0.5,
        }),
      /reason/i,
    );
  });

  it("selects aspect ratio intent for social vertical", () => {
    const socialProject: ProjectSpec = {
      ...project,
      platforms: ["tiktok"],
      aspectRatio: "9:16",
      formats: ["social"],
    };
    const t = developVisualTreatment({ productionId: "p2", creative, project: socialProject });
    assert.equal(t.aspectRatio, "9:16");
    assert.equal(t.aspectRatioIntent, "social_vertical");
  });

  it("maps shot purposes to dramatic objectives", () => {
    assert.equal(dramaticPurposeFor("establishing", "establishing", "establishing", 0), "establish_geography");
    assert.equal(dramaticPurposeFor("reaction", "confrontation", "reaction", 1), "capture_reaction");
    assert.equal(dramaticPurposeFor("insert", "proof", "insert", 2), "reveal_information");
    assert.equal(dramaticPurposeFor("closeup", "payoff", "closeup", 1), "emphasize_emotion");
    assert.equal(
      dramaticPurposeFor("over_the_shoulder", "confrontation", "over_the_shoulder", 1),
      "deliver_dialogue",
    );
    assert.equal(dramaticPurposeFor("tracking", "montage", "tracking", 0), "show_action");
  });

  it("plans mode-aware coverage: express < standard <= deep", () => {
    const g = composeGrammars(["narrative_film"]);
    const scene = makeScene();
    const ex = planCoverage({
      narrativeFunction: scene.narrativeFunction,
      grammar: g,
      mode: "express",
      maxShots: 6,
    });
    const st = planCoverage({
      narrativeFunction: scene.narrativeFunction,
      grammar: g,
      mode: "standard",
      maxShots: 6,
    });
    const dp = planCoverage({
      narrativeFunction: scene.narrativeFunction,
      grammar: g,
      mode: "deep",
      maxShots: 6,
    });
    assert.ok(ex.shotTypes.length < st.shotTypes.length);
    assert.ok(st.shotTypes.length <= dp.shotTypes.length);
    assert.ok(ex.roles.includes("master"));
    assert.ok(dp.roles.includes("reaction") || dp.shotTypes.includes("reaction"));
    assert.ok(Array.isArray(dp.redundantPairs));
  });

  it("keeps camera static when movement is unmotivated", () => {
    const m = planMotivatedMovement({
      purpose: "establish_geography",
      shotType: "establishing",
      preferred: ["static"],
    });
    assert.equal(m.movement, "static");
    assert.equal(m.motivation, "none_static_preferred");
  });

  it("motivates push-in for emotional beats", () => {
    const m = planMotivatedMovement({
      purpose: "emphasize_emotion",
      shotType: "closeup",
      preferred: ["push_in", "dolly"],
      emotionalObjective: "intimacy",
    });
    assert.equal(m.movement, "push_in");
    assert.equal(m.motivation, "psychological_intimacy");
    assert.ok(m.reason.length > 0);
  });

  it("builds temporal beats ordered within duration", () => {
    const beats = buildTemporalBeats(6, "emphasize_emotion", "push_in");
    assert.ok(beats.length >= 2);
    assert.equal(beats[0]!.label, "start");
    assert.equal(beats[beats.length - 1]!.label, "end");
    for (let i = 1; i < beats.length; i++) {
      assert.ok((beats[i]!.startHintSec ?? 0) >= (beats[i - 1]!.startHintSec ?? 0));
    }
    assert.ok((beats[beats.length - 1]!.endHintSec ?? 0) <= 6);
  });

  it("planShotsForScene attaches cinematic intelligence to ShotSpec", () => {
    const g = composeGrammars(["narrative_film"]);
    const treatment = developVisualTreatment({ productionId: "p1", creative, project });
    const shots = planShotsForScene({
      scene: makeScene(),
      grammar: g,
      aspectRatio: "16:9",
      maxShots: 4,
      preferI2V: true,
      characterIds: ["char_a", "char_b"],
      genre: "thriller",
      mode: "standard",
      treatment,
    });
    assert.ok(shots.length >= 2);
    for (const s of shots) {
      assert.ok(s.cinematic, `missing cinematic on ${s.id}`);
      assert.ok(s.cinematic!.dramaticPurpose);
      assert.ok(s.cinematic!.visualHierarchy.primarySubject);
      assert.ok(s.cinematic!.capabilityRequirements);
      assert.ok(s.cinematic!.referenceRequirements);
      assert.ok(s.cinematic!.rationale.framing);
      assert.ok(s.cinematic!.rationale.movement);
      assert.ok(typeof s.cinematic!.quality.purposeClarity === "number");
      assert.equal(s.cinematic!.lookSignature, lookSignature(treatment));
      assert.ok(s.purpose.trim().length > 0);
    }
  });

  it("express mode produces fewer or equal shots than deep", () => {
    const g = composeGrammars(["narrative_film"]);
    const treatment = developVisualTreatment({ productionId: "p1", creative, project });
    const scene = makeScene();
    const ex = planShotsForScene({
      scene,
      grammar: g,
      aspectRatio: "16:9",
      maxShots: 6,
      preferI2V: true,
      characterIds: scene.characterIds,
      mode: "express",
      treatment,
    });
    const dp = planShotsForScene({
      scene,
      grammar: g,
      aspectRatio: "16:9",
      maxShots: 6,
      preferI2V: true,
      characterIds: scene.characterIds,
      mode: "deep",
      treatment,
    });
    assert.ok(ex.length <= dp.length);
  });

  it("emits reference + capability requirements without provider ids", () => {
    const treatment = developVisualTreatment({ productionId: "p1", creative, project });
    const { cinematic } = buildShotCinematicIntelligence({
      shotType: "closeup",
      narrativeFunction: "confrontation",
      coverageRole: "closeup",
      index: 1,
      durationSec: 4,
      characterIds: ["char_a"],
      locationId: "loc_corridor",
      propIds: [],
      emotionalObjective: "realization",
      preferredMovements: ["push_in"],
      treatment,
      beginState: "neutral",
      endState: "intense",
      preferI2V: true,
    });
    assert.equal(cinematic.referenceRequirements.requiresCharacterReference, true);
    assert.deepEqual(cinematic.referenceRequirements.characterIds, ["char_a"]);
    assert.equal(cinematic.referenceRequirements.requiresLocationReference, true);
    assert.equal(cinematic.capabilityRequirements.imageToVideo, true);
    assert.equal(cinematic.capabilityRequirements.startFrame, true);
    const blob = JSON.stringify(cinematic);
    assert.equal(/kling|runway|veo|sora|higgsfield|openai|fal\.ai/i.test(blob), false);
  });

  it("validates motivated movement and flags unmotivated motion", () => {
    const treatment = developVisualTreatment({ productionId: "p1", creative, project });
    const { cinematic } = buildShotCinematicIntelligence({
      shotType: "closeup",
      narrativeFunction: "confrontation",
      coverageRole: "closeup",
      index: 1,
      durationSec: 4,
      characterIds: ["char_a"],
      propIds: [],
      emotionalObjective: "realization",
      preferredMovements: ["push_in"],
      treatment,
      beginState: "neutral",
      endState: "intense",
      preferI2V: false,
    });
    assert.equal(validateCinematicShot(cinematic).includes("unmotivated_camera_movement"), false);

    const bad: ShotCinematicIntelligence = {
      ...cinematic,
      movementMotivation: "none_static_preferred",
      capabilityRequirements: {
        ...cinematic.capabilityRequirements,
        cameraMotion: "orbit",
      },
    };
    assert.ok(validateCinematicShot(bad).includes("unmotivated_camera_movement"));
  });

  it("supports intentional 180° axis crossing with required reason", () => {
    const treatment = developVisualTreatment({ productionId: "p1", creative, project });
    const { cinematic } = buildShotCinematicIntelligence({
      shotType: "wide",
      narrativeFunction: "confrontation",
      coverageRole: "wide",
      index: 0,
      durationSec: 5,
      characterIds: ["char_a", "char_b"],
      locationId: "loc_corridor",
      propIds: [],
      emotionalObjective: "disorient",
      preferredMovements: ["pan"],
      treatment,
      beginState: "A left",
      endState: "reversed",
      preferI2V: false,
    });
    const missingReason: ShotCinematicIntelligence = {
      ...cinematic,
      spatial: {
        ...cinematic.spatial,
        axisPolicy: "intentionally_cross",
        axisCrossReason: undefined,
      },
    };
    assert.ok(validateCinematicShot(missingReason).includes("axis_cross_missing_reason"));

    const withReason: ShotCinematicIntelligence = {
      ...cinematic,
      spatial: {
        ...cinematic.spatial,
        axisPolicy: "intentionally_cross",
        axisCrossReason: "Disorient viewer as allegiance flips",
        axisTransitionMechanism: "camera_move",
      },
    };
    assert.equal(validateCinematicShot(withReason).includes("axis_cross_missing_reason"), false);
  });

  it("evaluates cinematic gate for production readiness", () => {
    const treatment = developVisualTreatment({ productionId: "p1", creative, project });
    const g = composeGrammars(["narrative_film"]);
    const shots = planShotsForScene({
      scene: makeScene(),
      grammar: g,
      aspectRatio: "16:9",
      maxShots: 4,
      preferI2V: true,
      characterIds: ["char_a", "char_b"],
      mode: "standard",
      treatment,
    });
    const gate = evaluateCinematicGate({
      treatment,
      shots: shots.map((s) => ({ purpose: s.purpose, cinematic: s.cinematic })),
    });
    assert.equal(gate.ready, true, gate.checks.map((c) => `${c.id}:${c.detail}`).join("; "));
  });

  it("resolveProductionMode still maps express/standard/deep", () => {
    assert.equal(resolveProductionMode({ modeOverride: "express" }), "express");
    assert.equal(resolveProductionMode({ modeOverride: "standard" }), "standard");
    assert.equal(resolveProductionMode({ modeOverride: "deep" }), "deep");
  });

  it("legacy adapters remain compatible", () => {
    const brief: any = {
      title: "Axis",
      productionMode: "standard",
      hook: "A spy faces the truth",
      scriptOutline: "hook → confrontation → reveal",
      visualDirection: "High-contrast thriller corridor",
      caption: "Axis",
      platformRecommendation: "YouTube",
      whyThisWorks: "Clear stakes",
      brandFitScore: 80,
      suggestedDuration: "90s",
      storyboard: [
        {
          id: "s1",
          beat: "Confrontation",
          durationSec: 20,
          camera: "medium",
          lighting: "fluorescent",
          location: "Hall",
          characters: ["A"],
          action: "Walks the corridor",
          emotion: "fear",
          dialogue: "",
          narration: "",
          music: "low pulse",
          sfx: [],
          transitions: "cut",
          onScreenText: "",
          pacing: "tight",
          scriptSnippet: "Who are you?",
          spokenLines: "Who are you?",
          visualDescription: "Hotel hall at night",
          valueJob: "confrontation",
          startState: "Enter",
          endState: "Flee",
        },
      ],
    };
    const production: any = {
      id: "prod_axis_legacy",
      title: "Axis",
      status: "Drafting",
      mode: "standard",
      dateCreated: "2026-01-01",
      aspectRatio: "16:9",
      formats: ["YouTube"],
      scenes: [],
      brief,
      productionScenes: brief.storyboard,
      targetDurationSec: 90,
    };
    const spec = legacyProductionToSpec({ production });
    assert.ok(spec.project?.title);
    const round = productionSpecToBrief(spec, brief);
    assert.equal(round.title, "Axis");
    assert.ok((round.storyboard || []).length >= 1);
  });

  it("is deterministic for identical inputs", () => {
    const g = composeGrammars(["narrative_film"]);
    const treatment = developVisualTreatment({ productionId: "p1", creative, project });
    const ctx = {
      scene: makeScene(),
      grammar: g,
      aspectRatio: "16:9",
      maxShots: 4,
      preferI2V: true,
      characterIds: ["char_a", "char_b"],
      mode: "standard" as const,
      treatment,
    };
    const a = planShotsForScene(ctx);
    const b = planShotsForScene(ctx);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("keeps VisualTreatment structured (not freeform prompt soup)", () => {
    const t: VisualTreatment = developVisualTreatment({ productionId: "p1", creative, project });
    assert.equal(typeof t.contrast, "string");
    assert.equal(typeof t.lensCharacter, "string");
    assert.equal(typeof t.palette, "string");
    assert.ok(t.provenance.includes("developVisualTreatment"));
    assert.ok(Array.isArray(t.principles));
    assert.ok(t.principles.length >= 10);
  });
});
