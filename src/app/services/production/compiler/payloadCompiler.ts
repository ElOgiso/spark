/**
 * Main Provider Payload Compiler Orchestrator for Phase 10.
 *
 * Deterministically orchestrates:
 * Semantic Shot + CraftPlan + ReferenceGraph + StyleBible + MediaCapabilityProfile
 * ↓
 * 1. Parameter Normalization
 * 2. Reference Graph Compilation & Ordering
 * 3. Cinematography & Craft Compilation
 * 4. Style & Lighting Compilation
 * 5. Structured Prompt Assembly
 * 6. Provider-Specific Translation
 * 7. Multi-Layer Validation
 * ↓
 * CompiledProviderRequest
 */

import type {
  CompiledProviderRequest,
  IProviderPayloadTranslator,
  ProviderPayloadCompilationRequest,
} from "./types";
import { COMPILER_VERSION, PROMPT_COMPILER_VERSION } from "./constants";
import { normalizeParameters } from "./normalizer";
import { compileReferences } from "./referenceCompiler";
import { compileCinematographyAndCraft } from "./cinematographyCompiler";
import { compileStyleAndLighting } from "./styleCompiler";
import { compileStructuredPrompt } from "./promptCompiler";
import { validateCompilation } from "./validation";

// Translators
import { KlingPayloadTranslator } from "./providers/kling";
import { SeedancePayloadTranslator } from "./providers/seedance";
import { GrokPayloadTranslator } from "./providers/grok";
import { HiggsfieldPayloadTranslator } from "./providers/higgsfield";
import { VeoPayloadTranslator } from "./providers/veo";
import { OpenAIPayloadTranslator } from "./providers/openai";
import { ElevenLabsPayloadTranslator } from "./providers/elevenlabs";
import { MuxPayloadTranslator } from "./providers/mux";
import { GenericPayloadTranslator } from "./providers/generic";

export class ProviderPayloadCompiler {
  private static translators: IProviderPayloadTranslator[] = [
    new KlingPayloadTranslator(),
    new SeedancePayloadTranslator(),
    new GrokPayloadTranslator(),
    new HiggsfieldPayloadTranslator(),
    new VeoPayloadTranslator(),
    new OpenAIPayloadTranslator(),
    new ElevenLabsPayloadTranslator(),
    new MuxPayloadTranslator(),
    new GenericPayloadTranslator(),
  ];

  /**
   * Register a custom provider translator.
   */
  static registerTranslator(translator: IProviderPayloadTranslator): void {
    this.translators.unshift(translator);
  }

  /**
   * Find appropriate translator for providerId and modelId.
   */
  static getTranslator(providerId: string, modelId: string): IProviderPayloadTranslator {
    const pLower = providerId.toLowerCase();
    for (const t of this.translators) {
      if (t.providerId.toLowerCase() === pLower && t.supports(modelId)) {
        return t;
      }
    }
    // Fall back by providerId only
    for (const t of this.translators) {
      if (t.providerId.toLowerCase() === pLower) {
        return t;
      }
    }
    // Fall back to generic
    return this.translators[this.translators.length - 1];
  }

  /**
   * Deterministically compile a provider request from semantic shot intent.
   */
  static compile(request: ProviderPayloadCompilationRequest): CompiledProviderRequest {
    const {
      shot,
      craftPlan,
      referenceGraph,
      styleBible,
      capabilityProfile,
      providerId,
      modelId,
      overrideReferences,
    } = request;

    // 1. Compile References
    const refResult = compileReferences({
      shot,
      referenceGraph,
      overrideReferences,
      capabilityProfile,
    });

    const isI2v = Boolean(refResult.firstFrame);

    // 2. Normalize Parameters
    const normResult = normalizeParameters(
      {
        durationSec: shot.durationSec,
        aspectRatio: shot.aspectRatio,
        resolution: shot.resolution,
        generateAudio: true,
        hasLastFrame: Boolean(refResult.lastFrame),
      },
      capabilityProfile
    );

    // 3. Compile Cinematography & Craft
    const cineResult = compileCinematographyAndCraft({
      shot,
      craftPlan,
      capabilityProfile,
    });

    // 4. Compile Style & Lighting
    const styleResult = compileStyleAndLighting({
      shot,
      styleBible,
    });

    // 5. Compile Structured Prompt
    const promptResult = compileStructuredPrompt({
      shot,
      isI2v,
      cameraDirectives: cineResult.cameraPromptDirectives,
      operationDirectives: cineResult.operationDirectives,
      lightingDirectives: styleResult.lightingDirectives,
      styleDirectives: styleResult.styleDirectives,
      negativeConstraints: styleResult.negativeStyleConstraints,
    });

    // 6. Provider-Specific Translation
    const translator = this.getTranslator(providerId, modelId);
    const translation = translator.translate(request, {
      prompt: promptResult.prompt,
      negativePrompt: promptResult.negativePrompt,
      mediaInputs: refResult.inputs,
      normalizedParams: normResult.params,
    });

    // 7. Multi-Layer Validation
    const allErrors = [
      ...refResult.errors,
      ...normResult.errors,
      ...translation.validation.errors,
    ];
    const allWarnings = [
      ...refResult.warnings,
      ...normResult.warnings,
      ...cineResult.warnings,
      ...translation.validation.warnings,
    ];
    const allDegradations = [
      ...normResult.degradations,
      ...cineResult.degradedFeatures,
      ...translation.validation.degradedFeatures,
    ];

    const finalValidation = validateCompilation({
      providerId,
      modelId,
      operation: translation.operation,
      mediaInputs: refResult.inputs,
      profile: capabilityProfile,
      rawPayload: translation.rawPayload,
      initialErrors: allErrors,
      initialWarnings: allWarnings,
      initialDegradations: allDegradations,
    });

    return {
      providerId,
      modelId,
      operation: translation.operation,
      prompt: promptResult.prompt,
      negativePrompt: promptResult.negativePrompt,
      media: {
        firstFrame: refResult.firstFrame,
        lastFrame: refResult.lastFrame,
        references: refResult.references,
        inputs: refResult.inputs,
      },
      parameters: {
        ...normResult.params,
        ...translation.parameters,
      },
      rawPayload: translation.rawPayload,
      metadata: {
        compilerVersion: COMPILER_VERSION,
        promptCompilerVersion: PROMPT_COMPILER_VERSION,
        capabilityProfileVersion: capabilityProfile.version,
        sourceShotId: shot.id,
        sourceSceneId: shot.sceneId,
        sourceProductionId: request.productionId,
        compiledAt: new Date().toISOString(),
      },
      validation: finalValidation,
    };
  }
}
