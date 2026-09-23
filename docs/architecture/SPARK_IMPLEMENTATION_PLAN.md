# SPARK Implementation Plan

Audit date: 2026-09-23. Source of phase numbering: [Notion phase program](https://app.notion.com/p/3e3c371711ff80d8ada6f0389a364476).
GitHub main inspected: `d26cbe7355fd7345fc3266250756f31fe802e6aa`.
Working branch: `gpt-fixes` (local `fix/production-hardening`).

A completion record proves a scoped implementation, not that every live consumer uses it. Main contains work through Phase 12, but earlier integration requirements remain incomplete. Do not rebuild those modules. Complete their missing connections first.

## Phase register against main

| Phase | Existing implementation | Incomplete requirement / next task |
| --- | --- | --- |
| 0 Baseline | Architecture contract, completion records, tests | Main retains type/test failures; `gpt-fixes` contains the verified baseline fixes. No lint script exists. |
| 1 Consolidation | ProductionService, lifecycle runner, execution bridge, canonical executor | Live adapter delegates to AssetService while canonical engine is used separately. Unify task selection first, then migrate execution incrementally; never run both spenders. |
| 2 Contracts | `specification/semanticMedia.ts`, `generationTask.ts`, `shotSpec.ts` | Ensure live payload preparation consumes semantic output/reference fields consistently. Corrected invalid field reads are on `gpt-fixes`. |
| 3 References/style | ReferenceGraph, StyleBible, continuity engine, reference registry | Prove complete propagation through the live bridge and persistence; preserve existing character sheets. |
| 4 Craft | `craft/operationRegistry.ts`, craftPlanner, compiler support | Ensure live retries compile changed operations through the canonical payload compiler. |
| 5 Capabilities/models | Capability profiles, adapter intersection, discovery/catalog code | Complete verified model health feedback from actual execution; static profiles alone are not live health. |
| 6 Routing | Canonical router, capability filtering/scoring, fallback planning | Connect real candidate cost and execution health to ranking; remove bypasses through compatibility paths. |
| 7 Cost | `economics/costEngine.ts`, pricing registry, estimate types | Lifecycle still uses heuristic estimates and zero provider actuals. Wire actual cost evidence into reports. |
| 8 Credits | Existing profile balance/ledger; CreditService and reservation migration | Default repository is in-memory. Implement secured persistent repository and authoritative reserve/capture/release on live generation. Database transaction/concurrency tests required. |
| 9 Reliability | Execution/job state machines, retries, reconciliation contracts | Durable job state and unknown-submission recovery must survive browser/request termination. |
| 10 Payload compiler | Canonical semantic payload compiler and adapter contracts | Live AssetService path does not consistently pass through it. Migrate existing calls, not a second compiler. |
| 11 Higgsfield | Existing client, discovery, image/video adapters and broader capabilities | Verify expansion against supported API contracts and actual adapter execution; registry declarations do not prove coverage. |
| 12 QC/repair | Failure taxonomy, repair planner, rerouting and tests | Canonical repair exists; live integration, typed contracts and evidence-based final readiness remain gates. Type repairs are on `gpt-fixes`. |
| 13 Format directors | `resolveGeneratePlan.ts`, narrator compiler, mode-aware production logic | Extend existing Narrator/Hybrid/Cinematic planning on the shared task spine. No separate mode pipelines. |
| 14 Long-form visuals | Narrative chapters, shot planning, still/motion support | Beat-level asset classification and selective-video planning across image/stock/map/chart/screenshot/text/user media remain incomplete. |
| 15 Audio | AudioSpec, voice/music/SFX paths, editorial audio mix | Wire dialogue, conversion, ambience, mix/master to one production timeline with measured durations. |
| 16 Video understanding | `research/providers/VideoUnderstandingProvider.ts`, watch/research integration | Extend the existing provider abstraction for uploaded references and planning/QC/craft consumers. |
| 17 Observability/memory | Execution logging and existing performance/learning modules | Persist joined task/job/cost/credit/QC evidence; learn measured production outcomes rather than fabricated actuals. |
| 18 Security/data | RLS, profiles, admin RPCs | Profile write privileges corrected live in prior task; migration is on `gpt-fixes`. OAuth/token boundary, media ingestion isolation, overlapping policies and secured financial RPCs remain. |
| 19 Admin operations | Existing admin credit controls | Extend with verified spend, reservations, actual margin, model/provider health and pricing management. |
| 20 UI integration | Existing navigation, modes, credit/settings surfaces | Connect verified estimates/budget/balance; keep infrastructure details in admin/debug surfaces. No redesign. |
| 21 Production validation | Extensive unit/mock integration tests | Paid end-to-end narrator/hybrid/cinematic production and forced failure recovery are not verified. |
| 22 Readiness | Architecture and readiness documents | Not complete: authoritative economics, durable execution, security, real masters and failure recovery must pass first. |

## Current task register

1. **A-05a — shared task selection (implemented on working branch):** extend `generation/generationPlanner.ts` with the single selection policy used by the existing live bridge and canonical executor. Preserve valid attached task routing/retry data even when only one task is attached; fill missing planned reference/voice/merge tasks; ignore foreign/stale identities; return the selected tasks on the spec. Fix executor result attachment so newly planned shot tasks are not overwritten with the old empty arrays.
2. **A-05b — execution migration (pending):** make existing live media operations run under the canonical task execution contract, preserving current assets/UI and preventing duplicate spend. This requires per-operation migration; changing one top-level function call is insufficient.
3. **D-08 — durable economics (pending):** reuse CreditService/ledger; harden the existing reservation SQL, add persistent repository, and wire server-authoritative quotation/reservation/settlement. Verify failure, unknown submission, duplicates and concurrent reservations in the database before claiming completion.
4. **E/G — live compiler and QC integration (pending):** route the migrated operations through existing payload compiler and repair planner, with targeted retries and truthful master readiness.
5. **G/H — remaining phases (pending):** proceed through 13–22 in the numbered order above once prerequisites are verified.

### A-05a boundaries and verification

- Changes are limited to the existing planner, executor, compatibility bridge, their tests, and this register.
- No provider integration, new pipeline, model choice, credit economics, database schema, or UI change.
- Tests cover identical bridge/canonical selection, one-task preservation, missing production tasks, stale/cross-production rejection, duplicate identity handling, explicit replanning and returned task state.
- This does **not** establish durable resume: production-level task persistence, in-flight reconciliation, output restoration and live execution migration remain A-05b/Phase 9 work.
- No paid provider calls are needed for this task.

## Verification discipline

Run typecheck, all discovered tests and production build for each scoped checkpoint. Database changes require schema reconciliation and transaction tests. Real generation validation must separately record provider spend and output evidence. Preserve Spark's existing architecture and UI; never mark a phase complete solely because its files or tests exist.
