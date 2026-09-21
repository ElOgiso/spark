# SPARK Phase 4 Craft Record

Repository: ElOgiso/spark
Branch: main
Phase: 4 (Craft Engine + Creative Operations)
Status: COMPLETE
Date: 2026-09-20

## 1. Purpose & Objective

Phase 4 establishes Spark's canonical **Craft Engine** and **Creative Operation** system.
Core Principle: **SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.**

The Craft Engine turns WHAT Spark wants (narrative beats, dramatic purpose, emotional objectives) into HOW the shot should be crafted creatively (camera moves, optical racking, lighting sweeps, product reveals, motion transfer, object replacement) without deciding WHICH provider or model executes it.

```text
ProductionSpec
    ↓
SceneSpec
    ↓
ShotSpec
    ↓
StyleBible + ReferenceGraph
    ↓
CraftPlan (CraftOperations[])
    ↓
ResolvedSemanticShot
    ↓
[Phase 5 Capability Registry]
    ↓
[Phase 6 Model Router]
    ↓
[Phase 10 Provider Compiler]
```

---

## 2. Canonical Craft Architecture

### 1. Canonical CraftOperation Contract (`src/app/services/production/craft/types.ts`)
- **`CraftOperation<TParams>`**:
  Encapsulates a meaningful creative direction applied to a shot:
  - `id`: unique operation instance identifier (e.g. `op_push_in_101`)
  - `type`: `CraftOperationType`
  - `category`: `CraftOperationCategory`
  - `purpose`: narrative and dramatic reason for the action
  - `target`: `CraftOperationTarget`
  - `parameters`: typed, semantic parameter dictionary
  - `timing`: `OperationTiming` (`startSec`, `durationSec`, `endSec`, `easing`)
  - `intensity`: `CraftIntensity` (`subtle | moderate | dramatic | extreme`)
  - `constraints`: semantic restrictions (e.g. `keep_subject_centered`)
  - `referenceNodeIds`: linked `ReferenceNode` IDs in `ReferenceGraph`
  - `capabilityRequirements`: declared capability requirements
  - `metadata`: non-provider semantic metadata
- **Taxonomy Categories (`CraftOperationCategory`)**:
  `CAMERA`, `COMPOSITION`, `PRODUCT`, `MOTION`, `TRANSFORMATION`, `EDIT`, `LIGHTING`, `SUBJECT`, `ENVIRONMENT`.
- **Target Entities (`CraftOperationTarget`)**:
  Targets semantic entities (`CAMERA`, `SUBJECT`, `CHARACTER`, `PRODUCT`, `OBJECT`, `ENVIRONMENT`, `BACKGROUND`, `FOREGROUND`, `LIGHTING`, `SHOT`, `FRAME`) via stable IDs or semantic labels.
- **Temporal Intent (`OperationTiming`)**:
  Expresses intra-shot creative timing. The existing Editorial and Timeline services remain authoritative for final timeline assembly.
- **Typed Parameter Schemas**:
  Strongly-typed schemas for major operations:
  `PushInParameters`, `PullBackParameters`, `PanParameters`, `TiltParameters`, `DollyParameters`, `CraneParameters`, `OrbitParameters`, `TrackParameters`, `WhipPanParameters`, `RackFocusParameters`, `ZoomParameters`, `HeroShotParameters`, `FlatlayParameters`, `MacroDetailParameters`, `ProductSpinParameters`, `DetailScanParameters`, `LightSweepParameters`, `MotionTransferParameters`, `ObjectReplacementParameters`, `SubjectTrackingParameters`, `SlowMotionParameters`, `SpeedRampParameters`, `MatchCutParameters`.

### 2. Implemented Canonical Operation Vocabulary
- **Camera**:
  - `PUSH_IN`: Progressive forward camera translation heightening intimacy or tension.
  - `PULL_BACK`: Camera retreat revealing context and environment.
  - `PAN`: Horizontal rotational movement.
  - `TILT`: Vertical rotational movement.
  - `DOLLY`: Physical translation through three-dimensional space.
  - `CRANE`: Substantial vertical elevation/descent.
  - `PEDESTAL`: Direct vertical elevation change without pitch alteration.
  - `ORBIT`: Circular arc traversal keeping subject centered.
  - `TRACK`: Camera movement in tandem with moving subject.
  - `WHIP_PAN`: High-speed kinetic horizontal pan generating motion blur.
  - `TOPDOWN`: Perpendicular overhead orientation.
  - `DUTCH_ANGLE`: Canted roll evoking tension or disorientation.
  - `RACK_FOCUS`: Dynamic focal plane shift between foreground and background.
  - `ZOOM`: Optical focal length change.
- **Composition**:
  - `HERO_SHOT`: Iconic, dominant framing celebrating subject prominence.
  - `FLATLAY`: Clean top-down arranged layout of tabletop items.
  - `SYMMETRICAL_COMPOSITION`: Balanced bilateral frame geometry.
  - `MACRO_DETAIL`: Extreme closeup on fine textures or mechanisms.
  - `CLOSE_UP`: Intimate framing isolating character performance.
  - `WIDE_ESTABLISHING`: Expansive composition clarifying geography and atmosphere.
