# SPARK Phase 5 Capability Record

Repository: ElOgiso/spark  
Branch: main  
Phase: 5.1 (Fail-Closed Video Submit Path)  
Status: PHASE 5.1 — FAIL-CLOSED SUBMIT PATH  
Date: 2026-09-21  

---

## 1. Executive Summary & Architectural Positioning

Phase 5 establishes the canonical **Capability Fact Layer + Model Catalog Alignment** for SPARK.
The purpose of this phase is to create the authoritative provider-neutral knowledge layer that answers:

> *"What can each available model actually do, what inputs does it accept, what outputs can it produce, what constraints does it have, and how reliable/current is that information?"*

This phase explicitly **does not** implement intelligent routing or scoring algorithms (deferred to Phase 6). Phase 5 establishes the verifiable facts; Phase 6 uses those facts to make routing decisions.

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
CAPABILITY FACT LAYER (MediaCapabilityProfile / registry.ts)
    ↓
MODEL CATALOG ALIGNMENT (modelCatalog.ts ↔ profiles.ts)
    ↓
[Phase 6 — Intelligent Model Router]
    ↓
[Phase 10 — Provider Payload Compilers]
```

---

## 2. Core Implementation Deliverables

### 1. Canonical Fact Layer (`src/app/services/production/capability/types.ts`)
- Preserved and enhanced `MediaCapabilityProfile` as the single canonical source of truth for media model capabilities.
- Added `aliases?: string[]` and `status?: "active" | "disabled" | "deprecated" | "unknown"` to `profile.metadata` for robust alias and lifecycle tracking.
- Every profile preserves full provenance metadata (`source: "manual" | "doc" | "adapter" | "probe"`, timestamp, and inspector notes).

### 2. Provider Profile Coverage & Alignment (`src/app/services/production/capability/profiles.ts`)
- Completed 100% profile coverage matching all production media models declared in `MODEL_CATALOG` (`src/app/services/runtime/modelCatalog.ts`).
- Key model profiles aligned and registered:
  - **Kling**: `kling-v2-6` (canonical, alias `kling-2.6`), `kling-v1-6`, `kling-v3-omni` (preview).
  - **Seedance (ByteDance/Ark)**: `doubao-seedance-1-5-pro-251215` (canonical, alias `doubao-seedance-1-5-pro`), `doubao-seedance-2-0-260128`.
  - **xAI Grok**: `grok-imagine-video-1.5`, `grok-imagine-image-2.0` (alias `grok-imagine-image`), `grok-tts-eve`.
  - **Google Gemini**: `veo-3.1-generate-preview` (canonical, alias `veo`), `veo-2.0-generate-001`, `imagen-3.0-generate-002` (aliases `imagen-3`, `imagen-4.0-generate-001`, `gemini-2.0-flash-exp-image`), `gemini-2.0-flash-tts`.
  - **Higgsfield**: `seedance-2.5-i2v`, `seedance-2.0-i2v`, `seedance-2.5-r2v` (alias `seedance-2.0-r2v`), `soul-2`, `soul-cinema`.
  - **OpenAI**: `gpt-image-1.5` (canonical, alias `gpt-image`), `dall-e-3`, `tts-1` (aliases `tts-1-hd`, `gpt-4o-mini-tts`).
  - **ElevenLabs**: `eleven_multilingual_v2` (canonical, alias `eleven-multilingual-v2`, `eleven_monolingual_v1`), `eleven_turbo_v2_5`.
  - **Runway & Luma**: `runway::gen3` and `luma::ray-2` explicitly registered with `status: "disabled"` and `adapterSupported: false`.
- **0 unmapped production media models** between runtime catalog and capability profiles.

### 3. Capability Profile Registry (`src/app/services/production/capability/registry.ts`)
- Case-insensitive model and alias resolution.
- Exact model matching with fallback to registered aliases.
- Added `findProfileForCatalogModel(providerId, modelId)` helper.
- Safe dynamic registration and test override support.

### 4. Subordination of Capability Matrix Scorecards (`src/app/services/production/routing/capabilityMatrix.ts`)
- Added `resolveScorecardLimits(providerId)` that queries `getCapabilityProfile(providerId)` first for allowed durations, max native duration, and reference budgets, falling back to legacy capability maps only if unprofiled.
- Soft scorecards (`PROVIDER_GENERATION_SCORECARDS`) now subordinate to canonical fact profiles.

### 5. Execution Validation Guard (`executionEngine.ts` & `productionVideoRequest.ts`)
- `assertExecutableCapability` validation guard enforced before submitting jobs to provider adapters:
  - Generative AI media tasks validate requirements against provider/model capability profiles.
  - If impossible (unsupported duration, unsupported aspect ratio, unsupported input count, unsupported start/end frame combination, disabled model), fails closed with structured `REJECTED_*` reason codes.
  - Never attempts the remote provider API call when capability checks fail.
  - Fallback providers are cleanly attempted if configured on the task.
  - Internal non-generative tasks (`merge`, `short_cut`) bypass generative media validation.
- Added capability pre-validation check in `requestProductionVideoClip` to fail impossible requests before remote network dispatch.

### 6. Architectural Boundary Enforcement
- Marked `src/app/services/capabilityRegistry.ts` as strictly isolated to Research and VideoUnderstanding.
- Marked `src/app/services/production/capability/sparkCapabilities.ts` as frozen for platform-level system capabilities (captioning, publishing, narrative planning).

---

## 3. Invariants & Guardrails Preserved

1. **SPARK Owns Meaning; Providers Own Execution**: Capabilities describe what models can do without prescribing subjective directorial intent.
2. **Single Fact Authority**: `MediaCapabilityProfile` remains the sole fact authority. No duplicate registries or greenfield classes (`ModelDefinition`, `ModelRegistry`) were introduced.
3. **Zero Remote Provider Spend**: All validation and tests execute entirely offline in-memory or via mocks with \$0.00 provider API cost.
4. **Zero Database Migrations**: No schema alterations were made.
5. **No Premature Routing**: Scorecards are purely informative priors; intelligent routing remains for Phase 6.

---

## 4. Phase 5.1 — Fail-Closed Video Submit Path

- **Shared `assertVideoRequestExecutable` Helper** (`src/app/services/production/capability/assertVideoRequest.ts`):
  - Extracted shared pre-flight validation used by both `productionVideoRequest.ts` (client before `fetch`) and `api/runtime/video.ts` (server after parsing body).
  - Enforces fail-closed validation: unmapped models, unknown providers, or disabled adapters (`adapterSupported: false`) throw explainable errors and never hit the network.
  - Removed `if (profile)` fail-open bypass in `productionVideoRequest.ts`.
- **R2V Detection & Higgsfield R2V Profile**:
  - Detects R2V from `mode: "reference-to-video" | "r2v"` or `model` containing `r2v`.
- **Strict I2V Still & Grid Guard**:
  - Enforces presence of shot still / firstFrameUrl for all I2V providers.
  - Rejects storyboard grids, contact sheets, and character sheets as motion sources.
  - Rejects `asset://` URI schemes for Higgsfield.
