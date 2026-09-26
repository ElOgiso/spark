/**
 * SPARK Production Character Model Sheet Generator
 * Delegates to characterFoundations — CHANGE identity variables, KEEP the sheet engine.
 */

import { slugify } from "./elements/productionElements";
import {
  compileCharacterFoundations,
  type CharacterFoundationInput,
} from "./characterFoundations";

export interface CharacterSheetPromptParams {
  creatorName?: string;
  role?: string;
  brandName?: string;
  niche?: string;
  purpose?: string;
  researchOneLiner?: string;
  genre?: string;
  personality?: string;
  skinTone?: string;
  hairStyle?: string;
  wardrobe?: string;
  directorNotes?: string;
  layoutStyle?: "turnaround_3view" | "full_turnaround_multiview";
  closeUpPriority?: boolean;
  identityImageUrl?: string | null;
  characterSheetUrl?: string | null;
  age?: string;
  gender?: string;
  ethnicity?: string;
  eyeColor?: string;
  build?: string;
}

function toFoundationInput(params: CharacterSheetPromptParams): CharacterFoundationInput {
  return {
    name: params.creatorName,
    role: params.role,
    brandName: params.brandName,
    niche: params.niche,
    purpose: params.purpose,
    genre: params.genre,
    personality: params.personality,
    skinTone: params.skinTone,
    hairStyle: params.hairStyle,
    wardrobe: params.wardrobe,
    directorNotes: [params.directorNotes, params.researchOneLiner].filter(Boolean).join("\n") || undefined,
    identityImageUrl: params.identityImageUrl,
    characterSheetUrl: params.characterSheetUrl,
    age: params.age,
    gender: params.gender,
    ethnicity: params.ethnicity,
    eyeColor: params.eyeColor,
    build: params.build,
  };
}

export function buildProductionCharacterSheetPrompt(params: CharacterSheetPromptParams): string {
  const compiled = compileCharacterFoundations(toFoundationInput(params));
  const name = params.creatorName?.trim() || (params.role === "support" ? "Supporting Character" : "Lead Host");
  const isSupport = params.role === "support" || String(params.role || "").toLowerCase().includes("support");
  const elementTag = isSupport
    ? `@support_${slugify(params.creatorName) || "character"}`
    : `@${slugify(params.creatorName) || "main_character"}`;

  if (params.layoutStyle === "full_turnaround_multiview") {
    return [
      compiled.mediumLock,
      compiled.identityLock,
      `ELEMENT TAG: ${elementTag}`,
      `CHARACTER: ${name}`,
      `LAYOUT ON ONE IMAGE:
- Top: name + role + 3 palette swatches
- Row: FRONT, 3/4 FRONT, LEFT, RIGHT, BACK, 3/4 REAR, same height, neutral gray
- Right: face close-up + 2 costume details
- Bottom-left: 8 labeled expressions
- Bottom-right: 4 brand-safe poses (presenting, pointing, reacting, standing) — not random movie stunts`,
      params.closeUpPriority
        ? "CLOSE-UP PRIORITY: The face close-up panel defines primary facial geometry and eye details for all downstream shots."
        : "",
      "LOCKS: Exactly ONE single human identity across all panels. Identical bone structure, face, hair, skin tone, outfit, and colors in every cell.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    `ELEMENT TAG: ${elementTag}`,
    compiled.sheetPrompt,
    params.closeUpPriority
      ? "CLOSE-UP PRIORITY: The face close-up panel defines primary facial geometry and eye details for all downstream shots."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildProductionCharacterPortraitPrompt(params: CharacterSheetPromptParams): string {
  return compileCharacterFoundations(toFoundationInput(params)).portraitPrompt;
}

export function resolveCharacterFoundation(params: CharacterSheetPromptParams) {
  return compileCharacterFoundations(toFoundationInput(params));
}
