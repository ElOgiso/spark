/**
 * Thumbnail prompt compiler — OS spine for viral thumbnail variants.
 */

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
}): { prompt: string; compiler: "thumbnail" } {
  const {
    variantLetter,
    concept,
    shortHookText,
    aspectRatio,
    characterName = "Host",
    characterStyle = "Executive",
    brandName,
    identityPrefix = "",
    refPromptHeader = "",
  } = params;

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

  const prompt = `
${refPromptHeader}
[${aspectRatio} PROVEN VIRAL THUMBNAIL VARIANT ${variantLetter}]
CONCEPT: ${concept}
${formulaSpec}
RULE OF THIRDS LAW: Align character face and visual elements on rule-of-thirds grid intersections.
CHARACTER LOCK: Primary subject "${characterName}" (${characterStyle}). Facial structure, hair, and wardrobe strictly identical to character sheet reference.
${identityPrefix}
Brand: ${brandName}
`.trim();

  return { prompt, compiler: "thumbnail" };
}
