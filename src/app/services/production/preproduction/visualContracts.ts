/**
 * Visual treatment + character / location / product visual contracts.
 * Extends CharacterMaster / LocationMaster / ProductMaster — does not replace them.
 */

import type { CharacterMaster, LocationMaster, ProductMaster } from "../specification/assetSpec";
import type { CreativeSpec, ProjectSpec, VisualStyleSpec } from "../specification/productionSpec";
import type {
  CharacterViewKind,
  CharacterVisualContract,
  LocationVisualContract,
  ProductVisualContract,
  VisualTreatment,
} from "./types";
import { filmmakingPrincipleIds } from "./filmmakingPrinciples";

function inferLook(creative: CreativeSpec, style?: VisualStyleSpec): string {
  const blob = [creative.genre, creative.tone, creative.visualLanguage, style?.look || ""].join(" ").toLowerCase();
  if (/noir/.test(blob)) return "low-key noir";
  if (/thriller|horror/.test(blob)) return "high-contrast thriller";
  if (/commercial|product|ad/.test(blob)) return "high-key commercial";
  if (/doc|verite|vérité/.test(blob)) return "observational documentary";
  if (/warm|nostalg/.test(blob)) return "warm nostalgic";
  return "naturalistic cinematic";
}

export function developVisualTreatment(params: {
  productionId: string;
  creative: CreativeSpec;
  project: ProjectSpec;
  visualStyle?: VisualStyleSpec;
  customLook?: string;
}): VisualTreatment {
  const lookLabel = params.customLook || inferLook(params.creative, params.visualStyle);
  const style = params.visualStyle;
  const aspect = String(params.project.aspectRatio || "16:9");
  const platforms = (params.project.platforms || []).join(" ");
  const aspectRatioIntent =
    aspect === "9:16" || /tiktok|shorts|reels/i.test(platforms)
      ? "social_vertical"
      : aspect === "21:9"
        ? "cinematic_widescreen"
        : aspect === "1:1"
          ? "square_editorial"
          : "television";

  return {
    id: `treatment_${params.productionId}`,
    productionId: params.productionId,
    lookLabel: style?.look?.trim() || lookLabel,
    palette: style?.colorLanguage?.trim() || "controlled production palette",
    contrast: /thriller|noir|horror/i.test(lookLabel) ? "high" : "moderate",
    saturation: /commercial|product/i.test(lookLabel) ? "product-true" : "controlled",
    lightingMood: style?.lightingLanguage?.trim() || "motivated practicals",
    texture: "subtle real-world texture",
    atmosphere: "clear observational air",
    cameraLanguage: style?.cameraLanguage?.trim() || "restrained motivated camera",
    lensCharacter: "neutral modern primes",
    depthOfFieldLanguage: "purpose-driven depth",
    colorLanguage: style?.colorLanguage?.trim() || "motivated color continuity",
    aspectRatioIntent,
    aspectRatio: aspect,
    references: style?.references ? [...style.references] : [],
    principles: filmmakingPrincipleIds(),
    confidence: style?.look ? 0.82 : 0.7,
    provenance: "preproduction.developVisualTreatment",
    version: 1,
  };
}

export function lookSignature(treatment: VisualTreatment): string {
  return [
    treatment.lookLabel,
    treatment.contrast,
    treatment.saturation,
    treatment.lightingMood,
    treatment.cameraLanguage,
    treatment.lensCharacter,
    treatment.texture,
  ].join("|");
}

const DEFAULT_CHARACTER_VIEWS: Array<{ view: CharacterViewKind; required: boolean }> = [
  { view: "front", required: true },
  { view: "three_quarter", required: true },
  { view: "profile", required: false },
  { view: "full_body", required: true },
  { view: "face_closeup", required: true },
  { view: "wardrobe_detail", required: false },
  { view: "rear", required: false },
];

