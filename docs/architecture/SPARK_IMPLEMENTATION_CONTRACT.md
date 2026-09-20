# SPARK Implementation Contract

Phase: 1 (Phase 0 Complete; Phase 1 Architecture Consolidation)
Repository: ElOgiso/spark
Branch inspected: main
Baseline HEAD: d3d960d56ba577f5f7d5eef49d7906a7b9d99d59
Phase 1 Consolidation Date: 2026-09-20

This contract defines the architectural invariants and authority mappings established in Phase 0 and consolidated in Phase 1.

## Product Principles

SPARK is an AI Media Operating System. It is not a generic prompt-to-download generator, provider marketplace, or disconnected toolbox.

Engineering work must preserve these product principles:

- Users operate brands, not prompts.
- SPARK understands brands, market context, productions, review, publishing, analytics, and memory as one operating system.
- Complexity should be hidden from user-facing flows unless it is needed for an executive decision.
- The product is mobile-native in behavior and should stay usable from mobile review and production surfaces.
- AI infrastructure is internal machinery. Provider/model terms should not become the product language unless the user is in an explicit settings/admin context.
- Analytics should explain why something happened, not only report numbers.
- Quality and beauty matter. Generated media should pass SPARK's creative, continuity, technical, and editorial standards.
- SPARK should feel like an intelligent media company operating for the user, not like a provider dashboard.

## Engineering Principle

SPARK OWNS MEANING.
PROVIDERS OWN EXECUTION.

SPARK owns story, brand meaning, production intent, creative constraints, references, quality policy, cost/budget policy, failure policy, QC, repair intent, editorial readiness, and user-facing decisions.

Providers own provider-specific request bodies, credentials, media preparation details, polling/status semantics, cancellation details, and output normalization.

Provider implementation details must not become the conceptual architecture of SPARK.

## Repository Baseline

Verified from the repository:

- Framework: Vite 6 + React 18 + TypeScript.
- Runtime/API shape: browser React app plus Vercel-style API handlers under `api/runtime`.
- Package manager baseline: `package-lock.json` is present and npm scripts are authoritative. `bun.lock` and `pnpm-workspace.yaml` also exist, but `package.json` scripts are npm-oriented.
- TypeScript: `tsconfig.json` has `strict: true`, includes `src`, excludes `src/**/*.test.ts`, and does not typecheck `api` handlers.
- Build: `vite build`.
- Test runner: Node test runner through `tsx --test` in `npm test`.
- Lint: no lint script is configured in `package.json`.
- Supabase: migrations live in `supabase/migrations`; generated/static types live in `src/app/backend/database.types.ts`.
- Frontend entry points: `src/main.tsx`, `src/App.tsx`, `src/app/App.tsx`, with major product surfaces under `src/app/components`.
- State and live production entry point: `src/app/state/SparkContext.tsx`.
- Production service layer: `src/app/services/productionService.ts`.
- Runtime provider layer: `src/app/services/runtime/*` and `api/runtime/*`.

## Canonical Production Spine

The canonical production spine already exists and must be extended, not replaced:

```text
ProductionSpec
-> SceneSpec
-> ShotSpec
-> GenerationTask
-> Execution
-> ProductionAsset
-> QC
-> Editorial
```

Verified current terminology:

- `ProductionSpec`: `src/app/services/production/specification/productionSpec.ts`
- `SceneSpec`: `src/app/services/production/specification/sceneSpec.ts`
- `ShotSpec`: `src/app/services/production/specification/shotSpec.ts`
- `GenerationTask`: `src/app/services/production/specification/generationTask.ts`
- `ProductionAsset`: domain type in `src/app/domain/types.ts`, persisted rows in `src/app/backend/database.types.ts`, repository in `src/app/backend/repositories/productionAssetRepository.ts`
- Execution: `src/app/services/production/execution/*`
- QC: `src/app/services/production/qc/*`
- Editorial: `src/app/services/production/editorial/*`

Compatibility names and live adapters:

