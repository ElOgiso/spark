/**
 * Generates deterministic prompts for creating an empty establishing Set / Location Plate
 * matching the brand, genre, and format settings without including any human characters.
 */
export function buildLocationPlatePrompt(params: {
  brandName?: string;
  niche?: string;
  genre?: string;
  contentFormat?: string;
  environmentDescription?: string;
}): string {
  const {
    brandName = "Brand",
    niche = "Content Creation",
    genre = "Cinematic / Realistic",
    contentFormat = "story",
    environmentDescription,
  } = params;

  const env =
    environmentDescription ||
    `a sophisticated, premium establishing production environment and architectural set designed for ${brandName} (${niche})`;

  return `[LOCKED LOCATION PLATE — EMPTY ESTABLISHING SET]
GENRE & STYLE: ${genre}.
CONTENT FORMAT: ${contentFormat.toUpperCase()}.
ENVIRONMENT SET: ${env}.
LIGHTING & OPTICS: Coherent volumetric key and ambient lighting, pristine architectural spatial depth, cinematic lens optics, realistic textures, zero AI artifacts, clean studio composition.

CRITICAL LOCATION LAWS:
- EMPTY SET ONLY. ABSOLUTELY NO CHARACTERS, NO PEOPLE, NO FACES, NO ACTORS, NO HOSTS, NO HUMAN FIGURES, NO SILHOUETTES.
- Pure spatial/architectural establishing room for environment continuity lock.
- NO TEXT, NO LETTERS, NO WATERMARKS, NO GRAPHICS, NO SPLIT SCREEN, NO MULTI-PANEL GRID.
- Single full-bleed photographic wide plate frame.`.trim();
}