- **Product / Object**:
  - `PRODUCT_SPIN`: Rotating showcase of product design and silhouette.
  - `DETAIL_SCAN`: Methodical camera traversal along surface contours.
  - `LABEL_TRACE`: Targeted tracking move focusing on typography or branding.
  - `LIGHT_SWEEP`: Dynamic specular beam passing across subject edges.
  - `PRODUCT_REVEAL`: Unveiling product from shadow or occlusion.
  - `OBJECT_HIGHLIGHT`: Selective accentuation on a specific item.
- **Motion**:
  - `MOTION_TRANSFER`: Kinematic transfer from driving video onto target subject while preserving identity.
  - `SUBJECT_TRACKING`: Continuous camera orientation lock to moving subject.
  - `CAMERA_FOLLOW`: Trailing or leading follow movement.
  - `SLOW_MOTION`: Overcranked temporal playback cadence.
  - `SPEED_RAMP`: Variable acceleration/deceleration between temporal rates.
  - `FREEZE_MOTION`: Temporal standstill in mid-action.
- **Transformation**:
  - `OBJECT_REPLACEMENT`: Seamless substitution of an object or prop with a target asset.
  - `BACKGROUND_REPLACEMENT`: Environment substitution preserving foreground lighting and performance.
  - `STYLE_TRANSFORMATION`: Temporal artistic transformation during the shot.
  - `ENVIRONMENT_TRANSFORMATION`: Weather or time-of-day changes during the shot.
- **Edit / Transition**:
  - `MATCH_CUT`: Visual shape or motion match to subsequent shot.
  - `WHIP_TRANSITION`: Kinetic whip pan cutting between scenes.
  - `SMASH_CUT`: Abrupt high-contrast cut between extreme tempos.
  - `DISSOLVE`: Optical cross-fade blend.
  - `MORPH`: Continuous topological deformation.
  - `CUTAWAY`: Brief insert shot away from main action.

### 3. CreativeOperationRegistry (`src/app/services/production/craft/operationRegistry.ts`)
- Canonical singleton and extensible registry answering: *What operations does Spark understand?*
- Exposes metadata, accepted targets, parameter validation, capability requirements, and mutual exclusivity.
- Provides `registerDefinition(definition)` for future extensibility without code modifications.

### 4. Deterministic Conflict Validation (`src/app/services/production/craft/validation.ts`)
- `validateCraftPlan(plan, context)`:
  - Detects contradictory operations on the same target sharing overlapping temporal intervals (e.g. `PUSH_IN` and `PULL_BACK`).
  - Detects missing required semantic inputs (e.g. `MOTION_TRANSFER` missing `sourceVideoRef` or `targetSubjectRef`).
  - Detects timing out of shot duration bounds.
  - Validates target type against accepted targets in the registry.
  - Validates reference node IDs against `ReferenceGraph` when provided.

---

## 3. Integration with Existing Systems & Retention

| Existing System | Authority Role | Phase 4 Integration Decision |
| :--- | :--- | :--- |
| **Cinematography Intelligence** (`cinematicIntelligence.ts`, `cameraPlanner.ts`, `shotPlanner.ts`) | Sole authority for dramatic purpose, coverage, angles, and lighting planning | Retained 100%. `deriveCraftPlanFromShot` translates cinematography plans into canonical `CraftPlan`s attached to `ShotSpec.craftPlan`. No duplicate cinematography engine was created. |
| **ReferenceGraph** (`referenceGraph.ts`) | Sole authority for visual identity and asset continuity | Retained 100%. Operations reference semantic node IDs (`referenceNodeIds`) without copying binary or asset tokens. |
| **StyleBible** (`styleBible.ts`) | Sole authority for visual language and artistic constraints | Retained 100%. Operations declare relative `intensity` within the StyleBible envelope without mutating global styles. |
| **ShotSpec** (`shotSpec.ts`) | Canonical unit of visual generation | Added `craftPlan?: CraftPlan;` to `ShotSpec`. |
| **Editorial & Timeline** (`editorial/*`, `timelineService.ts`) | Sole authority for final timeline assembly | Retained 100%. `OperationTiming` expresses intra-shot creative timing only. |
| **Production Execution** (`productionExecutor.ts`, `executionEngine.ts`) | Sole authority for generation task execution | Retained 100%. Existing dry-run execution verified passing with `CraftPlan` attached. |

---

## 4. Capability Requirements Mapping

Deterministic mapping from `CraftOperation` to Phase 2 capability requirements:

