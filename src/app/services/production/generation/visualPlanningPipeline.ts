/**
 * Visual planning pipeline — Phase 3 post-ProductionSpec enrichment.
 * Cinematography → Continuity → Strategy → Routing → Prompt compile → Generation tasks.
 * Does NOT execute media generation.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { ComposedGrammar } from "../grammar";
import { planShotsForScene } from "../cinematography/shotPlanner";
import { developVisualTreatment, treatmentToVisualStyle } from "../cinematography/cinematicIntelligence";
import { normalizeModeString } from "../resolveProductionMode";
import { applyContinuityEngine } from "../continuity/continuityEngine";
import { resolveShotGenerationStrategy } from "./strategyResolver";
import { routeProductionShots } from "../routing/capabilityRouter";
import { compileProductionPrompts } from "./promptCompiler";
import { attachGenerationTasksToSpec, planGenerationTasks } from "./generationPlanner";
import type { GenerationTask } from "../specification/generationTask";
import { buildProductionDag, type ProductionDag } from "../dag/productionDag";

export interface VisualPlanningOptions {
  grammar: ComposedGrammar;
  preferI2V?: boolean;
  availableProviderIds?: string[];
  /** Cap shots per scene (grammar density still applies within cap) */
  maxShotsPerScene?: number;
}

export interface VisualPlanningResult {
  spec: ProductionSpec;
  generationTasks: GenerationTask[];
  dag: ProductionDag;
  stats: {
    sceneCount: number;
    shotCount: number;
    routedShots: number;
    generationTaskCount: number;
    continuityBridges: number;
  };
}

function maxShotsForScene(durationSec: number, grammar: ComposedGrammar, hardCap: number): number {
  const density =
    grammar.coverage.brollDensity === "high" ? 3 : grammar.coverage.requireInserts ? 2 : 1;
  const byDuration = durationSec >= 12 ? 3 : durationSec >= 6 ? 2 : 1;
  return Math.max(1, Math.min(hardCap, Math.max(density, byDuration)));
}

/**
 * Replace blueprint stub shots with purposeful cinematography coverage,
 * then route, compile prompts, and build the generation task DAG.
 */
export function applyVisualPlanningPipeline(
  spec: ProductionSpec,
  opts: VisualPlanningOptions
): VisualPlanningResult {
  const preferI2V = opts.preferI2V !== false;
  const hardCap = opts.maxShotsPerScene ?? 4;
  const grammar = opts.grammar;
  const mode = normalizeModeString(String(spec.project.productionMode || "")) || "standard";
  const treatment =
    spec.visualTreatment ||
    developVisualTreatment({
      productionId: spec.id,
      creative: spec.creative,
      project: spec.project,
      visualStyle: spec.visualStyle,
    });


  // 1) Cinematography — look treatment + purposeful multi-shot coverage per scene
  let next: ProductionSpec = {
    ...spec,
    visualTreatment: treatment,
    visualStyle: spec.visualTreatment ? spec.visualStyle : treatmentToVisualStyle(treatment),
    scenes: spec.scenes.map((scene) => {
      const characterIds = scene.characterIds?.length
        ? scene.characterIds
        : spec.characters.map((c) => c.identity.ref);
      const shots = planShotsForScene({
        scene,
        grammar,
        aspectRatio: String(spec.project.aspectRatio),
        maxShots: maxShotsForScene(scene.durationSec, grammar, hardCap),
        preferI2V,
        characterIds,
        genre: spec.creative.genre,
        mode,
        treatment,
      });
      return { ...scene, shots };
    }),
  };

  // 2) Continuity bridges across shots
  next = applyContinuityEngine(next);

  // 3) Deterministic strategy per shot (flat ordered pass for continuity chain)
  const ordered: ShotSpec[] = [];
  next = {
    ...next,
    scenes: next.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => {
        const previousShot = ordered.length ? ordered[ordered.length - 1] : null;
        const resolved = resolveShotGenerationStrategy({
          shot,
          creative: next.creative,
          preferI2V,
          isFirstShotInProduction: ordered.length === 0,
          previousShot,
          lastFrameChainEnabled: next.continuity.lastFrameChainEnabled,
        });
        const upgraded: ShotSpec = {
          ...shot,
          generationStrategy: resolved.alias,
          generationStrategySpec: resolved.spec,
          references: {
            ...shot.references,
            previousShotId: previousShot?.id,
          },
        };
        ordered.push(upgraded);
        return upgraded;
      }),
    })),
  };

  // 4) Capability-based routing (no media calls)
  next = routeProductionShots(next, opts.availableProviderIds);

  // 5) Prompt compilation
  next = compileProductionPrompts(next);

  // 6) Generation task graph + attach to shots
  const generationTasks = planGenerationTasks(next);
  next = attachGenerationTasksToSpec(next, generationTasks);
  const dag = buildProductionDag(next, generationTasks);

  const shotCount = next.scenes.reduce((n, s) => n + s.shots.length, 0);
  return {
    spec: next,
    generationTasks,
    dag,
    stats: {
      sceneCount: next.scenes.length,
      shotCount,
      routedShots: next.routing.shotDecisions.length,
      generationTaskCount: generationTasks.length,
      continuityBridges: next.continuity.shotBridges.length,
    },
  };
}
