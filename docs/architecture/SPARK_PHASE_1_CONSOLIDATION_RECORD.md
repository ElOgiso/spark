# SPARK Phase 1 Consolidation Record

Repository: ElOgiso/spark
Branch: main
Phase: 1 (Architecture Consolidation)
Status: COMPLETE
Date: 2026-09-20

## 1. Purpose & Objective

Phase 1 consolidates SPARK's existing production architecture into one coherent production execution spine:
`ProductionSpec` → `SceneSpec` → `ShotSpec` → `GenerationTask` → `Execution` → `Provider` → `ProductionAsset` → `QC` → `Editorial`.

In accordance with Phase 1 constraints:
- No working systems were deleted or bypassed.
- No secondary or duplicate authorities were created (e.g. no second ModelRouter, no second credit ledger, no second QC engine).
- Compatibility layers and adapters bridge existing live execution and UI representations to canonical contracts.
- Code-level deprecation markings were placed on obsolete dead code paths.
- Regression tests were added to lock in architectural invariants.

---

## 2. Canonical Authorities Across 5 Dimensions

### Dimension 1: Production Orchestration Authority
- **Canonical Orchestrator**: `src/app/services/productionService.ts` (`ProductionService`)
  - Coordinates production creation from ideas/sparks, state persistence, and triggering generation.
- **Canonical Lifecycle Conductor**: `src/app/services/production/execution/productionLifecycleRunner.ts` (`ProductionLifecycleRunner`)
  - Coordinates stage transitions through the generation state machine.
- **Specialized Semantic Planner**: `src/app/services/production/intelligence/productionOrchestrator.ts` (`ProductionOrchestrator`)
  - Produces rich narrative and cinematography plans resulting in `ProductionSpec`.
- **Compatibility Adapter**: `src/app/services/production/execution/productionExecutionBridge.ts` (`ProductionExecutionBridge`)
  - Translates `ProductionSpec` into asset generation requests compatible with the live media generation engine.
- **Compatibility Views**: `src/app/services/production/specification/adapters.ts` (`legacyProductionToSpec`, `productionSpecToBrief`)
  - Bridges existing UI types (`ProductionBrief`, `ProductionScene`) to/from canonical specs.

### Dimension 2: Generation Execution Authority
- **Canonical Execution Conductor**: `src/app/services/production/execution/productionExecutor.ts` (`executeProduction`)
  - Unified entry point for executing production specifications, supporting dryRun, live generation, and step-by-step execution.
- **Canonical Execution Engine**: `src/app/services/production/execution/executionEngine.ts` (`GenerationExecutionEngine`)
  - Executes the `GenerationTask` DAG according to task dependencies.
- **Specialized Live Media Spender**: `src/app/services/production/productionAssetService.ts` (`ProductionAssetService.generateAssets`)
  - Manages real provider asset generation (images, voice, I2V, SFX) and live Supabase asset updates.
- **Compatibility Adapter**: `src/app/services/production/execution/liveAssetExecuteAdapter.ts` (`createLiveAssetExecuteAdapter`)
  - Bridges the live `ProductionAssetService` into the canonical `ProductionLifecycleRunner`.

### Dimension 3: Routing Authority
- **Canonical Runtime Router**: `src/app/services/runtime/modelRouter.ts` (`ModelRouter`)
  - The single authority for mapping category requests (`image_generation`, `video_generation`, `voice_generation`, etc.) to specific providers and models.
- **Canonical Provider Dispatcher**: `src/app/services/runtime/AIProviderOrchestrator.ts` (`AIProviderOrchestrator`)
  - Handles actual provider API invocation, health tracking, and circuit breaking.
- **Specialized Planning Router**: `src/app/services/production/routing/capabilityRouter.ts` (`CapabilityRouter`)
  - Evaluates provider-neutral capability scores at planning time without performing runtime model selection or API dispatch.
- **Compatibility Helper**: `src/app/services/runtime/providerCapabilities.ts` (`resolveActiveVideoProvider`)
  - Compatibility wrapper resolving active video provider settings.

### Dimension 4: Asset Authority
- **Canonical Database Repository**: `src/app/backend/repositories/productionAssetRepository.ts` (`productionAssetRepository`)
  - Source of truth for persisted asset rows in `public.production_assets`.
