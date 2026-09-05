/**
 * Build GenerationIntent from ShotSpec + storyboard panel + reference manifest.
 * Reuses compileVideoGenerationIntent — does not invent a second cinematic planner.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import { strategyFromAlias } from "../specification/generationStrategy";
import {
  compileVideoGenerationIntent,
  buildStoryboardPanelFromShot,
  buildReferenceManifest,
  scoreShotGenerationRisk,
  type CharacterVisualContract,
  type LocationVisualContract,
  type ProductVisualContract,
  type VisualTreatment,
  type StoryboardPanelSpec,
  type StoryboardBlueprint,
  type ReferenceManifest,
} from "../preproduction";
import type {
  CandidatePolicy,
  GenerationConstraint,
  GenerationIntent,
  GenerationQualityMode,
  ShotHandoffState,
} from "./generationIntent";

function hashId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(16)}`;
}

function lightingText(shot: ShotSpec): string {
  return (
    [shot.lighting.atmosphere, shot.lighting.direction, shot.lighting.intensity, shot.lighting.color]
      .filter(Boolean)
      .join("; ") || "motivated lighting"
  );
}

function handoffFromShot(
  shot: ShotSpec,
  which: "start" | "end",
  panel?: StoryboardPanelSpec
): ShotHandoffState {
  const state = which === "start" ? shot.motion.beginState : shot.motion.endState;
  const panelState = which === "start" ? panel?.incomingState : panel?.outgoingState;
  return {
    subjectPosition: panelState?.subjectPosition || state,
    cameraPosition: shot.camera.cameraPosition,
    lighting: panelState?.lighting || lightingText(shot),
    wardrobe: panelState?.wardrobe,
    propState: panelState?.propsHeld,
    notes: panelState?.notes?.length ? panelState.notes : [state],
  };
}

export function mapQualityMode(
  mode?: "previs" | "balanced" | "final" | GenerationQualityMode
): GenerationQualityMode {
  if (mode === "previs") return "previs";
  if (mode === "final" || mode === "high_quality") return "high_quality";
  return "standard";
}

export function buildCandidatePolicy(params: {
  shot: ShotSpec;
  qualityMode?: GenerationQualityMode;
  referenceManifest?: ReferenceManifest;
  /** Configurable overrides — defaults are policy, not eternal hard-codes */
  candidateCounts?: { low: number; medium: number; high: number };
}): CandidatePolicy {
  const risk = scoreShotGenerationRisk({
    shot: params.shot,
    referenceManifest: params.referenceManifest,
  });
  const counts = params.candidateCounts || { low: 1, medium: 2, high: 3 };
  const recommendedCandidateCount =
    risk.level === "high" ? counts.high : risk.level === "medium" ? counts.medium : counts.low;
  return {
    riskScore: risk.score,
    riskLevel: risk.level,
    riskFactors: risk.factors,
    recommendedCandidateCount,
    qualityMode:
      params.qualityMode ||
      mapQualityMode(risk.level === "high" ? "final" : risk.level === "low" ? "balanced" : "balanced"),
    preferStrongerProvider: risk.recommendStrongerProvider,
    preferMoreReferences: risk.recommendMoreReferences,
  };
}

function buildConstraints(params: {
  shot: ShotSpec;
  manifest: ReferenceManifest;
  qualityMode: GenerationQualityMode;
}): { hard: GenerationConstraint[]; soft: GenerationConstraint[] } {
  const hard: GenerationConstraint[] = [];
  const soft: GenerationConstraint[] = [];

  if (params.shot.characterIds.length) {
    hard.push({
      id: "hard_character_identity",
      kind: "hard",
      category: "identity",
      description: "Character identity must match locked visual contracts",
      capability: "character_consistency",
    });
  }
  if (params.shot.propIds.length || params.shot.assetIds.length) {
    hard.push({
      id: "hard_product_appearance",
      kind: "hard",
      category: "product",
      description: "Product / prop appearance must match approved references when present",
      capability: "object_consistency",
    });
  }
  if (params.shot.aspectRatio) {
    hard.push({
      id: "hard_aspect_ratio",
      kind: "hard",
      category: "aspect_ratio",
      description: `Aspect ratio ${params.shot.aspectRatio} is required`,
    });
  }
  hard.push({
    id: "hard_duration",
    kind: "hard",
    category: "duration",
    description: `Duration target ${params.shot.durationSec}s`,
  });
  for (const req of params.shot.continuityRequirements) {
    hard.push({
      id: `hard_continuity_${hashId("c", req).slice(-6)}`,
      kind: "hard",
      category: "continuity",
      description: req,
    });
  }
  if (params.manifest.conflicts.some((c) => c.severity === "blocking")) {
    hard.push({
      id: "hard_reference_conflict",
      kind: "hard",
      category: "identity",
      description: "Blocking reference conflicts must be resolved before generation",
    });
  }

  soft.push({
    id: "soft_camera_move",
    kind: "soft",
    category: "camera",
    description: `Preferred camera movement: ${String(params.shot.camera.cameraMovement)}`,
    capability: "motion_quality",
  });
  soft.push({
    id: "soft_lighting",
    kind: "soft",
    category: "lighting",
    description: lightingText(params.shot),
  });
  if (params.qualityMode === "high_quality") {
    soft.push({
      id: "soft_high_res",
      kind: "soft",
      category: "delivery",
      description: "Prefer higher resolution when cost allows",
      capability: "high_resolution",
    });
  }

  return { hard, soft };
}

