/**
 * Location Plate Prompt Compiler
 *
 * Compiles structured location requirements into generation prompts.
 * Empty locked environments (NO PEOPLE) for continuity plates.
 */

export type LocationPlatePromptInput = {
  brandName?: string;
  niche?: string;
  genre?: string;
  contentFormat?: string;
  environmentDescription?: string;
  /** Structured production requirement fields */
  locationName?: string;
  geography?: string;
  architecture?: string;
  spatialLayout?: string;
  timeOfDay?: string;
  weather?: string;
  lighting?: string;
  palette?: string;
  continuityFeatures?: string[];
  visualMedium?: string;
  narrativePurpose?: string;
  emptyEnvironment?: boolean;
};

/**
 * Compile a locked location plate prompt from structured production context.
 * Prefer structured fields over free-form environmentDescription when both exist.
 */
export function buildLocationPlatePrompt(params: LocationPlatePromptInput): string {
  const empty = params.emptyEnvironment !== false;
  const name = (params.locationName || '').trim();
  const geography = (params.geography || '').trim();
  const architecture = (params.architecture || '').trim();
  const spatial = (params.spatialLayout || '').trim();
  const timeOfDay = (params.timeOfDay || '').trim();
  const weather = (params.weather || '').trim();
  const lighting = (params.lighting || '').trim();
  const palette = (params.palette || '').trim();
  const medium = (params.visualMedium || '').trim();
  const purpose = (params.narrativePurpose || '').trim();
  const continuity = (params.continuityFeatures || []).filter(Boolean);
  const fallbackEnv = (params.environmentDescription || '').trim();

  const placeLine = [
    name ? `LOCATION: ${name}` : '',
    geography ? `GEOGRAPHY: ${geography}` : '',
    architecture ? `ARCHITECTURE: ${architecture}` : '',
    spatial ? `SPATIAL LAYOUT: ${spatial}` : '',
    fallbackEnv && !name ? `ENVIRONMENT: ${fallbackEnv}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const conditionLine = [
    timeOfDay ? `TIME OF DAY: ${timeOfDay}` : '',
    weather ? `WEATHER: ${weather}` : '',
    lighting ? `LIGHTING: ${lighting}` : '',
    palette ? `COLOR LANGUAGE: ${palette}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const mediumGuidance = mediumGuidanceFor(medium);

  return [
    'LOCKED LOCATION PLATE — empty environment reference for production continuity.',
    placeLine,
    conditionLine,
    purpose ? `NARRATIVE PURPOSE: ${purpose}` : '',
    continuity.length ? `CONTINUITY LANDMARKS: ${continuity.join('; ')}` : '',
    mediumGuidance,
    params.brandName ? `Brand world: ${params.brandName}` : '',
    params.niche ? `Niche context: ${params.niche}` : '',
    params.genre ? `Genre: ${params.genre}` : '',
    params.contentFormat ? `Content format: ${params.contentFormat}` : '',
    empty
      ? 'NO PEOPLE. No faces. No crowd. Empty locked set for reuse across shots.'
      : 'Minimal figures only if narratively essential; prefer empty plate.',
    'Establish architecture, spatial layout, materials, and camera-relevant landmarks.',
    'Single coherent visual treatment. Photoreal or stylized per medium — do not mix media.',
    'Do not invent competing locations. One place, one state.',
  ]
    .filter(Boolean)
    .join('\n');
}

function mediumGuidanceFor(medium: string): string {
  const m = medium.toLowerCase();
  if (m.includes('anime')) {
    return 'VISUAL MEDIUM: Anime environment language — line, color flats, stylized architecture consistent with anime production design.';
  }
  if (m.includes('wuxia')) {
    return 'VISUAL MEDIUM: Wuxia period environment — traditional architecture, landscape scale, costume-era materials, martial-world atmosphere.';
  }
  if (m.includes('3d') || m.includes('cgi') || m.includes('cg')) {
    return 'VISUAL MEDIUM: 3D/CG environment — coherent materials, render lighting, digital production design.';
  }
  if (m.includes('cinematic')) {
    return 'VISUAL MEDIUM: Cinematic live-action photography — professional lighting design, production design, lens-aware space.';
  }
  if (m.includes('realistic') || m.includes('live')) {
    return 'VISUAL MEDIUM: Photorealistic live-action — physically plausible materials and lighting.';
  }
  return medium ? `VISUAL MEDIUM: ${medium}` : '';
}
