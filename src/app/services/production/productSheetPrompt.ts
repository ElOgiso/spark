/**
 * SPARK Production Product & Prop Model Sheet Generator
 * Creates professional multi-view product/prop design bibles (turnaround, material callouts, detail close-ups, in-hand / in-use angles)
 * used for zero-drift visual locking across scenes in video and image generation pipelines.
 */

export interface ProductSheetPromptParams {
  productName?: string;
  brandName?: string;
  category?: string; // Tech | Apparel | Beverage | Hardware | Cosmetic | Prop | Artifact
  description?: string;
  materials?: string[];
  colorPalette?: string[];
  keyFeatures?: string[];
  dimensionsOrFormFactor?: string;
  brandingOrLogos?: string;
  genre?: string; // Realistic | Cinematic | Industrial Design Render | 3D | Minimalist
  usageContext?: string;
  directorNotes?: string;
}

function mediumProductStyleDirective(genre: string): string {
  const g = genre.toLowerCase();
  if (g.includes("anime")) {
    return "MEDIUM LOCK: Clean anime prop design — consistent line weight, defined cel shading, accurate anime scale. Do not mix photoreal live-action textures.";
  }
  if (g.includes("3d") || g.includes("cgi") || g.includes("render")) {
    return "MEDIUM LOCK: 3D CAD / Octane studio product render — crisp specular highlights, physically based materials (PBR), digital precision.";
  }
  if (g.includes("cinematic")) {
    return "MEDIUM LOCK: Cinematic commercial cinematography — anamorphic depth of field, real studio softbox reflections, pristine hero product lighting.";
  }
  return "MEDIUM LOCK: High-end commercial product photography — tactile surface textures, authentic material physics, clean studio environment.";
}

export function buildProductionProductSheetPrompt(params: ProductSheetPromptParams): string {
  const productName = params.productName?.trim() || "Hero Product";
  const brandName = params.brandName?.trim() || "SPARK";
  const genre = params.genre?.trim() || "Realistic";
  const category = params.category?.trim() || "Commercial Product";
  const desc = params.description?.trim();
  const materials = (params.materials || []).filter(Boolean);
  const colors = (params.colorPalette || []).filter(Boolean);
  const features = (params.keyFeatures || []).filter(Boolean);
  const formFactor = params.dimensionsOrFormFactor?.trim();
  const branding = params.brandingOrLogos?.trim();
  const usage = params.usageContext?.trim();
  const notes = params.directorNotes?.trim();

  return `
Professional industrial design product model sheet, single product entity, studio turnaround.
STYLE: ${genre} commercial presentation for ${brandName}.
${mediumProductStyleDirective(genre)}
PRODUCT: ${productName} (Category: ${category}).
${desc ? `DESCRIPTION: ${desc}` : ""}
${materials.length > 0 ? `MATERIALS & FINISHES: ${materials.join(", ")}` : "MATERIALS: Premium industrial materials with realistic specular reflection."}
${colors.length > 0 ? `COLOR PALETTE: ${colors.join(", ")}` : "PALETTE: Cohesive brand-locked colorway."}
${features.length > 0 ? `CRITICAL DETAILS & CONTROLS: ${features.join("; ")}` : ""}
${formFactor ? `FORM FACTOR: ${formFactor}` : ""}
${branding ? `BRANDING PLACEMENT: ${branding}` : ""}
${usage ? `USAGE CONTEXT: ${usage}` : ""}
${notes ? `DIRECTOR NOTES: ${notes}` : ""}
LAYOUT ON ONE IMAGE:
- Top: product name + brand + colorway material swatches
- Row: FRONT ELEVATION, 3/4 HERO VIEW, SIDE PROFILE, REAR ELEVATION, TOP-DOWN VIEW, same scale, neutral studio gray backdrop
- Bottom-left: 2 high-detail close-up callouts (texture, button/interface, or logo engraving)
- Bottom-right: 1 in-hand or in-context scale reference demonstration
Zero morphing. Identical proportions, buttons, materials, and logos across every angle. No background clutter, no people, single locked product object only.
`.trim();
}
