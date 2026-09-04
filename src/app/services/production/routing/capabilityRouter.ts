/**
 * Capability-based shot-level router.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotRoutingDecision } from "../specification/routingSpec";
import { selectProviderForShot } from "./providerSelector";

export function routeProductionShots(spec: ProductionSpec, availableProviderIds?: string[]): ProductionSpec {
  const decisions: ShotRoutingDecision[] = [];
  const scenes = spec.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      const decision = selectProviderForShot(shot, spec.routing, availableProviderIds);
      decisions.push(decision);
      return {
        ...shot,
        provider: decision.provider,
        generationStrategy: (decision.strategy as typeof shot.generationStrategy) || shot.generationStrategy,
      };
    }),
  }));

  return {
    ...spec,
    scenes,
    routing: {
      ...spec.routing,
      shotDecisions: decisions,
    },
  };
}

export { scoreProvidersForShot } from "./modelScorer";
export { selectProviderForShot } from "./providerSelector";
export { buildFallbackPlan } from "./fallbackPlanner";
export * from "./capabilityMatrix";
