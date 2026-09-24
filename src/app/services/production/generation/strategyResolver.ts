/**
 * Deterministic generation-strategy resolver.
 * Decides WHAT kind of generation a shot needs — not which provider.
 */

import type { ShotSpec, GenerationStrategy } from "../specification/shotSpec";
import type { CreativeSpec } from "../specification/productionSpec";
import { strategyFromAlias, type GenerationStrategySpec } from "../specification/generationStrategy";
import type { ProductionSpec } from "../specification/productionSpec";
import { normalizeModeString } from "../resolveProductionMode";

/** Long-form visual decisions enrich the existing shot plan; no parallel task pipeline. */
export function applyLongFormVisualPlanning(spec: ProductionSpec): ProductionSpec {
  const mode = normalizeModeString(String(spec.project.productionMode)) || "standard";
  const automatic = spec.project.targetDurationSec >= 120 && mode !== "deep";
  let index = 0;
  return { ...spec, scenes: spec.scenes.map(scene => ({ ...scene, shots: scene.shots.map(shot => {
    const first = index++ === 0;
    if (!automatic && !shot.visualPlan) return shot;
    let visualPlan = shot.visualPlan;
    if (!visualPlan) {
      const intent = `${shot.narrativeBeat || ""} ${shot.purpose || ""} ${shot.productionReason || ""}`;
      const classifications: Array<[RegExp, NonNullable<ShotSpec["visualPlan"]>["kind"]]> = [
        [/\b(user[- ](?:supplied|uploaded) (?:asset|footage|image)|uploaded footage)\b/i, "USER_ASSET"],
        [/\b(stock footage|archival footage)\b/i, "STOCK"],
        [/\b(screenshot|screen capture|screen recording)\b/i, "SCREENSHOT"],
        [/\b(map|geographic route)\b/i, "MAP"],
        [/\b(chart|graph|data visualization)\b/i, "CHART"],
        [/\b(motion graphic|animated diagram)\b/i, "MOTION_GRAPHIC"],
        [/\b(title card|text card|quote card)\b/i, "TEXT"],
      ];
      const special = classifications.find(([pattern]) => pattern.test(intent));
      if (special) visualPlan = { kind: special[1], reason: "Narrative beat explicitly calls for this visual medium." };
      else if (mode !== "express" && (first || /\b(motion demonstration|demonstrate movement|continuous action)\b/i.test(intent))) {
        visualPlan = { kind: "VIDEO", reason: first ? "Selected hybrid opening hook." : "The beat explicitly requires visible motion." };
      } else visualPlan = { kind: "IMAGE", reason: "Narration can be supported by a still; AI video is not required." };
    }
    return {
      ...shot, visualPlan,
      ...(visualPlan.kind === "IMAGE" ? { generationStrategy: "slideshow_still" as const, generationStrategySpec: strategyFromAlias("slideshow_still") } : {}),
      ...(visualPlan.kind === "VIDEO" && ["slideshow_still", "text_to_image"].includes(shot.generationStrategy)
        ? { generationStrategy: "image_to_video" as const, generationStrategySpec: strategyFromAlias("image_to_video") } : {}),
    };
  }) })) };
}

/** Never replace requested factual/sourced visuals with speculative AI footage. */
export function assertVisualPlanExecutable(spec: ProductionSpec): void {
  const mode = normalizeModeString(String(spec.project.productionMode)) || "standard";
  const shots = spec.scenes.flatMap(scene => scene.shots);
  for (const [index, shot] of shots.entries()) {
    const kind = shot.visualPlan?.kind;
    if (!kind) continue;
    if (kind !== "IMAGE" && kind !== "VIDEO") {
      throw new Error(`Visual planning requires ${kind} sourcing/rendering for shot ${shot.id}; generation is paused before provider spend.`);
    }
    if (kind === "VIDEO" && (mode === "express" || (mode === "standard" && index > 0 && shots.some(s => s.visualPlan?.kind === "IMAGE")))) {
      throw new Error(`Visual plan for shot ${shot.id} requires mixed-timeline assembly beyond the existing narrator/hybrid hook compiler.`);
    }
  }
}

export interface StrategyResolveInput {
  shot: Pick<
    ShotSpec,
    | "index"
    | "camera"
    | "characterIds"
    | "dialogue"
    | "durationSec"
    | "references"
    | "generationStrategy"
  >;
  creative: CreativeSpec;
  preferI2V: boolean;
  isFirstShotInProduction: boolean;
  previousShot?: ShotSpec | null;
  lastFrameChainEnabled?: boolean;
}

export interface StrategyResolveResult {
  alias: GenerationStrategy;
  spec: GenerationStrategySpec;
  reasons: string[];
}

/**
 * Resolve generation strategy for a shot from production context.
 * Deterministic and testable — no provider selection here.
 */
export function resolveShotGenerationStrategy(input: StrategyResolveInput): StrategyResolveResult {
  const reasons: string[] = [];
  const { shot, creative, preferI2V } = input;

  // Express / still path
  if (!preferI2V) {
    reasons.push("express/slideshow mode — still keyframes only");
    return {
      alias: "slideshow_still",
      spec: strategyFromAlias("slideshow_still"),
      reasons,
    };
  }

  if (creative.requiresAnimation) {
    reasons.push("animation treatment — stylized image-to-video");
  }

  // Character identity → multi-reference when refs exist
  const hasCharRefs =
    (shot.characterIds?.length || 0) > 0 || (shot.references?.characterRefs?.length || 0) > 0;
  if (hasCharRefs && creative.requiresCharacters) {
    reasons.push("character identity requires reference-guided video");
    const alias: GenerationStrategy = "multi_reference";
    return {
      alias,
      spec: {
        ...strategyFromAlias(alias),
        notes: creative.requiresAnimation ? "animation + character consistency" : "character consistency",
      },
      reasons,
    };
  }

  // Continuity chain → first+last frame when previous shot exists
  if (
    input.lastFrameChainEnabled !== false &&
    preferI2V &&
    !input.isFirstShotInProduction &&
    input.previousShot
  ) {
    reasons.push("continuity chain — first+last frame conditioning");
    return {
      alias: "first_last_frame",
      spec: strategyFromAlias("first_last_frame"),
      reasons,
    };
  }

  if (shot.camera.shotType === "macro" || shot.camera.shotType === "insert") {
    reasons.push("detail/product insert — first-frame locked I2V");
    return {
      alias: "image_to_video",
      spec: strategyFromAlias("image_to_video"),
      reasons,
    };
  }

  reasons.push("default image-to-video with first-frame conditioning");
  return {
    alias: "image_to_video",
    spec: strategyFromAlias("image_to_video"),
    reasons,
  };
}
