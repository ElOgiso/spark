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
 → VisualTreatment (project look bible; scene overrides require reason)
 → Cinematography (purpose → coverage → camera/lens/DOF/movement → blocking/lighting)
 → ShotCinematicIntelligence on each ShotSpec (temporal beats, spatial axis, handoff, refs/capabilities)
 → Continuity bridges
 → Generation strategy resolution
 → Capability-based provider routing (shot-level)
 → Prompt compilation (semantic + cinematic → provider)
 → Generation task DAG
```

Public path still `createProductionPlan()` — now applies visual planning by default.
Cinematic look/shot-direction intelligence lives in `cinematography/cinematicIntelligence.ts` and extends existing planners (no second orchestrator). See `docs/CINEMATIC_SHOT_INTELLIGENCE.md`.
Roadmap “Phase 5 cinematic intelligence” maps here; repo “Phase 5” below remains Intelligent QC.
## Phase 4 status (Media Execution Engine)

```
ProductionSpec + GenerationTask DAG
 → executeProduction()
 → dependency-aware scheduler
 → provider adapters (kling/seedance/grok I2V, openai/gemini image ports, elevenlabs voice, mux)
 → technical validation
 → ProductionAsset persistence
 → retry/fallback via Phase 3 planner
```

Entry: `executeProduction` / `productionService.executeProductionPlan`.
Existing `generateAssetsForProduction` path preserved.
No UI redesign. Unit tests use mocks only — no live provider calls in CI.

## Phase 5 status (Intelligent QC)

```
Generated Asset
 → Phase 4 technical validation (reused)
 → VisualAnalysisService (provider-neutral)
 → multi-dimension QC (intent, identity, continuity, cinematography, motion, audio, style, technical)
 → repair decision engine → Phase 3/4 retry/fallback
 → shot → scene → production hierarchy
 → automation modes (manual / balanced / autonomous)
```

Entry: `runProductionQcHierarchy` / `runQcWithRepairLoop` / `executeProductionWithQc`.
Results stored on `production.reasoning.productionQc` — no QC dashboard UI.
Intelligent QC evaluates planned ShotSpec vs observed media; not aesthetic preference.

## Phase 6 status (Editorial Timeline & Mastering)

```
Approved ProductionAssets
 → QC-gated eligibility
 → EditorialTimeline (frame timebase, multi-track)
 → validation + decision engine (automation modes)
 → provider-neutral MasteringService
 → FFmpeg adapter boundary (deferred when unavailable)
 → Master ProductionAsset + final technical QC
 → delivery variants (16:9 / 9:16 / 1:1, …)
```

Entry: `assembleEditorialTimeline` / `runEditorialPipeline` / `productionService.assembleEditorialForProduction`.
Legacy `buildEditorialTimeline` preserved. No NLE UI. No UI redesign.

## Phase 7 status (Autonomous Creative Director)

```
User Intent
 → Creative Director (+ CreativeStrategy)
 → Intent / Audience / Objective / Format / Hook / Pacing
 → Production Complexity (+ master reuse)
 → Creative Preflight
 → Existing Genre / Grammar / Narrative / Production planners
 → Phase 3–6 pipeline (generation → QC → editorial → master)
 → QC failure patterns → bounded strategy adjustment
```

Phase 7 owns: executive creative decisions, explainability metadata, complexity estimation, preflight, QC→strategy feedback contracts.
Phase 7 does NOT own: providers, FFmpeg, NLE UI, publishing, analytics dashboards, auth, onboarding redesign.
No duplicate orchestrator — extends `createProductionPlan` / `directCreativeIntent`.

## Phase 8 status (Performance Learning & Adaptive Content Intelligence)

```
PUBLISH / DISTRIBUTE (existing)
 → PERFORMANCE DATA (existing analyticsPipeline — reused, not replaced)
 → PerformanceSnapshot / Observation / Series (normalized)
 → CreativeDNA (from Phase 7 CreativeStrategy)
 → PerformanceAnalyzer → diagnoses + retention (when data exists)
 → CreativeLearning (confidence, decay, provenance, scope)
 → MemoryItem bridge (existing memoryService)
 → Adaptive advice → Phase 7 Creative Director / buildCreativeStrategy
 → next production
```

Phase 8 owns: provider-neutral performance model, metric vocabulary + windows, Creative DNA, analyzer/diagnoses, retention/hook/format/duration learning, account-scoped learning, experiments, confidence/decay/provenance, adaptive strategy influence, production-reliability consumption, quality vs audience-performance distinction.

Phase 8 does NOT own: analytics ingestion replacement, OAuth/auth, publishing rebuild, analytics dashboard UI redesign, engagement bots, scraping, Creative Director v2, second orchestrator.

Entry modules: `src/app/services/production/intelligence/performance/`.
Feedback port: `CreativePerformanceFeedbackPort` / hints on `buildCreativeStrategy`.
Viral Sparks: soft `opportunityBoostFromLearning` only (no second opportunity engine).
Research: market evidence kept distinct from account-specific evidence.

