/**
 * Shot planner — derives purposeful coverage from scene + grammar.
 * Every shot must answer: WHY does this shot exist?
 */

import type { SceneSpec, NarrativeFunction } from "../specification/sceneSpec";
import type { ShotSpec, ShotType, CameraMovement, GenerationStrategy } from "../specification/shotSpec";
import type { ComposedGrammar } from "../grammar";
import { strategyFromAlias } from "../specification/generationStrategy";
import { planCameraForShot } from "./cameraPlanner";
import { planLightingForShot } from "./lightingPlanner";
import { planBlockingForShot } from "./blockingPlanner";
import type { ResolvedMode } from "../resolveProductionMode";
import type { VisualTreatment } from "./cinematicIntelligence";
import {
  planCoverage,
  buildShotCinematicIntelligence,
  validateCinematicShot,
} from "./cinematicIntelligence";

export interface ShotPlanContext {
  scene: Omit<SceneSpec, "shots"> & { shots?: ShotSpec[] };
  grammar: ComposedGrammar;
  aspectRatio: string;
  maxShots: number;
  preferI2V: boolean;
  characterIds: string[];
  /** Optional genre for lighting/treatment */
  genre?: string;
  /** Phase 5 production mode for coverage depth */
  mode?: ResolvedMode;
  /** Phase 5 project look treatment */
  treatment?: VisualTreatment;
}

function shotPurpose(
  fn: NarrativeFunction,
  shotType: ShotType,
  index: number
): { purpose: string; reason: string } {
  if (shotType === "establishing") {
    return {
      purpose: fn === "hook" ? "Reveal world geography for the opening hook" : "Establish location and spatial geography",
      reason: "Audience needs to know where we are before coverage tightens",
    };
  }
  if (shotType === "insert" || shotType === "macro") {
    return {
      purpose: fn === "product" ? "Product detail / craft insert" : "Detail / evidence insert",
      reason: `Support ${fn} with a readable detail that sells proof or product`,
    };
  }
  if (shotType === "closeup" || shotType === "extreme_closeup") {
    return {
      purpose: "Emotional / informational emphasis",
      reason: `Tighten on subject to land the ${fn} beat`,
    };
  }
  if (shotType === "reaction") {
    return { purpose: "Reaction beat", reason: "Comedy/drama timing requires reaction coverage" };
  }
  if (shotType === "over_the_shoulder") {
    return {
      purpose: "Dialogue / interview relationship coverage",
      reason: `OTS coverage supports ${fn} with spatial relationship between speakers`,
    };
  }
  if (index === 0) {
    return { purpose: `Primary ${fn} coverage`, reason: `Core visual for narrative function ${fn}` };
  }
  return {
    purpose: `Supporting coverage for ${fn}`,
    reason: "Grammar requires additional coverage for clarity and pacing",
  };
}

function selectShotTypes(fn: NarrativeFunction, grammar: ComposedGrammar, maxShots: number): ShotType[] {
  const types: ShotType[] = [];

  // Opening / geography
  if (
    grammar.coverage.requireEstablishing &&
    (fn === "hook" || fn === "establishing" || fn === "context" || fn === "broll")
  ) {
    types.push("establishing");
  }

  // Primary information / story coverage
  if (fn === "product") {
    types.push("medium");
  } else if (fn === "interview") {
    types.push("medium");
  } else if (fn === "montage") {
    types.push(grammar.coverage.preferredShotTypes.includes("tracking") ? "tracking" : "medium");
  } else {
    types.push("medium");
  }

  // Emphasis / intimacy / conversion
  if (maxShots > 1 && (fn === "payoff" || fn === "proof" || fn === "cta" || fn === "product" || grammar.coverage.requireInserts)) {
    if (fn === "product") types.push("macro");
    else if (fn === "comedy") types.push("reaction");
    else types.push("closeup");
  }

  // Evidence / B-roll inserts
  if (maxShots > 2 && (grammar.coverage.requireInserts || fn === "broll" || fn === "proof" || fn === "example")) {
    if (!types.includes("insert") && !types.includes("macro")) types.push("insert");
  }

  // Dialogue relationship
  if (maxShots > 2 && grammar.coverage.dialogueCoverage && (fn === "interview" || fn === "confrontation")) {
    types.push("over_the_shoulder");
  }

  for (const t of grammar.coverage.preferredShotTypes) {
    if (types.length >= maxShots) break;
    if (!types.includes(t)) types.push(t);
  }
  return types.slice(0, Math.max(1, maxShots));
}

