/**
 * Video generation bridge — compiles ShotSpec + panel + visual contracts into
 * provider-neutral VideoGenerationIntent / MultimodalVideoGenerationRequest.
 *
 * Motion is ALWAYS separate from appearance (never inferred from a still alone).
 * ShotSpec remains canonical; panel.shotId links without duplicating ShotSpec.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type {
  CharacterVisualContract,
  ClassifiedReference,
  LocationVisualContract,
  MultimodalVideoGenerationRequest,
  ProductVisualContract,
  ReferenceManifest,
  StoryboardPanelSpec,
  VideoGenerationIntent,
  VisualTreatment,
} from "./types";
import { buildReferenceManifest, optimizeReferenceBudget } from "./referenceManifest";
import { getMaxMultimodalReferences } from "../../runtime/providerCapabilities";

function lightingSummary(shot: ShotSpec): string {
  const parts = [
    shot.lighting.atmosphere,
    shot.lighting.direction,
    shot.lighting.intensity,
    shot.lighting.color,
    shot.lighting.timeOfDay,
  ].filter(Boolean);
  return parts.join("; ") || "motivated lighting";
}

function appearanceVisualState(params: {
  shot: ShotSpec;
  panel?: StoryboardPanelSpec;
  characters?: CharacterVisualContract[];
  location?: LocationVisualContract | null;
  products?: ProductVisualContract[];
  treatment?: VisualTreatment | null;
}): string {
  const chars = (params.characters || [])
    .filter(
      (c) =>
        params.shot.characterIds.includes(c.characterId) ||
        params.shot.characterIds.includes(c.assetRef)
    )
    .map((c) => `${c.identity}; face:${c.face}; wardrobe:${c.wardrobe}`)
    .join(" | ");
  const loc = params.location?.environmentIdentity || params.shot.environment;
  const products = (params.products || [])
    .map((p) => `${p.identity}; ${p.shape}; branding:${p.branding}`)
    .join(" | ");
  const treatment = params.treatment
    ? `${params.treatment.lookLabel}; ${params.treatment.palette}`
    : "";
  return [
    chars || params.shot.subject,
    loc,
    products,
    treatment,
    params.panel ? `panel composition: ${params.panel.composition}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Compile a VideoGenerationIntent from canonical ShotSpec (+ optional panel/contracts).
 * Appearance and motion are separate fields — motion always from ShotSpec.motion.
 */
export function compileVideoGenerationIntent(params: {
  productionId: string;
  shot: ShotSpec;
  panel?: StoryboardPanelSpec;
  treatment?: VisualTreatment | null;
  characters?: CharacterVisualContract[];
  location?: LocationVisualContract | null;
  products?: ProductVisualContract[];
  referenceManifest?: ReferenceManifest;
  qualityTarget?: VideoGenerationIntent["qualityTarget"];
  candidateIndex?: number;
  aspectRatio?: string;
  sceneId?: string;
  sequenceId?: string;
}): VideoGenerationIntent {
  const { shot, panel } = params;
  if (panel && panel.shotId !== shot.id) {
    throw new Error(`panel.shotId ${panel.shotId} does not match ShotSpec.id ${shot.id}`);
  }

  const composition = panel?.composition || shot.camera.composition;
  const framing = panel?.framing || shot.camera.framing;
  const lighting = panel?.lightingIntent || lightingSummary(shot);
  const locationId = params.location?.locationId || panel?.locations[0];
  const envDescription =
    params.location?.environmentIdentity || shot.environment || panel?.environmentAction || "";

  const manifest =
    params.referenceManifest ||
    buildReferenceManifest({
      productionId: params.productionId,
      shotId: shot.id,
      panelId: panel?.panelId,
      treatment: params.treatment ?? undefined,
      characters: params.characters,
      locations: params.location ? [params.location] : undefined,
      products: params.products,
      panel,
    });

  const capabilityRequirements: string[] = ["image_to_video", "motion_quality"];
  if (shot.characterIds.length) capabilityRequirements.push("character_consistency");
  if (shot.references.firstFrameUrl || shot.references.lastFrameUrl) {
    capabilityRequirements.push("first_frame_conditioning");
  }
  if (shot.dialogue) capabilityRequirements.push("dialogue");

  return {
    shotId: shot.id,
    panelId: panel?.panelId,
    productionId: params.productionId,
    appearance: {
      visualState: appearanceVisualState(params),
      composition,
      framing,
      lighting,
      treatmentSummary: params.treatment
        ? `${params.treatment.lookLabel}; ${params.treatment.cameraLanguage}`
        : shot.atmosphere || shot.color || "",
    },
    /** Motion ALWAYS from ShotSpec — never inferred from storyboard still alone */
    motion: {
      subjectMotion: shot.motion.subjectMovement || shot.subjectAction,
      cameraMotion:
        shot.motion.cameraMovementDetail || String(shot.camera.cameraMovement),
      environmentMotion: shot.motion.environmentalMovement || "",
      temporalOrder: `${shot.motion.beginState} → ${shot.motion.endState}`,
      speed: shot.motion.timingNotes || "motivated_pace",
    },
    camera: {
      position: shot.camera.cameraPosition,
      lensIntent: shot.camera.lens || panel?.camera.lensIntent || "unspecified",
      depthOfField: shot.camera.depthOfField || panel?.camera.depthOfField || "unspecified",
      movement: String(shot.camera.cameraMovement),
    },
    environment: {
      locationId,
      description: envDescription,
    },
    temporal: {
      durationSec: shot.durationSec,
      startState: shot.motion.beginState,
      endState: shot.motion.endState,
    },
    audio: {
      dialogue: shot.dialogue,
      ambience: shot.atmosphere,
    },
    continuity: {
      incomingState: panel
        ? [
            panel.incomingState.subjectPosition,
            panel.incomingState.lighting,
            ...panel.incomingState.wardrobe,
          ].join("; ")
        : shot.motion.beginState,
      outgoingState: panel
        ? [
            panel.outgoingState.subjectPosition,
            panel.outgoingState.lighting,
            ...panel.outgoingState.wardrobe,
          ].join("; ")
        : shot.motion.endState,
      requirements: shot.continuityRequirements ?? [],
    },
    referenceManifest: manifest,
    capabilityRequirements: Array.from(new Set(capabilityRequirements)),
    aspectRatio: params.aspectRatio || shot.aspectRatio || "16:9",
    qualityTarget: params.qualityTarget || "balanced",
    candidateIndex: params.candidateIndex,
    trace: {
      productionId: params.productionId,
      sceneId: params.sceneId || shot.sceneId,
      sequenceId: params.sequenceId,
      shotId: shot.id,
      panelId: panel?.panelId,
      referenceManifestId: manifest.id,
      mode: panel?.generationIntent.mode === "final" ? "final" : "generation",
    },
  };
}

