# SPARK Phase 2 Contract Record

Repository: ElOgiso/spark
Branch: main
Phase: 2 (Canonical Models & Semantic Contracts)
Status: COMPLETE
Commit SHA: d52ddf3
Date: 2026-09-20

## 1. Purpose & Objective

Phase 2 establishes provider-neutral canonical semantic contracts across the SPARK production spine:
`ProductionSpec` → `SceneSpec` → `ShotSpec` → `GenerationTask` → `SemanticGenerationRequest` → [Routing & Compilers] → `ProviderExecutionRequest`.

Core Principle: **SPARK owns Meaning. Providers own Execution.**
Spark's internal production models now describe WHAT should be produced and WHY, without prematurely embedding provider-specific parameters, model IDs, or API request shapes into canonical production types.

---

## 2. Canonical Semantic Architecture

### 1. Canonical Semantic Models
- **`ProductionSpec`** (`src/app/services/production/specification/productionSpec.ts`):
  Master production specification containing project intent, creative grammar, world definition, character masters, narrative structure, audio plan, and scene specifications.
- **`SceneSpec`** (`src/app/services/production/specification/sceneSpec.ts`):
  Scene-level specification expressing narrative function, emotional objectives, continuity locks, environment, and shot lists.
- **`ShotSpec`** (`src/app/services/production/specification/shotSpec.ts`):
  Canonical unit of visual generation expressing:
  - **Identity**: `id`, `sceneId`, `index`
  - **Narrative**: `purpose`, `productionReason`, `narrativeBeat`, `subject`, `subjectAction`
  - **Visual & Cinematography**: `camera` (framing, composition, lens, cameraMovement), `blocking`, `performanceDirection`, `environment`, `lighting`, `atmosphere`, `motion`
  - **Temporal**: `timingStartSec`, `durationSec`
  - **References**: `references` (`ShotReferencePack`) and `semanticReferences` (`SemanticReference[]`)
  - **Output Requirements**: `outputRequirements` (`ShotOutputRequirement`) including `mediaType`, `aspectRatio`, `qualityTier`, `resolutionClass`, and `audio`
  - **Provider Isolation**: Legacy fields `provider`, `model`, and `resolution` are marked `@deprecated @compatibility`. Canonical shot planning (`shotPlanner.ts`) never populates them.
- **`GenerationTask`** (`src/app/services/production/specification/generationTask.ts`):
  Executable task derived from semantic models. Contains provider-independent `requiredCapabilities`, `preferredCapabilities`, `semanticReferences`, `outputRequirements`, task dependencies (DAG), and execution priority.
- **`SemanticGenerationRequest`** (`src/app/services/production/specification/semanticExecution.ts`):
  The explicit contract boundary between `GenerationTask` and downstream routing/compilation. Bundles `mediaType`, `intent`, `capabilities`, `references`, `output`, and `constraints` without requiring a selected provider or model.

### 2. Semantic Media Vocabulary (`src/app/services/production/specification/semanticMedia.ts`)
- **Normalized Media Types (`SemanticMediaType`)**:
  `IMAGE`, `VIDEO`, `AUDIO`, `VOICE`, `MUSIC`, `SFX`, `AMBIENCE`, `USER_ASSET`, `STOCK`, `SCREENSHOT`, `MAP`, `CHART`, `TEXT`, `MOTION_GRAPHIC`.
- **Quality Tiers (`QualityTier`)**:
  `DRAFT`, `STANDARD`, `HIGH`, `CINEMATIC`, `MAXIMUM`.
- **Resolution Classes (`ResolutionClass`)**:
  `SD`, `HD`, `FULL_HD`, `UHD`.
- **Audio Requirements (`ShotAudioRequirement`)**:
  Expresses audio needs (`dialogue`, `narration`, `music`, `sfx`, `ambience`, `nativeAudio`) without provider specifics.

### 3. Semantic Reference Roles (`SemanticReference`)
- Structured reference roles:
  `CHARACTER`, `IDENTITY`, `START_FRAME`, `END_FRAME`, `STYLE`, `ENVIRONMENT`, `SOURCE_VIDEO`, `REPLACEMENT_OBJECT`, `PROP`, `COMPOSITION`.
