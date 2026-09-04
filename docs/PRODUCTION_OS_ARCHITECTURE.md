# Spark Production OS — Architecture Audit (Phase 0)

## Goal

Evolve existing Spark into a genre-agnostic AI Media Production OS without discarding working infrastructure. New intelligence lives under `src/app/services/production/{specification,intelligence,grammar,cinematography,generation,routing,...}` and adapts to/from legacy `ProductionBrief` / `ProductionScene`.

## Existing foundations (reuse)

| Area | Location | Role |
|------|----------|------|
| Domain types | `src/app/domain/types.ts` | `Production`, `ProductionBrief`, `ProductionScene`, `ProductionAsset`, `GenerationProgress`, `ViralSpark` |
| Create flow | `SparkContext` → `productionService` → `ProductionBriefService.generateBrief` → `ProductionAssetService.generateAssets` | Spark → brief → assets |
| Modes | `resolveProductionMode.ts` | express / standard / deep |
| Prompt packs | `productionPromptPacks.ts` | Mode recipes + motion prompts (compiler modules going forward) |
| Continuity | Beat start/end, last-frame extract, `visualContinuityGate` | Frame chaining (advisory) |
| QC | `viralSparkGate`, character sheet gate, continuity gate, generation guard | Preflight + readiness |
| Video | `productionVideoRequest`, `/api/runtime/video`, `providerCapabilities`, `ModelRouter` | I2V + routing |
| Merge | `sceneVideoMerger`, `narratorVideoCompiler` | Clip concat / slideshow |
| Research | `StructuredResearchContext` on spark/brief | Factual/viral context |
| Memory | `rankBrandLaws`, series bible, brand win writeback | Soft defaults |
| Persistence | Supabase `productions` / `production_assets` + local cache | Keep intact |
| Onboarding | `BrandGenesisFlow` (not CreatorProfile) | Preserve UI; soft-defaults later |
| UI surfaces | `CreativeReview`, galleries, `ReviewCenter`, `ViralSparks` | Preserve; wire new plan underneath |

## Gaps this upgrade fills

1. No shot-level canonical model (scenes ≈ beats; no ShotSpec).
2. Prompt packs act as the production brain instead of a compiled output of a spec.
3. Provider choice is production-wide, not shot-capability-scored.
4. Continuity is mostly last-frame chaining, not structured ContinuityState.
5. QC is not actionable remediation (rerender / change model / etc.).
6. Editorial merge is clip concat, not a multi-track timeline.
7. Genre/grammar intelligence is implicit in viral formats, not composable.

## Canonical hierarchy (new)

```
ProductionSpec
 └── SceneSpec[]
      └── ShotSpec[]          ← fundamental visual generation unit
           └── GenerationTask
                └── Asset refs (master IDs)
```

Legacy `ProductionBrief` / `ProductionScene` remain compatibility views via adapters.

## Implementation order (this PR = P0)

P0: specs, adapters, creative director, orchestrator, grammars, shot/camera planners, capability router, prompt compiler + tests.

P1+: master assets runtime, continuity engine, QC/retry, DAG, editorial timeline, onboarding CreatorProfile soft-defaults, production board (reuse CreativeReview).

## UI preservation

No redesign. New architecture attaches to existing create/review/progress surfaces. Studio/Director controls only when no existing surface can expose required state.
