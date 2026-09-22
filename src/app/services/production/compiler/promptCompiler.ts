/**
 * Structured Prompt Compiler for Provider Payload Compiler.
 *
 * Compiles provider-neutral semantic intent:
 * - Subject
 * - Action
 * - Environment
 * - Composition
 * - Camera
 * - Lighting
 * - Atmosphere
 * - Style
 *
 * Emits clean, non-filler prompt strings.
 */

import type { ShotSpec } from "../specification/shotSpec";
import { I2V_MOTION_LOCK_PREAMBLE, CANONICAL_NEGATIVE_LAWS } from "./constants";

const BANNED_FILLER = /\b(beautiful|stunning|epic|masterpiece|ultra[- ]detailed|breathtaking)\b/gi;

export function stripFiller(text: string): string {
  return text.replace(BANNED_FILLER, "").replace(/\s{2,}/g, " ").trim();
}

export function compileStructuredPrompt(params: {
  shot: ShotSpec;
  isI2v: boolean;
  cameraDirectives: string[];
  operationDirectives: string[];
  lightingDirectives: string[];
  styleDirectives: string[];
  negativeConstraints: string[];
}): { prompt: string; negativePrompt: string } {
  const {
    shot,
    isI2v,
    cameraDirectives,
    operationDirectives,
    lightingDirectives,
    styleDirectives,
    negativeConstraints,
  } = params;

  const blocks: string[] = [];

  if (isI2v) {
    blocks.push(I2V_MOTION_LOCK_PREAMBLE);
  }

  // Purpose & Production Reason
  if (shot.purpose) {
    blocks.push(`SHOT PURPOSE: ${shot.purpose}`);
  }

  // Subject & Action
  if (shot.subject) {
    blocks.push(`SUBJECT: ${shot.subject}`);
  }
  if (shot.subjectAction) {
    blocks.push(`ACTION: ${shot.subjectAction}`);
  }

  // Environment
  if (shot.environment) {
    blocks.push(`ENVIRONMENT: ${shot.environment}`);
  }

  // Atmosphere
  if (shot.atmosphere) {
    blocks.push(`ATMOSPHERE: ${shot.atmosphere}`);
  }

  // Cinematography & Camera
  blocks.push(...cameraDirectives);
  blocks.push(...operationDirectives);

  // Lighting
  blocks.push(...lightingDirectives);

  // Style
  blocks.push(...styleDirectives);

  const cleanPrompt = stripFiller(blocks.filter(Boolean).join("\n\n"));

  // Negative Prompt Assembly
  const negParts = [CANONICAL_NEGATIVE_LAWS, ...negativeConstraints].filter(Boolean);
  const cleanNegative = Array.from(
    new Set(
      negParts
        .join(", ")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  ).join(", ");

  return {
    prompt: cleanPrompt,
    negativePrompt: cleanNegative,
  };
}
