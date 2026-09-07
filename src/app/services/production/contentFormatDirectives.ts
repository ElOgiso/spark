/**
 * Canonical contentFormat directives for the live production spine.
 * Snapshot / formatSettings own the enum — never invent genre-as-format.
 */

import type { Character, ContentFormat } from "../../domain/types";
import { getEffectiveContentFormat, type EffectiveContentFormat } from "./characterSheetGate";

export type CanonicalContentFormat = EffectiveContentFormat;

/** Normalize any string to the four live enums (no tutorial/documentary leakage). */
export function normalizeCanonicalContentFormat(
  raw?: string | null
): CanonicalContentFormat {
  return getEffectiveContentFormat({
    formatSettings: { contentFormat: raw || undefined },
  });
}

export function resolveProductionContentFormat(params: {
  production?: any;
  brief?: any;
  brand?: any;
  formatSettings?: any;
  settingsSnapshot?: { contentFormat?: string } | null;
  specMeta?: { contentFormat?: string } | null;
}): CanonicalContentFormat {
  const fromSnapshot = params.settingsSnapshot?.contentFormat;
  const fromSpec = params.specMeta?.contentFormat;
  if (fromSnapshot) return normalizeCanonicalContentFormat(fromSnapshot);
  if (fromSpec) return normalizeCanonicalContentFormat(fromSpec);
  return getEffectiveContentFormat({
    production: params.production,
    brief: params.brief,
    brand: params.brand,
    formatSettings: params.formatSettings,
  });
}

/** Compiler-owned format law injected into still / motion / sheet / thumb prompts. */
export function contentFormatDirective(format: CanonicalContentFormat): string {
  switch (format) {
    case "faceless":
      return [
        "CONTENT FORMAT: Faceless / VO-led.",
        "Prefer B-roll, product, UI, data, and empty-set framing.",
        "Do not invent a host face unless this beat explicitly requires a locked character subject.",
        "Visuals illustrate spoken narration — no presenter-facing talk-to-camera default.",
      ].join(" ");
    case "story":
      return [
        "CONTENT FORMAT: Story / multi-character narrative.",
        "Cinematic continuity across beats; lead character identity locked when subject is main/support.",
        "Allow environment and insert beats without forcing a presenter pose.",
      ].join(" ");
    case "anime":
      return [
        "CONTENT FORMAT: Anime / stylized narrative.",
        "MEDIUM LOCK: anime illustration line, cel shading, non-photoreal rendering.",
        "Do not render live-action photoreal faces or documentary realism.",
        "Lead character design stays consistent across panels when subject is main/support.",
      ].join(" ");
    case "host":
    default:
      return [
        "CONTENT FORMAT: Host / on-camera presenter.",
        "Primary subject is the locked host when beat subject is main.",
        "Identity must match the character sheet reference.",
      ].join(" ");
  }
}

export function formatSubjectRoleLabel(
  format: CanonicalContentFormat,
  resolvedSubject: "main" | "support" | "insert" | "set" | string
): { nameFallback: string; styleFallback: string; roleLine: string } {
  if (resolvedSubject === "support") {
    return {
      nameFallback: "Support Character",
      styleFallback: "Supporting Role",
      roleLine: "Supporting subject",
    };
  }
  if (format === "anime") {
    return {
      nameFallback: "Anime Lead",
      styleFallback: "Anime character design",
      roleLine: "Anime lead",
    };
  }
  if (format === "story") {
    return {
      nameFallback: "Lead Character",
      styleFallback: "Narrative lead",
      roleLine: "Lead character",
    };
  }
  if (format === "faceless") {
    return {
      nameFallback: "Narrator subject",
      styleFallback: "VO-led visual",
      roleLine: "Optional identity subject",
    };
  }
  return {
    nameFallback: "Host",
    styleFallback: "Executive Presenter",
    roleLine: "Primary host",
  };
}