- `ProductionBrief` and `ProductionScene` remain compatibility views for existing UI and persisted rows.
- `legacyProductionToSpec`, `productionSpecToBrief`, and `sceneSpecToProductionScene` live in `src/app/services/production/specification/adapters.ts`.
- `ProductionExecutionBridge` maps `ProductionSpec` back through the existing `ProductionAssetService` executor in `src/app/services/production/execution/productionExecutionBridge.ts`.
- `createLiveAssetExecuteAdapter` keeps the lifecycle conductor from becoming a second media spender in `src/app/services/production/execution/liveAssetExecuteAdapter.ts`.

Current implementation note:

- `GenerationTask` is provider-independent by comment and fields, with provider selection deferred.
- `ShotSpec` currently still contains optional `provider`, `model`, and `resolution` fields for compatibility. Phase 1+ should constrain how those are populated rather than replacing `ShotSpec`.

## Real Production Flow

This is the currently implemented live path as traced from code.

| Stage | File / function | Responsibility | Current authority | Status |
| --- | --- | --- | --- | --- |
| UI production request | `src/app/components/ViralSparks.tsx`, `ProductionDrawer`, `createProductionFromSpark` call | User confirms a Spark as a production | Live UI | Compatibility/live |
| Context shell creation | `src/app/state/SparkContext.tsx`, `createProductionFromSpark` | Guards Production Generation switch, evaluates spark readiness, creates optimistic `Production` and `ReviewItem`, emits events | `SparkContext` | Live authority |
| Service production creation | `src/app/services/productionService.ts`, `createProductionFromSpark` | Generates brief, polishes spark, creates ProductionSpec plan, attaches reasoning, saves state | `ProductionService` | Live authority with canonical spec |
| Brief/script planning | `src/app/services/production/productionBriefService.ts`, `ProductionBriefService.generateBrief` | Produces polished `ProductionBrief`, narrative script, beats, storyboard compatibility data | `ProductionBriefService` | Live authority for spoken/script polish |
| Semantic production planning | `src/app/services/production/intelligence/productionOrchestrator.ts`, `createProductionPlan` / `orchestrateIdeaToProductionSpec` | Creative Director, grammar, narrative, ProductionSpec, visual planning, routing trace, generation tasks | Production intelligence modules | Canonical planning authority |
| Scene/shot planning | `specification/*`, `cinematography/*`, `generation/*`, `routing/*` | SceneSpec/ShotSpec construction, cinematography, capability routing, prompts, GenerationTask DAG | Canonical modules under `src/app/services/production` | Canonical planning |
| Auto asset generation | `SparkContext.createProductionFromSpark` then `productionService.generateAssetsForProduction` | Chains media generation when Production Generation is ON | `SparkContext` trigger, `ProductionService` conductor | Live authority |
| Legacy/live execution bridge | `productionService.generateAssetsForProduction`, `createLiveAssetExecuteAdapter`, `executeProductionViaAssetBridge` | Runs lifecycle but delegates live spend to `ProductionAssetService` | Lifecycle conductor plus bridge | Overlap/consolidation area |
| Media execution | `src/app/services/production/productionAssetService.ts`, `ProductionAssetService.generateAssets` | Executes storyboard stills, voice, I2V clips, storage upload, media sync, merge | `ProductionAssetService` | Live media execution authority |
| Model routing | `src/app/services/runtime/modelRouter.ts`, `ModelRouter.executeCategoryRequest` | Category to provider/model selection and calls into AIProviderOrchestrator | Existing ModelRouter | Current routing authority |
| Capability routing | `src/app/services/production/routing/*`, `src/app/services/production/capability/*` | Provider-neutral planning-time capability scoring and fallbacks | Production routing/capability modules | Canonical planning authority, not a second ModelRouter |
| Provider request boundary | `src/app/services/production/productionVideoRequest.ts`, `api/runtime/video.ts`, `api/runtime/_videoContract.ts`, `api/runtime/_higgsfieldClient.ts` | I2V request validation, provider payloads, polling, finalization | API/runtime/provider adapters | Provider execution authority |
| Provider adapters | `src/app/services/production/execution/adapters/*` | Adapter interface, registry, I2V wrappers, image/voice/merge ports | Execution adapters | Canonical provider boundary in progress |
| Asset persistence | `ProductionAssetService.uploadAssetToStorage`, `workspaceSync.persistProductionAssetCreate`, `productionAssetRepository` | Stores media into Spark storage and production asset records | AssetService + backend repositories | Live authority |
| QC | `src/app/services/production/qc/qcOrchestrator.ts`, `runProductionQcHierarchy`, `runQcWithRepairLoop` | Shot/scene/production QC and repair planning | QC module | Canonical QC authority |
| Repair/retry | `qc/repairPlanner.ts`, `generation/retryPlanner.ts`, lifecycle repair reexecution callback | Plans bounded repairs and re-executes through existing execution path when injected | QC + execution | Canonical but still bridged |
| Editorial/timeline | `src/app/services/production/editorial/pipeline.ts`, `assembly.ts`, `timelineService.ts`, `mastering/*` | Assembles timeline, validates, decides, optionally masters | Editorial module | Canonical editorial authority |
| Master output | `ProductionAssetService.mergeProductionScenes` for live path; editorial mastering service for canonical path | Durable master / passthrough / FFmpeg mock or adapter | AssetService for live; Editorial for planned path | Consolidation area |
| Publishing | `src/app/state/SparkContext.tsx`, `publishProduction`; `src/app/services/production/publishing/*` | Existing publish job creation and policy | SparkContext / publishing service | Live product authority |
| Learning | `src/app/services/production/intelligence/performance/*`, `intelligence/autonomy/*`, `memoryService` | Performance observations, learnings, adaptive advice | Intelligence/memory modules | Canonical learning support |

