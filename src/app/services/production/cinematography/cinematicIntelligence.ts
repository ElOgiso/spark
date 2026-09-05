/**
 * Phase 5 — Cinematic look development + shot-direction intelligence.
 * Provider-neutral. Extends existing cinematography planners (no second orchestrator).
 */

import type { CreativeSpec, ProjectSpec, VisualStyleSpec } from "../specification/productionSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";
import type { CameraMovement, ShotType } from "../specification/shotSpec";
import type { ComposedGrammar } from "../grammar";
import type { ResolvedMode } from "../resolveProductionMode";

export const CINEMATIC_PRINCIPLES = [
  { id: "A", title: "Cinematic is systemic", text: "Look + lighting + composition + camera + blocking + motion + performance + edit + sound + continuity + finishing — not grade alone." },
  { id: "B", title: "Look before generation", text: "Establish production visual treatment before generating a large sequence." },
  { id: "C", title: "Assets before shots", text: "Lock important characters, environments, props, and style references before dependent shots." },
  { id: "D", title: "Purpose before camera", text: "Decide why the shot exists before choosing how it is photographed." },
  { id: "E", title: "Motion must be motivated", text: "Camera movement needs narrative, emotional, spatial, or editorial justification." },
  { id: "F", title: "Sequence before isolated clip", text: "Plan how shots interact editorially before generating them independently." },
  { id: "G", title: "Semantic intent before provider syntax", text: "Decide what is wanted first; adapters decide how to express it." },
  { id: "H", title: "Capability truth beats prompt fantasy", text: "Do not pretend a provider can do what it cannot; declare constraint + fallback." },
  { id: "I", title: "Continuity is multi-dimensional", text: "Track identity, wardrobe, props, location, lighting, look, camera language, geography, screen direction, eyeline, story state." },
  { id: "J", title: "Quality is not prompt length", text: "Compile only relevant intent — longer prompts are not automatically better." },
] as const;

export type LookPresetId =
  | "naturalistic"
  | "warm_nostalgic"
  | "cold_clinical"
  | "high_contrast_thriller"
  | "gritty_documentary"
  | "period_drama"
  | "soft_romantic"
  | "dreamlike"
  | "neon_nocturnal"
  | "cyberpunk"
  | "high_key_commercial"
  | "low_key_noir"
  | "epic_fantasy"
  | "intimate_drama"
  | "clean_corporate"
  | "handheld_verite"
  | "stylized_animation"
  | "experimental";

export type AspectRatioIntent =
  | "cinematic_widescreen"
  | "television"
  | "social_vertical"
  | "square_editorial"
  | "creative_format";

export interface VisualTreatment {
  id: string;
  lookPreset: LookPresetId;
  lookLabel: string;
  palette: string;
  contrast: string;
  saturation: string;
  lightingMood: string;
  texture: string;
  atmosphere: string;
  cameraLanguage: string;
  lensCharacter: string;
  depthOfFieldLanguage: string;
  aspectRatioIntent: AspectRatioIntent;
  aspectRatio: string;
  references: string[];
  principles: string[];
  confidence: number;
  provenance: string;
}

export interface VisualTreatmentOverride {
  patch: Partial<VisualTreatment>;
  reason: string;
  scope: "scene" | "shot";
  confidence: number;
}

type LookSeed = Omit<
  VisualTreatment,
  "id" | "lookPreset" | "aspectRatioIntent" | "aspectRatio" | "references" | "principles" | "confidence" | "provenance"
>;