export function buildMultimodalVideoGenerationRequest(params: {
  intent: VideoGenerationIntent;
  providerId: string;
  /** Optional override; otherwise registry getMaxMultimodalReferences(providerId) */
  maxSlots?: number;
  storyboardReferenceUrl?: string;
}): MultimodalVideoGenerationRequest {
  const { intent } = params;
  const refs = intent.referenceManifest.references;

  const characterReferences = refs.filter(
    (r) => r.referenceRole === "identity" || r.subjectKind === "character"
  );
  const locationReferences = refs.filter(
    (r) => r.referenceRole === "environment" || r.subjectKind === "location"
  );
  const productReferences = refs.filter(
    (r) => r.referenceRole === "product" || r.subjectKind === "product"
  );
  const styleReferences = refs.filter((r) => r.referenceRole === "style");
  const motionReferences = refs.filter((r) => r.referenceRole === "motion");
  const audioReferences = refs.filter((r) => r.referenceRole === "audio");
  const primaryStoryboardReference =
    refs.find((r) => r.referenceRole === "composition") ||
    (params.storyboardReferenceUrl
      ? ({
          referenceId: `ref_storyboard_${intent.panelId || intent.shotId}`,
          referenceRole: "composition" as const,
          scope: "panel" as const,
          priority: "high_value" as const,
          version: 1,
          provenance: "storyboard_bridge",
          url: params.storyboardReferenceUrl,
        } satisfies ClassifiedReference)
      : undefined);

  const maxSlots =
    typeof params.maxSlots === "number"
      ? params.maxSlots
      : getMaxMultimodalReferences(params.providerId);

  const budget = optimizeReferenceBudget({
    manifest: intent.referenceManifest,
    providerId: params.providerId,
    maxSlots,
  });

  const textIntent = [
    intent.appearance.visualState,
    `Composition: ${intent.appearance.composition}`,
    `Framing: ${intent.appearance.framing}`,
    `Lighting: ${intent.appearance.lighting}`,
    intent.appearance.treatmentSummary,
  ]
    .filter(Boolean)
    .join(". ");

  const cameraIntent = [
    `position ${intent.camera.position}`,
    `movement ${intent.camera.movement}`,
    `lens ${intent.camera.lensIntent}`,
    `DoF ${intent.camera.depthOfField}`,
  ].join("; ");

  /** Motion intent is compiled separately from appearance — do not merge into textIntent alone */
  const motionIntent = [
    `subject: ${intent.motion.subjectMotion}`,
    `camera: ${intent.motion.cameraMotion}`,
    intent.motion.environmentMotion
      ? `environment: ${intent.motion.environmentMotion}`
      : "",
    `temporal: ${intent.motion.temporalOrder}`,
    `speed: ${intent.motion.speed}`,
  ]
    .filter(Boolean)
    .join("; ");

  return {
    shotId: intent.shotId,
    primaryStoryboardReference,
    characterReferences,
    locationReferences,
    productReferences,
    styleReferences,
    motionReferences,
    audioReferences,
    textIntent,
    cameraIntent,
    motionIntent,
    durationSec: intent.temporal.durationSec,
    aspectRatio: intent.aspectRatio,
    quality: intent.qualityTarget,
    capabilityRequirements: intent.capabilityRequirements,
    packedReferences: budget.selected,
    budget,
    intent,
  };
}

/** Assert motion fields are not collapsed into appearance (test/helper). */
export function assertMotionSeparatedFromAppearance(intent: VideoGenerationIntent): boolean {
  return (
    Boolean(intent.motion.subjectMotion) &&
    Boolean(intent.motion.temporalOrder) &&
    intent.appearance.visualState !== intent.motion.subjectMotion &&
    !("subjectMotion" in (intent.appearance as object))
  );
}
