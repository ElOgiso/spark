# SPARK Phase 3 Reference & Style Record

Repository: ElOgiso/spark
Branch: main
Phase: 3 (ReferenceGraph + StyleBible)
Status: COMPLETE
Date: 2026-09-20

## 1. Purpose & Objective

Phase 3 establishes the two canonical creative-state systems for SPARK's production architecture:
1. **`ReferenceGraph`**: Canonical authority for visual identity, character consistency, environmental anchors, prop assets, and inter-shot continuity references. Answers: *Which assets and identities are required or related to this production/scene/shot, and how?*
2. **`StyleBible`**: Canonical authority for production-wide visual language, cinematography, lighting, color palettes, and artistic constraints. Answers: *What visual grammar, aesthetics, and negative constraints govern the look of this production?*

Core Principle: **SPARK owns Meaning. Providers own Execution.**
Visual identity and style are modeled completely provider-neutrally. Neither the `ReferenceGraph` nor the `StyleBible` contains provider IDs, model parameters, API payloads, or pricing data.

---

## 2. Canonical Systems Implemented

### 1. Canonical ReferenceGraph (`src/app/services/production/specification/referenceGraph.ts`)
- **Reference Nodes (`ReferenceNode`)**:
  - Provider-neutral representation of visual assets and identities.
  - Attributes: `id`, `type`, `role`, `label`, `uri`, `masterRef` (MasterAssetRef), `assetId`, `metadata`, `scope` (`PRODUCTION | SCENE | SHOT | CHARACTER`), `characterId`, `sceneId`, `shotId`, `priority` (`REQUIRED | PREFERRED | OPTIONAL | EXCLUDED`).
- **Node Types (`ReferenceNodeType`)**:
  - `CHARACTER`, `ENVIRONMENT`, `PROP`, `STYLE_REFERENCE`, `START_FRAME`, `END_FRAME`, `KEYFRAME`, `MOTION_GUIDE`, `COMPOSITION_GUIDE`, `USER_UPLOAD`, `BRAND_ASSET`, `GENERATED_OUTPUT`.
- **Reference Roles (`ReferenceRole`)**:
  - `IDENTITY`, `SUBJECT`, `WARDROBE`, `HAIR_MAKEUP`, `LIGHTING_REFERENCE`, `COLOR_PALETTE`, `CAMERA_ANGLE`, `MOTION_TRAJECTORY`, `DEPTH_GUIDE`, `POSE_GUIDE`, `BACKGROUND`, `FOREGROUND`, `CANONICAL_LOOK`.
- **Reference Edges (`ReferenceEdge` & `ReferenceRelationType`)**:
  - Represents directed relationships between nodes:
    `APPEARS_IN`, `SET_IN`, `USES_PROP`, `CONTINUITY_FROM`, `MATCHES_STYLE`, `DERIVED_FROM`, `CONSTRAINED_BY`, `OVERRIDES`, `EXCLUDES`.
- **Deterministic Resolution & Precedence (`resolveReferences`)**:
  - Deterministic precedence hierarchy:
    1. **Exclusions**: Any node explicitly excluded or targeted by an `EXCLUDES` edge is removed from the active set (veto).
    2. **Shot Overrides**: Shot-level reference overrides supersede scene or production references.
    3. **Shot References**: Scoped specifically to the shot.
    4. **Scene References**: Inherited from the enclosing scene.
    5. **Character Identity References**: Inherited when characters appear in the shot.
    6. **Production & Brand References**: Inherited production-wide.
- **Deterministic Conflict Detection (`ReferenceConflict`)**:
  - When contradictory `REQUIRED` references are specified for the same entity role without an explicit priority override, Spark does not guess or crash.
  - Generates structured `ReferenceConflict` records containing `conflictId`, `role`, conflicting `nodeIds`, `candidates`, and diagnostic `evidence`.
- **Stable Asset Identity**:
  - Nodes anchor to persistent storage references via `assetId` or `masterRef` (`MasterAssetRef`), rather than volatile ephemeral URLs alone.

### 2. Canonical StyleBible (`src/app/services/production/specification/styleBible.ts`)
- **Structured Visual Language Dimensions**:
  - **`VisualLanguageStyle`**: `artDirection`, `visualTone`, `realismDegree`, `aestheticEra`, `textureQuality`, `renderingEngineFeel`.
  - **`CinematographyStyle`**: `cameraLensFamily`, `sensorFormatFeel`, `depthOfField`, `defaultShotFraming`, `cameraMotionLanguage`, `shutterFeel`.
  - **`LightingStyle`**: `primaryKeyRatio`, `contrastStyle`, `colorTemperaturePreference`, `practicalLightMotifs`, `atmosphericHaze`.
  - **`ColorStyle`**: `dominantPalette`, `accentPalette`, `colorGradingApproach`, `saturationProfile`, `shadowsTone`, `highlightsTone`.
  - **`EnvironmentStyle`**: `architecturalLanguage`, `materialsAndTextures`, `worldCondition`, `weatherDefaults`, `environmentalScale`.
  - **`CharacterStyle`**: `visualTreatment`, `wardrobeTone`, `hairMakeupLanguage`, `lightingResponse`.
  - **`MotionStyle`**: `paceFeel`, `subjectMotionDynamics`, `cameraMotionDynamics`, `temporalRhythm`.
  - **`GraphicsStyle`**: `overlaysAllowed`, `typographyStyle`, `frameBorders`, `graphicalMotifs`.
  - **`StyleConstraints`**: `negativePrompts`, `forbiddenArtifacts`, `forbiddenColors`, `lightingConstraints`.