const LOOKS: Record<LookPresetId, LookSeed> = {
  naturalistic: { lookLabel: "Naturalistic", palette: "observed environmental hues", contrast: "moderate", saturation: "natural", lightingMood: "motivated practicals", texture: "subtle real-world texture", atmosphere: "clear observational air", cameraLanguage: "observational / restrained", lensCharacter: "neutral modern prime", depthOfFieldLanguage: "moderate depth" },
  warm_nostalgic: { lookLabel: "Warm nostalgic", palette: "amber, soft gold, muted teal shadows", contrast: "restrained", saturation: "muted-warm", lightingMood: "golden-hour bias", texture: "subtle film texture", atmosphere: "hazy warmth", cameraLanguage: "intimate observational", lensCharacter: "soft moderate telephoto", depthOfFieldLanguage: "shallow-to-moderate" },
  cold_clinical: { lookLabel: "Cold clinical", palette: "cyan-gray sterile neutrals", contrast: "crisp", saturation: "low-cool", lightingMood: "fluorescent / clinical", texture: "hard clean surfaces", atmosphere: "sterile air", cameraLanguage: "locked / analytical", lensCharacter: "sharp normal", depthOfFieldLanguage: "deep to moderate" },
  high_contrast_thriller: { lookLabel: "High-contrast thriller", palette: "charcoal, cold steel, selective warm practicals", contrast: "high", saturation: "controlled", lightingMood: "low-key tension", texture: "grit in shadows", atmosphere: "pressure / unease", cameraLanguage: "deliberate / predatory", lensCharacter: "moderate telephoto compression", depthOfFieldLanguage: "shallow isolation" },
  gritty_documentary: { lookLabel: "Gritty documentary", palette: "mixed practicals", contrast: "situational", saturation: "unpolished natural", lightingMood: "available light", texture: "environmental grit", atmosphere: "lived-in air", cameraLanguage: "handheld vérité when motivated", lensCharacter: "zoom / observational", depthOfFieldLanguage: "deep enough for context" },
  period_drama: { lookLabel: "Period drama", palette: "era-accurate dyes", contrast: "painterly moderate", saturation: "period-muted", lightingMood: "motivated period sources", texture: "fabric detail", atmosphere: "period dust / air", cameraLanguage: "composed / classical", lensCharacter: "classic spherical primes", depthOfFieldLanguage: "moderate" },
  soft_romantic: { lookLabel: "Soft romantic", palette: "blush, soft gold, pastels", contrast: "low-moderate", saturation: "soft", lightingMood: "diffused beauty light", texture: "soft diffusion", atmosphere: "tender air", cameraLanguage: "gentle push / float", lensCharacter: "soft portrait", depthOfFieldLanguage: "shallow" },
  dreamlike: { lookLabel: "Dreamlike", palette: "pastel / twilight hues", contrast: "softened", saturation: "ethereal", lightingMood: "poetic sources", texture: "soft haze", atmosphere: "dream haze", cameraLanguage: "floating / dissociated", lensCharacter: "soft / anamorphic suggestion", depthOfFieldLanguage: "shallow selective" },
  neon_nocturnal: { lookLabel: "Neon nocturnal", palette: "magenta, cyan, sodium", contrast: "high nocturnal", saturation: "neon punch", lightingMood: "practical neon keys", texture: "wet street / glass", atmosphere: "urban night moisture", cameraLanguage: "nocturnal glide / static", lensCharacter: "fast night prime", depthOfFieldLanguage: "shallow night isolation" },
  cyberpunk: { lookLabel: "Cyberpunk", palette: "electric cyan, hot magenta, oil-black", contrast: "high tech", saturation: "hyperselective", lightingMood: "LED / signage motivated", texture: "rain, chrome, haze", atmosphere: "polluted night air", cameraLanguage: "tracking through density", lensCharacter: "wide night", depthOfFieldLanguage: "shallow in dense bg" },
  high_key_commercial: { lookLabel: "High-key commercial", palette: "clean brand neutrals + accent", contrast: "controlled bright", saturation: "product-true", lightingMood: "studio-clean", texture: "polished product", atmosphere: "clean void / lifestyle", cameraLanguage: "precise orbit / push", lensCharacter: "sharp product / beauty", depthOfFieldLanguage: "shallow product isolation" },
  low_key_noir: { lookLabel: "Low-key noir", palette: "ink black, amber practical, rain silver", contrast: "extreme low-key", saturation: "near mono + warm practical", lightingMood: "single hard practical", texture: "wet asphalt / venetian shadow", atmosphere: "smoke / rain", cameraLanguage: "static or slow push", lensCharacter: "normal to mild wide", depthOfFieldLanguage: "deep stages / shallow face" },
  epic_fantasy: { lookLabel: "Epic fantasy", palette: "mythic jewel tones or misted earth", contrast: "heroic", saturation: "elevated selective", lightingMood: "motivated mythic sources", texture: "fabric, metal, landscape", atmosphere: "volume light / mist", cameraLanguage: "crane / orbit / processional", lensCharacter: "wide epic / portrait long", depthOfFieldLanguage: "deep geography / shallow intimacy" },
  intimate_drama: { lookLabel: "Intimate drama", palette: "muted lived-in interiors", contrast: "soft-real", saturation: "restrained", lightingMood: "motivated interior", texture: "domestic detail", atmosphere: "quiet room air", cameraLanguage: "restrained / eyeline-aware", lensCharacter: "normal to mild telephoto", depthOfFieldLanguage: "shallow performance" },
  clean_corporate: { lookLabel: "Clean corporate", palette: "brand neutrals, cool glass", contrast: "clean", saturation: "brand-safe", lightingMood: "architectural bright", texture: "glass / steel", atmosphere: "clear office air", cameraLanguage: "stable / slider", lensCharacter: "sharp normal", depthOfFieldLanguage: "moderate" },
  handheld_verite: { lookLabel: "Handheld vérité", palette: "available-light real", contrast: "situational", saturation: "unmanaged natural", lightingMood: "found light", texture: "real locations", atmosphere: "present-tense air", cameraLanguage: "motivated handheld", lensCharacter: "zoom / wide observational", depthOfFieldLanguage: "deep enough" },
  stylized_animation: { lookLabel: "Stylized animation", palette: "design-system colors", contrast: "graphic", saturation: "designed", lightingMood: "stylized key logic", texture: "style material language", atmosphere: "style-world air", cameraLanguage: "animation camera grammar", lensCharacter: "virtual camera", depthOfFieldLanguage: "style DOF cues" },
  experimental: { lookLabel: "Experimental", palette: "concept-first", contrast: "variable", saturation: "variable", lightingMood: "anti-default when motivated", texture: "process-visible", atmosphere: "concept air", cameraLanguage: "rule-breaking with reason", lensCharacter: "any motivated optic", depthOfFieldLanguage: "any motivated" },
};