/**
 * Resolve live beat subject without blanket-faceless override.
 * Honors stamped beat subject (hook/CTA may stay main on faceless when sheet exists).
 */
export function resolveLiveBeatSubject(params: {
  contentFormat: CanonicalContentFormat;
  rawSubject?: string;
  cameraDirection?: string;
  visualDescription?: string;
}): "main" | "support" | "insert" | "set" {
  const format = params.contentFormat;
  const raw = String(params.rawSubject || "").toLowerCase().trim();
  const cam = String(params.cameraDirection || "").toLowerCase();
  const desc = String(params.visualDescription || "").toLowerCase();

  const isSet =
    raw === "set" ||
    raw === "environment" ||
    cam.includes("establishing shot") ||
    desc.includes("empty set") ||
    desc.includes("empty room") ||
    desc.includes("establishing shot of the studio") ||
    desc.includes("wide shot of the set");

  const isInsertHint =
    raw === "insert" ||
    raw === "product" ||
    cam.includes("close up on hands") ||
    cam.includes("insert shot") ||
    desc.includes("close-up of the screen") ||
    desc.includes("product display");

  const isSupport =
    raw === "support" || raw === "supporting" || raw.includes("support");

  if (isSet) return "set";
  if (isInsertHint) return "insert";
  if (isSupport && format !== "faceless") return "support";
  if (raw === "main" || raw === "host" || raw === "lead") return "main";

  // Faceless default: insert when beat did not stamp a subject
  if (format === "faceless") return "insert";
  return "main";
}

export function voiceIdentityLockBlock(params: {
  contentFormat: CanonicalContentFormat;
  character?: Character | null;
  characterRefUrl?: string;
}): string {
  const format = params.contentFormat;
  const charName = params.character?.name;
  const charStyle = params.character?.style;
  const traits = (params.character?.traits || []).join(", ");
  const ref = params.characterRefUrl ? ` Reference Sheet: ${params.characterRefUrl}` : "";

  if (format === "faceless") {
    return `VOICE / FORMAT (FACELESS): Narration-led delivery. Do not require an on-camera host presence.${
      charName ? ` Optional brand voice persona: "${charName}".` : ""
    }`;
  }
  if (format === "anime") {
    return `CHARACTER (LOCKED · ANIME): Lead "${charName || "Anime Lead"}" (Style: ${
      charStyle || "Anime character design"
    }${traits ? `, Traits: ${traits}` : ""}).${ref}`;
  }
  if (format === "story") {
    return `CHARACTER (LOCKED · STORY): Lead "${charName || "Lead Character"}" (Style: ${
      charStyle || "Narrative lead"
    }${traits ? `, Traits: ${traits}` : ""}).${ref}`;
  }
  return `CHARACTER (LOCKED): Primary subject is "${charName || "Host"}" (Style: ${
    charStyle || "Executive Presenter"
  }${traits ? `, Traits: ${traits}` : ""}).${ref}`;
}

export function thumbnailSubjectLock(params: {
  contentFormat: CanonicalContentFormat;
  characterName?: string;
  characterStyle?: string;
}): string {
  const labels = formatSubjectRoleLabel(params.contentFormat, "main");
  const name = params.characterName || labels.nameFallback;
  const style = params.characterStyle || labels.styleFallback;

  if (params.contentFormat === "faceless") {
    return `SUBJECT LOCK: Faceless thumbnail — hero object, metric, or curiosity visual. NO invented host face. Text and composition carry the hook.`;
  }
  if (params.contentFormat === "anime") {
    return `CHARACTER LOCK: Anime lead "${name}" (${style}). Stylized anime rendering; facial design matches sheet; not photoreal.`;
  }
  if (params.contentFormat === "story") {
    return `CHARACTER LOCK: Lead "${name}" (${style}). Facial structure, hair, and wardrobe match the character sheet.`;
  }
  return `CHARACTER LOCK: Primary subject "${name}" (${style}). Facial structure, hair, and wardrobe strictly identical to character sheet reference.`;
}
