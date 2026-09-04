/**
 * Deterministic generation-strategy resolver.
 * Decides WHAT kind of generation a shot needs — not which provider.
 */

import type { ShotSpec, GenerationStrategy } from "../specification/shotSpec";
import type { CreativeSpec } from "../specification/productionSpec";
import { strategyFromAlias, type GenerationStrategySpec } from "../specification/generationStrategy";

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
