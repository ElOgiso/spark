/**
 * Derives locked production references for a production in Creative Review.
 * Surfaces character sheet, location plate(s), prop sheets, and wardrobe sheets
 * from brief/production.generatedAssets.
 */

export interface LockedProductionReference {
  id: string;
  label: string;
  url: string;
  role: "character" | "location" | "prop" | "wardrobe";
  tag?: string;
}

export function deriveLockedProductionReferences(params: {
  activeProd?: any;
  brief?: any;
  character?: any;
}): LockedProductionReference[] {
  const { activeProd, brief, character } = params;
  const refs: LockedProductionReference[] = [];
  const seenUrls = new Set<string>();

  const pushRef = (
    id: string,
    label: string,
    url: string | undefined,
    role: "character" | "location" | "prop" | "wardrobe",
    tag?: string
  ) => {
    if (!url || typeof url !== "string" || url.trim().length < 8) return;
    const cleanUrl = url.trim();
    if (seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);
    refs.push({ id, label, url: cleanUrl, role, tag });
  };

  // 1. Character: characterSheetUrl || imageUrl || avatarUrl
  const isFaceless = String(
    brief?.contentFormat ||
    activeProd?.contentFormat ||
    activeProd?.format ||
    brief?.format ||
    ""
  ).toLowerCase().includes("faceless");

  const charUrl =
    brief?.characterSheetUrl ||
    activeProd?.characterSheetUrl ||
    brief?.generatedAssets?.characterSheetUrl ||
    activeProd?.generatedAssets?.characterSheetUrl ||
    brief?.imageUrl ||
    activeProd?.imageUrl ||
    brief?.avatarUrl ||
    activeProd?.avatarUrl ||
    (!isFaceless ? (character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl) : undefined);

  if (charUrl) {
    pushRef("char-sheet", "Character", charUrl, "character");
  }

  // 2. Location: generatedAssets.locationPlates values + locationPlateUrl
  const locPlates = {
    ...((activeProd?.generatedAssets as any)?.locationPlates || {}),
    ...((brief?.generatedAssets as any)?.locationPlates || {}),
  } as Record<string, string>;
  Object.entries(locPlates).forEach(([tag, url]) => {
    const displayLabel = tag.startsWith("@") ? tag : `@${tag}`;
    pushRef(`loc-${tag}`, displayLabel || "Location", url, "location", displayLabel);
  });
  const singleLoc =
    brief?.locationPlateUrl ||
    activeProd?.locationPlateUrl;
  if (singleLoc) {
    pushRef("loc-plate", "Location", singleLoc, "location");
  }

  // 3. Props: Object.entries(generatedAssets.propSheets || {})
  const propSheets = {
    ...((activeProd?.generatedAssets as any)?.propSheets || {}),
    ...((brief?.generatedAssets as any)?.propSheets || {}),
  } as Record<string, string>;
  Object.entries(propSheets).forEach(([tag, url]) => {
    const displayLabel = tag.startsWith("@") ? tag : `@${tag}`;
    pushRef(`prop-${tag}`, displayLabel, url, "prop", displayLabel);
  });

  // 4. Wardrobe: Object.entries(generatedAssets.wardrobeSheets || {})
  const wardrobeSheets = {
    ...((activeProd?.generatedAssets as any)?.wardrobeSheets || {}),
    ...((brief?.generatedAssets as any)?.wardrobeSheets || {}),
  } as Record<string, string>;
  Object.entries(wardrobeSheets).forEach(([tag, url]) => {
    const displayLabel = tag.startsWith("@") ? tag : `@${tag}`;
    pushRef(`wardrobe-${tag}`, displayLabel, url, "wardrobe", displayLabel);
  });

  return refs;
}