- **Precedence Cascade (`resolveStyleBible`)**:
  - Deterministic resolution cascade:
    `Global Defaults` → `Brand Style` → `Production StyleBible` → `Scene Override` → `Shot Override`.
  - Dimension-level isolation: a shot override modifying `lighting` merges non-destructively, preserving inherited cinematography, color, and environment rules.
- **Provenance Tracking (`StyleProvenance`)**:
  - Resolving a StyleBible produces a `provenance` map tracking the exact origin of every dimension (`sourceScope`, `sourceId`, `timestamp`, `explicit`).
- **Bidirectional Adapters (`visualTreatmentToStyleBible` & `styleBibleToVisualTreatment`)**:
  - Full lossless compatibility with existing `VisualTreatment` objects in `cinematicIntelligence.ts`.

---

## 3. Specification Integration

- **`ProductionSpec`** (`src/app/services/production/specification/productionSpec.ts`):
  Added `referenceGraph?: ReferenceGraph` and `styleBible?: StyleBible`.
- **`SceneSpec`** (`src/app/services/production/specification/sceneSpec.ts`):
  Added `styleOverride?: Partial<StyleBible>` and `referenceOverrides?: ReferenceOverrideSpec`.
- **`ShotSpec`** (`src/app/services/production/specification/shotSpec.ts`):
  Added `styleOverride?: Partial<StyleBible>` and `referenceOverrides?: ReferenceOverrideSpec`.
- **`adapters.ts`** (`src/app/services/production/specification/adapters.ts`):
  `legacyProductionToSpec` automatically constructs a default `StyleBible` and `ReferenceGraph` when adapting legacy briefs.
- **`index.ts`** (`src/app/services/production/specification/index.ts`):
  All canonical types, interfaces, helpers, and adapters exported from the specification module barrel.

---

## 4. Separation of Concerns & Boundary Guarantees

| Concern | System Authority | Phase 3 Integration Rule |
| :--- | :--- | :--- |
| Visual Identity & References | `ReferenceGraph` | Canonical source for shot reference requirements. No provider fields. |
| Visual Language & Aesthetics | `StyleBible` | Canonical source for aesthetic rules and constraints. Independent from references. |
| Temporal Continuity | `ContinuityState` / `ShotContinuityBridge` / `visualContinuityGate.ts` | Retained as the sole temporal state authority. ReferenceGraph models inter-shot links as `CONTINUITY_FROM` edges without duplicating temporal logic. |
| Asset Persistence | `productionAssetRepository` / `ProductionAssetService` | Retained as the sole asset storage and persistence authority. Reference nodes link via `assetId` / `masterRef`. |
| Execution & Spend | `executeProduction` / `ProductionLifecycleRunner` | Preserved. Zero live generation spend incurred. |

---

## 5. Verification Results

### ReferenceGraph & StyleBible Test Suite (Phase 3)
```text
node --import tsx --test src/app/services/production/referenceAndStyle.test.ts

TAP version 13
# Subtest: SPARK Phase 3: ReferenceGraph & StyleBible
    ok 1 - Test A: ReferenceGraph construction accepts semantic nodes and edges
    ok 2 - Test B: References inherit down from Production → Scene → Character into Shot
    ok 3 - Test C: A shot can override an inherited reference deterministically
    ok 4 - Test D: Explicitly excluded references do not appear in the resolved set
    ok 5 - Test E: Deterministically surfaces conflicts for contradictory REQUIRED references
    ok 6 - Test F: ReferenceGraph contains no provider-specific execution fields
    ok 7 - Test G: StyleBible constructs structured visual language dimensions and negative constraints
    ok 8 - Test H: Style precedence resolves Defaults → Brand → Production → Scene → Shot
    ok 9 - Test I: Shot-level style override updates specific dimension without destroying others
    ok 10 - Test J: Resolved style bible maintains provenance map for all visual dimensions
    ok 11 - Test K: References and Style remain distinct concepts
    ok 12 - Test L: Character identity references integrate with MasterAssetRef identity system
    ok 13 - Test M: Reference nodes resolve to stable asset identity rather than mutable URLs alone
    ok 14 - Test N: Existing continuity system remains separate authority for temporal state
    ok 15 - Test O: Existing dry-run execution completes successfully with StyleBible and ReferenceGraph attached
    ok 16 - Guardrails: VisualTreatment adapts bidirectionally to StyleBible without loss
1..16
# tests 16
# suites 1
# pass 16
# fail 0
```

### Regression Tests (Phases 1 & 2)
```text
node --import tsx --test src/app/services/production/architectureConsolidation.test.ts src/app/services/production/semanticContracts.test.ts

# Phase 1 Suite: 6/6 passed
# Phase 2 Suite: 9/9 passed
```

### Full Repository Test Suite
Baseline maintained: 791 passing tests (2 pre-existing baseline failures documented in Phase 0).

### Production Build
`npm run build` completed successfully.

---

## 6. Phase 4 Handoff

Phase 3 is complete. The system is ready for **PHASE 4: CRAFT / CREATIVE OPERATIONS**.
Phase 4 will establish the provider-neutral creative operation vocabulary (`GenerateStill`, `GenerateMotionI2V`, `GenerateAudioTrack`, `ExtendShot`, etc.) and transform semantic specifications into executable craft intents.
