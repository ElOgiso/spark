/**
 * Identity-free character foundations.
 *
 * Three inputs only:
 *   Foundation  — production engine (camera, geometry, anatomy, quality). No person.
 *   Genre       — medium lock + moodboard pixels as STYLE / MEDIUM only.
 *   Identity    — user-owned face / hair / clothing / age / gender / ethnicity.
 *
 * Compile: foundation + genre medium lock + user identity slots.
 * Never copy a moodboard face. Never leave a sample person in the engine.
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
  skin?: string;
  hair?: string;
  eyes?: string;
  face?: string;
  build?: string;
  wardrobe?: string;
  accessories?: string;
  expression?: string;
  posture?: string;
  personality?: string;
  environment?: string;
  definingTraits?: string;
}

export interface CompileCharacterFoundationsParams {
  genre?: string | null;
  identity?: CharacterIdentityVariables;
  brandName?: string;
  niche?: string;
  purpose?: string;
  directorNotes?: string;
  /** User photo controls IDENTITY. Moodboard pixels control MEDIUM only. */
  hasIdentityImage?: boolean;
  layoutStyle?: "portrait_9x16" | "turnaround_3view" | "full_turnaround_multiview";
  closeUpPriority?: boolean;
}

export interface CompiledCharacterFoundations {
  genreId: CharacterGenreId;
  genreLabel: string;
  mediumLockLine: string;
  doNot: string;
  referenceImages: string[];
  identityBlock: string;
  portraitPrompt: string;
  sheetPrompt: string;
}

const IDENTITY_FORBIDDEN_IN_FOUNDATION = [
  "korean woman",
  "oatmeal",
  "seoul",
  "ribbed knit",
  "beautiful woman in her early 20s",
];