| Operation Type | Derived Capability Requirements |
| :--- | :--- |
| `PUSH_IN`, `PULL_BACK`, `PAN`, `TILT`, `DOLLY`, `CRANE`, `PEDESTAL`, `ORBIT`, `TRACK` | `camera_motion`, `camera_control` |
| `WHIP_PAN` | `camera_motion`, `motion_blur` |
| `TOPDOWN`, `DUTCH_ANGLE` | `camera_angle`, `composition_control` |
| `RACK_FOCUS` | `focus_control`, `depth_of_field` |
| `ZOOM` | `optical_zoom`, `focal_length_control` |
| `HERO_SHOT`, `FLATLAY`, `SYMMETRICAL_COMPOSITION` | `composition_control` |
| `MACRO_DETAIL` | `macro_lens`, `close_focus` |
| `CLOSE_UP`, `WIDE_ESTABLISHING` | `framing_control` |
| `PRODUCT_SPIN`, `DETAIL_SCAN`, `LABEL_TRACE`, `PRODUCT_REVEAL` | `product_presentation` |
| `LIGHT_SWEEP` | `lighting_control`, `dynamic_specular` |
| `OBJECT_HIGHLIGHT` | `selective_lighting`, `object_emphasis` |
| `MOTION_TRANSFER` | `motion_transfer`, `video_input`, `image_reference` |
| `SUBJECT_TRACKING`, `CAMERA_FOLLOW` | `subject_tracking`, `camera_motion` |
| `SLOW_MOTION`, `SPEED_RAMP`, `FREEZE_MOTION` | `temporal_control` |
| `OBJECT_REPLACEMENT` | `object_replacement`, `video_input`, `replacement_reference` |
| `BACKGROUND_REPLACEMENT` | `background_replacement`, `segmentation`, `image_reference` |
| `STYLE_TRANSFORMATION` | `style_transformation`, `style_reference` |
| `ENVIRONMENT_TRANSFORMATION` | `environment_control`, `weather_effects` |
| `MATCH_CUT`, `WHIP_TRANSITION`, `SMASH_CUT`, `DISSOLVE`, `MORPH` | `continuity_transition` |

---

## 5. Provider Neutrality & Guardrails

- **Zero Provider Leakage**:
  - No provider IDs (`higgsfield`, `kling`, `runway`, `luma`, etc.) exist in the Craft layer.
  - No model names (`hf_mult_motion_control`, `kling-v1-5`, etc.) exist in the Craft layer.
  - No prompt strings or compiled provider payloads exist in the Craft layer.
  - No provider pricing or credit costs exist in the Craft layer.
  - No generic provider escape hatches (`Record<string, any>` for provider params) exist in canonical contracts.

---

## 6. Verification Results

### Dedicated Craft Engine Suite (Phase 4)
```text
node --import tsx --test src/app/services/production/craftEngine.test.ts

TAP version 13
# Subtest: SPARK Phase 4: Craft Engine & Creative Operations
    ok 1 - Test A: Known operations resolve from the canonical registry
    ok 2 - Test B: Each registered operation exposes valid semantic metadata
    ok 3 - Test C: CraftOperation contains no provider/model selection
    ok 4 - Test D: Operations can reference semantic ReferenceGraph identities
    ok 5 - Test E: Operations can coexist with StyleBible without mutating global style
    ok 6 - Test F: Operations map deterministically to Phase 2 capability requirements
    ok 7 - Test G: Operations can express valid temporal intent
    ok 8 - Test H: Operations reject invalid semantic targets
    ok 9 - Test I: Conflicting operations produce structured validation results
    ok 10 - Test J: Compatible operations can coexist in one CraftPlan
    ok 11 - Test K: MOTION_TRANSFER expresses semantic requirements without a provider-specific implementation
    ok 12 - Test L: OBJECT_REPLACEMENT expresses semantic requirements without provider-specific implementation
    ok 13 - Test M: Existing cinematic planning automatically attaches canonical CraftPlan
    ok 14 - Test N: ReferenceGraph resolution functions seamlessly with CraftPlan
    ok 15 - Test O: StyleBible cascade resolves cleanly alongside CraftPlan
    ok 16 - Test P: Existing dry-run execution completes successfully with CraftPlan attached
    ok 17 - Guardrails: CreativeOperationRegistry and CraftPlan contain zero provider specifics
1..17
# tests 18
# pass 18
# fail 0
```

### Regression Test Suites (Phases 1, 2, 3)
```text
node --import tsx --test src/app/services/production/referenceAndStyle.test.ts src/app/services/production/semanticContracts.test.ts src/app/services/production/architectureConsolidation.test.ts

# Phase 3 Suite: 16/16 passed
# Phase 2 Suite: 9/9 passed
# Phase 1 Suite: 6/6 passed
# Total regression: 31/31 passed (100%)
```

---

## 7. Database Changes & Provider Spend

- **Database Migrations**: `NONE`. Zero schema changes or database migrations.
- **Provider Spend**: `ZERO`. All validation performed via local deterministic tests and dry-run execution; zero live provider API calls or spend occurred.

---

## 8. Phase 5 Handoff

Phase 4 is complete. The system is ready for **PHASE 5: CAPABILITY + MODEL REGISTRY**.
Phase 5 will establish:
- Canonical capability taxonomy indexing provider capabilities
- Provider model registry declaring supported modalities, resolutions, and quality tiers
- Matcher querying whether a model supports declared `CraftOperation` capability requirements
- Groundwork for Phase 6 Intelligent Model Routing