function inferLook(creative: CreativeSpec, style?: VisualStyleSpec): LookPresetId {
  const blob = [creative.genre, creative.tone, creative.visualLanguage, ...(creative.grammarTags || []), style?.look || "", style?.colorLanguage || ""].join(" ").toLowerCase();
  if (/noir/.test(blob)) return "low_key_noir";
  if (/cyber/.test(blob)) return "cyberpunk";
  if (/neon/.test(blob)) return "neon_nocturnal";
  if (/doc|v[eé]rit/.test(blob)) return "gritty_documentary";
  if (/commercial|advert|product/.test(blob)) return "high_key_commercial";
  if (/horror|thriller/.test(blob)) return "high_contrast_thriller";
  if (/romance|romantic/.test(blob)) return "soft_romantic";
  if (/fantasy|epic/.test(blob)) return "epic_fantasy";
  if (/corporate|saas|b2b/.test(blob)) return "clean_corporate";
  if (/anime|animation/.test(blob)) return "stylized_animation";
  if (/nostalg|warm/.test(blob)) return "warm_nostalgic";
  if (/clinical|cold/.test(blob)) return "cold_clinical";
  if (/dream/.test(blob)) return "dreamlike";
  if (/period|historical/.test(blob)) return "period_drama";
  if (/experimental|surreal/.test(blob)) return "experimental";
  if (/drama|narrative/.test(blob)) return "intimate_drama";
  return "naturalistic";
}

function aspectIntent(project: ProjectSpec): { intent: AspectRatioIntent; ratio: string } {
  const ratio = String(project.aspectRatio || "16:9");
  const platforms = (project.platforms || []).join(" ").toLowerCase();
  if (ratio === "9:16" || /tiktok|shorts|reels/.test(platforms)) return { intent: "social_vertical", ratio };
  if (ratio === "1:1") return { intent: "square_editorial", ratio };
  if (ratio === "21:9") return { intent: "cinematic_widescreen", ratio };
  if (ratio === "16:9") return { intent: "television", ratio };
  return { intent: "creative_format", ratio };
}

export function developVisualTreatment(params: {
  productionId: string;
  creative: CreativeSpec;
  project: ProjectSpec;
  visualStyle?: VisualStyleSpec;
  customLook?: LookPresetId;
}): VisualTreatment {
  const lookPreset = params.customLook || inferLook(params.creative, params.visualStyle);
  const seed = LOOKS[lookPreset];
  const aspect = aspectIntent(params.project);
  const style = params.visualStyle;
  return {
    id: `treatment_${params.productionId}`,
    lookPreset,
    ...seed,
    lookLabel: style?.look?.trim() || seed.lookLabel,
    palette: style?.colorLanguage?.trim() || seed.palette,
    cameraLanguage: style?.cameraLanguage?.trim() || seed.cameraLanguage,
    lightingMood: style?.lightingLanguage?.trim() || seed.lightingMood,
    aspectRatioIntent: aspect.intent,
    aspectRatio: aspect.ratio,
    references: style?.references?.length ? [...style.references] : [],
    principles: CINEMATIC_PRINCIPLES.map((p) => p.id),
    confidence: style?.look ? 0.82 : 0.7,
    provenance: "cinematicIntelligence.developVisualTreatment",
  };
}

export function applyVisualTreatmentOverride(base: VisualTreatment, override: VisualTreatmentOverride): VisualTreatment {
  if (!override.reason.trim()) throw new Error("Visual treatment override requires an explicit reason");
  return {
    ...base,
    ...override.patch,
    id: base.id,
    lookPreset: override.patch.lookPreset || base.lookPreset,
    references: override.patch.references || base.references,
    principles: Array.from(new Set([...(override.patch.principles || base.principles), "intentional-override"])),
    confidence: Math.min(base.confidence, override.confidence),
    provenance: `${base.provenance}|${override.scope}:${override.reason}`,
  };
}

