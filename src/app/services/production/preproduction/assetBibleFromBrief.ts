/**
 * SPARK Preproduction — Asset Bible Planner
 * Derives the required production asset bible (@tags + sheet kinds)
 * from a production brief, characters, beats, and environmental mentions.
 */

import type { Brand, Character, ProductionBrief } from "../../../domain/types";
import { normalizeElementTag, slugify, type ElementRole } from "../elements/productionElements";

export type SheetKind = "character" | "location" | "prop" | "wardrobe_variant";

export interface AssetBibleEntry {
  tag: string; // e.g. "@santiago", "@loc_office", "@prop_recorder"
  role: ElementRole;
  sheetKind: SheetKind;
  label: string;
  notes: string;
  sourceEntityId?: string;
  variantOf?: string; // If wardrobe_variant, the base character tag
}

export interface PlanAssetBibleOptions {
  characters?: Character[] | null;
  brand?: Brand | null;
  heroCharacter?: Character | null;
}

/**
 * Extracts candidate locations, props, and wardrobe variants from text.
 */
function extractMentionKeywords(text: string): {
  locations: string[];
  props: string[];
  hasFlashback: boolean;
  hasChildhood: boolean;
  hasUniformOrSuit: boolean;
} {
  const lower = text.toLowerCase();
  const locations = new Set<string>();
  const props = new Set<string>();

  // Location detection patterns
  const locRegex = /\b(office|cabin|studio|lab|laboratory|corridor|rooftop|warehouse|street|forest|cockpit|chamber|hall|boardroom|lounge|stadium|arena|bathroom|tunnel|courtyard|kitchen|garage|bedroom|gym|auditorium)\b/gi;
  let locMatch: RegExpExecArray | null;
  while ((locMatch = locRegex.exec(lower)) !== null) {
    locations.add(locMatch[1].toLowerCase());
  }

  // Prop / product detection patterns
  const propRegex = /\b(recorder|folio|journal|terminal|phone|device|sword|blade|artifact|briefcase|key|locket|cube|camera|bottle|helmet|perfume|watch|ball|trophy|glass|ring|badge|guitar|bag|jacket|shoe)\b/gi;
  let propMatch: RegExpExecArray | null;
  while ((propMatch = propRegex.exec(lower)) !== null) {
    props.add(propMatch[1].toLowerCase());
  }

  const hasFlashback = /\b(flashback|memory|past|younger|origins|twenty years earlier|years ago)\b/i.test(lower);
  const hasChildhood = /\b(child|childhood|young|kid|boy|girl|elementary)\b/i.test(lower);
  const hasUniformOrSuit = /\b(uniform|suit|combat gear|armor|scrubs|lab coat|tuxedo)\b/i.test(lower);

  return {
    locations: Array.from(locations),
    props: Array.from(props),
    hasFlashback,
    hasChildhood,
    hasUniformOrSuit,
  };
}

/**
 * Plans the required production asset bible (@tags + sheet kinds) from a brief.
 * Pure planner: generates the structured asset catalog without triggering image generation.
 */
