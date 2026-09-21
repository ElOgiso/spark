# SPARK Phase 6 Architecture Record: Intelligent Model Routing & Router Consolidation

**Repository:** `ElOgiso/spark`  
**Branch:** `main`  
**Baseline Commit:** `c945ee5` (`fix(capability): harden video capability boundary`)  
**Phase:** 6 — Intelligent Model Routing & Router Consolidation  
**Status:** COMPLETE & VERIFIED  
**Date:** 2026-09-21  

---

## 1. Executive Summary

Phase 6 establishes **one canonical routing authority** for SPARK, consolidating historical routing pathways and eliminating scattered hardcoded provider/model selections across production services.

The target architecture is strictly verified and active:
```text
Production Intent
        ↓
Routing Intent
        ↓
CANONICAL MODEL ROUTER (src/app/services/production/capability/router.ts)
        ↓
Hard Capability Filtering (MediaCapabilityProfile + Adapter Claims)
        ↓
Candidate Set (Eligible models)
        ↓
Intelligent Scoring (Fit, Quality, Reliability, Health, Latency, Cost, Preferences)
        ↓
Resolved Explicit Provider + Model + Explanations
        ↓
Phase 5.2 Capability Validation Guard (assertVideoRequestExecutable)
        ↓
Provider Adapter
        ↓
Generation Dispatch
```

---

## 2. Pre-Phase 6 Router Landscape (Audit)

Before Phase 6 consolidation, routing decisions were fragmented across several systems:

1. **`src/app/services/runtime/modelRouter.ts`**:
   - Historically used as a static default category switch table (`videoGeneration -> gemini`, `storyboardImages -> openai`).
   - Looked up catalog models via `getRecommendedModel(provider, capability)` from `modelCatalog.ts`.
   - Did not perform capability-profile validation or health-aware filtering for media assets.

2. **`src/app/services/production/capability/router.ts`**:
   - Created in Phase 3 as an in-memory scoring engine over `MediaCapabilityProfile` candidates.
   - Evaluated hard constraints and soft scores, but was not uniformly called by upstream asset generators.

3. **`src/app/services/production/routing/capabilityMatrix.ts`**:
   - Held static scorecards (`PROVIDER_GENERATION_SCORECARDS`) that were partially subordinated to profiles in Phase 5.

4. **Ad-hoc Hardcoded Switches in Upstream Callers**:
   - `productionAssetService.ts` (`generateChapterClip`): passed `options.model` without explicit resolution, falling back to legacy downstream defaults.
   - `productionAssetService.ts` (`repairSceneVideo`): hardcoded provider check:
     `activeVideo.providerId === "higgsfield" ? "seedance-2.5-i2v" : activeVideo.providerId === "kling" ? "kling-v2-6" : ...`

---

## 3. Canonical Routing Authority Selection

**Canonical Authority:** `src/app/services/production/capability/router.ts`  
**Canonical Functions:** `resolveCanonicalModel` & `routeMediaCapability`

### Rationale:
- Built directly on the authoritative **Capability Fact Layer** (`MediaCapabilityProfile` in `profiles.ts` and effective capabilities from `adapterSupport.ts`).
- Respects live provider health via `ServiceHealthMonitor`.
- Evaluates real adapter constraints (e.g. Runway/Luma flagged `adapterSupported: false`).
- Implements two-stage filtering (Hard Capability Filtering before Soft Scoring).
- Produces fully explainable decisions with structured `reasons` and `reasonCodes`.

### Facade Role for `ModelRouter`:
`src/app/services/runtime/modelRouter.ts` was retained as a backward-compatible facade. When resolving providers or models for media categories (`videoGeneration`, `storyboardImages`), `ModelRouter.resolveProvider` and `ModelRouter.resolveModel` delegate directly to `routeMediaCapability`.

---

## 4. Caller Migration Map

| Caller | Before Phase 6 | After Phase 6 |
|---|---|---|
| `ModelRouter.resolveProvider` (media) | Static category switch (`gemini`, `openai`) | Delegates to canonical `routeMediaCapability` |
| `ModelRouter.resolveModel` (media) | `getRecommendedModel` from static catalog | Delegates to canonical `routeMediaCapability` |
| `productionAssetService.ts:generateChapterClip` | Passed `options.model` directly (often undefined) | Resolves `effectiveVideoModel` via `routeMediaCapability` |
| `productionAssetService.ts:repairSceneVideo` | Hardcoded ternary across provider IDs | Calls `routeMediaCapability` with `preferredProviderId` |
| `productionAssetService.ts:requestProductionVideoClip` | Allowed undefined model to reach legacy default | Receives explicit `provider` + `model` from caller |

---

## 5. Legacy Fallback Analysis

- **`resolveLegacyCompatibilityModel`** in `src/app/services/production/capability/assertVideoRequest.ts`:
  - Maintained strictly as a `@deprecated` fail-safe guard for non-production tests.
  - **Production Callers Before Phase 6:** 1 (`productionAssetService.ts`).
  - **Production Callers After Phase 6:** **0**. All live generation paths in `productionAssetService` explicitly resolve models upstream via canonical routing.