export function treatmentToVisualStyle(treatment: VisualTreatment): VisualStyleSpec {
  return {
    look: treatment.lookLabel,
    colorLanguage: `${treatment.palette}; contrast ${treatment.contrast}; sat ${treatment.saturation}`,
    cameraLanguage: `${treatment.cameraLanguage}; lens ${treatment.lensCharacter}; dof ${treatment.depthOfFieldLanguage}`,
    lightingLanguage: treatment.lightingMood,
    era: undefined,
    references: treatment.references,
    antiSlopLaws: [
      "Do not equate aspect ratio alone with cinematic quality",
      "Do not use color grade as a substitute for cinematography",
      "Prefer motivated lighting and composition over generic cinematic adjectives",
    ],
  };
}

export function lookSignature(treatment: VisualTreatment): string {
  return [treatment.lookPreset, treatment.contrast, treatment.saturation, treatment.lightingMood, treatment.cameraLanguage, treatment.lensCharacter, treatment.texture].join("|");
}

export type DramaticPurpose =
  | "establish_geography"
  | "introduce_character"
  | "reveal_information"
  | "show_relationship"
  | "deliver_dialogue"
  | "capture_reaction"
  | "show_action"
  | "emphasize_emotion"
  | "show_object_detail"
  | "create_suspense"
  | "create_scale"
  | "create_rhythm"
  | "orient_viewer"
  | "provide_editorial_coverage";

export type CoverageRole =
  | "master"
  | "establishing"
  | "wide"
  | "medium"
  | "closeup"
  | "extreme_closeup"
  | "two_shot"
  | "over_the_shoulder"
  | "pov"
  | "reaction"
  | "insert"
  | "tracking"
  | "environmental_detail";

export type LensIntent = "very_wide" | "wide" | "normal" | "moderate_telephoto" | "telephoto" | "intimate" | "observational" | "neutral";
export type DepthIntent = "deep_focus" | "moderate_depth" | "shallow_depth" | "very_shallow" | "subject_isolation";
export type MovementMotivation =
  | "psychological_intimacy"
  | "reveal_isolation"
  | "follow_subject"
  | "reveal_relationship"
  | "reveal_information"
  | "reveal_scale"
  | "documentary_immediacy"
  | "product_hero"
  | "editorial_energy"
  | "none_static_preferred";

export interface TemporalBeat {
  index: number;
  label: string;
  description: string;
  startHintSec?: number;
  endHintSec?: number;
}

export interface ShotCinematicIntelligence {
  dramaticPurpose: DramaticPurpose;
  visualObjective: string;
  emotionalObjective: string;
  informationPriority: string;
  coverageRole: CoverageRole;
  editorialRole: string;
  framing: string;
  lensIntent: LensIntent;
  focalLengthIntent?: string;
  depthOfFieldIntent: DepthIntent;
  movementMotivation: MovementMotivation;
  physicalCameraPath?: {
    startPosition: string;
    movementPath: string;
    subjectAnchor: string;
    movementSpeed: string;
    reveal?: string;
    endPosition: string;
  };
  temporalBeats: TemporalBeat[];
  motionSeparation: {
    visualState: string;
    subjectMotion: string;
    cameraState: string;
    environmentalMotion: string;
    temporalState: string;
  };
  spatial: {
    axis: string;
    screenDirection: string;
    eyeline: string;
    cameraSide: string;
    subjectPosition: string;
    axisPolicy: "preserve" | "intentionally_cross";
    axisCrossReason?: string;
    axisTransitionMechanism?: string;
  };
  visualHierarchy: {
    primarySubject: string;
    secondarySubject?: string;
    environmentalContext?: string;
  };
  handoff: {
    outgoingState: string;
    requiredIncomingState: string;
    cutReason: string;
    transitionType: string;
    transitionMotivation: string;
  };
  referenceRequirements: {
    requiresCharacterReference: boolean;
    characterIds: string[];
    requiresLocationReference: boolean;
    locationIds: string[];
    requiresPropReference: boolean;
    propIds: string[];
    requiresStyleReference: boolean;
    requiresStartFrame: boolean;
    requiresEndFrame: boolean;
  };
  capabilityRequirements: {
    imageToVideo: boolean;
    textToVideo: boolean;
    startFrame: boolean;
    endFrame: boolean;
    characterReference: boolean;
    locationReference: boolean;
    styleReference: boolean;
    cameraMotion: string;
    temporalControl: boolean;
    durationSeconds: number;
  };
  generationIntent: {
    generationResolution: string;
    finishingResolution: string;
    qualityPriority: "cost" | "balanced" | "max_quality";
    upscaleEligible: boolean;
    rationale: string;
  };
  lookSignature: string;
  treatmentId: string;
  rationale: {
    framing: string;
    movement: string;
    lensIntent: string;
    depthOfField: string;
    duration: string;
    coverage: string;
    purpose: string;
  };
  quality: {
    purposeClarity: number;
    coverageValue: number;
    compositionQuality: number;
    cameraMotivation: number;
    spatialConsistency: number;
    temporalCoherence: number;
    continuityReadiness: number;
    capabilityFit: number;
    editorialUtility: number;
    referenceReadiness: number;
  };
  capabilityFallback?: {
    constraint: string;
    creativeRisk: string;
    fallbackOptions: string[];
  };
  promptRelevance: Record<string, "required" | "important" | "optional" | "omit">;
  principlesApplied: string[];
  validationIssues: string[];
  confidence: number;
}