export function buildCharacterVisualContract(params: {
  character: CharacterMaster;
  visualTreatment?: VisualTreatment;
  userReferenceUrls?: string[];
  requiredViews?: CharacterViewKind[];
}): CharacterVisualContract {
  const c = params.character;
  const required = new Set(params.requiredViews || ["front", "three_quarter", "full_body", "face_closeup"]);
  const views = DEFAULT_CHARACTER_VIEWS.map((v) => ({
    view: v.view,
    required: required.has(v.view) || v.required,
    description: `${v.view} view of ${c.name}`,
  }));

  return {
    id: `cvc_${c.identity.baseId}_v${c.identity.version}`,
    assetRef: c.identity.ref,
    characterId: c.identity.baseId,
    identity: c.description || c.name,
    face: c.visualAttributes.face || "consistent facial structure",
    body: c.visualAttributes.body || "consistent body proportions",
    proportions: "stable character proportions",
    hair: c.visualAttributes.hair || "consistent hair",
    skin: "consistent skin tone",
    wardrobe: c.wardrobeState?.description || "locked wardrobe state",
    accessories: [],
    colorPalette: c.wardrobeState?.colors || [],
    silhouette: "recognizable silhouette",
    style: params.visualTreatment?.lookLabel || "production style",
    agePresentation: "consistent age presentation",
    canonicalExpressions: ["neutral", "focused", "reactive"],
    canonicalPoses: ["standing", "three-quarter address", "action-ready"],
    views,
    referenceImageUrls: [...c.approvedReferenceUrls, ...(params.userReferenceUrls || [])],
    version: c.identity.version,
    approvalState: c.status === "approved" ? "approved" : "draft",
    visualTreatmentId: params.visualTreatment?.id,
    provenance: "preproduction.buildCharacterVisualContract",
  };
}

export function buildLocationVisualContract(params: {
  location: LocationMaster;
  visualTreatment?: VisualTreatment;
  userReferenceUrls?: string[];
}): LocationVisualContract {
  const loc = params.location;
  return {
    id: `lvc_${loc.identity.baseId}_v${loc.identity.version}`,
    assetRef: loc.identity.ref,
    locationId: loc.identity.baseId,
    environmentIdentity: loc.environment || loc.description,
    architecture: loc.architecture || "consistent architecture",
    layout: "stable spatial layout",
    lighting: loc.defaultLighting || params.visualTreatment?.lightingMood || "motivated location lighting",
    timeOfDay: loc.defaultTimeOfDay || "unspecified",
    weather: "stable weather condition",
    materials: [],
    color: params.visualTreatment?.palette || "location-native palette",
    spatialLandmarks: [],
    entryExitPoints: [],
    foregroundAnchors: [],
    backgroundAnchors: [],
    approvedReferenceUrls: [...loc.approvedReferenceUrls, ...(params.userReferenceUrls || [])],
    version: loc.identity.version,
    approvalState: loc.status === "approved" ? "approved" : "draft",
    provenance: "preproduction.buildLocationVisualContract",
  };
}

export function buildProductVisualContract(params: {
  product: ProductMaster;
  visualTreatment?: VisualTreatment;
  userReferenceUrls?: string[];
}): ProductVisualContract {
  const p = params.product;
  return {
    id: `pvc_${p.identity.baseId}_v${p.identity.version}`,
    assetRef: p.identity.ref,
    productId: p.identity.baseId,
    identity: p.description || p.name,
    shape: "canonical product silhouette",
    proportions: "accurate product proportions",
    materials: [],
    colors: [],
    branding: p.brandName || "",
    logos: p.brandName ? [p.brandName] : [],
    surfaceDetails: p.mustShowFeatures || [],
    approvedViews: p.heroAngle ? [p.heroAngle, "three_quarter", "detail"] : ["hero", "three_quarter", "detail"],
    canonicalReferenceUrl: p.approvedReferenceUrls[0],
    approvedReferenceUrls: [...p.approvedReferenceUrls, ...(params.userReferenceUrls || [])],
    version: p.identity.version,
    approvalState: p.status === "approved" ? "approved" : "draft",
    provenance: "preproduction.buildProductVisualContract",
  };
}

export function requiredCharacterViewsForProduction(genre: string): CharacterViewKind[] {
  if (/commercial|product|fashion|beauty/i.test(genre)) {
    return ["front", "three_quarter", "full_body", "face_closeup", "wardrobe_detail"];
  }
  if (/doc|interview/i.test(genre)) {
    return ["front", "three_quarter", "face_closeup"];
  }
  return ["front", "three_quarter", "full_body", "face_closeup"];
}