function slot(label: string, value?: string): string | null {
  const v = value?.trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

export function formatIdentityBlock(identity: CharacterIdentityVariables = {}): string {
  const lines = [
    slot("Name", identity.name),
    slot("Role", identity.role),
    slot("Age appearance", identity.age),
    slot("Gender", identity.gender),
    slot("Ethnicity / cultural features", identity.ethnicity),
    slot("Skin", identity.skin),
    slot("Hair", identity.hair),
    slot("Eyes", identity.eyes),
    slot("Face", identity.face),
    slot("Build", identity.build),
    slot("Wardrobe", identity.wardrobe),
    slot("Accessories", identity.accessories),
    slot("Expression", identity.expression),
    slot("Posture", identity.posture),
    slot("Personality signals", identity.personality),
    slot("Defining traits", identity.definingTraits),
    slot("Environment (only if the user asked)", identity.environment),
  ].filter(Boolean) as string[];

  if (lines.length === 0) {
    return [
      "CHARACTER IDENTITY — USER DECIDES",
      "No identity variables were supplied.",
      "Do not invent a celebrity, stock-model look-alike, or default ethnicity / face / hair / outfit.",
      "Use a generic, unspecific everyday person only if generation cannot proceed without a body, and keep every identity choice ordinary and replaceable.",
    ].join("\n");
  }

  return ["CHARACTER IDENTITY — USER DECIDES", ...lines].join("\n");
}

function portraitFoundation(genreId: CharacterGenreId): string {
  const shared = [
    "FOUNDATION — KEEP (identity-free engine)",
    "A full-body portrait in vertical 9:16.",
    "SUBJECT is supplied only by CHARACTER IDENTITY and/or an attached identity photo.",
    "Do not invent a face, hair color, hairstyle, ethnicity, age, body, jewelry, or wardrobe.",
    "Do not copy the appearance of anyone in a genre moodboard. Moodboard images are STYLE / MEDIUM references only.",
    "Standing square to the camera, both feet planted shoulder-width, full body uncropped, five fingers per hand.",
    "Natural posture, shoulders easy, chin level, steady eye contact.",
    "Framed eye-level from mid-chest height origin. Sharp deep focus. No text, no logos, no watermarks, no collage, no second person.",
  ];

  const medium: Record<CharacterGenreId, string[]> = {
    realistic: [
      "Photoreal smartphone capture. Natural color accuracy. Soft even observed daylight.",
      "Real skin: visible pores, fine texture, natural asymmetry. No beauty-filter, no airbrush, no plastic skin.",
      "Background is an ordinary lived-in place consistent with IDENTITY environment if given; otherwise a simple quiet exterior or interior with no readable signage.",
    ],
    cinematic: [
      "Photoreal cinema still. Production lighting, cinema lens language, physically plausible materials.",
      "Real skin texture under cinematic key + fill. No beauty-filter, no LUT-as-identity.",
      "Background is a quiet production-designed space with no readable signage unless IDENTITY environment specifies it.",
    ],
    pixel_3d: [
      "Feature-CGI / pixel-3D still. Coherent materials, readable sculpt, subsurface on skin-like surfaces, studio key.",
      "Not photoreal live-action photography. Not 2D anime linework. Not mobile-game plastic.",
      "Simple studio or designed set. No readable logos.",
    ],
    anime: [
      "2D anime character still. Consistent line weight, anime proportions, cel color flats.",
      "Not photoreal skin. Not live-action photography. Not 3D CGI.",
      "Simple clean background. No readable logos.",
    ],
    cartoon: [
      "Stylized 2D cartoon still. Broad readable shapes, graphic color, clean silhouette.",
      "Not photoreal. Not 3D CGI.",
      "Simple clean background. No readable logos.",
    ],
    illustration: [
      "Illustration still. Drawn or painted figure, not a photograph.",
      "Simple field or wash background. No readable logos.",
    ],
    comic: [
      "Graphic-novel character still. Inked line, graphic color.",
      "Plain field background. No readable logos.",
    ],
    painterly: [
      "Painterly figure still. Visible pigment, theatrical light.",
      "Not photoreal, not 3D CGI. Simple ground. No readable logos.",
    ],
    clay: [
      "Stop-motion / clay miniature still. Tactile handmade materials.",
      "Not smooth photoreal CGI, not 2D anime. Simple craft-table ground. No readable logos.",
    ],
  };

  return [...shared, ...medium[genreId]].join("\n");
}

function sheetFoundation(genreId: CharacterGenreId, layout: CompileCharacterFoundationsParams["layoutStyle"]): string {
  const identityLaw = [
    "FOUNDATION — KEEP (identity-free engine)",
    "Three-panel character reference sheet of ONE person — the person described in CHARACTER IDENTITY and/or shown in the attached identity photo.",
    "Identical face, identical facial structure, identical hair, identical features in all panels. Same person three times.",
    "Do not invent a new face. Do not copy a moodboard person's identity. Moodboard images are STYLE / MEDIUM only.",
    "Keep the outfit from CHARACTER IDENTITY / identity photo. Modest, fully clothed, opaque fabric.",
    "Correct hand and finger anatomy. No extra limbs. No logos or copyrighted graphics.",
  ];

  if (layout === "full_turnaround_multiview") {
    return [
      ...identityLaw,
      "LAYOUT ON ONE IMAGE:",
      "- Top: name + role + 3 palette swatches (no extra identity invention)",
      "- Row: FRONT, 3/4 FRONT, LEFT, RIGHT, BACK, 3/4 REAR, same height, neutral gray",
      "- Right: face close-up + 2 costume details",
      "- Bottom-left: 8 labeled expressions",
      "- Bottom-right: 4 brand-safe poses (presenting, pointing, reacting, standing)",
      sheetMediumSentence(genreId),
    ].join("\n");
  }

  return [
    ...identityLaw,
    "LAYOUT ON ONE IMAGE — library 3-view geometry:",
    "Three-panel character reference sheet, 16:9.",
    "Panel 1 (left third): full body, standing neutral, five fingers per hand.",
    "Panel 2 (center third): true 90-degree side profile, MEDIUM bust — upper chest to top of head, full hair silhouette, not a tight face crop.",
    "Panel 3 (right third): frontal MEDIUM bust facing camera, neutral calm expression, same framing rule.",
    "Background: smooth solid plain mid-grey seamless studio, one perfectly even flat grey tone, no texture, no gradient, no vignette, floor blending into the same grey.",
    "Soft even diffused studio light, no specular glamour highlights.",
    sheetMediumSentence(genreId),
  ].join("\n");
}

function sheetMediumSentence(genreId: CharacterGenreId): string {
  switch (genreId) {
    case "pixel_3d":
      return "MEDIUM SENTENCE: Feature-CGI / pixel-3D materials and sculpt. Not photoreal live-action, not 2D anime linework.";
    case "anime":
      return "MEDIUM SENTENCE: 2D anime line and cel flats. Not photoreal skin, not 3D CGI.";
    case "cartoon":
      return "MEDIUM SENTENCE: Stylized 2D cartoon shapes. Not photoreal, not 3D CGI.";
    case "illustration":
      return "MEDIUM SENTENCE: Illustration pigment or ink. Not a photograph.";
    case "comic":
      return "MEDIUM SENTENCE: Inked graphic-novel treatment. Not photoreal.";
    case "painterly":
      return "MEDIUM SENTENCE: Painterly pigment. Not photoreal, not 3D CGI.";
    case "clay":
      return "MEDIUM SENTENCE: Clay / stop-motion tactile materials. Not smooth photoreal CGI.";
    case "cinematic":
      return "MEDIUM SENTENCE: Photoreal cinema still. Matte unretouched skin, visible pores, no plastic skin, no glamour beauty-filter.";
    default:
      return "MEDIUM SENTENCE: Photoreal matte unretouched skin with visible pores, no smoothing, no plastic skin, no glamour lighting.";
  }
}

function referenceLaw(hasIdentityImage?: boolean): string {
  return [
    "REFERENCE LAW",
    hasIdentityImage
      ? "An identity photo is attached. That photo controls face, hair, body, and current wardrobe. Match that person."
      : "No identity photo attached. Use only CHARACTER IDENTITY text. Do not invent a look-alike.",
    "Any genre moodboard images control medium / materials / lighting grammar only. Never steal their face, hair, or outfit.",
  ].join("\n");
}

export function compileCharacterFromGenreFoundation(
  params: CompileCharacterFoundationsParams = {},
): CompiledCharacterFoundations {
  const genreId = normalizeCharacterGenre(params.genre) || "realistic";
  const option = characterGenreOption(genreId);
  const identity = params.identity || {};
  const identityBlock = formatIdentityBlock(identity);
  const brand = params.brandName?.trim();
  const extra = [
    brand ? `Brand context (not identity): ${brand}` : "",
    params.niche?.trim() ? `Niche context (not identity): ${params.niche.trim()}` : "",
    params.purpose?.trim() ? `Narrative function (not identity): ${params.purpose.trim()}` : "",
    params.directorNotes?.trim() ? `Director notes: ${params.directorNotes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sharedTail = [
    option.mediumLockLine,
    referenceLaw(params.hasIdentityImage),
    identityBlock,
    extra,
    "MASTER RULE: change the identity variables. Keep the engine. Identity is never foundation.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const portraitPrompt = [portraitFoundation(genreId), sharedTail].join("\n\n");
  const sheetLayout = params.layoutStyle === "full_turnaround_multiview" ? "full_turnaround_multiview" : "turnaround_3view";
  const sheetPrompt = [
    sheetFoundation(genreId, sheetLayout),
    params.closeUpPriority
      ? "CLOSE-UP PRIORITY: The frontal medium-bust panel defines primary facial geometry and eye details for all downstream shots."
      : "",
    sharedTail,
    "This sheet owns continuity for future shots. Shot prompts must not redefine face, hair, or wardrobe already locked here.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    genreId,
    genreLabel: option.label,
    mediumLockLine: option.mediumLockLine,
    doNot: option.doNot,
    referenceImages: option.referenceImages,
    identityBlock,
    portraitPrompt,
    sheetPrompt,
  };
}

export function foundationContainsForbiddenIdentity(text: string): boolean {
  const lower = text.toLowerCase();
  return IDENTITY_FORBIDDEN_IN_FOUNDATION.some((needle) => lower.includes(needle));
}

export { IDENTITY_FORBIDDEN_IN_FOUNDATION };