export interface CoveragePlan {
  mode: ResolvedMode;
  shotTypes: ShotType[];
  roles: CoverageRole[];
  rationale: string[];
  optionalShotIndexes: number[];
  redundantPairs: Array<{ a: number; b: number; reason: string }>;
}

function roleFor(shotType: ShotType, index: number): CoverageRole {
  if (shotType === "establishing" || shotType === "aerial") return "establishing";
  if (shotType === "wide") return "wide";
  if (shotType === "closeup") return "closeup";
  if (shotType === "extreme_closeup") return "extreme_closeup";
  if (shotType === "reaction") return "reaction";
  if (shotType === "insert" || shotType === "macro") return "insert";
  if (shotType === "over_the_shoulder") return "over_the_shoulder";
  if (shotType === "two_shot") return "two_shot";
  if (shotType === "pov") return "pov";
  if (shotType === "tracking") return "tracking";
  return index === 0 ? "master" : "medium";
}

export function planCoverage(params: {
  narrativeFunction: NarrativeFunction;
  grammar: ComposedGrammar;
  mode: ResolvedMode;
  maxShots: number;
}): CoveragePlan {
  const { narrativeFunction: fn, grammar, mode } = params;
  const budget =
    mode === "express"
      ? Math.min(params.maxShots, 2)
      : mode === "deep"
        ? Math.max(1, params.maxShots)
        : Math.min(params.maxShots, Math.max(2, params.maxShots));
  const types: ShotType[] = [];
  const rationale: string[] = [];

  if (grammar.coverage.requireEstablishing && (fn === "hook" || fn === "establishing" || fn === "context" || fn === "broll")) {
    types.push("establishing");
    rationale.push("Establish geography before tightening");
  }

  types.push(fn === "montage" && grammar.coverage.preferredShotTypes.includes("tracking") ? "tracking" : "medium");
  rationale.push(`Primary coverage for ${fn}`);

  if (budget > types.length && (fn === "payoff" || fn === "proof" || fn === "cta" || fn === "product" || grammar.coverage.requireInserts)) {
    types.push(fn === "product" ? "macro" : fn === "comedy" ? "reaction" : "closeup");
    rationale.push("Emphasis beat needs tighter coverage");
  }

  if (mode !== "express" && budget > types.length && (grammar.coverage.requireInserts || fn === "broll" || fn === "proof" || fn === "example")) {
    if (!types.includes("insert") && !types.includes("macro")) {
      types.push("insert");
      rationale.push("Detail/evidence insert for editorial flexibility");
    }
  }

  if (mode !== "express" && budget > types.length && grammar.coverage.dialogueCoverage && (fn === "interview" || fn === "confrontation")) {
    types.push("over_the_shoulder");
    rationale.push("Dialogue relationship coverage");
  }

  if (mode === "deep" && budget > types.length && !types.includes("reaction") && (fn === "confrontation" || fn === "payoff" || fn === "comedy")) {
    types.push("reaction");
    rationale.push("Deep mode reaction coverage");
  }

  for (const t of grammar.coverage.preferredShotTypes) {
    if (types.length >= budget) break;
    if (!types.includes(t)) types.push(t);
  }

  const shotTypes = types.slice(0, Math.max(1, budget));
  const roles = shotTypes.map(roleFor);
  const optionalShotIndexes = mode === "deep" && shotTypes.length >= 4 ? [shotTypes.length - 1] : [];
  const redundantPairs: CoveragePlan["redundantPairs"] = [];
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      if (roles[i] === roles[j] && roles[i] !== "reaction" && roles[i] !== "insert") {
        redundantPairs.push({ a: i, b: j, reason: `Duplicate role ${roles[i]}` });
      }
    }
  }
  return { mode, shotTypes, roles, rationale, optionalShotIndexes, redundantPairs };
}

export function dramaticPurposeFor(
  shotType: ShotType,
  fn: NarrativeFunction,
  role: CoverageRole,
  index: number
): DramaticPurpose {
  if (role === "establishing" || shotType === "establishing") return "establish_geography";
  if (role === "reaction" || shotType === "reaction") return "capture_reaction";
  if (role === "insert" || shotType === "insert" || shotType === "macro") {
    return fn === "product" ? "show_object_detail" : "reveal_information";
  }
  if (role === "closeup" || role === "extreme_closeup" || shotType === "closeup") return "emphasize_emotion";
  if (role === "over_the_shoulder" || shotType === "over_the_shoulder") return "deliver_dialogue";
  if (role === "tracking" || shotType === "tracking") return "show_action";
  if (fn === "confrontation") return index === 0 ? "show_relationship" : "create_suspense";
  if (fn === "hook") return index === 0 ? "orient_viewer" : "introduce_character";
  if (fn === "montage") return "create_rhythm";
  if (fn === "cta") return "emphasize_emotion";
  return "provide_editorial_coverage";
}

