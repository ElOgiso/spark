/**
 * Character master templates.
 * CHANGE the identity / wardrobe / environment inputs.
 * KEEP the engine: anatomy, continuity, identity lock, sheet geometry, quality.
 *
 * Sources:
 * - Social influencer Prompt 1 (realistic portrait foundation)
 * - SPARK library — Character portrait + 3-view sheet
 * - Product advertising Prompt 3 (3-view sheet geometry)
 *
 * Master rule: CHANGE THE INPUTS. KEEP THE ENGINE.
 * Reference image controls identity. Template controls production behavior.
 */

import {
  characterGenreOption,
  normalizeCharacterGenre,
  type CharacterGenreId,
} from "../../domain/characterGenre";

export interface CharacterIdentityVariables {
  name?: string;
  role?: string;
  age?: string;
  gender?: string;
  ethnicity?: string;
  skinTone?: string;
  hairStyle?: string;
  eyeColor?: string;
  build?: string;
  wardrobe?: string;
  personality?: string;
  expression?: string;
  location?: string;
  directorNotes?: string;
  brandName?: string;
  niche?: string;
  purpose?: string;
}

export interface CharacterFoundationInput extends CharacterIdentityVariables {
  genre?: string;
  /** User-uploaded face / existing portrait. Controls identity. */
  identityImageUrl?: string | null;
  /** Existing 3-view sheet, if regenerating look only. */
  characterSheetUrl?: string | null;
}

export interface CompiledCharacterPrompt {
  genreId: CharacterGenreId;
  genreLabel: string;
  moodboardUrl: string;
  mediumLock: string;
  identityLock: string;
  portraitPrompt: string;
  sheetPrompt: string;
  /** Style / medium refs first, identity last so the face wins. */
  referenceImageUrls: string[];
}

const REALISTIC_PORTRAIT_FOUNDATION = `A full-body street-style portrait in vertical 9:16 format shows the locked character standing square to the camera with both feet planted shoulder-width apart on a clean, grey, residential pavement. One hand loosely holds a bag strap while the other arm hangs by their side, posture relaxed with shoulders gently pulled back and chin level for steady eye contact with the lens, creating a calm and approachable expression with a closed-lip smile. Complexion is natural, with subtle natural detail—visible pores, fine skin texture, a flush on the cheeks, under-eye shadow, eyebrows with stray hairs, soft lips, clear iris detail, and daylight catchlights. The narrow alleyway behind features a low brick wall with faded mortar, a slim tree trunk, metal gate, grey step, and blank shop shutter, with gentle overcast daylight from above and slightly frontal yielding soft, even shadows under the chin and within clothing folds, keeping background slightly darker. Framed eye-level from mid-chest height with no cropping of the body, this digital image is captured in sharp, deep focus on a modern smartphone with natural color accuracy, no noise, film grain, LUT stylization, harsh light, or lens artifacts present, evoking a calm urban mood and authentic realism.`;

const EDITORIAL_PORTRAIT_FOUNDATION = `A full-length vertical editorial portrait, 9:16. The locked character stands in a physically believable environment with natural posture and weight, both feet visible at the bottom of the frame. Clothing behaves like real fabric for the chosen medium. Soft even key light, no harsh shadows, deep focus. No accidental branding, no invented logos.`;

const SHEET_FOUNDATION = `Three-panel character reference sheet, 16:9, of the exact same person as in the input photo — identical face, identical facial structure, identical hair, identical features in all three panels, same person photographed three times. Keep the outfit and styling from the input photo, modest fully-clothed, opaque fabric, no revealing styling. Panel 1 (left third): full body, standing neutral, five fingers per hand. Panel 2 (center third): true 90-degree side profile, MEDIUM bust — upper chest to top of head, full hair silhouette, not a tight face crop. Panel 3 (right third): frontal MEDIUM bust facing camera, neutral calm expression, same framing rule. Background: smooth solid plain mid-grey seamless studio, one perfectly even flat grey tone, no texture, no gradient, no vignette, floor blending into the same grey. Soft even diffused studio light, no specular highlights on skin. No real brand logos or copyrighted graphics, replace any with generic abstract designs.`;

function mediumLockFor(genre: CharacterGenreId): string {
  switch (genre) {
    case "3D":
      return "MEDIUM LOCK: Real pixel / feature-CGI 3D character construction — coherent materials, subsurface, studio key, digital sculpt readability. Not photoreal live-action photography. Not 2D anime linework. Not mobile-game plastic.";
    case "Anime":
      return "MEDIUM LOCK: 2D anime character construction — consistent line weight, anime proportions, anime color flats. Do not render photoreal skin or live-action photography. Do not render 3D CGI.";
    case "Cartoon":
      return "MEDIUM LOCK: Bold 2D cartoon illustration — readable silhouette, flat or simple shading. Not photoreal. Not 3D CGI.";
    case "Illustration":
      return "MEDIUM LOCK: Editorial illustration — graphic color, designed figure, not photoreal photography.";
    case "Comic":
      return "MEDIUM LOCK: Inked graphic-novel / comic construction — line, silhouette, graphic color. Not photoreal.";
    case "Clay":
      return "MEDIUM LOCK: Tactile clay / stop-motion miniature — visible material, handmade surface. Not smooth photoreal CGI. Not live-action skin.";
    case "Pixel":
      return "MEDIUM LOCK: Retro pixel-art character — readable pixel silhouette, limited palette. Not photoreal.";
    case "Art":
      return "MEDIUM LOCK: Painterly fine-art portrait — visible pigment / brush, not beauty-filter photography, not 3D CGI.";
    case "Cinematic":
      return "MEDIUM LOCK: Cinematic live-action photography — physically plausible materials, production lighting, cinema lens language. Not anime. Not 3D cartoon.";
    default:
      return "MEDIUM LOCK: Photorealistic live-action character — physically plausible face/body/wardrobe, natural pores, no beauty-filter smoothing. Not anime. Not 3D CGI.";
  }
}