- Forward-compatible with Phase 3 `ReferenceGraph`.
- Lossless bi-directional adapters `referencePackToSemanticReferences` and `semanticReferencesToReferencePack` maintain compatibility with existing executors and UI.

---

## 3. Provider Isolation & Compatibility Boundaries

| Field / Component | Location | Role / Boundary | Action Taken |
| :--- | :--- | :--- | :--- |
| `ShotSpec.provider` | `specification/shotSpec.ts` | Compatibility | Marked `@deprecated @compatibility`. Ignored by canonical shot planning. |
| `ShotSpec.model` | `specification/shotSpec.ts` | Compatibility | Marked `@deprecated @compatibility`. Ignored by canonical shot planning. |
| `ShotSpec.resolution` | `specification/shotSpec.ts` | Compatibility | Marked `@deprecated @compatibility`. Normalized via `ResolutionClass` / `QualityTier`. |
| `GenerationTask.selectedProvider` | `specification/generationTask.ts` | Downstream Routing | Deferred to routing phase; optional on task creation. |
| `GenerationTask.selectedModel` | `specification/generationTask.ts` | Downstream Routing | Deferred to routing phase; optional on task creation. |
| `ProductionBrief` $\leftrightarrow$ `ProductionSpec` | `specification/adapters.ts` | Compatibility Bridge | Preserved and verified losslessly bidirectional. |
| `ProviderGenerationRequest` | `execution/types.ts` | Downstream Execution | Strictly separated from `SemanticGenerationRequest`. |

---

## 4. Verification Results

### Semantic Contracts Test Suite
```text
node --import tsx --test src/app/services/production/semanticContracts.test.ts

TAP version 13
# Subtest: SPARK Phase 2: Canonical Models & Semantic Contracts
    ok 1 - Test A: ShotSpec can express complete production intent without provider or model
    ok 2 - Test B: Capability requirements derived from shot do not contain provider selections
    ok 3 - Test C: GenerationTask represents executable intent without requiring concrete provider payloads
    ok 4 - Test D: Bidirectional conversion between ProductionBrief and canonical ProductionSpec preserves data
    ok 5 - Test E: SemanticGenerationRequest boundary separates intent from provider request
    ok 6 - Test F: Reference roles convert bidirectionally without loss of core URLs
    ok 7 - Test G: QualityTier and ResolutionClass parse and normalize provider-neutrally
    ok 8 - Test H: Existing dry-run execution completes without live spend
    ok 9 - Guardrails: Architecture maintains single routing, execution, and persistence authority
1..9
# tests 9
# suites 1
# pass 9
# fail 0
```

### Architecture Consolidation Suite (Phase 1 Regression)
```text
node --import tsx --test src/app/services/production/architectureConsolidation.test.ts
# tests 6
# suites 1
# pass 6
# fail 0
```

### Full Repository Test Suite
```text
& 'C:\Program Files\nodejs\npm.cmd' test
tests 793
pass 791
fail 2 (pre-existing baseline failures: officialI2vFrames.test.ts, assetBibleFromBrief.test.ts)
```

### Production Build
```text
& 'C:\Program Files\nodejs\npm.cmd' run build
✓ built in 54.82s
```

---

## 5. Invariants Maintained

1. **No Duplicate Authorities**: Exactly one runtime routing authority (`ModelRouter`), one execution conductor (`executeProduction`), and one asset persistence repository.
2. **No Live Spend**: All contract tests executed via dry runs or unit assertions; zero provider spend occurred.
3. **No Database Migrations**: No Supabase schema changes made.
4. **No UI Redesign**: No UI components modified; all changes isolated to specification layers and documentation.
5. **Lossless Compatibility**: All existing callers of `ProductionBrief` and `ProductionScene` remain 100% operational.

---

## 6. Phase 3 Handoff & Readiness

Phase 2 is complete. Phase 3 (**ReferenceGraph + StyleBible**) can build directly on:
- Normalized `SemanticReference` and `SemanticReferenceRole` in `src/app/services/production/specification/semanticMedia.ts`.
- Structured `outputRequirements` and provider-independent `ShotSpec` in `src/app/services/production/specification/shotSpec.ts`.
- Clean boundary established by `SemanticGenerationRequest` in `src/app/services/production/specification/semanticExecution.ts`.
- Passing test suite in `src/app/services/production/semanticContracts.test.ts`.