export function planShotsForScene(ctx: ShotPlanContext): ShotSpec[] {
  const { scene, grammar, aspectRatio, preferI2V, characterIds } = ctx;
  const maxShots = Math.max(1, ctx.maxShots);
  const mode = ctx.mode || "standard";
  const coverage = planCoverage({
    narrativeFunction: scene.narrativeFunction,
    grammar,
    mode,
    maxShots,
  });
  const shotTypes = coverage.shotTypes;
  const perShot = Math.max(2, Math.round(scene.durationSec / shotTypes.length));
  let t = 0;

  return shotTypes.map((shotType, index) => {
    const { purpose, reason } = shotPurpose(scene.narrativeFunction, shotType, index);
    const coverageRole = coverage.roles[index] || (index === 0 ? "master" : "medium");
    const blocking = planBlockingForShot({
      shotType,
      subjectAction: scene.visualDescription || scene.purpose,
      characters: characterIds,
      narrativeFunction: scene.narrativeFunction,
      environment: scene.environment,
    });
    const durationSec = index === shotTypes.length - 1 ? Math.max(2, scene.durationSec - t) : perShot;
    const begin =
      index === 0
        ? blocking.entrance || scene.continuity.entranceState
        : `${shotType} continues scene action`;
    const end =
      index === shotTypes.length - 1
        ? blocking.exit || scene.continuity.exitState
        : `${shotType} completes its motivated action`;

    const fallbackTreatment: VisualTreatment = ctx.treatment || {
      id: `treatment_${scene.id}`,
      lookPreset: "naturalistic",
      lookLabel: "Naturalistic",
      palette: "observed environmental hues",
      contrast: "moderate",
      saturation: "natural",
      lightingMood: "motivated practicals",
      texture: "subtle real-world texture",
      atmosphere: "clear observational air",
      cameraLanguage: "observational / restrained",
      lensCharacter: "neutral modern prime",
      depthOfFieldLanguage: "moderate depth",
      aspectRatioIntent: "television",
      aspectRatio,
      references: [],
      principles: ["A", "D", "E"],
      confidence: 0.6,
      provenance: "shotPlanner.fallbackTreatment",
    };

    const { cinematic, movement } = buildShotCinematicIntelligence({
      shotType,
      narrativeFunction: scene.narrativeFunction,
      coverageRole,
      index,
      durationSec,
      characterIds,
      locationId: scene.locationId,
      propIds: scene.propIds || [],
      emotionalObjective: scene.emotionalObjective,
      preferredMovements: grammar.coverage.preferredMovements,
      treatment: fallbackTreatment,
      beginState: begin,
      endState: end,
      preferI2V,
    });
    cinematic.validationIssues = validateCinematicShot(cinematic);

    const camera = planCameraForShot({
      shotType,
      grammar,
      emotionalObjective: scene.emotionalObjective,
      narrativeFunction: scene.narrativeFunction,
      movementOverride: movement,
    });
    // Align lens/DOF text with cinematic intent when available
    if (cinematic.focalLengthIntent) camera.lens = cinematic.focalLengthIntent;
    if (cinematic.depthOfFieldIntent) {
      camera.depthOfField =
        cinematic.depthOfFieldIntent === "shallow_depth" || cinematic.depthOfFieldIntent === "very_shallow" || cinematic.depthOfFieldIntent === "subject_isolation"
          ? "shallow — isolate subject"
          : cinematic.depthOfFieldIntent === "deep_focus"
            ? "deep — readable geography"
            : "natural cinema DOF";
    }

    const lighting = planLightingForShot({
      environment: scene.environment,
      timeOfDay: scene.timeOfDay,
      tone: scene.emotionalObjective,
      narrativeFunction: scene.narrativeFunction,
      genre: ctx.genre || grammar.id,
    });

    const strategy: GenerationStrategy = preferI2V ? "image_to_video" : "slideshow_still";

    const shot: ShotSpec = {
      id: `${scene.id}_shot_${index}`,
      sceneId: scene.id,
      index,
      purpose: cinematic.visualObjective || purpose,
      productionReason: cinematic.rationale.purpose || reason,
      timingStartSec: t,
      startTime: t,
      durationSec,
      camera,
      subject: characterIds[0] || "primary_subject",
      subjectAction: blocking.subjectAction,
      blocking: [blocking.blocking, blocking.screenDirection].filter(Boolean).join(" | "),
      performanceDirection: blocking.performanceDirection,
      dialogue: scene.dialogue,
      narration: index === 0 ? scene.narration : undefined,
      environment: scene.environment,
      lighting,
      atmosphere: scene.emotionalObjective,
      motion: {
        subjectMovement: blocking.subjectAction,
        cameraMovementDetail: cinematic.rationale.movement || describeMovement(camera.cameraMovement),
        environmentalMovement: cinematic.motionSeparation.environmentalMotion,
        performanceDirection: blocking.performanceDirection,
        timingNotes: cinematic.temporalBeats.map((b) => `${b.label}: ${b.description}`).join(" | "),
        beginState: begin,
        endState: end,
        interaction: blocking.spatialRelationship,
      },
      references: {
        characterRefs: characterIds,
        locationRefs: scene.locationId ? [scene.locationId] : [],
        styleRefs: fallbackTreatment.references || [],
      },
      continuityRequirements: [
        ...scene.continuity.identityLocks,
        ...scene.continuity.wardrobeLocks,
        blocking.screenDirection,
        cinematic.spatial.screenDirection,
        cinematic.spatial.eyeline,
        begin,
        end,
      ].filter(Boolean),
      characterIds,
      propIds: scene.propIds || [],
      assetIds: characterIds,
      generationStrategy: strategy,
      generationStrategySpec: strategyFromAlias(strategy),
      aspectRatio,
      generationStatus: "planned",
      qcStatus: "pending",
      cinematic,
    };
    t += durationSec;
    return shot;
  });
}

function describeMovement(m: CameraMovement): string {
  switch (m) {
    case "static":
      return "Locked-off camera; no unmotivated drift";
    case "push_in":
      return "Slow motivated push-in toward subject";
    case "pull_out":
      return "Controlled pull-out revealing context";
    case "dolly":
      return "Smooth dolly move along story axis";
    case "tracking":
      return "Track with subject movement";
    case "handheld":
      return "Subtle handheld energy, stable horizon";
    case "crane":
      return "Crane move for geography reveal";
    case "orbit":
      return "Orbit around product/subject hero angle";
    case "pan":
      return "Motivated pan following attention";
    case "tilt":
      return "Motivated tilt for scale or reveal";
    default:
      return `Motivated ${m} only if story requires it`;
  }
}