export function planMotivatedMovement(params: {
  purpose: DramaticPurpose;
  shotType: ShotType;
  preferred: CameraMovement[];
  emotionalObjective?: string;
}): { movement: CameraMovement; motivation: MovementMotivation; reason: string } {
  const { purpose, shotType, preferred, emotionalObjective } = params;
  const tone = (emotionalObjective || "").toLowerCase();

  if (purpose === "show_object_detail" || shotType === "macro" || shotType === "insert") {
    const movement = preferred.includes("orbit") ? "orbit" : "static";
    return {
      movement,
      motivation: movement === "orbit" ? "product_hero" : "none_static_preferred",
      reason: movement === "orbit" ? "Orbit reveals product form" : "Detail insert needs stability",
    };
  }
  if (purpose === "emphasize_emotion" && (preferred.includes("push_in") || tone.includes("intim"))) {
    return { movement: "push_in", motivation: "psychological_intimacy", reason: "Slow push-in increases intimacy as the beat lands" };
  }
  if (purpose === "establish_geography") {
    if (preferred.includes("crane")) return { movement: "crane", motivation: "reveal_scale", reason: "Crane reveals geography and scale" };
    if (preferred.includes("pull_out")) return { movement: "pull_out", motivation: "reveal_isolation", reason: "Pull-out reveals environment around subject" };
    if (preferred.includes("pan")) return { movement: "pan", motivation: "reveal_information", reason: "Pan surveys geography" };
    return { movement: "static", motivation: "none_static_preferred", reason: "No survey motivation — keep establishing locked" };
  }
  if (purpose === "show_action" || shotType === "tracking") {
    const movement = preferred.includes("tracking") ? "tracking" : preferred.includes("dolly") ? "dolly" : "tracking";
    return { movement, motivation: "follow_subject", reason: "Follow subject to preserve action geography" };
  }
  if (purpose === "create_suspense") {
    return preferred.includes("handheld")
      ? { movement: "handheld", motivation: "documentary_immediacy", reason: "Subtle handheld supports tension" }
      : { movement: "static", motivation: "none_static_preferred", reason: "Static holds tension without unmotivated motion" };
  }
  if (purpose === "create_rhythm") {
    const movement = preferred.includes("tracking") ? "tracking" : preferred.includes("handheld") ? "handheld" : preferred[0] || "dolly";
    return { movement, motivation: "editorial_energy", reason: "Motivated kinetic move supports montage rhythm" };
  }
  return { movement: "static", motivation: "none_static_preferred", reason: "No valid movement motivation — prefer static/restrained camera" };
}

export function lensFor(purpose: DramaticPurpose, shotType: ShotType): { intent: LensIntent; focal?: string } {
  if (purpose === "establish_geography" || shotType === "establishing" || shotType === "wide" || shotType === "aerial") {
    return { intent: "wide", focal: "24-35mm semantic" };
  }
  if (purpose === "emphasize_emotion" || purpose === "capture_reaction" || shotType === "closeup") {
    return { intent: "moderate_telephoto", focal: "85mm semantic" };
  }
  if (purpose === "show_object_detail" || shotType === "macro") return { intent: "intimate", focal: "macro/85mm semantic" };
  if (purpose === "create_scale") return { intent: "very_wide", focal: "14-24mm semantic" };
  if (purpose === "show_relationship") return { intent: "normal", focal: "35-50mm semantic" };
  return { intent: "neutral", focal: "35-50mm semantic" };
}

export function depthFor(purpose: DramaticPurpose, shotType: ShotType): DepthIntent {
  if (purpose === "emphasize_emotion" || purpose === "capture_reaction" || shotType === "closeup" || shotType === "extreme_closeup") {
    return "shallow_depth";
  }
  if (purpose === "show_object_detail" || shotType === "macro") return "subject_isolation";
  if (purpose === "establish_geography" || shotType === "establishing" || shotType === "wide") return "deep_focus";
  if (purpose === "create_suspense") return "shallow_depth";
  return "moderate_depth";
}

export function buildTemporalBeats(durationSec: number, purpose: DramaticPurpose, movement: CameraMovement): TemporalBeat[] {
  if (durationSec <= 3 || movement === "static") {
    return [{ index: 0, label: "hold", description: `Hold ${purpose} with clear subject readability`, startHintSec: 0, endHintSec: durationSec }];
  }
  const a = Math.max(1, Math.round(durationSec * 0.35));
  const b = Math.max(a + 1, Math.round(durationSec * 0.7));
  return [
    { index: 0, label: "start", description: "Establish starting visual state", startHintSec: 0, endHintSec: a },
    { index: 1, label: "development", description: "Advance subject/camera beat", startHintSec: a, endHintSec: b },
    { index: 2, label: "end", description: "Arrive at readable end state for handoff", startHintSec: b, endHintSec: durationSec },
  ];
}

