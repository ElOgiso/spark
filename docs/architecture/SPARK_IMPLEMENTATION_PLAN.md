# SPARK Implementation Plan

Audit date: 2026-09-23. Source of phase numbering: [Notion phase program](https://app.notion.com/p/3e3c371711ff80d8ada6f0389a364476).
GitHub main inspected: `d26cbe7355fd7345fc3266250756f31fe802e6aa`.
Implementation target: `main`, as explicitly requested. The previously verified commits `297d28c` and `b7b8234` are incorporated into this main-tree checkpoint.

A completion record proves a scoped implementation, not that every live consumer uses it. Main contains work through Phase 12, but earlier integration requirements remain incomplete. Do not rebuild those modules. Complete their missing connections first.

## Phase register against main

| Phase | Existing implementation | Incomplete requirement / next task |
| --- | --- | --- |
| 0 Baseline | Architecture contract, completion records, tests | Verified baseline fixes are incorporated into this checkpoint. No lint script exists. |
| 1 Consolidation | ProductionService, lifecycle runner, execution bridge, canonical executor | Live adapter delegates to AssetService while canonical engine is used separately. Unify task selection first, then migrate execution incrementally; never run both spenders. |
| 2 Contracts | `specification/semanticMedia.ts`, `generationTask.ts`, `shotSpec.ts` | Ensure live payload preparation consumes semantic output/reference fields consistently. Invalid field reads are corrected in this checkpoint. |
| 3 References/style | ReferenceGraph, StyleBible, continuity engine, reference registry | Prove complete propagation through the live bridge and persistence; preserve existing character sheets. |
| 4 Craft | `craft/operationRegistry.ts`, craftPlanner, compiler support | Ensure live retries compile changed operations through the canonical payload compiler. |
| 5 Capabilities/models | Capability profiles, adapter intersection, discovery/catalog code | Complete verified model health feedback from actual execution; static profiles alone are not live health. |
| 6 Routing | Canonical router, capability filtering/scoring, fallback planning | Connect real candidate cost and execution health to ranking; remove bypasses through compatibility paths. |
| 7 Cost | `economics/costEngine.ts`, pricing registry, estimate types | Lifecycle still uses heuristic estimates and zero provider actuals. Wire actual cost evidence into reports. |
| 8 Credits | Existing profile balance/ledger; CreditService and reservation migration | Default repository is in-memory. Implement secured persistent repository and authoritative reserve/capture/release on live generation. Database transaction/concurrency tests required. |
| 9 Reliability | Execution/job state machines, retries, reconciliation contracts | Durable job state and unknown-submission recovery must survive browser/request termination. |
| 10 Payload compiler | Canonical semantic payload compiler and adapter contracts | Live AssetService path does not consistently pass through it. Migrate existing calls, not a second compiler. |
| 11 Higgsfield | Existing client, discovery, image/video adapters and broader capabilities | Verify expansion against supported API contracts and actual adapter execution; registry declarations do not prove coverage. |
| 12 QC/repair | Failure taxonomy, repair planner, rerouting and tests | Canonical repair exists; live integration, typed contracts and evidence-based final readiness remain gates. Type repairs are incorporated in this checkpoint. |
| 13 Format directors | `resolveGeneratePlan.ts`, narrator compiler, mode-aware production logic | Extend existing Narrator/Hybrid/Cinematic planning on the shared task spine. No separate mode pipelines. |
| 14 Long-form visuals | Narrative chapters, shot planning, still/motion support | Beat-level asset classification and selective-video planning across image/stock/map/chart/screenshot/text/user media remain incomplete. |
| 15 Audio | AudioSpec, voice/music/SFX paths, editorial audio mix | Wire dialogue, conversion, ambience, mix/master to one production timeline with measured durations. |
| 16 Video understanding | `research/providers/VideoUnderstandingProvider.ts`, watch/research integration | Extend the existing provider abstraction for uploaded references and planning/QC/craft consumers. |
| 17 Observability/memory | Execution logging and existing performance/learning modules | Persist joined task/job/cost/credit/QC evidence; learn measured production outcomes rather than fabricated actuals. |
| 18 Security/data | RLS, profiles, admin RPCs | Profile write privileges corrected live in prior task; migration is included in this checkpoint. OAuth/token boundary, media ingestion isolation, overlapping policies and secured financial RPCs remain. |
| 19 Admin operations | Existing admin credit controls | Extend with verified spend, reservations, actual margin, model/provider health and pricing management. |
| 20 UI integration | Existing navigation, modes, credit/settings surfaces | Connect verified estimates/budget/balance; keep infrastructure details in admin/debug surfaces. No redesign. |
| 21 Production validation | Extensive unit/mock integration tests | Paid end-to-end narrator/hybrid/cinematic production and forced failure recovery are not verified. |
| 22 Readiness | Architecture and readiness documents | Not complete: authoritative economics, durable execution, security, real masters and failure recovery must pass first. |

## Current task register

1. **A-05a — shared task selection (implemented):** extend `generation/generationPlanner.ts` with the single selection policy used by the existing live bridge and canonical executor. Preserve valid attached task routing/retry data even when only one task is attached; fill missing planned reference/voice/merge tasks; ignore foreign/stale identities; return the selected tasks on the spec. Fix executor result attachment so newly planned shot tasks are not overwritten with the old empty arrays.
2. **A-05b — execution migration (implemented):** migrated existing live media operations (voice narration, keyframe stills, scene video clips, and multi-scene master merge) in `ProductionAssetService` to execute under SPARK's canonical `GenerationTask` execution contract via `GenerationExecutionEngine.executeTask(...)`. Guaranteed single execution authority with zero dual calls, preserved all existing assets/UI/lineage, enabled truthful task status persistence and round-tripping, and verified with zero paid provider spend ($0.00).
3. **D-08 — durable economics (pending):** reuse CreditService/ledger; harden the existing reservation SQL, add persistent repository, and wire server-authoritative quotation/reservation/settlement. Verify failure, unknown submission, duplicates and concurrent reservations in the database before claiming completion.
4. **E/G — live compiler and QC integration (pending):** route the migrated operations through existing payload compiler and repair planner, with targeted retries and truthful master readiness.
5. **G/H — remaining phases (pending):** proceed through 13–22 in the numbered order above once prerequisites are verified.

### A-05a boundaries and verification

- Changes are limited to the existing planner, executor, compatibility bridge, their tests, and this register.
- No provider integration, new pipeline, model choice, credit economics, database schema, or UI change.
- Tests cover identical bridge/canonical selection, one-task preservation, missing production tasks, stale/cross-production rejection, duplicate identity handling, explicit replanning and returned task state.
- This does **not** establish durable resume: production-level task persistence is addressed below; in-flight reconciliation, output restoration and live execution migration remain A-05b/Phase 9 work.
- No paid provider calls are needed for this task.

### A-05b.1 — preserve all task state in the existing spec (implemented)

- Confirmed defect: `attachGenerationTasksToSpec` discarded tasks without a shot. Voice/merge state and asset identity disappeared when `production.reasoning.productionSpec` was serialized, and selection recreated their initial states.
- Extend the existing `ProductionSpec` with optional `productionTasks` for non-shot work only. Shot tasks remain on `ShotSpec`; no duplicate task registry, table, executor or provider pipeline.
- The shared selector restores both scopes, rejects foreign production/removed scene/changed task identities, and retains explicit replanning behavior. Old specs with no production tasks still plan normally.
- The live bridge attaches the final dependency-adjusted task states through the same helper used by the canonical executor. Existing production reasoning persistence carries the data; no database migration.
- Regression coverage: JSON save/reload retains task status, retry count and asset identity; production/shot scopes are disjoint; bridge output and canonical executor output carry their final tasks; invalid identities cannot inject completion state.
- This is task-state round-tripping, **not durable execution recovery**. The bridge still resets states before AssetService execution, and canonical execution still needs prior output restoration. Provider-job reconciliation and per-operation migration are the next A-05b work. Do not mark Phase 1 or Phase 9 complete.
- Verification: typecheck, full discovered test suite and production build. No paid provider calls or deployed production smoke test.

### A-05b.2 — canonical live execution migration (implemented)

- Migrated existing live media operations in `ProductionAssetService.generateAssets` to execute under the canonical `GenerationTask` contract via `GenerationExecutionEngine.executeTask(...)`:
  - Voice Narration: executed via canonical engine when canonical context (`engine`, `spec`, `voiceTask`) is present; settles credits and produces persistent `ProductionAsset`.
  - Keyframe Stills: executed via canonical engine when canonical context (`engine`, `spec`, `kfTask`) is present; updates task status and assets with zero duplicate calls.
  - Scene Video Clips (I2V): executed via canonical engine inside `generateSubclip` when canonical context (`engine`, `spec`, `videoTask`) is present; guarantees single execution authority.
  - Multi-scene Master Merge: executed via canonical engine for `mergeTask` when multi-scene concatenation is required.
- Preserved existing product behavior, assets, UI, storage paths, fallbacks, and lineage sync (`syncProductionMediaStores`).
- Preserved task identity and state round-tripping via `attachGenerationTasksToSpec(spec, tasks)` in `generateAssets` return.
- Added comprehensive unit & integration test suite `src/app/services/production/execution/canonicalExecutionMigration.test.ts` covering Tests A through J (task identity, single submit, persistence, truthful errors, UNKNOWN_SUBMISSION safety, router ownership, compiler ownership, bridge consistency, production tasks, $0.00 provider spend).
- Verified with zero live provider spend ($0.00).

## Verification discipline

Run typecheck, all discovered tests and production build for each scoped checkpoint. Database changes require schema reconciliation and transaction tests. Real generation validation must separately record provider spend and output evidence. Preserve Spark's existing architecture and UI; never mark a phase complete solely because its files or tests exist.