## Existing Systems To Extend, Not Duplicate

Verified systems:

- ProductionSpec: `src/app/services/production/specification/productionSpec.ts`
- SceneSpec: `src/app/services/production/specification/sceneSpec.ts`
- ShotSpec: `src/app/services/production/specification/shotSpec.ts`
- GenerationTask: `src/app/services/production/specification/generationTask.ts`
- ProductionAsset: `src/app/domain/types.ts`, `src/app/backend/repositories/productionAssetRepository.ts`, `supabase/migrations/20260807120000_production_assets.sql`
- Cinematography intelligence: `src/app/services/production/cinematography/*`
- Shot planner: `src/app/services/production/cinematography/shotPlanner.ts`
- Capability routing: `src/app/services/production/capability/*`, `src/app/services/production/routing/*`
- Model routing: `src/app/services/runtime/modelRouter.ts`
- Continuity: `src/app/services/production/continuity/*`, `liveContinuityBridge.ts`, `visualContinuityGate.ts`
- References/assets: `src/app/services/production/assets/*`, `preproduction/referenceManifest.ts`, `lockedProductionReferences.ts`, `resolveLiveDirectorRefs.ts`
- QC: `src/app/services/production/qc/*`
- Repair: `src/app/services/production/qc/repairPlanner.ts`, `generation/retryPlanner.ts`
- Editorial: `src/app/services/production/editorial/*`
- Generation lifecycle: `src/app/services/production/execution/productionLifecycleRunner.ts`, `executionEngine.ts`, `jobStateMachine.ts`, `lifecycleStateMachine.ts`
- Credit ledger: `profiles.credit_balance` and `credit_ledger` in Supabase migrations; admin operations in `src/app/backend/repositories/adminRepository.ts`
- Admin credit management: `src/app/components/admin/*`, `src/app/backend/repositories/adminRepository.ts`
- Provider adapters: `src/app/services/production/execution/adapters/*`, `src/app/services/runtime/AIProviderOrchestrator.ts`, `api/runtime/*`

## Overlapping Production Paths

There are two overlapping but connected paths.

Canonical/newer path:

```text
ProductionSpec
-> SceneSpec
-> ShotSpec
-> GenerationTask
-> DAG
-> execution
-> QC
-> editorial
```

Primary files:

