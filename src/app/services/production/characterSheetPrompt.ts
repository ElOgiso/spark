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

export function resolveGenreStyleLanguage(genre?: string): string {
  const g = (genre || "Realistic").toLowerCase();
  if (g.includes("anime") || g.includes("manga")) {
    return "High-end anime character design bible sheet, crisp studio lineart, cel-shaded precision, clean anime key animation turnarounds, production masterclass standard.";
  }
  if (g.includes("3d") || g.includes("cgi") || g.includes("render")) {
    return "Pixar/Overwatch grade stylized 3D character model sheet, Octane/Unreal Engine 5 subsurface scattering, crisp topology turnaround, high-end 3D visual development standard.";
  }
  if (g.includes("art") || g.includes("illustrat") || g.includes("comic")) {
    return "Stylized editorial digital concept art model sheet, bold graphic silhouettes, premium visual development illustration bible, expressive designer character sheet.";
  }
  if (g.includes("cine") || g.includes("film")) {
    return "35mm anamorphic cinematic film look, ARRI Alexa LF capture, motivated cinematic studio lighting, subtle film grain, natural photoreal depth.";
  }
  // Default: Realistic
  return "Photorealistic 8K commercial production model sheet, Hasselblad 100MP studio photography, ultra-crisp skin textures, neutral studio key lighting, zero AI distortion.";
}

export function buildProductionCharacterSheetPrompt(params: CharacterSheetPromptParams): string {
  const name = params.creatorName?.trim() || "Lead Host";
  const role = params.role?.trim() || "Brand Presenter";
  const brandName = params.brandName?.trim() || "SPARK";
  const genre = params.genre?.trim() || "Realistic";
  const styleLanguage = resolveGenreStyleLanguage(genre);

  const wardrobe = params.wardrobe?.trim() || "Executive Tailored Suit";
  const personality = params.personality?.trim() || "Confident, Authoritative, Engaging";
  const hairStyle = params.hairStyle?.trim() || "Short styled professional hair";
  const skinTone = params.skinTone?.trim() || "Rich warm tone";
  const directorNotes = params.directorNotes?.trim() || "Authoritative host in modern high-contrast studio setting.";

  return `
Professional animation model sheet, single character, studio turnaround.
STYLE: ${genre} (${styleLanguage}) consistent with brand ${brandName}.
CHARACTER: ${name}, role ${role}, ${personality} (${skinTone} skin tone, ${hairStyle}).
WARDROBE LOCK: ${wardrobe} — one locked signature costume inferred from genre. Do not invent a second costume.
DIRECTOR NOTES: ${directorNotes}

LAYOUT ON ONE IMAGE (Studio Model Sheet / Production Bible):
- Top: ${name} — ${role} + 5-6 labeled palette swatches (wardrobe primary/secondary, skin tone, hair tint, set accent)
- Row: FRONT, 3/4 FRONT, LEFT, RIGHT, BACK, 3/4 REAR — same height, standing on neutral gray studio backdrop
- Right: Face close-up + 2-3 costume & accessory details (tailoring texture, wristwear, tech prop)
- Bottom-left: 8 labeled expressions (Calm, Smile, Intense Hook, Surprise, Thoughtful, Speaking, Skeptical, Confident)
- Bottom-right: 4 action poses that fit this brand's content (Presenting, Pointing to graphic, Explaining insight, Sign-off CTA)

Same face, hair, outfit, colors in every cell. No collage of different people.
Reference any user-uploaded face if provided.
`.trim();
}
