/**
 * Localized Narration Compiler — Prompt 8, Component C
 *
 * Builds the LLM prompt to translate a NarrativeScript into a target language
 * while preserving ALL structural fields (chapter count, jobs, openLoops, CTA).
 * The result is a localized VARIANT — the canonical master is untouched.
 *
 * Constitution rules enforced:
 * - Never recreate shots or regenerate feature video.
 * - Borrow format only (Prompt 6 originality gate still applies to localized scripts).
 * - parity validator ensures same chapter count + same job sequence + non-empty openLoops.
 */

import type { NarrativeScript } from "../../../domain/types";

// ─── Parity Validation ───────────────────────────────────────────────────────

export interface LocalizedScriptParityResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validates that a localized script preserves structural parity with the original.
 * Does NOT block on style similarity — only on structure divergence (Prompt 6 rule).
 */
export function validateLocalizedScriptParity(
  original: NarrativeScript,
  localized: NarrativeScript
): LocalizedScriptParityResult {
  const errors: string[] = [];

  // 1. Chapter count must match exactly
  if ((original.chapters?.length ?? 0) !== (localized.chapters?.length ?? 0)) {
    errors.push(
      `Chapter count mismatch: original has ${original.chapters?.length ?? 0}, localized has ${localized.chapters?.length ?? 0}`
    );
  }

  // 2. Chapter job sequence must be identical
  if (original.chapters && localized.chapters) {
    const maxLen = Math.min(original.chapters.length, localized.chapters.length);
    for (let i = 0; i < maxLen; i++) {
      if (original.chapters[i].job !== localized.chapters[i].job) {
        errors.push(
          `Chapter ${i + 1} job mismatch: original "${original.chapters[i].job}" vs localized "${localized.chapters[i].job}"`
        );
      }
    }
  }

  // 3. openLoops must be preserved (non-empty plantedAtSec)
  if (!localized.openLoops || (localized.openLoops.plantedAtSec?.length ?? 0) === 0) {
    errors.push(
      "openLoops.plantedAtSec is empty in localized script — open-loop retention structure must be preserved"
    );
  }
  if (
    original.openLoops?.plantedAtSec?.length &&
    (localized.openLoops?.plantedAtSec?.length ?? 0) !== original.openLoops.plantedAtSec.length
  ) {
    errors.push(
      `openLoops.plantedAtSec count mismatch: original ${original.openLoops.plantedAtSec.length} vs localized ${localized.openLoops?.plantedAtSec?.length ?? 0}`
    );
  }

  // 4. mustNotCopy must be retained — localized may add items but must include originals
  const origMNC = new Set(original.mustNotCopy ?? []);
  const localMNC = new Set(localized.mustNotCopy ?? []);
  const missing = [...origMNC].filter((t) => !localMNC.has(t));
  if (missing.length > 0) {
    errors.push(
      `mustNotCopy entries dropped in localized script (Prompt 6 rule): ${missing.slice(0, 3).join(", ")}`
    );
  }

  // 5. contentSource must be "ai" — localized is AI-generated, not template-fallback
  if (localized.contentSource === "template-fallback") {
    errors.push(
      "contentSource is 'template-fallback' on localized script — localization must be AI-generated"
    );
  }

  return { ok: errors.length === 0, errors };
}

// ─── Prompt Compiler ─────────────────────────────────────────────────────────

/**
 * Compiles the LLM prompt that instructs the model to translate a NarrativeScript.
 * The callerresponsible for routing through ModelRouter and parsing the JSON response.
 *
 * @param script  The canonical master NarrativeScript (untranslated).
 * @param targetLanguage  BCP-47 language tag (e.g. "es", "fr", "pt-BR").
 * @returns       LLM prompt string to send via ModelRouter.
 */
export function compileLocalizedNarrationPrompt(
  script: NarrativeScript,
  targetLanguage: string
): string {
  const chapterSummary = (script.chapters ?? [])
    .map((ch) => `  [${ch.id}] order:${ch.order} job:"${ch.job}" durationSec:${ch.durationSec}`)
    .join("\n");

  const openLoopsSummary = `plantedAtSec: [${(script.openLoops?.plantedAtSec ?? []).join(", ")}], resolvedAtSec: [${(script.openLoops?.resolvedAtSec ?? []).join(", ")}]`;

  return `You are a professional localization director. Translate the following NarrativeScript into ${targetLanguage}.

STRICT RULES:
1. OUTPUT a valid JSON object matching the EXACT same structure as the input.
2. Translate ONLY the spoken/written text fields:
   - title, logline, premise, hook.spoken, chapters[].spoken, chapters[].visualIntent, fullSpokenScript, cta.spoken, cta.onScreen
3. PRESERVE ALL structural fields UNCHANGED:
   - chapters[].id, chapters[].order, chapters[].job, chapters[].durationSec, chapters[].setsUpNextChapterId
   - openLoops (keep identical plantedAtSec and resolvedAtSec arrays)
   - targetDurationSec, format, contentSource, mustNotCopy, provider, model, sourceUrls, formatBorrowedFrom
   - claims[] — translate claim text but keep verified status and source unchanged
4. DO NOT invent new chapters, reorder chapters, or change any chapter.job values.
5. DO NOT translate proper nouns (brand names, product names, handles, URLs).
6. Retain the hook's rhetorical function (question, curiosity gap, pattern interrupt) in the target language.
7. Retain open-loop phrasing at the timestamps indicated: ${openLoopsSummary}

STRUCTURE REFERENCE (DO NOT CHANGE these chapter definitions):
${chapterSummary}

INPUT SCRIPT:
${JSON.stringify(script, null, 2)}

Return ONLY the translated JSON object — no markdown fences, no commentary, no apologies.`;
}
