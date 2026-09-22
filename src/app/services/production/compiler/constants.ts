/**
 * Compiler versions and constants for Phase 10.
 */

export const COMPILER_VERSION = "provider-payload-v1.0";
export const PROMPT_COMPILER_VERSION = "spark-prompt-v2.0";

/**
 * Standard anti-slop negative prompt baseline.
 */
export const CANONICAL_NEGATIVE_LAWS =
  "face morphing, identity drift, different person, wardrobe change, set change, background reset, extra limbs, extra fingers, deformed hands, warped face, duplicated subject, cloned character, jump cut, hard cut, scene reset, burned-in text, caption, subtitle, watermark, logo, glitch, visual artifacts, low quality, blurry, distorted";

/**
 * Standard I2V motion lock preamble.
 */
export const I2V_MOTION_LOCK_PREAMBLE =
  "Animate the provided start frame. Do not restyle, recompose, or change identity, wardrobe, or set. Prompt describes motion and camera only.";
