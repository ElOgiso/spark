/**
 * SPARK Production Elements System
 * Provider-agnostic asset @tagging registry.
 * Maps durable production assets (characters, sets, props) to stable @tags,
 * resolving them into ordered reference URLs and machine-readable prompt headers.
 */

import type { Brand, Character } from "../../../domain/types";
import type { AssetBibleEntry } from "../preproduction/assetBibleFromBrief";

export type ElementRole =
  | "character_main"
  | "character_support"
  | "location"
  | "prop"
  | "continuity"
  | "wardrobe_variant";

export interface ProductionElement {
  tag: string; // "@eduardo" — normalized lowercase slug
  role: ElementRole;
  label: string; // Human name
  url: string; // Durable public HTTPS or data URI
  entityId?: string; // Character id / brand id / asset id
  description?: string; // Short binding descriptor for prompt headers
}

export type PropUrlInput = string | { url: string; name?: string; tag?: string };
export type WardrobeVariantInput = string | { url: string; name?: string; tag?: string; variantOf?: string };

export interface BuildElementPackParams {
  character?: Character | null;
  supportCharacter?: Character | null;
  characters?: Character[] | null;
  brand?: Brand | null;
  locationPlateUrl?: string | null;
  directorIdentityUrls?: string[] | null;
  directorSupportUrls?: string[] | null;
  directorPropUrl?: string | null;
  propUrls?: PropUrlInput[] | null;
  wardrobeVariantUrls?: WardrobeVariantInput[] | null;
  assetBible?: AssetBibleEntry[] | null;
}

function isValidMediaUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false;
  const t = url.trim();
  return t.length >= 8 && (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:"));
}

/**
 * Normalizes an element tag to @slug (lowercase, underscores, no special characters).
 * e.g. "Eduardo" -> "@eduardo", "@Loc Cabin!" -> "@loc_cabin"
 */
export function normalizeElementTag(raw: string): string {
  if (!raw || typeof raw !== "string") return "@element";
  let s = raw.trim().toLowerCase();
  if (s.startsWith("@")) {
    s = s.slice(1);
  }
  s = s.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return s ? `@${s}` : "@element";
}

export function slugify(text?: string | null): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Builds an ordered, deduplicated pack of ProductionElements for the production.
 * Priority: character_main -> character_support -> location -> prop -> wardrobe_variant -> continuity
 */