export function planAssetBibleFromBrief(
  brief?: ProductionBrief | null,
  options?: PlanAssetBibleOptions
): AssetBibleEntry[] {
  const entries: AssetBibleEntry[] = [];
  const seenTags = new Set<string>();

  const pushEntry = (entry: AssetBibleEntry) => {
    const normTag = normalizeElementTag(entry.tag);
    if (seenTags.has(normTag)) return;
    seenTags.add(normTag);
    entries.push({ ...entry, tag: normTag });
  };

  const brand = options?.brand;
  const hero = options?.heroCharacter || options?.characters?.[0];
  const supportingChars = (options?.characters || []).filter((c) => c.id !== hero?.id);

  // Combine brief text for heuristic extraction
  const allBriefText = [
    brief?.title,
    brief?.visualDirection,
    brief?.hook,
    brief?.scriptOutline,
    ...(brief?.beats || []).map((b) => `${b.spokenLines || ""} ${b.physicalAction || ""} ${b.cameraDirection || ""}`),
  ]
    .filter(Boolean)
    .join(" ");

  const textAnalysis = extractMentionKeywords(allBriefText);

  // 1. Primary Character Sheet
  const heroName = hero?.name?.trim() || brand?.name?.trim() || "Lead Character";
  const heroSlug = slugify(hero?.name) || slugify(brand?.name) || "main_character";
  const heroTag = `@${heroSlug}`;
  pushEntry({
    tag: heroTag,
    role: "character_main",
    sheetKind: "character",
    label: heroName,
    notes: "3-panel grey seamless turnaround: front full-body, back full-body, face close-up. Locked single identity.",
    sourceEntityId: hero?.id,
  });

  // 2. Supporting Characters
  for (const supp of supportingChars) {
    const sName = supp.name?.trim() || "Supporting Character";
    const sSlug = slugify(supp.name) || "support";
    pushEntry({
      tag: `@support_${sSlug}`,
      role: "character_support",
      sheetKind: "character",
      label: sName,
      notes: "Supporting character identity turnaround; distinct silhouette, color palette, and wardrobe.",
      sourceEntityId: supp.id,
    });
  }

  // 3. Wardrobe / Age Variants (e.g. Flashback, Childhood, Uniform)
  if (textAnalysis.hasFlashback || textAnalysis.hasChildhood) {
    const variantLabel = textAnalysis.hasChildhood ? "Childhood / Young" : "Past / Flashback";
    const variantSlug = textAnalysis.hasChildhood ? "childhood" : "flashback";
    pushEntry({
      tag: `@wardrobe_${heroSlug}_${variantSlug}`,
      role: "wardrobe_variant",
      sheetKind: "wardrobe_variant",
      label: `${heroName} (${variantLabel} Variant)`,
      notes: `${variantLabel} appearance sheet: matching bone structure and eye color, adjusted scale and age-appropriate attire.`,
      variantOf: heroTag,
    });
  }
  if (textAnalysis.hasUniformOrSuit) {
    pushEntry({
      tag: `@wardrobe_${heroSlug}_uniform`,
      role: "wardrobe_variant",
      sheetKind: "wardrobe_variant",
      label: `${heroName} (Uniform / Gear Variant)`,
      notes: "Mission / uniform wardrobe variant: identical facial identity, specialized wardrobe and kit.",
      variantOf: heroTag,
    });
  }

  // 4. Locations (from explicit brief fields + analyzed mentions)
  const envDirection = brief?.visualDirection?.trim();
  if (envDirection) {
    const envSlug = slugify(envDirection.split(/[,\s]+/)[0]) || "main_set";
    pushEntry({
      tag: `@loc_${envSlug}`,
      role: "location",
      sheetKind: "location",
      label: envDirection.slice(0, 40),
      notes: "Empty locked set, 3/4 depth angle establishing composition. No people, no crowd.",
    });
  }

  for (const loc of textAnalysis.locations) {
    pushEntry({
      tag: `@loc_${loc}`,
      role: "location",
      sheetKind: "location",
      label: `${loc.charAt(0).toUpperCase() + loc.slice(1)} Environment`,
      notes: "Empty environment plate with clear architectural geometry and 3/4 depth angle. NO PEOPLE.",
    });
  }

  // Fallback default location if none found
  if (!entries.some((e) => e.sheetKind === "location")) {
    pushEntry({
      tag: "@loc_main_set",
      role: "location",
      sheetKind: "location",
      label: "Main Production Set",
      notes: "Primary environment plate, empty of people, 3/4 depth angle for continuity.",
    });
  }

  // 5. Props & Products
  for (const prop of textAnalysis.props) {
    pushEntry({
      tag: `@prop_${prop}`,
      role: "prop",
      sheetKind: "prop",
      label: `Hero ${prop.charAt(0).toUpperCase() + prop.slice(1)}`,
      notes: "Ghost-mannequin / neutral grey product model sheet; no real-world brand IP.",
    });
  }

  return entries;
}

/**
 * Infers matching @tags from scene action, description, or dialogue against the asset bible.
 * Returns undefined if no tags match, allowing subjectType fallback.
 */
export function inferNeededTagsFromScene(
  scene: any,
  bible?: AssetBibleEntry[] | null
): string[] | undefined {
  if (!scene || !bible || !Array.isArray(bible) || bible.length === 0) return undefined;

  const text = [
    scene.shotList,
    scene.physicalAction,
    scene.action,
    scene.visualDescription,
    scene.description,
    scene.spokenLines,
    scene.scriptSnippet,
    scene.cameraDirection,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text.trim()) return undefined;

  const matchedTags = new Set<string>();

  for (const entry of bible) {
    const rawTagWithoutAt = entry.tag.replace(/^@/, "").toLowerCase();
    const labelLower = entry.label.toLowerCase();

    // Direct tag match without prefix
    const keyword = rawTagWithoutAt.replace(/^(loc_|prop_|support_)/, "");
    if (keyword.length >= 3) {
      const kwRegex = new RegExp(`\\b${keyword}\\b`, "i");
      if (kwRegex.test(text)) {
        matchedTags.add(entry.tag);
        continue;
      }
    }

    if (labelLower.length >= 3) {
      const labelWords = labelLower
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !["environment", "hero", "lead", "character", "sheet"].includes(w));
      for (const w of labelWords) {
        if (new RegExp(`\\b${w}\\b`, "i").test(text)) {
          matchedTags.add(entry.tag);
          break;
        }
      }
    }
  }

  return matchedTags.size > 0 ? Array.from(matchedTags) : undefined;
}