---

## 6. Two-Stage Decision Architecture

### Stage 1: Hard Capability Filtering
Any model failing hard requirements is immediately rejected and cannot be chosen, regardless of preference or score:
- **Modality & Generation Mode**: I2V, R2V, T2V, Text-to-Image, TTS.
- **Reference Constraints**: Supported types (`character`, `style`, `environment`), single vs multi-reference count.
- **Temporal Constraints**: Start frame, end frame, tail frame, start-and-end frame conditioning.
- **Output Constraints**: Duration bounds (`minSeconds` / `maxSeconds` / `supportedValues`), aspect ratio support.
- **Audio Constraints**: Native audio generation requirement.
- **Execution Constraints**: `adapterSupported: true` required. Models claiming capabilities without SPARK adapter execution (e.g., Runway, Luma) are rejected with `REJECTED_ADAPTER_UNSUPPORTED`.
- **Exclusion Filters**: `excludedProviderIds`, `excludedModelIds`.
- **Budget Ceilings**: `budget.maxProviderCost` rejects candidates exceeding maximum allowed cost when economics are known.

### Stage 2: Intelligent Soft Scoring
Eligible candidates are scored across weighted dimensions:
$$\text{FinalScore} = \text{Fit} \times 1.0 + Q \cdot W_q + R \cdot W_r + L \cdot W_l + C \cdot W_c + P \cdot W_p + H \cdot W_h$$

- **Fit ($1.0$)**: Degree of requirement satisfaction (warnings slightly penalize).
- **Quality ($W_q$)**: Baseline capability richness & performance quality score.
- **Reliability ($W_r$)**: Historic success rate and health status.
- **Latency ($W_l$)**: Execution speed & roundtrip latency.
- **Cost ($W_c$)**: Normalized inverse of generation cost (neutral $0.5$ when unknown; pricing engine deferred to Phase 7).
- **Preference ($W_p$)**: Preferred provider ($+0.35$) and model ($+0.15$).
- **Health ($W_h$)**: Service status (`healthy` = 1.0, `unknown` = 0.7, `degraded` = 0.45, `error`/`disabled` = 0.0).

### Dynamic Weight Adjustments:
- **Production Modes**:
  - `Economy`: Biases cost ($0.35$) and reliability ($0.35$); lowers quality weight ($0.20$).
  - `Balanced`: Standard cinematic balance ($0.35$ quality, $0.25$ reliability, $0.20$ cost).
  - `Cinematic`: Biases quality ($0.50$) and reliability ($0.30$); deprioritizes cost ($0.10$).
  - `Maximum`: Extreme quality floor ($0.60$ quality, $0.25$ reliability, $0.05$ cost).
- **Priorities**:
  - `hero`: Quality boosted by $+0.30$, reliability $+0.10$, cost relaxed.
  - `supporting`: Cost boosted by $+0.30$, latency $+0.20$, quality relaxed.

### Deterministic Tie-Breaking (Zero Randomness):
Ties are resolved deterministically without `Math.random()`:
1. `finalScore` descending
2. `reliability` descending
3. `quality` descending
4. `canonicalIndex` ascending (stable order in canonical capability profiles catalog)

---

## 7. Canonical Routing Contract

```typescript
export interface RoutingIntent {
  modality: MediaModality;
  generationMode?: GenerationMode;
  references?: ReferenceRequirements;
  temporal?: TemporalRequirements;
  camera?: CameraRequirements;
  motion?: MotionRequirements;
  output?: OutputRequirements;
  audio?: AudioRequirements;
  execution?: ExecutionRequirements;
  objective?: RoutingObjective;
  productionMode?: RoutingProductionMode;
  priority?: RoutingPriority;
  preferredProviderId?: string;
  preferredModelId?: string;
  budget?: { maxProviderCost?: number; maxTotalBudget?: number; currency?: string };
  excludedProviderIds?: string[];
  excludedModelIds?: string[];
  manualOverride?: boolean;
}

export interface ResolvedModelRouting {
  providerId: string;
  modelId: string;
  score: number;
  reasons: {
    capabilityFit: string[];
    strengths: string[];
    tradeoffs: string[];
  };
  reasonCodes: RoutingReasonCode[];
  estimatedCost?: number;
  decision: MediaRoutingDecision;
}
```

---

## 8. Verification & Test Results