export function buildProductionElementPack(params: BuildElementPackParams): ProductionElement[] {
  const elements: ProductionElement[] = [];
  const seenUrls = new Set<string>();

  const pushElement = (
    url: string | undefined | null,
    role: ElementRole,
    rawTag: string,
    label: string,
    entityId?: string,
    description?: string
  ) => {
    if (!isValidMediaUrl(url)) return;
    const trimmed = url.trim();
    if (seenUrls.has(trimmed)) return;
    seenUrls.add(trimmed);
    elements.push({
      tag: normalizeElementTag(rawTag),
      role,
      label,
      url: trimmed,
      entityId,
      description: description || `${label} (${role.replace("_", " ")})`,
    });
  };

  const bible = params.assetBible || [];
  const bibleMain = bible.find((b) => b.role === "character_main" || b.sheetKind === "character");
  const bibleLoc = bible.find((b) => b.role === "location" || b.sheetKind === "location");
  const bibleProps = bible.filter((b) => b.role === "prop" || b.sheetKind === "prop");
  const bibleWardrobes = bible.filter((b) => b.role === "wardrobe_variant" || b.sheetKind === "wardrobe_variant");

  // a) Main character (Spec Director masters -> character sheet -> extra sheets -> image/avatar)
  const mainChar = params.character;
  const mainName = bibleMain?.label || mainChar?.name?.trim() || "Main Character";
  const mainSlug = slugify(mainChar?.name) || "main_character";
  const mainTag = bibleMain?.tag || `@${mainSlug}`;

  for (const url of params.directorIdentityUrls || []) {
    pushElement(url, "character_main", mainTag, mainName, mainChar?.id, "character identity sheet (face/wardrobe lock)");
  }
  if (mainChar?.characterSheetUrl) {
    pushElement(mainChar.characterSheetUrl, "character_main", mainTag, mainName, mainChar.id, "character identity sheet (face/wardrobe lock)");
  }
  const sheetList = (mainChar as any)?.sheet_image_urls;
  if (Array.isArray(sheetList)) {
    for (const url of sheetList) {
      pushElement(url, "character_main", mainTag, mainName, mainChar?.id, "character identity reference");
    }
  }
  if (mainChar?.imageUrl || mainChar?.avatarUrl) {
    pushElement(mainChar.imageUrl || mainChar.avatarUrl, "character_main", mainTag, mainName, mainChar?.id, "character appearance reference");
  }

  // b) Support characters (director support -> explicit support -> characters list)
  for (const url of params.directorSupportUrls || []) {
    const suppSlug = slugify(params.supportCharacter?.name) || "support";
    pushElement(url, "character_support", `@support_${suppSlug}`, params.supportCharacter?.name || "Support Character", params.supportCharacter?.id, "supporting character identity sheet");
  }

  const supportList: Character[] = [];
  if (params.supportCharacter) supportList.push(params.supportCharacter);
  if (Array.isArray(params.characters)) {
    for (const c of params.characters) {
      if (c && c.id !== mainChar?.id && !supportList.some((s) => s.id === c.id)) {
        supportList.push(c);
      }
    }
  }

  for (const supp of supportList) {
    const sName = supp.name?.trim() || "Support Character";
    const sSlug = slugify(supp.name) || "support";
    const bibleSupp = bible.find(
      (b) =>
        (b.sourceEntityId && b.sourceEntityId === supp.id) ||
        (supp.name && b.label.toLowerCase() === supp.name.toLowerCase()) ||
        (supp.name && b.tag.toLowerCase().includes(slugify(supp.name)))
    );
    const sTag = bibleSupp?.tag || `@support_${sSlug}`;
    const sLabel = bibleSupp?.label || sName;

    if (supp.characterSheetUrl) {
      pushElement(supp.characterSheetUrl, "character_support", sTag, sLabel, supp.id, "supporting character identity sheet");
    }
    const suppSheets = (supp as any)?.sheet_image_urls;
    if (Array.isArray(suppSheets)) {
      for (const url of suppSheets) {
        pushElement(url, "character_support", sTag, sLabel, supp.id, "supporting character reference");
      }
    }
    if (supp.imageUrl || supp.avatarUrl) {
      pushElement(supp.imageUrl || supp.avatarUrl, "character_support", sTag, sLabel, supp.id, "supporting character appearance reference");
    }
  }

  // c) Location plate (explicit plate -> brand plate)
  const plateUrl =
    params.locationPlateUrl ||
    params.brand?.locationPlateUrl ||
    (params.brand as any)?.settings?.locationPlateUrl ||
    (params.brand as any)?.settings?.location_plate_url;
  if (plateUrl) {
    const brandName = params.brand?.name?.trim();
    const locSlug = slugify(brandName) ? `loc_${slugify(brandName)}` : "location_plate";
    const locTag = bibleLoc?.tag || `@${locSlug}`;
    const locLabel = bibleLoc?.label || "Location Plate";
    pushElement(plateUrl, "location", locTag, locLabel, params.brand?.id, "location plate (set lock)");
  }

  // d) Props / Products
  if (params.directorPropUrl) {
    const heroProp = bibleProps[0];
    const pTag = heroProp?.tag || "@prop_hero";
    const pLabel = heroProp?.label || "Director Hero Prop / Product";
    pushElement(params.directorPropUrl, "prop", pTag, pLabel, undefined, "product / prop design lock");
  }
  if (Array.isArray(params.propUrls)) {
    params.propUrls.forEach((item, i) => {
      const url = typeof item === "string" ? item : item?.url;
      const explicitTag = typeof item === "object" ? item?.tag : undefined;
      const explicitName = typeof item === "object" ? item?.name : undefined;

      // Find matching bible prop by explicit tag, name, or slug
      const matchedBibleProp =
        (explicitTag && bibleProps.find((p) => p.tag.toLowerCase() === explicitTag.toLowerCase())) ||
        (explicitName &&
          bibleProps.find(
            (p) =>
              p.label.toLowerCase().includes(explicitName.toLowerCase()) ||
              p.tag.toLowerCase().includes(slugify(explicitName))
          )) ||
        undefined;

      const offset = params.directorPropUrl ? 1 : 0;
      const fallbackBibleProp = bibleProps[i + offset];
      const pTag = matchedBibleProp?.tag || fallbackBibleProp?.tag || (explicitTag ? normalizeElementTag(explicitTag) : `@prop_${i + 1}`);
      const pLabel = matchedBibleProp?.label || fallbackBibleProp?.label || explicitName || `Product / Prop ${i + 1}`;
      pushElement(url, "prop", pTag, pLabel, undefined, "product / prop design reference");
    });
  }

  // e) Wardrobe variants
  if (Array.isArray(params.wardrobeVariantUrls)) {
    params.wardrobeVariantUrls.forEach((item, i) => {
      const url = typeof item === "string" ? item : item?.url;
      const explicitTag = typeof item === "object" ? item?.tag : undefined;
      const explicitName = typeof item === "object" ? item?.name : undefined;

      const matchedBibleW =
        (explicitTag && bibleWardrobes.find((w) => w.tag.toLowerCase() === explicitTag.toLowerCase())) ||
        (explicitName &&
          bibleWardrobes.find(
            (w) =>
              w.label.toLowerCase().includes(explicitName.toLowerCase()) ||
              w.tag.toLowerCase().includes(slugify(explicitName))
          )) ||
        undefined;

      const fallbackBibleW = bibleWardrobes[i];
      const wTag = matchedBibleW?.tag || fallbackBibleW?.tag || (explicitTag ? normalizeElementTag(explicitTag) : `@wardrobe_${i + 1}`);
      const wLabel = matchedBibleW?.label || fallbackBibleW?.label || explicitName || `Wardrobe Variant ${i + 1}`;
      pushElement(url, "wardrobe_variant", wTag, wLabel, undefined, "wardrobe variant reference");
    });
  }

  return elements;
}

