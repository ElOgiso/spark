/**
 * Lightweight stage validators for production intelligence intermediates.
 * Rejects malformed structured results before they enter ProductionSpec.
 * No new validation library — plain TypeScript checks matching existing SpecValidationResult.
 */

import type { SpecValidationResult } from "../specification";
import type { CreativeDirection } from "./creativeDirector";
import type { NarrativeBeatPlan } from "./narrativePlanner";
import type { GenreClassification } from "./genreClassifier";
import type { ComposedGrammar } from "../grammar";

function result(errors: string[], warnings: string[] = []): SpecValidationResult {
  return { ok: errors.length === 0, errors, warnings };
}

export function validateCreativeDirection(direction: CreativeDirection | null | undefined): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!direction) return result(["creativeDirection missing"]);
  if (!direction.contentType?.trim()) errors.push("creativeDirection.contentType required");
  if (!direction.genre) errors.push("creativeDirection.genre required");
  if (typeof direction.confidence !== "number" || direction.confidence < 0 || direction.confidence > 1) {
    errors.push("creativeDirection.confidence must be 0–1");
  }
  if (!Array.isArray(direction.platform)) errors.push("creativeDirection.platform must be an array");
  if (!Array.isArray(direction.unknownFields)) errors.push("creativeDirection.unknownFields must be an array");
  if (direction.tone === "unknown") warnings.push("tone unknown");
  if (direction.durationSec != null && !(direction.durationSec > 0)) {
    errors.push("creativeDirection.durationSec must be > 0 when set");
  }
  return result(errors, warnings);
}

export function validateGenreClassification(c: GenreClassification | null | undefined): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!c) return result(["genreClassification missing"]);
  if (!c.primaryGenre) errors.push("classification.primaryGenre required");
  if (!Array.isArray(c.styleTags)) errors.push("classification.styleTags must be an array");
  if (!Array.isArray(c.secondaryGenres)) errors.push("classification.secondaryGenres must be an array");
  if (typeof c.confidence !== "number") errors.push("classification.confidence required");
  if (c.ambiguous) warnings.push("classification ambiguous");
  return result(errors, warnings);
}

export function validateGrammarSelection(grammar: ComposedGrammar | null | undefined): SpecValidationResult {
  const errors: string[] = [];
  if (!grammar) return result(["grammar missing"]);
  if (!grammar.id && !grammar.sources?.length) errors.push("grammar id/sources required");
  if (!grammar.coverage) errors.push("grammar.coverage required");
  if (!grammar.audioBias) errors.push("grammar.audioBias required");
  return result(errors);
}

export function validateNarrativePlan(
  beats: NarrativeBeatPlan[] | null | undefined,
  structureId?: string
): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!beats || !Array.isArray(beats)) return result(["narrative beats missing"]);
  if (beats.length < 2) errors.push("narrative plan requires at least 2 beats");
  if (!structureId?.trim()) warnings.push("narrative structureId missing");
  for (const b of beats) {
    if (typeof b.index !== "number") errors.push("beat.index required");
    if (!b.narrativeFunction) errors.push(`beat[${b.index}].narrativeFunction required`);
    if (!b.purpose?.trim()) errors.push(`beat[${b.index}].purpose required`);
    if (!(b.durationSec > 0)) errors.push(`beat[${b.index}].durationSec must be > 0`);
  }
  return result(errors, warnings);
}

/**
 * Repair helper: drop invalid beats rather than accepting corrupted narrative silently.
 */
export function sanitizeNarrativeBeats(beats: NarrativeBeatPlan[]): NarrativeBeatPlan[] {
  return beats
    .filter((b) => b && b.narrativeFunction && b.purpose?.trim() && b.durationSec > 0)
    .map((b, index) => ({ ...b, index }));
}
