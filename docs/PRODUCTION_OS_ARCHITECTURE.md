# Spark Production OS — Architecture Audit (Phase 0)

## Goal

Evolve existing Spark into a genre-agnostic AI Media Production OS without discarding working infrastructure. New intelligence lives under `src/app/services/production/{specification,intelligence,grammar,cinematography,generation,routing,continuity,qc,dag,editorial}` and adapts to/from legacy `ProductionBrief` / `ProductionScene`.

## Existing foundations (reuse)

| Area | Location | Role |
|------|----------|------|
| Domain types | `src/app/domain/types.ts` | `Production`, `ProductionBrief`, `ProductionScene`, `ProductionAsset`, `GenerationProgress`, `ViralSpark` |
| Create flow | `SparkContext` → `productionService` → `ProductionBriefService.generateBrief` → `ProductionAssetService.generateAssets` | Spark → brief → assets |
| Modes | `resolveProductionMode.ts` | express / standard / deep |
| Prompt packs | `productionPromptPacks.ts` | Mode recipes + motion prompts (now compiler inputs/laws) |
| Continuity | Beat start/end, last-frame extract, `visualContinuityGate` + new `continuityEngine` | Frame chain + structured state |
| QC | viral/character/continuity gates + new structured QC module | Preflight + actionable remediation |
| Video | `productionVideoRequest`, `/api/runtime/video`, `providerCapabilities`, `ModelRouter` | I2V + routing |
| Merge | `sceneVideoMerger`, `narratorVideoCompiler` | Clip concat / slideshow (preview/fallback) |
| Research / Memory / Supabase / UI | unchanged | Preserved |

## Canonical hierarchy

```
ProductionSpec
 └── SceneSpec[]
      └── ShotSpec[]          ← fundamental visual generation unit
           └── GenerationTask (DAG)
                └── Master asset refs
```

## Implemented in this PR

**P0:** ProductionSpec/SceneSpec/ShotSpec, legacy adapters, Creative Director, Orchestrator, composable grammars, shot/camera/lighting/blocking planners, capability router + scorer + fallbacks, prompt compiler, generation/retry planners, tests.

**P1 foundations:** Master asset types, CreatorProfile soft defaults + preference hierarchy, continuity engine, QC gates, production DAG, editorial timeline model.

**Wiring:** `productionService.createProductionFromSpark` attaches `reasoning.productionSpec` + `approvalSummary` without replacing brief/UI.

## Compatibility

- `legacyProductionToSpec` / `productionSpecToBrief` keep persisted productions working.
- No UI redesign; BrandGenesis / CreativeReview / galleries untouched.
- Existing provider integrations and prompt packs preserved.

## Next recommended step

Drive `ProductionAssetService.generateAssets` from `planGenerationTasks` + shot-level `routeProductionShots` decisions (partial regeneration via `planShotRetry`), then surface `approvalSummary` in existing CreativeReview without a new board UI.