- `src/app/services/production/intelligence/productionOrchestrator.ts`
- `src/app/services/production/generation/*`
- `src/app/services/production/dag/productionDag.ts`
- `src/app/services/production/execution/*`
- `src/app/services/production/qc/*`
- `src/app/services/production/editorial/*`

Legacy/live path:

```text
SparkContext
-> ProductionService
-> ProductionAssetService
-> ModelRouter / AIProviderOrchestrator / api/runtime providers
```

Primary files:

- `src/app/state/SparkContext.tsx`
- `src/app/services/productionService.ts`
- `src/app/services/production/productionBriefService.ts`
- `src/app/services/production/productionAssetService.ts`
- `src/app/services/runtime/modelRouter.ts`
- `src/app/services/runtime/AIProviderOrchestrator.ts`
- `api/runtime/video.ts`

Current authority split:

- Product/UI trigger authority: `SparkContext`.
- Brief/script polish authority: `ProductionBriefService`.
- Semantic planning authority: `createProductionPlan` and `ProductionSpec`.
- Live provider spend authority: `ProductionAssetService` through ModelRouter/API runtime.
- Lifecycle/QC/editorial authority: canonical execution/QC/editorial modules, currently bridged to AssetService for live generation.

Phase 1 should consolidate authority boundaries carefully. It must not delete the live path just because the newer path exists.

## Future Target Architecture

This is the agreed target. It is not Phase 0 implementation scope.

```text
USER
-> SPARK DIRECTOR / ASTRA
-> PRODUCTION INTENT
-> SCRIPT ENGINE
-> VISUAL DIRECTOR
-> SCENE / SHOT
-> CRAFT ENGINE
-> CAPABILITY ENGINE
-> MODEL ROUTER
-> PROVIDER ADAPTER
-> GENERATION
-> VISUAL QC
-> TIMELINE
-> AUDIO
-> MASTER QC
-> MP4
-> PUBLISHING
```

## Known Future Consolidation Areas

Future work, not Phase 0 implementation:

- Duplicate routing authorities between planning-time capability routing and runtime ModelRouter.
- Duplicate/overlapping production paths between canonical lifecycle and live SparkContext/AssetService execution.
- Cost-aware routing.
- Provider-neutral CraftOperation.
- ReferenceGraph.
- StyleBible.
- Provider payload compiler.
- Credit reservation and settlement.
- Provider submission idempotency.
- Expanded provider adapter contract.
- QC -> repair -> reroute.
- FormatDirector.
- AudioDirector.
- VideoUnderstandingEngine.
- Production Memory.
- Observability.
- Supabase hardening.
- Admin economics.

## Spec Expectation vs Current Implementation

| Spec expectation | Current implementation | Phase 0 decision |
| --- | --- | --- |
| ProductionSpec -> SceneSpec -> ShotSpec exists | Verified in `src/app/services/production/specification/*` | Preserve and extend |
| GenerationTask is provider-neutral | Verified by contract comment and fields; selected provider/model are optional execution fields | Preserve, tighten later |
| ShotSpec should not use provider language conceptually | Current ShotSpec has optional `provider`, `model`, `resolution` compatibility fields | Document as consolidation target, no Phase 0 rename |
| One ModelRouter | Verified one `ModelRouter` class in `src/app/services/runtime/modelRouter.ts`; capability routing exists separately for planning | Do not create another router |
| One credit ledger | Verified `profiles.credit_balance` and `credit_ledger` in migrations | Do not create another ledger |
| Provider-specific details behind adapters/compilers | Partially true: execution adapters and `api/runtime/_videoContract.ts` exist; `productionAssetService.ts` still calls some runtime paths directly | Future provider payload compiler/consolidation |
| QC exists | Verified `src/app/services/production/qc/*` | Extend, do not replace |
| Editorial exists | Verified `src/app/services/production/editorial/*` | Extend, do not replace |
| Production lifecycle exists | Verified `runProductionLifecycle` and bridge | Consolidate in Phase 1, no Phase 0 rewrite |

## NON-NEGOTIABLE INVARIANTS