/**
 * Resolves the ordered subset of elements needed for a specific shot.
 * If neededTags is provided and non-empty, matches by @tag.
 * Otherwise, falls back to subjectType defaults:
 *   main    -> character_main, location
 *   support -> character_support, location (fallback to main if no support)
 *   set     -> location
 *   insert  -> prop, location
 */
export function resolveElementsForShot(
  pack: ProductionElement[],
  neededTags?: string[] | null,
  subjectType?: string
): ProductionElement[] {
  if (!pack || pack.length === 0) return [];

  if (Array.isArray(neededTags) && neededTags.length > 0) {
    const normalized = neededTags.map(normalizeElementTag);
    const resolved: ProductionElement[] = [];
    const seenUrls = new Set<string>();

    for (const tag of normalized) {
      const match = pack.find((e) => {
        if (e.tag === tag) return true;
        if (
          (tag === "@loc_plate" || tag === "@location_plate") &&
          (e.tag === "@loc_plate" || e.tag === "@location_plate" || e.role === "location")
        ) {
          return true;
        }
        if (
          (tag === "@main" || tag === "@main_character") &&
          (e.tag === "@main" || e.tag === "@main_character" || e.role === "character_main")
        ) {
          return true;
        }
        return false;
      });
      if (match && !seenUrls.has(match.url)) {
        seenUrls.add(match.url);
        resolved.push(match);
      }
    }
    if (resolved.length > 0) return resolved;
  }

  // Subject-based defaults
  const sType = (subjectType || "main").toLowerCase();
  const seenUrls = new Set<string>();
  const pick = (role: ElementRole): ProductionElement[] => {
    return pack.filter((e) => {
      if (e.role === role && !seenUrls.has(e.url)) {
        seenUrls.add(e.url);
        return true;
      }
      return false;
    });
  };

  if (sType === "set" || sType === "establishing" || sType === "environment") {
    return pick("location");
  }

  if (sType === "insert" || sType === "product" || sType === "b-roll") {
    const props = pick("prop");
    const locs = pick("location");
    return [...props, ...locs];
  }

  if (sType === "support" || sType === "supporting") {
    const supports = pick("character_support");
    const locs = pick("location");
    if (supports.length > 0) {
      return [...supports, ...locs];
    }
    // Fall back to main if no support character element exists
    const mains = pick("character_main");
    return [...mains, ...locs];
  }

  // Default: main
  const mains = pick("character_main");
  const locs = pick("location");
  const props = pick("prop");
  return [...mains, ...locs, ...props];
}

/**
 * Formats a clean, machine-readable ELEMENT BINDING header block for motion prompts.
 * Example:
 * ELEMENT BINDING:
 * @eduardo = character identity sheet (face/wardrobe lock)
 * @loc_cabin = location plate (set lock)
 * IMAGE 1 = this shot’s storyboard still (first frame — animate only)
 */
export function formatElementBindingHeader(
  elements: ProductionElement[],
  firstFrameLabel = "this shot’s storyboard still (first frame). Animate only. Do not restyle."
): string {
  const lines: string[] = ["ELEMENT BINDING:"];
  for (const el of elements) {
    lines.push(`${el.tag} = ${el.description || el.label}`);
  }
  lines.push(`IMAGE 1 = ${firstFrameLabel}`);
  return lines.join("\n");
}