export function buildShotCinematicIntelligence(params: {
  shotType: ShotType;
  narrativeFunction: NarrativeFunction;
  coverageRole: CoverageRole;
  index: number;
  durationSec: number;
  characterIds: string[];
  locationId?: string;
  propIds: string[];
  emotionalObjective?: string;
  preferredMovements: CameraMovement[];
  treatment: VisualTreatment;
  beginState: string;
  endState: string;
  preferI2V: boolean;
}): { cinematic: ShotCinematicIntelligence; movement: CameraMovement } {
  const purpose = dramaticPurposeFor(params.shotType, params.narrativeFunction, params.coverageRole, params.index);
  const move = planMotivatedMovement({
    purpose,
    shotType: params.shotType,
    preferred: params.preferredMovements,
    emotionalObjective: params.emotionalObjective,
  });
  const lens = lensFor(purpose, params.shotType);
  const depth = depthFor(purpose, params.shotType);
  const beats = buildTemporalBeats(params.durationSec, purpose, move.movement);
  const hasChars = params.characterIds.length > 0;
  const hasLoc = Boolean(params.locationId);
  const needsEnd = move.movement !== "static" && params.durationSec >= 5;

  const cinematic: ShotCinematicIntelligence = {
    dramaticPurpose: purpose,
    visualObjective: `Serve ${purpose} for ${params.narrativeFunction}`,
    emotionalObjective: params.emotionalObjective || String(params.narrativeFunction),
    informationPriority: purpose === "reveal_information" || purpose === "show_object_detail" ? "high" : "balanced",
    coverageRole: params.coverageRole,
    editorialRole: params.coverageRole === "reaction" || params.coverageRole === "insert" ? "coverage_option" : "primary_story",
    framing: String(params.shotType),
    lensIntent: lens.intent,
    focalLengthIntent: lens.focal,
    depthOfFieldIntent: depth,
    movementMotivation: move.motivation,
    physicalCameraPath:
      move.movement === "static"
        ? undefined
        : {
            startPosition: "motivated start frame",
            movementPath: `${move.movement} along story axis`,
            subjectAnchor: params.characterIds[0] || "primary_subject",
            movementSpeed: move.movement === "push_in" ? "slow" : "controlled",
            reveal: purpose === "reveal_information" || purpose === "establish_geography" ? "reveal story information" : undefined,
            endPosition: "stable end frame for cut",
          },
    temporalBeats: beats,
    motionSeparation: {
      visualState: params.beginState,
      subjectMotion: "one clear motivated subject action",
      cameraState: move.movement,
      environmentalMotion: "subtle practical atmosphere only if motivated",
      temporalState: beats.map((b) => b.label).join(" → "),
    },
    spatial: {
      axis: "scene_axis_v1",
      screenDirection: "stable audience-facing unless confrontation",
      eyeline: hasChars ? "consistent eyeline across dialogue axis" : "environment-facing",
      cameraSide: "axis-preserving side",
      subjectPosition: "primary third",
      axisPolicy: "preserve",
    },
    visualHierarchy: {
      primarySubject: params.characterIds[0] || "primary_subject",
      secondarySubject: params.characterIds[1],
      environmentalContext: params.locationId,
    },
    handoff: {
      outgoingState: params.endState,
      requiredIncomingState: params.endState,
      cutReason: "continue narrative progression",
      transitionType: "cut",
      transitionMotivation: purpose === "show_action" ? "action" : purpose === "capture_reaction" ? "gaze" : "continuity_match",
    },
    referenceRequirements: {
      requiresCharacterReference: hasChars,
      characterIds: [...params.characterIds],
      requiresLocationReference: hasLoc,
      locationIds: params.locationId ? [params.locationId] : [],
      requiresPropReference: params.propIds.length > 0,
      propIds: [...params.propIds],
      requiresStyleReference: params.treatment.references.length > 0,
      requiresStartFrame: params.preferI2V,
      requiresEndFrame: needsEnd,
    },
    capabilityRequirements: {
      imageToVideo: params.preferI2V,
      textToVideo: !params.preferI2V,
      startFrame: params.preferI2V,
      endFrame: needsEnd,
      characterReference: hasChars,
      locationReference: hasLoc,
      styleReference: params.treatment.references.length > 0,
      cameraMotion: move.movement,
      temporalControl: beats.length > 1,
      durationSeconds: params.durationSec,
    },
    generationIntent: {
      generationResolution: "1080p",
      finishingResolution: params.treatment.aspectRatioIntent === "cinematic_widescreen" ? "4k" : "1080p",
      qualityPriority: "balanced",
      upscaleEligible: true,
      rationale: "Generate at efficient working resolution; upscale in finishing when beneficial",
    },
    lookSignature: lookSignature(params.treatment),
    treatmentId: params.treatment.id,
    rationale: {
      framing: `${params.shotType} framing serves ${purpose}`,
      movement: move.reason,
      lensIntent: `${lens.intent}${lens.focal ? ` (${lens.focal})` : ""} supports ${purpose}`,
      depthOfField: `${depth} supports subject/environment priority for ${purpose}`,
      duration: `${params.durationSec}s fits beat count ${beats.length}`,
      coverage: `${params.coverageRole} coverage role`,
      purpose: `Shot exists to ${purpose}`,
    },
    quality: {
      purposeClarity: 0.9,
      coverageValue: params.coverageRole === "master" || params.coverageRole === "establishing" ? 0.9 : 0.8,
      compositionQuality: 0.8,
      cameraMotivation: move.motivation === "none_static_preferred" && move.movement !== "static" ? 0.4 : 0.9,
      spatialConsistency: 0.85,
      temporalCoherence: beats.length ? 0.85 : 0.7,
      continuityReadiness: 0.8,
      capabilityFit: 0.8,
      editorialUtility: 0.8,
      referenceReadiness: hasChars || hasLoc ? 0.75 : 0.55,
    },
    capabilityFallback: needsEnd
      ? {
          constraint: "End-frame lock may be unsupported by some providers",
          creativeRisk: "Trajectory drift between start and end",
          fallbackOptions: ["Split into two shots with editorial bridge", "Use start-frame only with stronger motion brief"],
        }
      : undefined,
    promptRelevance: {
      purpose: "required",
      framing: "required",
      movement: move.movement === "static" ? "optional" : "required",
      temporalBeats: beats.length > 1 ? "important" : "optional",
      look: "important",
      lens: "optional",
      depthOfField: "optional",
    },
    principlesApplied: ["A", "D", "E", "G", "J"],
    validationIssues: [],
    confidence: 0.84,
  };

  if (cinematic.movementMotivation === "none_static_preferred" && move.movement !== "static") {
    cinematic.validationIssues.push("unmotivated_camera_movement");
  }

  return { cinematic, movement: move.movement };
}