- **Canonical Storage & Normalization**: `src/app/services/production/productionAssetService.ts` (`uploadAssetToStorage`) and `src/app/services/production/execution/outputNormalization.ts` (`OutputNormalizer`)
  - Uploads raw provider outputs to Supabase Storage and normalizes asset metadata.
- **Canonical Media Lineage Sync**: `src/app/services/production/productionMediaLineage.ts` (`syncProductionMediaStores`)
  - Synchronizes media URLs across `productions`, `production_scenes`, and `production_assets`.

### Dimension 5: Lifecycle Authority
- **Canonical Phase State Machine**: `src/app/services/production/execution/lifecycleStateMachine.ts` (`ProductionLifecycleStateMachine`)
  - Enforces valid state transitions across production lifecycle phases.
- **Canonical Job State Machine**: `src/app/services/production/execution/jobStateMachine.ts` (`JobStateMachine`)
  - Tracks individual task/job execution states (`pending`, `running`, `completed`, `failed`).
- **Canonical Editorial & Mastering**: `src/app/services/production/editorial/*`
  - Assembles timeline clips, verifies continuity, and orchestrates final video mastering.
- **Deprecated Dead Code**: `mergeSceneVideosClientUnused` in `src/app/services/production/sceneVideoMerger.ts`
  - Client-side Canvas/MediaRecorder concatenation; marked `@deprecated` in favor of server FFmpeg and editorial assembly.

---

## 3. Full Component Classification Registry

| File / Component Path | Primary Export | Classification | Reason / Role |
| --- | --- | --- | --- |
| `src/app/services/productionService.ts` | `ProductionService` | **CANONICAL** | Primary orchestration entry point for productions |
| `src/app/services/production/intelligence/productionOrchestrator.ts` | `ProductionOrchestrator` | **SPECIALIZED** | Semantic analysis, narrative direction, cinematography planning |
| `src/app/services/production/execution/productionLifecycleRunner.ts` | `ProductionLifecycleRunner` | **CANONICAL** | Lifecycle phase driver |
| `src/app/services/production/execution/productionExecutor.ts` | `executeProduction` | **CANONICAL** | Unified spec execution entry point |
| `src/app/services/production/execution/executionEngine.ts` | `GenerationExecutionEngine` | **CANONICAL** | GenerationTask DAG executor |
| `src/app/services/production/productionAssetService.ts` | `ProductionAssetService` | **SPECIALIZED** | Active billable media generation & storage persistence |
| `src/app/services/production/execution/productionExecutionBridge.ts` | `ProductionExecutionBridge` | **COMPATIBILITY** | Translates ProductionSpec to ProductionAssetService calls |
| `src/app/services/production/execution/liveAssetExecuteAdapter.ts` | `createLiveAssetExecuteAdapter` | **COMPATIBILITY** | Adapts live generation for lifecycle runner |
| `src/app/services/production/specification/adapters.ts` | `legacyProductionToSpec`, etc. | **COMPATIBILITY** | Bidirectional translation between legacy brief & specs |
| `src/app/services/production/specification/productionSpec.ts` | `ProductionSpec` | **CANONICAL** | Master production specification type contract |
| `src/app/services/production/specification/sceneSpec.ts` | `SceneSpec` | **CANONICAL** | Scene-level specification type contract |
| `src/app/services/production/specification/shotSpec.ts` | `ShotSpec` | **CANONICAL** | Shot-level specification type contract |
| `src/app/services/production/specification/generationTask.ts` | `GenerationTask` | **CANONICAL** | Provider-independent generation task unit |
| `src/app/services/runtime/modelRouter.ts` | `ModelRouter` | **CANONICAL** | Sole runtime category-to-model routing authority |
| `src/app/services/runtime/AIProviderOrchestrator.ts` | `AIProviderOrchestrator` | **CANONICAL** | Sole provider invocation & failover authority |
| `src/app/services/production/routing/capabilityRouter.ts` | `CapabilityRouter` | **SPECIALIZED** | Planning-time provider capability scoring |
| `src/app/services/runtime/providerCapabilities.ts` | `resolveActiveVideoProvider` | **COMPATIBILITY** | Video provider setting resolver |
| `src/app/backend/repositories/productionAssetRepository.ts` | `productionAssetRepository` | **CANONICAL** | Database CRUD authority for production assets |
| `src/app/services/production/execution/outputNormalization.ts` | `OutputNormalizer` | **CANONICAL** | Provider output normalization |
| `src/app/services/production/productionMediaLineage.ts` | `syncProductionMediaStores` | **CANONICAL** | Media store sync & lineage tracking |
| `src/app/services/production/execution/lifecycleStateMachine.ts` | `ProductionLifecycleStateMachine` | **CANONICAL** | Production phase state machine |
| `src/app/services/production/execution/jobStateMachine.ts` | `JobStateMachine` | **CANONICAL** | Task job state machine |
| `src/app/services/production/qc/*` | QC Orchestrator / Gates | **CANONICAL** | Quality control and validation |
| `src/app/services/production/editorial/*` | Editorial / Timeline / Mastering | **CANONICAL** | Timeline assembly & video mastering |
| `src/app/services/production/sceneVideoMerger.ts` | `mergeSceneVideosClientUnused` | **DEPRECATED** | In-browser canvas video concat (superseded by server ffmpeg) |