function filledIdentity(input: CharacterFoundationInput): string[] {
  const rows: string[] = [];
  const push = (label: string, value?: string) => {
    const v = value?.trim();
    if (v) rows.push(`- ${label}: ${v}`);
  };
  push("Name", input.name);
  push("Role", input.role);
  push("Age", input.age);
  push("Gender", input.gender);
  push("Ethnicity / presentation", input.ethnicity);
  push("Skin tone", input.skinTone);
  push("Hair", input.hairStyle);
  push("Eyes", input.eyeColor);
  push("Build", input.build);
  push("Wardrobe", input.wardrobe);
  push("Personality", input.personality);
  push("Expression", input.expression);
  push("Location", input.location);
  push("Brand", input.brandName);
  push("Niche", input.niche);
  push("Purpose", input.purpose);
  push("Director notes", input.directorNotes);
  return rows;
}

export function buildIdentityLock(input: CharacterFoundationInput): string {
  const rows = filledIdentity(input);
  const hasRef = Boolean(input.identityImageUrl || input.characterSheetUrl);
  return [
    "IDENTITY LOCK — KEEP CHARACTER FEATURES.",
    "KEEP across every output and every genre change: face, facial structure, bone structure, hair style and color, hairline, skin tone, eyes, brows, nose, mouth, distinctive marks, body build and proportions.",
    "These features belong to the user's character. Do not invent a new person when they create or regenerate their own character.",
    "CHANGE only what the user explicitly edited (wardrobe, expression, location, medium/genre). Do not restyle hair or reshape the face unless the user changed those fields.",
    "When a reference image is supplied, the reference controls identity. The template controls production behavior.",
    "Do not copy the moodboard person's identity onto this character. Moodboard is STYLE / MEDIUM only.",
    hasRef
      ? "INPUT PHOTO / SHEET is the identity source. Match that face and hair in every output."
      : "No photo yet — use only the listed identity variables. Do not invent extra distinctive marks.",
    rows.length
      ? "CHANGE — IDENTITY VARIABLES (user-owned, then KEEP):\n" + rows.join("\n")
      : "CHANGE — IDENTITY VARIABLES: infer a single coherent person from the brief, then lock them.",
  ].join("\n");
}

function portraitFoundationFor(genre: CharacterGenreId): string {
  if (genre === "Realistic" || genre === "Cinematic") return REALISTIC_PORTRAIT_FOUNDATION;
  return EDITORIAL_PORTRAIT_FOUNDATION;
}

export function compileCharacterFoundations(input: CharacterFoundationInput): CompiledCharacterPrompt {
  const option = characterGenreOption(input.genre);
  const genreId = option.id;
  const mediumLock = mediumLockFor(genreId);
  const identityLock = buildIdentityLock(input);

  const portraitPrompt = [
    "MASTER RULE: CHANGE THE INPUTS. KEEP THE ENGINE.",
    mediumLock,
    identityLock,
    "FOUNDATION — PORTRAIT (keep camera logic, anatomy, authenticity; swap only medium / lighting / materials for this genre):",
    portraitFoundationFor(genreId),
    "OUTPUT: single character, vertical 9:16 unless a different format is required. Modest fully-clothed. No logos.",
  ].join("\n\n");

  const sheetMedium =
    genreId === "Realistic" || genreId === "Cinematic"
      ? "Photorealistic matte unretouched skin with visible pores, no smoothing, no plastic skin, no glamour lighting."
      : `Apply the ${option.label} medium lock to every panel. Keep panel geometry identical. Never weaken same-person consistency.`;

  const sheetPrompt = [
    "MASTER RULE: CHANGE THE INPUTS. KEEP THE ENGINE.",
    mediumLock,
    identityLock,
    "FOUNDATION — THREE-VIEW CHARACTER SHEET (keep geometry and same-person lock):",
    SHEET_FOUNDATION,
    sheetMedium,
    "CRITICAL: the sheet is a continuity tool. Do not weaken the exact-same-person requirement. Identical face, identical facial structure, identical hair, identical features in all three panels.",
  ].join("\n\n");

  const refs: string[] = [];
  if (option.moodboardUrl) refs.push(option.moodboardUrl);
  if (input.identityImageUrl) refs.push(input.identityImageUrl);
  else if (input.characterSheetUrl) refs.push(input.characterSheetUrl);

  return {
    genreId,
    genreLabel: option.label,
    moodboardUrl: option.moodboardUrl,
    mediumLock,
    identityLock,
    portraitPrompt,
    sheetPrompt,
    referenceImageUrls: Array.from(new Set(refs)),
  };
}

export function compileCharacterPortraitPrompt(input: CharacterFoundationInput): string {
  return compileCharacterFoundations(input).portraitPrompt;
}

export function compileCharacterSheetPrompt(input: CharacterFoundationInput): string {
  return compileCharacterFoundations(input).sheetPrompt;
}

export function compileCharacterFromGenreFoundation(input: CharacterFoundationInput): CompiledCharacterPrompt {
  return compileCharacterFoundations(input);
}

export { normalizeCharacterGenre };