export function validateCinematicShot(cinematic: ShotCinematicIntelligence): string[] {
  const issues = [...cinematic.validationIssues];
  if (!cinematic.dramaticPurpose) issues.push("missing_purpose");
  if (!cinematic.rationale.movement) issues.push("missing_movement_rationale");
  if (
    cinematic.movementMotivation === "none_static_preferred" &&
    cinematic.capabilityRequirements.cameraMotion !== "static" &&
    cinematic.capabilityRequirements.cameraMotion !== "none"
  ) {
    issues.push("unmotivated_camera_movement");
  }
  if (cinematic.spatial.axisPolicy === "intentionally_cross" && !cinematic.spatial.axisCrossReason) {
    issues.push("axis_cross_missing_reason");
  }
  if (cinematic.referenceRequirements.requiresCharacterReference && cinematic.referenceRequirements.characterIds.length === 0) {
    issues.push("character_reference_unresolved");
  }
  return Array.from(new Set(issues));
}

export function evaluateCinematicGate(params: {
  treatment?: VisualTreatment;
  shots: Array<{ purpose?: string; cinematic?: ShotCinematicIntelligence }>;
}): { ready: boolean; checks: Array<{ id: string; ok: boolean; detail: string }> } {
  const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
  checks.push({
    id: "visual_treatment",
    ok: Boolean(params.treatment),
    detail: params.treatment ? `treatment ${params.treatment.lookPreset}` : "missing treatment",
  });
  const purposeless = params.shots.filter((s) => !s.purpose?.trim() && !s.cinematic?.dramaticPurpose);
  checks.push({
    id: "shot_purpose",
    ok: purposeless.length === 0,
    detail: purposeless.length ? `${purposeless.length} purposeless shots` : "all shots have purpose",
  });
  const unmotivated = params.shots.filter(
    (s) => s.cinematic && validateCinematicShot(s.cinematic).includes("unmotivated_camera_movement")
  );
  checks.push({
    id: "movement_motivation",
    ok: unmotivated.length === 0,
    detail: unmotivated.length ? `${unmotivated.length} unmotivated moves` : "movement motivated or static",
  });
  const refsPending = params.shots.filter(
    (s) =>
      s.cinematic?.referenceRequirements.requiresCharacterReference &&
      s.cinematic.referenceRequirements.characterIds.length === 0
  );
  checks.push({
    id: "reference_requirements",
    ok: refsPending.length === 0,
    detail: refsPending.length ? "character refs required but empty" : "reference requirements explicit",
  });
  return { ready: checks.every((c) => c.ok), checks };
}
