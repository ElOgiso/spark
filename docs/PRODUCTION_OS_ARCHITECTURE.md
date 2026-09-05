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


## Phase 9 status (Generation QA + Automated Repair)

Phase 9 extends the existing QC subsystem — it does **not** introduce a second QA engine.

```
GenerationTask → Candidate(s)
  → Structural / Technical / Identity / Continuity / Cinematic / Temporal QA
  → Compare against ProductionSpec truth (ShotSpec + ContinuityState + GenerationIntent)
  → PASS | WARN | FAIL | CRITICAL | UNKNOWN
  → Failure taxonomy + root-cause hints
  → Localized repair plan (bounded retries)
  → Re-QA → approve | escalate
```

### Evaluation layers (existing `qc/` module)

| Layer | Module | Role |
| --- | --- | --- |
| Structural | `evaluators/structuralEvaluator.ts` | Asset exists / readable / usable before semantic spend |
| Technical | `evaluators/technicalConsumer.ts` | Consumes Phase 4 technical validation (duration, resolution, …) |
| Identity / reference | `evaluators/identityEvaluator.ts` | Character / product / wardrobe identity vs contracts |
| Continuity | `evaluators/continuityEvaluator.ts` | Wardrobe, props, location, screen direction, eyeline, axis |
| Handoff / temporal | `evaluators/handoffEvaluator.ts` | Start/end state + shot N→N+1 handoff |
| Cinematic intent / coverage | `evaluators/coverageEvaluator.ts` + cinematography | Purpose, framing, coverage role |
| Motion / audio / style | existing evaluators | Soft vs hard as taxonomy dictates |

Every semantic finding carries **score / confidence / evidence**. Missing vision capability returns `not_evaluated` / inconclusive — never fabricated confidence.

### Scoring + gate

- Composite score is summary-only.
- Hard-requirement failures dominate aesthetic score (`hardFailures` / `hardFailurePresent` via `partitionFailures` + `gateDecisionFromQc` in `scoring.ts`).
- Gate outcomes follow `gateDecision`: approve | approve_with_warnings | reject | needs_review | not_evaluated.

### Repair

- `repairPlanner.ts` chooses the smallest valid scope (`candidate` → `shot` → `shot_and_dependents` → `scene`).
- Strategies include reference strengthening, continuity constraints, camera/motion intent, provider change, and `escalate_human_review`.
- `automationPolicy.ts` + QC budgets bound autonomous retries; budget exhaustion escalates rather than looping forever.
- Continuity feedback (`dagFeedback.ts`) records findings only — it does **not** silently mutate ContinuityState.
- Downstream dependents are marked for **revalidation**, not automatic full-production regeneration.

### Candidate ranking

`candidateRanking.ts`: hard-requirement eligibility outranks aesthetic score (cherry-pick the best **valid** candidate).

### Provider-agnostic

No provider-named QC agents. Provider/model metadata is evidence only.

## Phase 10 status (End-to-end Production Lifecycle)

Phase 10 is an **integration conductor only** — it does not rebuild QC, editorial, DAG, or the executor.

```
Planned ProductionSpec
 → runProductionPreflight (spec + legacy gate + DAG)
 → executeProduction (Phase 4)
 → runQcWithRepairLoop (Phase 5/9)
 → runEditorialPipeline + optional master (Phase 6)
 → ProductionLifecycleReport (+ checkpoint)
```

Entry points:
- `runProductionLifecycle` / `resumeProductionLifecycle` in `execution/productionLifecycleRunner.ts`
- `productionService.runFullProductionLifecycle` (persists summary on `production.reasoning.lifecycle`)

Conductor behavior:
- Provider-agnostic; supports `dryRun`
- Preflight blockers → `blocked` with actionable codes (no generation)
- QC `production_failed` → `failed` (no editorial)
- QC needs review → `awaiting_review` (no editorial)
- Mastering failure (not deferred) → `failed`, never `completed`
- `allowCompleteWithoutMaster` / express-like modes may complete without master
- Resume of a `completed` checkpoint is a no-op (no regeneration)
- `AbortSignal` → `cancelled`
- Structured lifecycle events; cost is estimated-only; timing rollup included

Out of scope here: Phase 11 learning loops / Phase 12 UX polish.


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

## Continuity State & Propagation (SPARK prompt Phase 7)

Separate from Creative Director above. Extends the existing continuity engine — does not replace it.

```
ProductionSpec / ShotSpec
 → ContinuityState (expected)
 → ContinuityDelta (deterministic)
 → Constraints + Conflicts + Risk
 → ContinuityGenerationHandoff → GenerationIntent
```