1. Do not create duplicate production systems.
2. Do not create a second ModelRouter.
3. Do not create a second credit ledger. The existing `profiles.credit_balance` and `credit_ledger` remain the financial foundation.
4. Do not replace ProductionSpec / SceneSpec / ShotSpec if they can be extended.
5. Do not replace existing continuity infrastructure if it can be extended.
6. Do not replace existing QC infrastructure if it can be extended.
7. Do not hard-code provider pricing in the frontend.
8. Do not make provider-specific models the conceptual language of ShotSpec.
9. Provider-specific implementation belongs behind provider adapters/compilers.
10. User-facing SPARK UX must not expose unnecessary provider/model complexity.
11. Do not redesign the existing SPARK UI/navigation as part of backend architecture work.
12. Do not move the entire application to Supabase Edge Functions simply because they exist.
13. Never fabricate provider capabilities, prices, job states, or generation results.
14. Financial operations must eventually be transactional and idempotent.
15. Unknown provider submission must be treated as unknown until reconciled.
16. A failed generation must not automatically become a successful credit charge.
17. Existing working behavior takes precedence over theoretical architectural elegance.

Additional verified implementation invariants:

- The live lifecycle must not bypass `ProductionGenerationGuard`.
- Dry-run paths may execute without spend for tests and readiness validation.
- Post-submit provider timeout must not blindly fail over to another billable provider.
- Provider URLs may be used as immediate playback previews only when durable Spark ingest is still being reconciled.
- Storyboard grids/sheets must not be sent as I2V first-frame stills.
- Missing vision/QC capability must remain inconclusive or needs-review, never fabricated pass confidence.
- Learning/adaptive systems may influence soft strategy but must not rewrite hard story, identity, continuity, legal, or explicit user constraints.

## Phase 0 Boundary

Phase 0 established baseline verification and inventory. It did not implement Phase 1 consolidation or later phases.

## Phase 1 Architecture Consolidation

Phase 1 consolidates SPARK's existing production architecture into one coherent production execution spine without duplicate authorities:

```text
ProductionSpec
  ↓
SceneSpec
  ↓
ShotSpec
  ↓
GenerationTask
  ↓
Execution
  ↓
Provider
  ↓
ProductionAsset
  ↓
QC
  ↓
Editorial
```

### Consolidated Authority Dimensions

1. **Production Orchestration Authority**:
   - **Canonical**: `src/app/services/productionService.ts` (`ProductionService`) coordinates the production lifecycle; `src/app/services/production/execution/productionLifecycleRunner.ts` orchestrates phase state transitions.
   - **Specialized**: `src/app/services/production/intelligence/productionOrchestrator.ts` generates semantic `ProductionSpec` plans.
   - **Compatibility**: `src/app/services/production/execution/productionExecutionBridge.ts` bridges canonical specs to live asset execution. `src/app/services/production/specification/adapters.ts` translates between legacy `ProductionBrief` and canonical `ProductionSpec`.

2. **Generation Execution Authority**:
   - **Canonical**: `src/app/services/production/execution/productionExecutor.ts` (`executeProduction`) and `src/app/services/production/execution/executionEngine.ts` (`GenerationExecutionEngine`).
   - **Specialized / Live Media Spender**: `src/app/services/production/productionAssetService.ts` (`ProductionAssetService.generateAssets`) performs billable media generation.
   - **Compatibility**: `src/app/services/production/execution/liveAssetExecuteAdapter.ts` adapts `ProductionAssetService` into the lifecycle executor interface.

3. **Routing Authority**:
   - **Canonical (Runtime)**: `src/app/services/runtime/modelRouter.ts` (`ModelRouter`) resolves category $\rightarrow$ provider/model for runtime execution.
   - **Canonical (Provider Dispatch)**: `src/app/services/runtime/AIProviderOrchestrator.ts` executes provider calls with failover and health tracking.
   - **Specialized (Planning)**: `src/app/services/production/routing/capabilityRouter.ts` evaluates provider-neutral planning scores without performing runtime dispatch.
   - **Compatibility**: `src/app/services/runtime/providerCapabilities.ts` (`resolveActiveVideoProvider`) maps legacy provider selection.