export function buildGenerationIntent(params: {
  productionId: string;
  scene: SceneSpec;
  shot: ShotSpec;
  storyboard?: StoryboardBlueprint | null;
  panel?: StoryboardPanelSpec | null;
  treatment?: VisualTreatment | null;
  characters?: CharacterVisualContract[];
  location?: LocationVisualContract | null;
  products?: ProductVisualContract[];
  referenceManifest?: ReferenceManifest;
  qualityMode?: GenerationQualityMode;
  previousShot?: ShotSpec | null;
  candidateCounts?: { low: number; medium: number; high: number };
}): GenerationIntent {
  const { shot, scene } = params;
  const panel =
    params.panel ||
    params.storyboard?.panels.find((p) => p.shotId === shot.id) ||
    buildStoryboardPanelFromShot({
      shot,
      sequenceIndex: shot.index,
      visualTreatmentId: params.treatment?.id,
      characterContracts: params.characters,
      locationContract: params.location,
      productContracts: params.products,
    });

  if (panel.shotId !== shot.id) {
    throw new Error(`Storyboard panel ${panel.panelId} does not resolve to shot ${shot.id}`);
  }

  const manifest =
    params.referenceManifest ||
    buildReferenceManifest({
      productionId: params.productionId,
      shotId: shot.id,
      panelId: panel.panelId,
      treatment: params.treatment ?? undefined,
      characters: params.characters,
      locations: params.location ? [params.location] : undefined,
      products: params.products,
      panel,
    });

  const qualityMode = params.qualityMode || "standard";
  const candidatePolicy = buildCandidatePolicy({
    shot,
    qualityMode,
    referenceManifest: manifest,
    candidateCounts: params.candidateCounts,
  });

  const videoIntent = compileVideoGenerationIntent({
    productionId: params.productionId,
    shot,
    panel,
    treatment: params.treatment,
    characters: params.characters,
    location: params.location,
    products: params.products,
    referenceManifest: manifest,
    qualityTarget:
      qualityMode === "previs" ? "previs" : qualityMode === "high_quality" ? "final" : "balanced",
    aspectRatio: shot.aspectRatio || "16:9",
    sceneId: scene.id,
  });

  const { hard, soft } = buildConstraints({ shot, manifest, qualityMode });
  const intentId = hashId("gint", `${params.productionId}:${shot.id}:${panel.panelId}`);

  return {
    id: intentId,
    productionId: params.productionId,
    sceneId: scene.id,
    shotId: shot.id,
    storyboardId: params.storyboard?.id,
    panelId: panel.panelId,
    purpose: shot.purpose,
    dramaticBeat: panel.dramaticBeat || shot.purpose,
    visualObjective: panel.visualObjective || shot.subject || shot.productionReason,
    appearanceIntent: videoIntent.appearance,
    motionIntent: videoIntent.motion,
    cameraIntent: videoIntent.camera,
    lightingIntent: videoIntent.appearance.lighting,
    visualTreatmentSummary: videoIntent.appearance.treatmentSummary,
    durationSec: shot.durationSec,
    temporalBeat: videoIntent.motion.temporalOrder,
    startState: handoffFromShot(shot, "start", panel),
    endState: handoffFromShot(shot, "end", panel),
    transitionIn: shot.transitionIn,
    transitionOut: shot.transitionOut,
    referenceManifest: manifest,
    continuityRequirements: shot.continuityRequirements ?? [],
    capabilityRequirements: [...videoIntent.capabilityRequirements],
    hardConstraints: hard,
    softPreferences: soft,
    generationMode: qualityMode,
    candidatePolicy,
    strategy: shot.generationStrategySpec || strategyFromAlias(shot.generationStrategy),
    aspectRatio: shot.aspectRatio || "16:9",
    dependencies: params.previousShot ? [`${params.previousShot.id}_video`] : [],
    rationale: [
      shot.productionReason,
      `Panel ${panel.panelId} maps to ShotSpec ${shot.id}`,
      `Risk ${candidatePolicy.riskLevel} → ${candidatePolicy.recommendedCandidateCount} candidate(s)`,
      "Appearance and motion compiled separately",
      ...panel.rationale.slice(0, 2),
    ],
    confidence: panel.confidence,
    assumptions: [
      "ShotSpec is canonical; storyboard panel is visualization/execution-prep only",
      "Motion is never inferred from a still alone",
    ],
    videoIntent,
    trace: {
      productionId: params.productionId,
      sceneId: scene.id,
      shotId: shot.id,
      storyboardId: params.storyboard?.id,
      panelId: panel.panelId,
      referenceManifestId: manifest.id,
      intentId,
    },
  };
}

/** Validate wardrobe / lighting / position handoff between adjacent intents. */
export function validateShotHandoff(
  previous: GenerationIntent,
  next: GenerationIntent
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (
    previous.endState.wardrobe?.length &&
    next.startState.wardrobe?.length &&
    previous.endState.wardrobe.join("|") !== next.startState.wardrobe.join("|")
  ) {
    issues.push("wardrobe_handoff_mismatch");
  }
  if (
    previous.endState.lighting &&
    next.startState.lighting &&
    previous.endState.lighting !== next.startState.lighting &&
    next.continuityRequirements.some((r) => /light/i.test(r))
  ) {
    issues.push("lighting_handoff_mismatch");
  }
  if (
    previous.endState.subjectPosition &&
    next.startState.subjectPosition &&
    previous.endState.subjectPosition !== next.startState.subjectPosition &&
    next.continuityRequirements.some((r) => /position|spatial|screen/i.test(r))
  ) {
    issues.push("subject_position_handoff_mismatch");
  }
  return { ok: issues.length === 0, issues };
}