See `docs/CONTINUITY_STATE_PROPAGATION.md` for ContinuityState, delta, locks, versioning,
scope inheritance, impact analysis, and Phase 6 handoff. Pixel verification remains Phase 9;
execution DAG scheduling remains Phase 8.

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

## Visual preproduction + storyboard bridge

```
ProductionSpec / ShotSpec (canonical)
 → VisualTreatment + character/location/product contracts
 → ReferenceManifest (priority, conflict, budget from capability registry)
 → StoryboardBlueprint (panel.shotId → ShotSpec; non-canonical)
 → VideoGenerationIntent (appearance ⊥ motion) → MultimodalVideoGenerationRequest
 → shot risk / candidate ranking / visual lock versioning
```

Module: `src/app/services/production/preproduction/`. See `docs/VISUAL_PREPRODUCTION.md`.
ShotSpec remains the generation unit; storyboard does not replace it. Multimodal reference ceilings (e.g. Seedance ~12) live in `providerCapabilities.maxMultimodalReferences`, not in cinematography/storyboard code.

## Phase 6 status (Operational Storyboard → GenerationIntent → GenerationTask)

Operational bridge after visual preproduction (distinct from editorial timeline Phase 6 numbering in earlier sprints):

```
ShotSpec (+ StoryboardPanelSpec / ReferenceManifest)
 → GenerationIntent (appearance ⊥ motion; hard/soft constraints; candidate policy)
 → CapabilityResolution (existing scoreProvidersForShot / capability matrix)
 → GenerationTask[] (existing DAG contract + optional trace fields)
```

Entry: `planOperationalShotGeneration` in `generation/operationalPipeline.ts`.
Storyboard sheets: `chooseStoryboardLayout` + `packStoryboardSheets`.
Cherry-pick: `selectAndRecordCandidate` / `planShotLocalRegeneration`.
Props: `PropVisualContract` via existing asset masters.
Acceptance: `productionPhase6Acceptance.test.ts` (John coffee shop).
Optional flag: `applyVisualPlanningPipeline(..., { enableOperationalGeneration: true })` (default OFF).
No new orchestrator / DAG / provider agent / UI. See `docs/PHASE6_OPERATIONAL_STORYBOARD_PIPELINE.md`.

## SPARK Generation DAG (Phase 8 — Execution Ordering)

> Naming note: the historical “Phase 8” section above covers Performance Learning.
> This section documents the SPARK roadmap **Generation DAG** work (execution ordering).
> It does not replace Performance Learning and does not implement visual QC (Phase 9).
> End-to-end lifecycle wiring lives in Phase 10 (`runProductionLifecycle`).

### Responsibility

Phase 8 answers: **when** may each `GenerationTask` run?

```
ProductionSpec
  → GenerationTask[] (planner)
  → ProductionDag (typed dependencies)
  → ready queue / execution waves
  → Scheduler (bounded concurrency)
  → ExecutionEngine / adapters (how)
  → Assets
```

### Dependency model

Edges are typed (`DependencyReason`) and strength-tagged (`hard` | `soft`):

| Reason | Typical use |
|--------|-------------|
| REFERENCE | Character/location reference readiness |
| CONTINUITY | Prior shot approved end-state required |
| SEQUENTIAL | Soft narrative adjacency (never blocks alone) |
| ASSET | Keyframe → video |
| EDITORIAL | Leaf media → master merge |
| VALIDATION | Candidate approval gates |

Hard edges block readiness. Soft edges never silently become hard.

Completion ≠ approval: `markNode(..., "done")` does not auto-approve.
`approveNode` sets `approved` for `approved_output` requirements.

### Parallelism & waves

`readyNodes` / `computeExecutionWaves` maximize safe parallelism.
Narrative order is not execution order unless CONTINUITY/hard edges say so.

### Scheduler

`selectReadyBatch` consumes DAG readiness + priority + modality/provider concurrency caps.
It does **not** choose providers (routing owns that).

### Failure / retry / resume

- `propagateFailure` blocks hard dependents; independents keep running
- `planRetry` / `applyRetry` regenerate minimal scope
- `createCheckpoint` / `resumeFromCheckpoint` preserve completed work
- Idempotent scheduling skips already-succeeded tasks

### Critical path

`computeCriticalPath` exposes the longest dependency chain for orchestration insight.

### Out of scope here

- Visual QC / automated repair (Phase 9)
- Full production UX surfaces (Phase 12) — Phase 10 wires the lifecycle conductor only
- LLM schedulers / second DAG engines
- Rewrites of `productionAssetService`