- **Orchestrator Provider Fidelity**:
  - `AIProviderOrchestrator` video generation resolves the target provider (`preferredProvider` / candidate `provider.id`), never hardcoding `"grok"`.
- **Single Billable Video Path Verified**:
  - Audited all occurrences of `fetch("/api/runtime/video")` across codebase.
  - Only `requestProductionVideoClip` initiates billable video generation; FFmpeg merges use `mux` bypass.
  - Regression tests in `src/app/services/production/failClosedVideoSubmit.test.ts`.

---

## 5. Phase 5.2 — Capability Boundary Hardening

- **Separation of Fact Validation from Model Routing**:
  - `assertVideoRequestExecutable` validates the caller's requested model without silent substitution. If a caller requests R2V mode with an I2V model (e.g. `seedance-2.5-i2v`), the request fails closed with an explainable capability rejection rather than secretly swapping the model to `seedance-2.5-r2v`.
  - Upstream orchestrators (`AIProviderOrchestrator`, `productionAssetService`) resolve model IDs before calling `requestProductionVideoClip`.
  - Legacy model defaulting is isolated to `resolveLegacyCompatibilityModel` with `@deprecated To be removed by Phase 6`.
- **Explicit R2V / I2V Semantics**:
  - Removed heuristic R2V inference from `candidateRefs.length > 0 && isIdentityCritical`.
  - R2V is only active when explicitly requested via `mode: "reference-to-video" | "reference_to_video" | "r2v"` or an explicit R2V model name.
  - Standard I2V requests with character/style reference images remain strictly I2V: the shot still is required as frame 1, storyboard grids/sheets as frame 1 are rejected, and identity is carried by the shot still.
  - Updated `generateHiggsfield` in `api/runtime/video.ts` to require `isExplicitR2v` before dispatching to `generateSeedanceReferenceVideo`.
- **Lexical Provider Identifier Aliases vs Routing Decisions**:
  - Formalized `PROVIDER_IDENTIFIER_ALIASES` (`ark` -> `seedance`, `xai` -> `grok`, `higgsfield-seedance` -> `higgsfield`, `google` -> `gemini`) via `normalizeProviderIdentifier`.
  - Documented architectural distinction: aliases normalize known integration/vendor naming variants to canonical capability keys; they do not perform provider selection or load balancing.
- **Verification Matrix (Tests A–L)**:
  - Added full test suite in `src/app/services/production/failClosedVideoSubmit.test.ts` covering:
    - Test A: Explicit `providerId + modelId` validated without substitution.
    - Test B: Known provider + unknown model rejects (`fail-closed`).
    - Test C: Disabled model (`adapterSupported: false`) rejects.
    - Test D: Explicit I2V passes when model supports it.
    - Test E: Explicit R2V passes when model supports it.
    - Test F: References + `identityCritical` do NOT imply R2V; stays I2V.
    - Test G: Missing first frame fails on I2V.
    - Test H: Storyboard / contact sheet / character sheet fails on I2V first frame.
    - Test I: Unsupported output constraints fail (duration, aspect ratio).
    - Test J: Non-generative `mux`/`merge` bypass remains functional.
    - Test K: Direct generative video path bypass check (validates before fetch).
    - Test L: Provider lexical aliases normalize correctly without routing.