---

## 4. Compatibility & Deprecation Actions

1. **Deprecated Browser Concat**:
   - `src/app/services/production/sceneVideoMerger.ts`: Annotated `mergeSceneVideosClientUnused` with `@deprecated`. Preserved function body to prevent runtime breakages for any legacy callers, while ensuring canonical assembly paths rely on server FFmpeg / editorial pipeline.
2. **Compatibility Adapter Annotations**:
   - `src/app/services/production/specification/adapters.ts`: Explicitly marked `legacyProductionToSpec`, `productionSceneToSceneSpec`, and `productionSpecToBrief` with `@compatibility` JSDoc annotations to document bridge status.
3. **Architecture Verification Suite**:
   - Created `src/app/services/production/architectureConsolidation.test.ts` testing 6 critical consolidation dimensions:
     1. ProductionService resolves ProductionSpec
     2. executeProduction dryRun completes without live spend
     3. ModelRouter maps categories and honors overrides
     4. ShotSpec semantic independence
     5. Bidirectional legacy-to-spec adapter preservation
     6. Safe execution of deprecated client merge fallback

---

## 5. Verification Results

### Architecture Test Suite
```text
node --import tsx --test src/app/services/production/architectureConsolidation.test.ts

TAP version 13
# Subtest: SPARK Phase 1: Architecture Consolidation
    ok 1 - 1. Canonical Production Orchestration: ProductionService resolves ProductionSpec
    ok 2 - 2. Canonical Generation Execution: executeProduction handles dryRun without live spend
    ok 3 - 3. Canonical Routing Authority: ModelRouter maps categories and honors preferred provider
    ok 4 - 4. Semantic Production Types: ShotSpec is provider-independent by design
    ok 5 - 5. Compatibility Adapters: bidirectional translation preserves critical brief metadata
    ok 6 - 6. Deprecated Components: mergeSceneVideosClientUnused returns null safely
1..6
# tests 6
# suites 1
# pass 6
# fail 0
```

### Full Repository Test Suite
```text
& 'C:\Program Files\nodejs\npm.cmd' test
tests 799
pass 797
fail 2 (pre-existing baseline failures: officialI2vFrames.test.ts, assetBibleFromBrief.test.ts)
```

### Production Build
```text
& 'C:\Program Files\nodejs\npm.cmd' run build
✓ built in 14.82s
```

---

## 6. Phase 2 Readiness

Phase 1 has consolidated architecture authorities and verified that the canonical spine is in place with no duplicate routing, ledger, or execution authorities.

Prerequisites for **Phase 2 (Canonical Semantic Contracts)** are satisfied:
- The canonical production spine `ProductionSpec → SceneSpec → ShotSpec → GenerationTask` is identified as authoritative.
- Compatibility adapters are verified bidirectional and lossless for critical fields.
- Phase 2 can proceed to tighten semantic types and refine provider neutrality across `ShotSpec` and `GenerationTask`.
