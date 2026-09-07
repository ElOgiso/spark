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

function mediumStyleDirective(genre: string): string {
  const g = genre.toLowerCase();
  if (g.includes("anime")) {
    return "MEDIUM LOCK: Anime character construction — consistent line weight, anime proportions, anime color flats. Do not render photoreal skin or live-action photography.";
  }
  if (g.includes("3d") || g.includes("cgi") || g.includes("render")) {
    return "MEDIUM LOCK: 3D/CG character construction — coherent materials, render lighting, digital sculpt readability. Do not mix 2D anime linework or live-action photography.";
  }
  if (g.includes("wuxia") || g.includes("martial")) {
    return "MEDIUM LOCK: Period martial-arts character design — costume-era silhouette, wuxia production language. Keep one coherent cinematic treatment.";
  }
  if (g.includes("cinematic")) {
    return "MEDIUM LOCK: Cinematic live-action photography — physically plausible materials, production lighting, cinema lens language.";
  }
  return "MEDIUM LOCK: Photorealistic live-action character bible — physically plausible face/body/wardrobe. One coherent medium only.";
}

export function buildProductionCharacterSheetPrompt(params: CharacterSheetPromptParams): string {
  const name = params.creatorName?.trim() || (params.role === "support" ? "Supporting Character" : "Lead Host");
  const brandName = params.brandName?.trim() || "SPARK";
  const characterGenre = params.genre?.trim() || "Realistic";
  const personality = params.personality?.trim() || (params.role === "support" ? "Dynamic supporting character" : "Authoritative, engaging visionary");
  const roleDesc = params.role === "support" ? "support" : (params.role || "host");
  const isSupport = params.role === "support" || roleDesc.toLowerCase().includes("support");
  const purpose = params.purpose?.trim();
  const niche = params.niche?.trim();
  const research = params.researchOneLiner?.trim();

  const wardrobeDirective = isSupport
    ? "WARDROBE & SILHOUETTE LOCK: distinct silhouette and distinct color palette from primary lead; one single outfit inferred from genre + brand; do not invent a second costume."
    : "WARDROBE LOCK: one outfit inferred from genre + brand; do not invent a second costume.";

  return `
Professional animation model sheet, single character, studio turnaround.
STYLE: ${characterGenre} consistent with brand ${brandName}.
${mediumStyleDirective(characterGenre)}
CHARACTER: ${name}, role ${roleDesc}, personality ${personality}.
${purpose ? `NARRATIVE FUNCTION: ${purpose}` : ""}
${niche ? `NICHE CONTEXT: ${niche}` : ""}
${research ? `STORY CONTEXT: ${research}` : ""}
${params.wardrobe?.trim() ? `WARDROBE STATE: ${params.wardrobe.trim()}` : wardrobeDirective}
${params.directorNotes?.trim() ? `DIRECTOR NOTES: ${params.directorNotes.trim()}` : ""}
LAYOUT ON ONE IMAGE:
- Top: name + role + 3 palette swatches
- Row: FRONT, 3/4 FRONT, LEFT, RIGHT, BACK, 3/4 REAR, same height, neutral gray
- Right: face close-up + 2 costume details
- Bottom-left: 8 labeled expressions
- Bottom-right: 4 brand-safe poses (presenting, pointing, reacting, standing) — not random movie stunts
Same face, hair, outfit, colors in every cell. No collage of different people.
If user uploaded a face, match that face.
This sheet owns identity — shot prompts must not redefine face/hair/wardrobe details already locked here.
`.trim();
}
