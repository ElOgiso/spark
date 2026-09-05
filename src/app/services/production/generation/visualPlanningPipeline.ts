/**
 * Visual planning pipeline — Phase 3 post-ProductionSpec enrichment.
 * Cinematography → Continuity → Strategy → Routing → Prompt compile → Generation tasks.
 * Does NOT execute media generation.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { ComposedGrammar } from "../grammar";
import { planShotsForScene } from "../cinematography/shotPlanner";
import { applyContinuityEngine } from "../continuity/continuityEngine";
import { resolveShotGenerationStrategy } from "./strategyResolver";
import { routeProductionShots } from "../routing/capabilityRouter";
import { compileProductionPrompts } from "./promptCompiler";
import { attachGenerationTasksToSpec, planGenerationTasks } from "./generationPlanner";
import type { GenerationTask } from "../specification/generationTask";
import { buildProductionDag, type ProductionDag } from "../dag/productionDag";
import {
  developVisualTreatment,
  type StoryboardBlueprint,
  type StoryboardPanelSpec,
  type VisualTreatment,
  type CharacterVisualContract,
  type LocationVisualContract,
  type ProductVisualContract,
} from "../preproduction";
import { planOperationalShotGeneration } from "./operationalPipeline";
import type { GenerationQualityMode } from "./generationIntent";

export interface VisualPlanningOptions {
  grammar: ComposedGrammar;
  preferI2V?: boolean;
  availableProviderIds?: string[];
  /** Cap shots per scene (grammar density still applies within cap) */
  maxShotsPerScene?: number;
  /** Optional: attach visual treatment enrichment (no new orchestrator) */
  enrichVisualTreatment?: boolean;
  /**
   * Phase 6 — when true, enrich/replace per-shot video(+keyframe) tasks via
   * operational storyboard → GenerationIntent → GenerationTask path for shots
   * that have storyboard panels (provided via options). Default OFF.
   */
  enableOperationalGeneration?: boolean;
  storyboard?: StoryboardBlueprint | null;
  storyboardPanels?: StoryboardPanelSpec[];
  qualityMode?: GenerationQualityMode;
  characters?: CharacterVisualContract[];
  location?: LocationVisualContract | null;
  products?: ProductVisualContract[];
  preferredProviderId?: string;
  candidateCounts?: { low: number; medium: number; high: number };
}

export interface VisualPlanningResult {
  spec: ProductionSpec;
  generationTasks: GenerationTask[];
  dag: ProductionDag;
  /** Optional preproduction treatment when enrichVisualTreatment is enabled */
  visualTreatment?: VisualTreatment;
  stats: {
    sceneCount: number;
    shotCount: number;
    routedShots: number;
    generationTaskCount: number;
    continuityBridges: number;
    operationalShots?: number;
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

  // 1) Cinematography — purposeful multi-shot coverage per scene
  let next: ProductionSpec = {
    ...spec,
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
  let generationTasks = planGenerationTasks(next);

  // 6b) Optional Phase 6 operational enrichment (default OFF — backward compatible)
  let operationalShots = 0;
  if (opts.enableOperationalGeneration === true) {
    const panelByShot = new Map<string, StoryboardPanelSpec>();
    for (const p of opts.storyboard?.panels || []) panelByShot.set(p.shotId, p);
    for (const p of opts.storyboardPanels || []) panelByShot.set(p.shotId, p);

    if (panelByShot.size > 0) {
      const kept: GenerationTask[] = [];
      const orderedShots: ShotSpec[] = [];
      for (const scene of next.scenes) {
        for (const shot of scene.shots) orderedShots.push(shot);
      }

      for (let i = 0; i < orderedShots.length; i++) {
        const shot = orderedShots[i];
        const panel = panelByShot.get(shot.id);
        if (!panel) continue;
        const scene = next.scenes.find((s) => s.id === shot.sceneId);
        if (!scene) continue;
        const result = planOperationalShotGeneration({
          productionId: next.project.id,
          scene,
          shot,
          routing: next.routing,
          storyboard: opts.storyboard,
          panel,
          treatment: undefined,
          characters: opts.characters,
          location: opts.location,
          products: opts.products,
          previousShot: i > 0 ? orderedShots[i - 1] : null,
          qualityMode: opts.qualityMode,
          availableProviderIds: opts.availableProviderIds,
          preferredProviderId: opts.preferredProviderId,
          candidateCounts: opts.candidateCounts,
        });
        if (result.plan.blocked || !result.plan.tasks.length) continue;
        operationalShots += 1;
        kept.push(...result.plan.tasks);
      }

      if (kept.length) {
        const replacedShotIds = new Set(
          kept.map((t) => t.shotId).filter((id): id is string => Boolean(id))
        );
        generationTasks = [
          ...generationTasks.filter((t) => {
            if (!t.shotId || !replacedShotIds.has(t.shotId)) return true;
            if (t.kind !== "video" && t.kind !== "keyframe") return true;
            return false;
          }),
          ...kept,
        ];
      }
    }
  }

  next = attachGenerationTasksToSpec(next, generationTasks);
  const dag = buildProductionDag(next, generationTasks);

  const shotCount = next.scenes.reduce((n, s) => n + s.shots.length, 0);

  // Optional light preproduction enrichment — does not replace cinematography/routing
  const visualTreatment =
    opts.enrichVisualTreatment === true
      ? developVisualTreatment({
          productionId: next.id,
          creative: next.creative,
          project: next.project,
          visualStyle: next.visualStyle,
        })
      : undefined;

  return {
    spec: next,
    generationTasks,
    dag,
    visualTreatment,
    stats: {
      sceneCount: next.scenes.length,
      shotCount,
      routedShots: next.routing.shotDecisions.length,
      generationTaskCount: generationTasks.length,
      continuityBridges: next.continuity.shotBridges.length,
      ...(operationalShots ? { operationalShots } : {}),
    },
  };
}
