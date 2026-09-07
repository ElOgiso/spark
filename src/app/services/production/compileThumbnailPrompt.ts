/**
 * Thumbnail prompt compiler — OS spine for viral thumbnail variants.
 */

import type { ContentFormat } from "../../domain/types";
import {
  contentFormatDirective,
  normalizeCanonicalContentFormat,
  thumbnailSubjectLock,
} from "./contentFormatDirectives";

export function compileThumbnailPrompt(params: {
  variantLetter: "A" | "B" | "C" | string;
  concept: string;
  shortHookText: string;
  aspectRatio: string;
  characterName?: string;
  characterStyle?: string;
  brandName: string;
  identityPrefix?: string;
  refPromptHeader?: string;
  contentFormat?: ContentFormat | string | null;
}): { prompt: string; compiler: "thumbnail" } {
  const {
    variantLetter,
    concept,
    shortHookText,
    aspectRatio,
    characterName,
    characterStyle,
    brandName,
    identityPrefix = "",
    refPromptHeader = "",
  } = params;

  const format = normalizeCanonicalContentFormat(params.contentFormat);

  const formulaDirectives: Record<string, string> = {
    A: `VIRAL FORMULA: Shock / High Emotion + Curiosity Gap.
LAYOUT: Subject on left vertical third (Rule of Thirds grid), short bold 2-4 word headline on right third.
TEXT OVERLAY: "${shortHookText}" (Short, bold, high-contrast typography, ≤4 words).
COLOR PALETTE: Primary brand accent + high-contrast monochrome base (black/white) + neon magenta highlight glow.`,
    B: `VIRAL FORMULA: Big Number Transformation + Character Scale Comparison.
LAYOUT: Subject on right vertical third gesturing toward large metric graphic card on left vertical third.
TEXT OVERLAY: "${shortHookText}" (Bold numerical highlight & metric callout, ≤4 words).
COLOR PALETTE: Primary brand accent + dark obsidian base + electric amber per-video highlight.`,
    C: `VIRAL FORMULA: Hero Object + Burning Question + Blurred Outcome.
LAYOUT: Subject at Rule of Thirds focal intersection looking toward curiosity object with subtle depth-of-field blur.
TEXT OVERLAY: "${shortHookText}" (Bold mystery question prompt, ≤4 words).
COLOR PALETTE: Primary brand accent + studio dark monochrome + cyan highlight glow.`,
  };

  const formulaSpec = formulaDirectives[variantLetter] || formulaDirectives.A;
  const subjectLock = thumbnailSubjectLock({
    contentFormat: format,
    characterName,
    characterStyle,
  });

  const prompt = `
${refPromptHeader}
${contentFormatDirective(format)}
[${aspectRatio} PROVEN VIRAL THUMBNAIL VARIANT ${variantLetter}]
CONCEPT: ${concept}
${formulaSpec}
RULE OF THIRTHS LAW: Align primary visual elements on rule-of-thirds grid intersections.
${subjectLock}
${identityPrefix}
Brand: ${brandName}
`.trim().replace("RULE OF THIRTHS", "RULE OF THIRDS");

  return { prompt, compiler: "thumbnail" };
}
