/**
 * Provider-independent generation strategy contract.
 * Selection of concrete providers belongs to a later routing phase.
 */

export type GenerationModality =
  | "text_to_image"
  | "image_to_image"
  | "text_to_video"
  | "image_to_video"
  | "slideshow_still"
  | "extend"
  | "edit"
  | "voice"
  | "audio"
  | "mux_edit";

/**
 * Structured generation requirements for a shot or task.
 * Prefer this over embedding everything in a prompt string.
 */
export interface GenerationStrategySpec {
  modality: GenerationModality;
  conditioning?: {
    firstFrame?: boolean;
    lastFrame?: boolean;
    referenceImages?: boolean;
    multiReference?: boolean;
  };
  includesVoice?: boolean;
  includesAudio?: boolean;
  includesEditing?: boolean;
  includesExtension?: boolean;
  notes?: string;
}

/** Compact modality alias kept on ShotSpec for compatibility with planners */
export type GenerationStrategyAlias =
  | GenerationModality
  | "first_last_frame"
  | "multi_reference"
  | string;

export function strategyFromAlias(alias: GenerationStrategyAlias): GenerationStrategySpec {
  switch (alias) {
    case "first_last_frame":
      return {
        modality: "image_to_video",
        conditioning: { firstFrame: true, lastFrame: true },
      };
    case "multi_reference":
      return {
        modality: "image_to_video",
        conditioning: { firstFrame: true, referenceImages: true, multiReference: true },
      };
    case "slideshow_still":
    case "text_to_image":
    case "image_to_image":
    case "text_to_video":
    case "image_to_video":
    case "extend":
    case "edit":
    case "voice":
    case "audio":
    case "mux_edit":
      return {
        modality: alias,
        conditioning:
          alias === "image_to_video"
            ? { firstFrame: true, referenceImages: true }
            : undefined,
        includesExtension: alias === "extend",
        includesEditing: alias === "edit" || alias === "mux_edit",
      };
    default:
      return { modality: "image_to_video", conditioning: { firstFrame: true }, notes: String(alias) };
  }
}

export function validateGenerationStrategySpec(strategy: GenerationStrategySpec): string[] {
  const errors: string[] = [];
  if (!strategy?.modality) errors.push("generationStrategy.modality required");
  if (
    strategy?.conditioning?.lastFrame &&
    strategy.modality !== "image_to_video" &&
    strategy.modality !== "extend"
  ) {
    errors.push("last-frame conditioning requires image_to_video or extend modality");
  }
  return errors;
}
