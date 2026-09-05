# Production Generate Spine (Phase 2 — as built)

This document describes the **actual** live generation path after Phase 2.
It is not aspirational. Dual paths that still exist are called out explicitly.

## A. Planning

```
ViralSpark / Idea
  → SparkContext (existing UI/state)
  → ProductionService.createProductionFromSpark
  → createProductionPlan (Creative Director + Production OS planners)
  → ProductionSpec
       → SceneSpec[]
            → ShotSpec[]
                 → GenerationTask[] (planGenerationTasks / attachGenerationTasksToSpec)
  → persisted on Production.reasoning.productionSpec
  → ReviewItem created (Pending Review; media filled later)
```

Authoritative planning types (unchanged, reused):

| Layer | Type | Location |
|-------|------|----------|
| Production | `ProductionSpec` | `specification/productionSpec.ts` |
| Scene | `SceneSpec` | `specification/sceneSpec.ts` |
| Shot | `ShotSpec` | `specification/shotSpec.ts` |
| Work unit | `GenerationTask` | `specification/generationTask.ts` |

Adapters reused (not duplicated):

- `legacyProductionToSpec` — rebuild Spec when missing
- `productionSpecToBrief` — Spec → legacy `ProductionBrief`
- `sceneSpecToProductionScene` — Scene/Shot → Review-compatible `ProductionScene` (now stamps `sceneId` / `shotId`)

## B. Execution

User-triggered generate entry:

```
UI / SparkContext
  → ProductionService.generateAssetsForProduction
       │
       ├─ IF production.reasoning.productionSpec.scenes.length > 0
       │     → executeProductionViaAssetBridge  ← Phase 2 live spine
       │           → resolveProductionSpec
       │           → ensureGenerationTasks
       │           → buildSpecDrivenBrief (one storyboard panel per ShotSpec, shotId stamped)
       │           → ProductionAssetService.generateAssets  ← existing filmmaker
       │           → projectAssetsOntoSpec (attach media to ShotSpec + task statuses)
       │           → Production.reasoning.productionSpec + generationSpine metadata
       │
       └─ ELSE (legacy production without Spec)
             → ProductionAssetService.generateAssets directly
```

Bridge module: `src/app/services/production/execution/productionExecutionBridge.ts`

What the bridge does **not** do:

- Does not call `executeProduction` / full DAG scheduler as the UI path
- Does not choose vendors (ModelRouter remains inside AssetService)
- Does not implement provider APIs, QC, editorial mastering, or a second Review UI
- Does not regenerate storyboard structure via LLM when Spec-linked panels already carry `shotId` (unless `forceRegenerate`)

AssetService change (minimal):

- When every `brief.storyboard` panel has a non-empty `shotId` and `forceRegenerate` is false, skip LLM storyboard-structure regen and use the Spec-linked panels.

Provider path inside AssetService (unchanged authority):

```
Shot / panel requirements
  → existing prompt packs / prompt context builders
  → ModelRouter / AIProviderOrchestrator
  → video / image / audio adapters
  → ProductionAsset URLs on brief + scenes
```

## C. Persistence

Stored on existing `Production` (local persistence via `savePersistedState`; no second production DB):

| Data | Where |
|------|--------|
| ProductionSpec | `production.reasoning.productionSpec` |
| Task spine snapshot | `production.reasoning.generationSpine.taskStatuses` |
| Review media | `production.videoUrl`, `audioUrl`, `scenes[]`, `productionScenes[]`, `brief` |
| Progress | `production.generationProgress` / brief progress (existing stages) |
| Shot ↔ panel identity | `ProductionScene.shotId`, `.sceneId`, optional `.generationTaskId` |

Reload reconstruction:

```
Production (persisted)
  → resolveProductionSpec(production)
  → same scene/shot IDs from reasoning.productionSpec
```

IDs do not change on reload when Spec was persisted.

## D. Compatibility

| Case | Behavior |
|------|----------|
| New create-from-spark | Always receives `reasoning.productionSpec` from `createProductionPlan` → bridge path |
| Legacy production without Spec | Direct `ProductionAssetService.generateAssets` (pre–Phase 2 path) |
| Spec missing mid-flight | `resolveProductionSpec` falls back to `legacyProductionToSpec` inside the bridge when Spec is required |
| Narrator / Hybrid / Cinematic + express/standard/deep | Still resolved inside AssetService from brief/productionMode; Spec drives storyboard identity, not a forced single I2V mode |

## E. Review

Review continues to consume existing contracts:

- `ReviewItem.brief`, `videoUrl`, opening moment from storyboard
- `Production.status` (`Ready for Review` / `Failed`)
- Scene images / video URLs on `production.scenes` / `productionScenes` / brief storyboard

Review does **not** need to understand the DAG or GenerationTask graph yet.

## F. Provider routing

ModelRouter is **not** called from the bridge.

```
Bridge → ProductionAssetService.generateAssets → (existing) ModelRouter / orchestrator → adapters
```

No ShotSpec→Kling/Veo/Grok hardcoding was added.

## G. Failure

| Condition | Result |
|-----------|--------|
| Master video missing | Production `Failed`; bridge logs `bridge_failed` |
| Keyframe/video task failure | Task `failed` with `lastError`; projected onto ShotSpec |
| Dependency failed or blocked | Dependent tasks `blocked` (transitive) via `applyTaskDependencyFailures` |
| Retry | `markShotRetry` increments attempt on **same** `ShotSpec.id` |

No silent fake master success.

## H. Remaining duality

Still present (intentional / later phases):

1. **`executeProduction` / DAG execution engine** — exists under `execution/` and is reachable via other service helpers, but is **not** the user-facing generate entry used by `generateAssetsForProduction`.
2. **Legacy AssetService-only path** — retained for productions without `reasoning.productionSpec`.
3. **QC / editorial / performance-learning** — remain in-repo but are **not** wired as required steps on the Phase 2 live generate spine.
4. **Phase 1 video-runtime hardening** — lived on a separate branch at Phase 2 start; this spine work does not depend on merging it.

Measurable gap for later phases: make DAG execution + durable master + Review output contract the same path that already persists Review-ready media.