4. **Asset Authority**:
   - **Canonical (Database Rows)**: `src/app/backend/repositories/productionAssetRepository.ts` (`productionAssetRepository`).
   - **Canonical (Storage / Normalization)**: `src/app/services/production/productionAssetService.ts` (`uploadAssetToStorage`) and `src/app/services/production/execution/outputNormalization.ts`.
   - **Canonical (Lineage Sync)**: `src/app/services/production/productionMediaLineage.ts` (`syncProductionMediaStores`).

5. **Lifecycle Authority**:
   - **Canonical (Production Phases)**: `src/app/services/production/execution/lifecycleStateMachine.ts`.
   - **Canonical (Task Jobs)**: `src/app/services/production/execution/jobStateMachine.ts`.
   - **Canonical (Editorial Mastering)**: `src/app/services/production/editorial/*`.
   - **Deprecated**: `mergeSceneVideosClientUnused` in `src/app/services/production/sceneVideoMerger.ts` (browser canvas/MediaRecorder fallback; deprecated in favor of server ffmpeg concat and editorial assembly).

### Component Classification Registry

| Component Path | Primary Symbol | Role / Classification | Authority |
| --- | --- | --- | --- |
| `src/app/services/productionService.ts` | `ProductionService` | CANONICAL | Production Orchestration |
| `src/app/services/production/intelligence/productionOrchestrator.ts` | `ProductionOrchestrator` / `createProductionPlan` | SPECIALIZED | Semantic Planning |
| `src/app/services/production/execution/productionLifecycleRunner.ts` | `ProductionLifecycleRunner` | CANONICAL | Lifecycle Conductor |
| `src/app/services/production/execution/productionExecutor.ts` | `executeProduction` | CANONICAL | Generation Execution |
| `src/app/services/production/execution/executionEngine.ts` | `GenerationExecutionEngine` | CANONICAL | Task DAG Execution |
| `src/app/services/production/productionAssetService.ts` | `ProductionAssetService` | SPECIALIZED | Live Media Spend Executor |
| `src/app/services/production/execution/productionExecutionBridge.ts` | `ProductionExecutionBridge` | COMPATIBILITY | Bridge Spec to Live Spend |
| `src/app/services/production/execution/liveAssetExecuteAdapter.ts` | `createLiveAssetExecuteAdapter` | COMPATIBILITY | Lifecycle Adapter for Live Spend |
| `src/app/services/production/specification/adapters.ts` | `legacyProductionToSpec`, `productionSpecToBrief` | COMPATIBILITY | Spec / Brief Translation |
| `src/app/services/runtime/modelRouter.ts` | `ModelRouter` | CANONICAL | Runtime Routing Authority |
| `src/app/services/runtime/AIProviderOrchestrator.ts` | `AIProviderOrchestrator` | CANONICAL | Provider Dispatch Authority |
| `src/app/services/production/routing/capabilityRouter.ts` | `CapabilityRouter` | SPECIALIZED | Planning-Time Capability Scorer |
| `src/app/backend/repositories/productionAssetRepository.ts` | `productionAssetRepository` | CANONICAL | Asset Database Authority |
| `src/app/services/production/execution/outputNormalization.ts` | `OutputNormalizer` | CANONICAL | Output Normalization Authority |
| `src/app/services/production/productionMediaLineage.ts` | `syncProductionMediaStores` | CANONICAL | Media Lineage Authority |
| `src/app/services/production/execution/lifecycleStateMachine.ts` | `ProductionLifecycleStateMachine` | CANONICAL | Production Phase Authority |
| `src/app/services/production/execution/jobStateMachine.ts` | `JobStateMachine` | CANONICAL | Job State Authority |
| `src/app/services/production/editorial/*` | Editorial Services | CANONICAL | Editorial & Mastering Authority |
| `src/app/services/production/qc/*` | QC Services | CANONICAL | Quality Control Authority |
| `src/app/services/production/sceneVideoMerger.ts` | `mergeSceneVideosClientUnused` | DEPRECATED | Browser Canvas Merging |


