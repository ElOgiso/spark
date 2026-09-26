/**
 * SPARK Production Character Model Sheet Generator
 * Creates professional multi-view character design bibles used for zero-drift
 * visual locking in video and image generation pipelines.
 *
 * Identity is never foundation. Compile = identity-free engine + genre medium
 * lock + user identity slots. Sample look-alikes do not live in this file.
 */

import { slugify } from "./elements/productionElements";
import {
  compileCharacterFromGenreFoundation,
  type CharacterIdentityVariables,
} from "./compileCharacterFromGenreFoundation";

export interface CharacterSheetPromptParams {
  creatorName?: string;
  role?: string;
  brandName?: string;
  niche?: string;
  purpose?: string;
  researchOneLiner?: string;
  genre?: string; // Realistic | Cinematic | Anime | 3D | ...
  personality?: string;
  skinTone?: string;
  hairStyle?: string;
  wardrobe?: string;
  directorNotes?: string;
  layoutStyle?: "turnaround_3view" | "full_turnaround_multiview";
  closeUpPriority?: boolean;
  identity?: CharacterIdentityVariables;
  hasIdentityImage?: boolean;
}

function identityFromLegacyParams(params: CharacterSheetPromptParams): CharacterIdentityVariables {
  return {
    name: params.creatorName,
    role: params.role,
    personality: params.personality,
    skin: params.skinTone,
    hair: params.hairStyle,
    wardrobe: params.wardrobe,
    ...(params.identity || {}),
  };
}

export function buildProductionCharacterSheetPrompt(params: CharacterSheetPromptParams): string {
  const name = params.creatorName?.trim() || (params.role === "support" ? "Supporting Character" : "Lead Host");
  const brandName = params.brandName?.trim() || "SPARK";
  const isSupport = params.role === "support" || String(params.role || "").toLowerCase().includes("support");
  const elementTag = isSupport
    ? `@support_${slugify(params.creatorName) || "character"}`
    : `@${slugify(params.creatorName) || "main_character"}`;

  const compiled = compileCharacterFromGenreFoundation({
    genre: params.genre,
    identity: identityFromLegacyParams(params),
    brandName,
    niche: params.niche,
    purpose: params.purpose,
    directorNotes: [params.directorNotes, params.researchOneLiner].filter(Boolean).join("\n") || undefined,
    hasIdentityImage: params.hasIdentityImage,
    layoutStyle: params.layoutStyle === "full_turnaround_multiview" ? "full_turnaround_multiview" : "turnaround_3view",
    closeUpPriority: params.closeUpPriority,
  });

  return [
    `ELEMENT TAG: ${elementTag}`,
    `STYLE: ${compiled.genreLabel} consistent with brand ${brandName}.`,
    compiled.mediumLockLine,
    compiled.sheetPrompt,
    "LOCKS: Exactly ONE single human identity across all panels. Identical bone structure, face, hair, skin tone, outfit, and colors in every cell. No collage of different people.",
    params.hasIdentityImage ? "If user uploaded a face, match that face." : "No uploaded face — use only CHARACTER IDENTITY text. Do not invent a look-alike.",
    "This sheet owns identity — shot prompts must not redefine face/hair/wardrobe details already locked here.",
  ].join("\n");
}

export function buildProductionCharacterPortraitPrompt(params: CharacterSheetPromptParams): string {
  const compiled = compileCharacterFromGenreFoundation({
    genre: params.genre,
    identity: identityFromLegacyParams(params),
    brandName: params.brandName,
    niche: params.niche,
    purpose: params.purpose,
    directorNotes: params.directorNotes,
    hasIdentityImage: params.hasIdentityImage,
    layoutStyle: "portrait_9x16",
  });
  return compiled.portraitPrompt;
}
