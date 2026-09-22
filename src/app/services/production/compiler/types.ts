/**
 * Canonical Provider Payload Compiler Contracts
 *
 * Core Principle: SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 *
 * Translates provider-neutral production intent into exact provider payloads.
 *
 * Invariants:
 * - Compiler does NOT route (Phase 6 chooses provider/model).
 * - Compiler does NOT estimate costs (Phase 7 CostEngine).
 * - Compiler does NOT manage credits (Phase 8 CreditService).
 * - 100% deterministic transformation.
 * - Credentials never emitted into payloads.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { CraftPlan } from "../craft/types";
import type { ReferenceGraph } from "../specification/referenceGraph";
import type { StyleBible } from "../specification/styleBible";
import type { MediaCapabilityProfile } from "../capability/types";
import type { SemanticReference, SemanticReferenceRole } from "../specification/semanticMedia";

/**
 * High-level provider media input role.
 */
export type ProviderMediaRole =
  | "first_frame"
  | "last_frame"
  | "reference_image"
  | "character_reference"
  | "style_reference"
  | "driving_video"
  | "source_video"
  | "audio_track"
  | "mask";

/**
 * Resolved and role-annotated media input.
 */
export interface CompiledMediaInput {
  role: ProviderMediaRole;
  url: string;
  mimeType?: string;
  semanticNodeId?: string;
  semanticRole?: SemanticReferenceRole;
  importance: "required" | "preferred" | "optional";
}

/**
 * Normalized parameter set across modalities.
 */
export interface NormalizedGenerationParameters {
  durationSec?: number;
  durationString?: string;
  aspectRatio: string;
  resolution: string;
  fps?: number;
  generateAudio?: boolean;
  seed?: number;
  klingMode?: "std" | "pro";
  klingSound?: "on" | "off";
  cameraMotion?: Record<string, unknown>;
  customParameters?: Record<string, unknown>;
}

/**
 * Input request for provider payload compilation.
 */
export interface ProviderPayloadCompilationRequest {
  shot: ShotSpec;
  craftPlan?: CraftPlan;
  referenceGraph?: ReferenceGraph;
  styleBible?: StyleBible;
  capabilityProfile: MediaCapabilityProfile;
  providerId: string;
  modelId: string;
  brandId?: string;
  productionId?: string;
  sceneId?: string;
  overrideReferences?: SemanticReference[];
  executionPolicy?: {
    strictConstraints?: boolean;
    allowDegradationWarnings?: boolean;
  };
}

/**
 * Multi-layer validation output for compilation.
 */
export interface CompilationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  degradedFeatures: string[];
}

/**
 * Canonical output of the Provider Payload Compiler.
 */
export interface CompiledProviderRequest {
  providerId: string;
  modelId: string;
  operation: string;

  /** Fully compiled, provider-tailored positive prompt */
  prompt: string;

  /** Provider-tailored negative prompt (if supported) */
  negativePrompt?: string;

  /** Provider media roles mapped and bounded by provider limits */
  media: {
    firstFrame?: string;
    lastFrame?: string;
    references?: string[];
    inputs: CompiledMediaInput[];
  };

  /** Normalized provider-neutral and provider-specific model parameters */
  parameters: Record<string, unknown>;

  /** Ready-to-send JSON-serializable wire body for the provider API */
  rawPayload: Record<string, unknown>;

  /** Reproducibility & audit metadata */
  metadata: {
    compilerVersion: string;
    promptCompilerVersion: string;
    capabilityProfileVersion?: string;
    sourceShotId?: string;
    sourceSceneId?: string;
    sourceProductionId?: string;
    compiledAt: string;
  };

  /** Explicit validation outcome */
  validation: CompilationValidation;
}

/**
 * Provider-specific translator interface.
 */
export interface IProviderPayloadTranslator {
  providerId: string;
  supports(modelId: string): boolean;
  translate(
    request: ProviderPayloadCompilationRequest,
    intermediates: {
      prompt: string;
      negativePrompt?: string;
      mediaInputs: CompiledMediaInput[];
      normalizedParams: NormalizedGenerationParameters;
    }
  ): {
    operation: string;
    rawPayload: Record<string, unknown>;
    parameters: Record<string, unknown>;
    validation: CompilationValidation;
  };
}
