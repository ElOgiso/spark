/**
 * Canonical StyleBible Contract
 *
 * Provider-neutral representation of persistent visual language:
 * Production → StyleBible → Scene / Shot → Style Requirements
 *
 * StyleBible answers: What visual language should remain consistent throughout this production?
 * Distinct from Cinematography Intelligence (which defines what an individual shot does).
 * Distinct from ReferenceGraph (which defines specific evidence and identity assets).
 */

import type { VisualTreatment, LookPresetId } from "../cinematography/cinematicIntelligence";

export type StyleProvenance =
  | "DEFAULT"
  | "BRAND"
  | "USER"
  | "PRODUCTION"
  | "REFERENCE"
  | "INFERRED"
  | "OVERRIDE";

export interface VisualLanguageStyle {
  aesthetic: string;
  medium?: string;
  realismLevel?: "photorealistic" | "stylized" | "hyperreal" | "painterly" | string;
  texture?: string;
  detailLevel?: "cinematic" | "simplified" | "gritty" | string;
}

export interface CinematographyStyle {
  cameraLanguage: string;
  lensCharacter?: string;
  depthOfField?: string;
  framingTendencies?: string[];
}

export interface LightingStyle {
  keyMood: string;
  contrast?: "low" | "moderate" | "high" | "extreme" | string;
  atmosphere?: string;
  colorTemperature?: string;
}

export interface ColorStyle {
  palette: string;
  saturation?: "desaturated" | "natural" | "vibrant" | "monochromatic" | string;
  temperature?: "warm" | "neutral" | "cool" | string;
  dominantColors?: string[];
}

export interface EnvironmentStyle {
  worldAtmosphere: string;
  productionDesign?: string;
  materials?: string[];
}

export interface CharacterStyle {
  appearanceTreatment?: string;
  wardrobePhilosophy?: string;
  groomingLanguage?: string;
}

export interface MotionStyle {
  movementPacing: string;
  dynamicEnergy?: "calm" | "measured" | "kinetic" | "frenetic" | string;
}

export interface GraphicsStyle {
  typographyStyle?: string;
  graphicTreatment?: string;
  captionStyle?: string;
}

export interface StyleConstraints {
  negativeRules: string[];
}

/**
 * The canonical StyleBible representing the persistent visual rules and aesthetics of a production.
 * Structured state, not a loose prompt string.
 */
