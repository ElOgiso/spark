/**
 * Creative DNA — structured creative characteristics referenced from Phase 7 strategy.
 */

import type { CreativeStrategy } from "../strategy/types";
import type { CreativeDNA, PerformanceContext } from "./types";

export function creativeDnaFromStrategy(
  strategy: CreativeStrategy,
  extras?: Partial<CreativeDNA>
): CreativeDNA {
  const dimensions: Record<string, string | number | boolean | undefined> = {
    hookType: strategy.hook.type,
    openingStyle: strategy.hook.openingVisual,
    narrativeStructure: strategy.narrativeStrategy,
    pacingProfile: strategy.pacing.model,
    visualStyle: strategy.visualStrategy,
    format: strategy.format,
    durationSec: strategy.durationTargetSec,
    emotionalArc: strategy.emotionalObjective,
    topic: strategy.objective.subject,
    audience: strategy.audience.primaryAudience,
    ctaType: strategy.callToAction ? "explicit_cta" : "none",
    characterUsage: strategy.characterStrategy,
    audioStyle: strategy.audioStrategy,
    editingDensity: strategy.pacing.visualChangePoints?.length
      ? strategy.pacing.visualChangePoints.length > 3
        ? "dense"
        : "moderate"
      : "unknown",
    aspectRatio: strategy.aspectRatio,
    complexity: strategy.complexity.level,
    optimizationProfile: strategy.optimizationProfile,
    curiosityMechanism: strategy.hook.curiosityMechanism,
  };

  return {
    strategyId: strategy.id,
    dimensions: { ...dimensions, ...extras?.dimensions },
    hookType: strategy.hook.type,
    openingStyle: strategy.hook.openingVisual,
    narrativeStructure: strategy.narrativeStrategy,
    pacingProfile: strategy.pacing.model,
    visualStyle: strategy.visualStrategy,
    format: String(strategy.format),
    durationSec: strategy.durationTargetSec,
    emotionalArc: strategy.emotionalObjective,
    topic: strategy.objective.subject,
    audience: strategy.audience.primaryAudience,
    ctaType: strategy.callToAction ? "explicit_cta" : "none",
    characterUsage: strategy.characterStrategy,
    audioStyle: strategy.audioStrategy,
    editingDensity: String(dimensions.editingDensity),
    aspectRatio: strategy.aspectRatio,
    platformHints: strategy.platform,
    ...extras,
  };
}

export function contextFromDna(
  dna: CreativeDNA,
  base?: Partial<PerformanceContext>
): PerformanceContext {
  return {
    ...base,
    creativeStrategyId: dna.strategyId || base?.creativeStrategyId,
    format: dna.format || base?.format,
    hookType: dna.hookType || base?.hookType,
    pacingModel: dna.pacingProfile || base?.pacingModel,
    audiencePrimary: dna.audience || base?.audiencePrimary,
    durationSec: dna.durationSec ?? base?.durationSec,
    aspectRatio: dna.aspectRatio || base?.aspectRatio,
    audioStrategy: dna.audioStyle || base?.audioStrategy,
    productionComplexity: dna.dimensions?.complexity != null ? String(dna.dimensions.complexity) : base?.productionComplexity,
  };
}

export function associateSnapshotContext(
  dna: CreativeDNA,
  context: PerformanceContext
): PerformanceContext {
  return { ...contextFromDna(dna), ...context };
}