### 1. Dedicated Phase 6 Router Test Suite
File: `src/app/services/production/canonicalRouter.test.ts`
- **Total Tests:** 20
- **Passed:** 20 (100%)
- **Failed:** 0
- **Suites covered:**
  1. Authoritative Routing Contract (`resolveCanonicalModel`)
  2. Stage 1 Hard Capability Filtering (unsupported duration, unsupported reference counts)
  3. Modality Routing (I2V, R2V, T2V, Image, Audio)
  4. Production Modes (Economy, Balanced, Cinematic, Maximum)
  5. Priorities (Hero vs Supporting)
  6. Exclusions & Budget Ceilings (`excludedProviderIds`, `excludedModelIds`, `maxProviderCost`)
  7. Determinism (10 repeated runs yield strictly identical provider, model, and score)
  8. ModelRouter Facade Delegation (`resolveProvider`, `resolveModel`)
  9. Phase 5.2 Validation Boundary (`assertVideoRequestExecutable` passes cleanly on resolved models)

### 2. Full Test Suite Regression Baseline
- Full test suite execution: `npm test`
- **Total tests executed:** 834
- **Passed:** 832
- **Baseline pre-existing failures (untouched):** 2 (`officialI2vFrames.test.ts`, `assetBibleFromBrief.test.ts`)
- **Regressions introduced:** 0

### 3. Production Build
- Build verification: `npm run build`
- TypeScript typechecking & Vite bundling completed with exit code 0.

### 4. Zero-Spend Verification
- **Total Provider API spend:** $0.00
- All tests execute in-memory or against registered mocks.

---

## 9. Phase 7 Readiness

The router cleanly supports Phase 7 (Cost Engine & Economic Optimization):
- Models default to `economics: { known: false }` to avoid inventing prices.
- `budget.maxProviderCost` filtering and `costScore` are fully implemented and activate automatically once authoritative pricing tables are attached in Phase 7.
- Zero breaking changes required for Phase 7 integration.

---

## 10. Phase 6.1 — Authority Audit & Hardening Record

**Audit Commit:** `612a56c`  
**Date:** 2026-09-21  
**Status:** COMPLETE & VERIFIED  

### 1. Canonical Authority Map
- **Capability Facts:** `src/app/services/production/capability/profiles.ts` (`MediaCapabilityProfile`, `MEDIA_CAPABILITY_PROFILES`, `getCapabilityProfile`)
- **Model Catalog:** `src/app/services/runtime/modelCatalog.ts` (`MODEL_CATALOG`, UI/API model metadata aligned with profiles)
- **Canonical Router:** `src/app/services/production/capability/router.ts` (`resolveCanonicalModel`, `routeMediaCapability`, `normalizeRoutingIntentToRequirements`)
- **Legacy Routing Facade:** `src/app/services/runtime/modelRouter.ts` (`ModelRouter.resolveProvider`, `ModelRouter.resolveModel`)
- **Scoring:** `src/app/services/production/capability/router.ts` (`computeWeights`, `scoreCandidate`, `capabilityFitScore`, `qualityScore`, `reliabilityScore`, `latencyScore`, `costScore`, `preferenceScore`, `healthScore`)
- **Health:** `src/app/services/runtime/serviceHealthMonitor.ts` (consumed via `resolveHealthSnapshot` in `registry.ts` as a routing signal)
- **Economics:** Deferred to Phase 7 Cost Engine; currently consumed strictly as an unauthoritative signal via `candidate.economics` in `costScore` (with neutral `0.5` when unknown, never assuming $0 or free)
- **Provider Execution:** `src/app/services/production/execution/adapters/` (`videoI2vAdapter.ts`, `mediaAdapters.ts`, `registry.ts`)
- **Payload Compilation:** `SemanticShotSpec` / `productionVideoRequest.ts` (Phase 10 Provider Payload Compilers)
- **Generation Lifecycle:** `src/app/services/production/execution/executionEngine.ts`, `lifecycleStateMachine.ts`, `jobStateMachine.ts`

### 2. Audit Findings & Hardening Applied
1. **ModelRouter Media Delegation Complete**:
   - `ModelRouter.resolveProvider` and `ModelRouter.resolveModel` previously delegated `videoGeneration` and `storyboardImages`.
   - Hardened to also delegate `voice` category to `routeMediaCapability({ modality: "audio", generationMode: "text_to_speech" })`.
2. **Economic Safety & Cost Score Neutrality**:
   - Verified `costScore` returns strictly `0.5` (neutral) when `economics.known` is false. Unknown economics are never interpreted as free or low-cost.
   - Verified `budget.maxProviderCost` only evaluates when `economics.known === true`, preventing artificial rejection of unpriced models before Phase 7.
3. **Fail-Closed Boundary Preservation**:
   - Verified `assertVideoRequestExecutable` validates caller-supplied models without silent substitutions.
   - Confirmed `resolveLegacyCompatibilityModel` has **0 production callers**.
4. **Deterministic Tie-Breaking**:
   - Verified zero randomness (`Math.random()` = 0). Total tie-breaker `a.canonicalIndex - b.canonicalIndex` guarantees strictly identical results across repeated calls.
5. **Phase 6.1 Test Coverage**:
   - Added Suite 10 to `canonicalRouter.test.ts` (26 / 26 passed, 100%).
   - Full test suite: 838 passed / 2 baseline failures (unrelated pre-existing).
   - Zero remote provider spend ($0.00).

