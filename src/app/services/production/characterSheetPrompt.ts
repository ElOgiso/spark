/**
 * SPARK Production Character Model Sheet Generator
 * Creates professional multi-view character design bibles (turnarounds, expressions, detail callouts, action poses)
 * used for zero-drift visual locking in video and image generation pipelines.
 */

export interface CharacterSheetPromptParams {
  creatorName?: string;
  role?: string;
  brandName?: string;
  niche?: string;
  purpose?: string;
  researchOneLiner?: string;
  genre?: string; // Realistic | Cinematic | Anime | Art | 3D / 3D Render
  personality?: string;
  skinTone?: string;
  hairStyle?: string;
  wardrobe?: string;
  directorNotes?: string;
}

export function buildProductionCharacterSheetPrompt(params: CharacterSheetPromptParams): string {
  const name = params.creatorName?.trim() || "Lead Host";
  const brandName = params.brandName?.trim() || "SPARK";
  const characterGenre = params.genre?.trim() || "Realistic";
  const personality = params.personality?.trim() || "Authoritative, engaging visionary";

  return `
Professional animation model sheet, single character, studio turnaround.
STYLE: ${characterGenre} consistent with brand ${brandName}.
CHARACTER: ${name}, role host, personality ${personality}.
WARDROBE LOCK: one outfit inferred from genre + brand; do not invent a second costume.
LAYOUT ON ONE IMAGE:
- Top: name + role + 3 palette swatches
- Row: FRONT, 3/4 FRONT, LEFT, RIGHT, BACK, 3/4 REAR, same height, neutral gray
- Right: face close-up + 2 costume details
- Bottom-left: 8 labeled expressions
- Bottom-right: 4 brand-safe poses (presenting, pointing, reacting, standing) — not random movie stunts
Same face, hair, outfit, colors in every cell. No collage of different people.
If user uploaded a face, match that face.
`.trim();
}
