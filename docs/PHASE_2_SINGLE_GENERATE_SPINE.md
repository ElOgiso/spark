# Phase 2 — Single Generate Spine

## 1. Before

Two production spines existed:

**Spine A (live UI path)**  
`SparkContext` → `ProductionService` → `ProductionAssetService.generateAssets` → ModelRouter / providers → Production + Review

**Spine B (Production OS)**  
`ProductionSpec` → `SceneSpec` / `ShotSpec` → `GenerationTask` → `executeProduction` / execution engine → QC / editorial (not the user-facing media persistence path)

Create-from-spark already stored Spec in `production.reasoning.productionSpec`, but generate still treated AssetService as brief/storyboard-driven without stable ShotSpec identity into execution.

## 2. After

One live generate spine for Spec-bearing productions:

```
Idea → Creative Director / createProductionPlan
  → ProductionSpec → SceneSpec → ShotSpec → GenerationTask
  → executeProductionViaAssetBridge
  → ProductionAssetService.generateAssets
  → ModelRouter → provider adapters
  → ProductionAsset URLs + Spec projection
  → existing persistence + Review
```

Legacy productions without Spec keep Spine A directly.

## 3. Files changed

| File | Reason |
|------|--------|
| `src/app/services/production/execution/productionExecutionBridge.ts` | **New** Spec→AssetService bridge |
| `src/app/services/production/execution/index.ts` | Export bridge helpers alongside existing execution exports |
| `src/app/services/productionService.ts` | Route `generateAssetsForProduction` through bridge when Spec present; persist bridge production |
| `src/app/services/production/productionAssetService.ts` | Skip LLM storyboard regen when Spec-linked `shotId` panels present |
| `src/app/services/production/specification/adapters.ts` | Stamp `sceneId` / `shotId` on legacy scenes |
| `src/app/domain/types.ts` | Optional `sceneId` / `shotId` / `generationTaskId` on `ProductionScene` |
| `src/app/services/production/productionGenerateSpine.p2.test.ts` | **New** focused spine tests |
| `package.json` | Register focused test in `npm test` |
| `docs/PRODUCTION_GENERATE_SPINE.md` | As-built architecture |
| `docs/PHASE_2_SINGLE_GENERATE_SPINE.md` | This change report |

## 4. New bridge

`executeProductionViaAssetBridge`:

1. Resolve Spec (`resolveProductionSpec` — `reasoning.productionSpec` or `legacyProductionToSpec`)
2. Ensure GenerationTasks (`ensureGenerationTasks` via `planGenerationTasks` / `attachGenerationTasksToSpec`)
3. Build Spec-linked storyboard (`buildSpecLinkedStoryboard` / `buildSpecDrivenBrief`; stable `shotId`)
4. Call existing `ProductionAssetService.generateAssets`
5. Project results (`projectAssetsOntoSpec`); apply dependency failures (`applyTaskDependencyFailures`); fail production if master missing / tasks failed
6. Persist Spec + `generationSpine` task snapshot on `production.reasoning`

Helpers: `resolveProductionSpec`, `buildSpecLinkedStoryboard`, `buildSpecDrivenBrief`, `ensureGenerationTasks`, `collectSpecShots`, `markShotRetry`, `applyTaskDependencyFailures`, `projectAssetsOntoSpec`, `isSpecLinkedStoryboard`

## 5. Existing systems reused

- ProductionSpec / SceneSpec / ShotSpec / GenerationTask
- `planGenerationTasks` / `attachGenerationTasksToSpec`
- `legacyProductionToSpec` / `productionSpecToBrief` / `sceneSpecToProductionScene`
- ProductionAssetService
- ModelRouter + provider adapters (inside AssetService)
- Existing persistence
- Existing Review item / Review UI contracts
- Existing production modes (express / standard / deep; narrator / hybrid / cinematic inside AssetService)

**Not created:** second orchestrator, Spec types, DAG, AssetService, ModelRouter, provider agents, QC, Review UI, Studio, or production DB.

## 6. Tests

Focused suite: `src/app/services/production/productionGenerateSpine.p2.test.ts`

Covers:

- Spec-linked storyboard shot IDs
- GenerationTask planning with stable shot identity
- Retry keeps same `ShotSpec.id` (`markShotRetry`)
- Transitive dependency blocking (`failed` → `blocked` dependents via `applyTaskDependencyFailures`)
- Spec round-trip via `production.reasoning`
- Mocked AssetService success and failure (no fake success)
- Mode preservation into brief
- Failure projection onto shot tasks

Validation commands run on this branch:

- `npm run typecheck` — pass
- `npm test` — pass (211 tests)
- `npm run build` — pass

## 7. Manual validation

Real provider end-to-end generation was **not** performed for Phase 2 acceptance (credentials/cost).

Validation performed:

- Mocked provider path through the real bridge + AssetService call site (unit/integration tests)
- No real Kling/Veo/Grok/image generation claimed

## 8. Remaining gaps (explicit)

| Gap | Status |
|-----|--------|
| Real-media QC on live spine | Not wired |
| Durable master + Review output contract (Phase 3) | Not started |
| Full DAG `executeProduction` as UI generate path | Still dual / unused by live generate |
| Provider capability depth | Unchanged |
| Editorial timeline as required output | Unchanged (Review still uses existing merge/compiler path) |
| Performance learning → routing | Intentionally not integrated |
| Publishing | Unchanged |

Phase 3 readiness: Spec→bridge→AssetService→Review media path is stable enough to define a durable master contract **without** starting Phase 3 in this change.