export interface StyleBible {
  id: string;
  productionId?: string;
  brandId?: string;
  version: number;
  visualLanguage: VisualLanguageStyle;
  cinematography: CinematographyStyle;
  lighting: LightingStyle;
  color: ColorStyle;
  environment?: EnvironmentStyle;
  character?: CharacterStyle;
  motion?: MotionStyle;
  graphics?: GraphicsStyle;
  constraints: StyleConstraints;
  provenanceMap?: Partial<Record<string, StyleProvenance>>;
  references?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ResolvedStyleBible {
  bible: StyleBible;
  provenance: Record<string, StyleProvenance>;
  appliedOverrides: string[];
}

export interface ResolveStyleBibleOptions {
  defaultStyle?: Partial<StyleBible>;
  brandStyle?: Partial<StyleBible>;
  productionStyle?: Partial<StyleBible>;
  sceneOverride?: Partial<StyleBible>;
  shotOverride?: Partial<StyleBible>;
}

/**
 * Creates default provider-neutral StyleBible.
 */
export function createDefaultStyleBible(productionId?: string, brandId?: string): StyleBible {
  const now = new Date().toISOString();
  return {
    id: `style_${productionId || "default"}`,
    productionId,
    brandId,
    version: 1,
    visualLanguage: {
      aesthetic: "cinematic realism",
      medium: "live_action",
      realismLevel: "photorealistic",
      texture: "subtle natural texture",
      detailLevel: "cinematic",
    },
    cinematography: {
      cameraLanguage: "restrained, motivated camera coverage",
      lensCharacter: "natural modern prime lenses",
      depthOfField: "moderate depth of field with subject isolation",
      framingTendencies: ["balanced rule of thirds", "eye-level angles"],
    },
    lighting: {
      keyMood: "motivated, naturalistic lighting",
      contrast: "moderate",
      atmosphere: "clear cinematic atmosphere",
      colorTemperature: "natural daylight 5600K",
    },
    color: {
      palette: "coherent brand grade with natural skin tones",
      saturation: "natural",
      temperature: "neutral",
    },
    environment: {
      worldAtmosphere: "authentic, lived-in environment",
    },
    character: {
      wardrobePhilosophy: "consistent wardrobe matching brand tone",
    },
    motion: {
      movementPacing: "measured narrative pacing",
      dynamicEnergy: "measured",
    },
    constraints: {
      negativeRules: [
        "no plastic skin",
        "no unmotivated camera drift",
        "no inconsistent wardrobe changes",
        "no burned-in watermarks or text",
      ],
    },
    provenanceMap: {
      visualLanguage: "DEFAULT",
      cinematography: "DEFAULT",
      lighting: "DEFAULT",
      color: "DEFAULT",
      environment: "DEFAULT",
      character: "DEFAULT",
      motion: "DEFAULT",
      constraints: "DEFAULT",
    },
    references: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Deep merge and resolve StyleBible according to the strict audited precedence hierarchy:
 * Global Defaults → Brand Style → Production StyleBible → Scene Override → Shot Override
 *
 * Preserves traceability via provenance tracking for each visual dimension.
 */
export function resolveStyleBible(opts: ResolveStyleBibleOptions): ResolvedStyleBible {
  const base = createDefaultStyleBible();
  const provenance: Record<string, StyleProvenance> = {};
  for (const [key, value] of Object.entries(base.provenanceMap || {})) {
    if (value) provenance[key] = value;
  }
  const appliedOverrides: string[] = [];

  const merged: StyleBible = {
    ...base,
    visualLanguage: { ...base.visualLanguage },
    cinematography: { ...base.cinematography },
    lighting: { ...base.lighting },
    color: { ...base.color },
    environment: base.environment ? { ...base.environment } : undefined,
    character: base.character ? { ...base.character } : undefined,
    motion: base.motion ? { ...base.motion } : undefined,
    graphics: base.graphics ? { ...base.graphics } : undefined,
    constraints: { negativeRules: [...base.constraints.negativeRules] },
  };

  function applyLayer(layer: Partial<StyleBible> | undefined, source: StyleProvenance) {
    if (!layer) return;

    if (layer.visualLanguage) {
      merged.visualLanguage = { ...merged.visualLanguage, ...layer.visualLanguage };
      provenance.visualLanguage = source;
      appliedOverrides.push(`visualLanguage (${source})`);
    }

    if (layer.cinematography) {
      merged.cinematography = { ...merged.cinematography, ...layer.cinematography };
      provenance.cinematography = source;
      appliedOverrides.push(`cinematography (${source})`);
    }

    if (layer.lighting) {
      merged.lighting = { ...merged.lighting, ...layer.lighting };
      provenance.lighting = source;
      appliedOverrides.push(`lighting (${source})`);
    }

    if (layer.color) {
      merged.color = { ...merged.color, ...layer.color };
      provenance.color = source;
      appliedOverrides.push(`color (${source})`);
    }

    if (layer.environment) {
      merged.environment = { ...(merged.environment || { worldAtmosphere: "" }), ...layer.environment };
      provenance.environment = source;
      appliedOverrides.push(`environment (${source})`);
    }

    if (layer.character) {
      merged.character = { ...(merged.character || {}), ...layer.character };
      provenance.character = source;
      appliedOverrides.push(`character (${source})`);
    }

    if (layer.motion) {
      merged.motion = { ...(merged.motion || { movementPacing: "" }), ...layer.motion };
      provenance.motion = source;
      appliedOverrides.push(`motion (${source})`);
    }

    if (layer.graphics) {
      merged.graphics = { ...(merged.graphics || {}), ...layer.graphics };
      provenance.graphics = source;
      appliedOverrides.push(`graphics (${source})`);
    }

    if (layer.constraints?.negativeRules?.length) {
      merged.constraints.negativeRules = Array.from(
        new Set([...merged.constraints.negativeRules, ...layer.constraints.negativeRules])
      );
      provenance.constraints = source;
      appliedOverrides.push(`constraints (${source})`);
    }

    if (layer.references?.length) {
      merged.references = Array.from(new Set([...(merged.references || []), ...layer.references]));
    }
  }

  // Apply in strict order
  applyLayer(opts.defaultStyle, "DEFAULT");
  applyLayer(opts.brandStyle, "BRAND");
  applyLayer(opts.productionStyle, "PRODUCTION");
  applyLayer(opts.sceneOverride, "OVERRIDE");
  applyLayer(opts.shotOverride, "OVERRIDE");

  return {
    bible: merged,
    provenance,
    appliedOverrides,
  };
}

/**
 * Adapt a legacy or cinematography VisualTreatment into a canonical StyleBible.
 */
export function styleBibleFromVisualTreatment(
  treatment: VisualTreatment,
  productionId?: string
): StyleBible {
  const base = createDefaultStyleBible(productionId);
  return {
    ...base,
    id: treatment.id || base.id,
    visualLanguage: {
      aesthetic: treatment.lookLabel,
      realismLevel: "photorealistic",
      texture: treatment.texture,
      detailLevel: "cinematic",
    },
    cinematography: {
      cameraLanguage: treatment.cameraLanguage,
      lensCharacter: treatment.lensCharacter,
      depthOfField: treatment.depthOfFieldLanguage,
    },
    lighting: {
      keyMood: treatment.lightingMood,
      contrast: treatment.contrast,
      atmosphere: treatment.atmosphere,
    },
    color: {
      palette: treatment.palette,
      saturation: treatment.saturation,
    },
    references: treatment.references || [],
    constraints: {
      negativeRules: treatment.principles || base.constraints.negativeRules,
    },
    provenanceMap: {
      visualLanguage: "INFERRED",
      cinematography: "INFERRED",
      lighting: "INFERRED",
      color: "INFERRED",
    },
  };
}

/**
 * Project a canonical StyleBible into a VisualTreatment for consumption by Cinematography Intelligence.
 */
export function visualTreatmentFromStyleBible(bible: StyleBible): VisualTreatment {
  return {
    id: bible.id,
    lookPreset: "naturalistic" as LookPresetId,
    lookLabel: bible.visualLanguage.aesthetic,
    palette: bible.color.palette,
    contrast: bible.lighting.contrast || "moderate",
    saturation: bible.color.saturation || "natural",
    lightingMood: bible.lighting.keyMood,
    texture: bible.visualLanguage.texture || "clean",
    atmosphere: bible.lighting.atmosphere || "clear",
    cameraLanguage: bible.cinematography.cameraLanguage,
    lensCharacter: bible.cinematography.lensCharacter || "prime",
    depthOfFieldLanguage: bible.cinematography.depthOfField || "moderate",
    aspectRatioIntent: "social_vertical",
    aspectRatio: "9:16",
    references: bible.references || [],
    principles: bible.constraints.negativeRules,
    confidence: 0.9,
    provenance: "StyleBible",
  };
}
