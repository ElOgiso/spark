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

## Phase 2 status (Creative Director + Production Intelligence)

Planning flow (no media generation, no shot-level provider scoring):

```
User idea
 → Creative Director (+ preference hierarchy)
 → Genre Classifier (extensible rules)
 → Production Grammar (composable)
 → Narrative Planner (genre-specific structures)
 → Production Planner (scene blueprint + stub shots)
 → validated ProductionSpec (+ structured researchRequirements)
 → ProductionBrief adapter (existing UI)
```

Public entry: `createProductionPlan()` / `orchestrateIdeaToProductionSpec()`.
Wired into `productionService.createProductionFromSpark` (intelligence owns storyboard structure; brief service keeps script polish).
Intermediates preserved on `production.reasoning.productionIntelligenceTrace`.
## Phase 3 status (Cinematography + Routing + Generation Planning)

After ProductionSpec is built:

```
ProductionSpec
 → Cinematography (purposeful multi-shot coverage)
 → Continuity bridges
 → Generation strategy resolution
 → Capability-based provider routing (shot-level)
 → Prompt compilation (semantic + cinematic → provider)
 → Generation task DAG
```

Public path still `createProductionPlan()` — now applies visual planning by default.
Media generation remains deferred until approval / later execution phase.
No UI redesign; existing ProductionBrief adapters continue to feed REVIEW.

