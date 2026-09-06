/**
 * Phase 6 — operational path: ShotSpec → GenerationIntent → capabilities → GenerationTask.
 * Reuses existing preproduction + routing; does not introduce a parallel planner/DAG/UI.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { RoutingSpec } from "../specification/routingSpec";
import type {
  CharacterVisualContract,
  LocationVisualContract,
  ProductVisualContract,
  StoryboardBlueprint,
  StoryboardPanelSpec,
  VisualTreatment,
} from "../preproduction";
import { buildGenerationIntent } from "./buildGenerationIntent";
import { resolveGenerationCapabilities } from "./capabilityResolution";
import {
  compileGenerationIntentToTasks,
  type CompiledGenerationPlan,
} from "./compileIntentToTasks";
import type {
  CapabilityResolutionResult,
  GenerationIntent,
  GenerationQualityMode,
} from "./generationIntent";
import type { StoryboardFrameAsset } from "../preproduction/storyboardFrame";
import type { GeneratedStateFrame } from "./generatedStateFrame";
import type { FrameStrategyCapabilities } from "./frameStrategy";

export interface OperationalShotGenerationParams {
  productionId: string;
  scene: SceneSpec;
  shot: ShotSpec;
  routing: RoutingSpec;
  storyboard?: StoryboardBlueprint | null;
  panel?: StoryboardPanelSpec | null;
  treatment?: VisualTreatment | null;
  characters?: CharacterVisualContract[];
  location?: LocationVisualContract | null;
  products?: ProductVisualContract[];
  previousShot?: ShotSpec | null;
  qualityMode?: GenerationQualityMode;
  availableProviderIds?: string[];
  preferredProviderId?: string;
  candidateCounts?: { low: number; medium: number; high: number };
  includeKeyframe?: boolean;
  /** Individual planned storyboard frame for this shot (not the sheet overview). */
  storyboardFrame?: StoryboardFrameAsset | null;
  storyboardEndFrame?: StoryboardFrameAsset | null;
  /** Observed last frame from prior generated shot for continuation. */
  previousGeneratedStateFrame?: GeneratedStateFrame | null;
  frameStrategyCapabilities?: FrameStrategyCapabilities;
}

export interface OperationalShotGenerationResult {
  intent: GenerationIntent;
  resolution: CapabilityResolutionResult;
  plan: CompiledGenerationPlan;
}

/**
 * Build intent → resolve capabilities → compile GenerationTask nodes for one shot.
 */
export function planOperationalShotGeneration(
  params: OperationalShotGenerationParams
): OperationalShotGenerationResult {
  const intent = buildGenerationIntent({
    productionId: params.productionId,
    scene: params.scene,
    shot: params.shot,
    storyboard: params.storyboard,
    panel: params.panel,
    treatment: params.treatment,
    characters: params.characters,
    location: params.location,
    products: params.products,
    previousShot: params.previousShot,
    qualityMode: params.qualityMode,
    candidateCounts: params.candidateCounts,
    storyboardFrame: params.storyboardFrame,
    storyboardEndFrame: params.storyboardEndFrame,
    previousGeneratedStateFrame: params.previousGeneratedStateFrame,
    frameStrategyCapabilities: params.frameStrategyCapabilities,
  });

  const resolution = resolveGenerationCapabilities({
    intent,
    shot: params.shot,
    routing: params.routing,
    availableProviderIds: params.availableProviderIds,
    preferredProviderId: params.preferredProviderId,
  });

  const plan = compileGenerationIntentToTasks({
    intent,
    resolution,
    includeKeyframe: params.includeKeyframe,
  });

  return {
    intent: plan.intent,
    resolution,
    plan,
  };
}
