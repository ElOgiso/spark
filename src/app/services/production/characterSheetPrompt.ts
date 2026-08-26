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
  const name = params.creatorName?.trim() || "Lead Presenter";
  const role = params.role?.trim() || "Brand Host & Lead Presenter";
  const brandName = params.brandName?.trim() || "SPARK Media";
  const niche = params.niche?.trim() || "Modern Media";
  const purpose = params.purpose?.trim() || "Empowering audiences with high-signal insights";
  const researchContext = params.researchOneLiner?.trim() ? ` — Theme: "${params.researchOneLiner.trim()}"` : "";
  const styleLanguage = resolveGenreStyleLanguage(params.genre);

  const wardrobe = params.wardrobe?.trim() || "Executive Tailored Suit";
  const personality = params.personality?.trim() || "Confident, Authoritative, Engaging";
  const hairStyle = params.hairStyle?.trim() || "Short styled professional hair";
  const skinTone = params.skinTone?.trim() || "Rich warm tone";
  const directorNotes = params.directorNotes?.trim() || "Authoritative executive host in a modern high-contrast studio universe.";

  return `
[PRODUCTION CHARACTER MODEL SHEET & DESIGN BIBLE: ${name.toUpperCase()}]
Universe: "${brandName}" (Niche: "${niche}", Purpose: "${purpose}"${researchContext})
Role: ${role}
Style Specification: ${styleLanguage}

CHARACTER IDENTITY & WARDROBE LOCK:
- Subject: "${name}" (${personality})
- Features: ${skinTone} skin tone, ${hairStyle}
- Signature Wardrobe: ${wardrobe}
- Director Notes: ${directorNotes}

SHEET LAYOUT & MULTI-VIEW BIBLE COMPOSITION (One unified widescreen master production model sheet):
1. TOP TITLE BLOCK & COLOR SWATCHES:
   - Title Header: "${name}" — Production Character Model Bible (${role}) | Brand: "${brandName}"
   - Palette Swatches: 5-6 labeled hex color swatches defining wardrobe primary/secondary, skin tone, hair tint, and accent colors.

2. FULL-BODY TURNAROUND ROW (Strictly same subject, identical height, standing on neutral gray studio ground line):
   - FRONT: Full frontal standing pose, hands relaxed/open, facing camera.
   - 3/4 FRONT: Three-quarter dynamic angle showing depth and wardrobe cut.
   - LEFT PROFILE: Full 90-degree left side view showing silhouette and posture.
   - RIGHT PROFILE: Full 90-degree right side view.
   - BACK: Full rear view showing back of garment, hair, and shoulders.
   - 3/4 REAR: Three-quarter back angle completing the 360 turnaround.

3. DETAIL CALLOUT INSETS:
   - Face Close-Up: High-resolution crop highlighting facial structure, eyes, and expressions.
   - Costume Detail 1: Close-up of signature wardrobe fabric, collar tailoring, or texture.
   - Costume Detail 2: Close-up of signature accessory, watch, tech prop, or footwear.

4. EXPRESSION PALETTE ROW (6-8 labeled facial emotion crops):
   - CALM / NEUTRAL, SMILE / WARM, INTENSE / HOOK, SURPRISE / REVELATION, THOUGHTFUL / ANALYSIS, SPEAKING / PRESENTING.

5. ACTION POSES (3-4 brand-fit presenter poses):
   - Presenting to viewer / Pointing to data graphic / Explaining insight / Authoritative CTA sign-off.

STRICT CONTINUITY LAWS:
- 100% Face, Hair, and Wardrobe Lock: Exactly the same individual character in every turnaround cell, expression crop, and action pose.
- Zero collage of different people. Single coherent visual development model sheet.
- Clean neutral studio background, crisp master lighting, 8K ultra-sharp reference clarity.
`.trim();
}
