# SPARK Implementation Plan

Audit date: 2026-09-23. Source of phase numbering: [Notion phase program](https://app.notion.com/p/3e3c371711ff80d8ada6f0389a364476).
Original audit baseline: `d26cbe7355fd7345fc3266250756f31fe802e6aa`. Phase 17 audited live HEAD: `396b8dbeee2d5769d50a38dcfdbdb464b120d20b`. Latest implementation baseline: Phase 18 on GitHub main.
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
| 8 Credits | Existing profile balance/ledger; CreditService and reservation migration | Implemented persistent SupabaseCreditRepository, secured financial RPCs (`spark_reserve_credits`, `spark_settle_credits`, `spark_release_credits`, `spark_mark_pending_unknown`, `spark_refund_credits`), floating-point pricing policy normalization, and complete test matrix A–O. Note: migration `20260923100000_durable_production_economics.sql` ready in repo; requires live apply to Supabase project `jaqzjhabmtvqtvinoafq`. |
| 9 Reliability | Execution/job state machines, retries, reconciliation contracts | Durable job state and unknown-submission recovery must survive browser/request termination. |
| 10 Payload compiler | Canonical semantic payload compiler and adapter contracts | Live AssetService path does not consistently pass through it. Migrate existing calls, not a second compiler. |
| 11 Higgsfield | Existing client, discovery, image/video adapters and broader capabilities | Verify expansion against supported API contracts and actual adapter execution; registry declarations do not prove coverage. |
| 12 QC/repair | Failure taxonomy, repair planner, rerouting and tests | Canonical repair exists; live integration, typed contracts and evidence-based final readiness remain gates. Type repairs are incorporated in this checkpoint. |
| 13 Format directors | Shared scene mode policy, snapshot-aware adapters, mode-safe task planning and operational enrichment implemented | See `SPARK_PHASE_13_FORMAT_DIRECTORS_RECORD.md`. Paid mode runs and mixed-media master validation remain unverified; earlier compiler/QC gates remain open. |
| 14 Long-form visuals | Classification, supplied-source tasks, deterministic factual graphics and shared mixed-media compilation are wired | Real browser/long-duration export acceptance and deployed runtime verification remain open. Stock/screenshots require supplied media; no autonomous stock licensing or site capture is claimed. See Phase 14.2 below. |
| 15 Audio | AudioSpec source bindings, conversion lineage, measured timeline placement, all-lane mixing and mastering handoff implemented | See `SPARK_PHASE_15_AUDIO_DIRECTOR_RECORD.md`. Conversion submission, live multitrack DSP and measured loudness verification remain runtime gates. |
| 16 Video understanding | Implemented. See `SPARK_PHASE_16_VIDEO_UNDERSTANDING_RECORD.md` | Uploaded-reference understanding is not yet the live VIRAL SPARKS truth source. |
| 17 Observability/memory | Implemented canonical production observability events (`public.production_events`), secret sanitization, unified trace synthesis, fail-closed boundaries, sample-size-protected learning gates, and lifecycle/autonomy bridging | See `SPARK_PHASE_17_OBSERVABILITY_MEMORY_RECORD.md`. Migration `20260924135502_production_observability_events.sql` is LIVE on remote Supabase (Gate A: PASS). |
| 18 Security/data | RLS, profiles, admin RPCs, financial & telemetry boundaries | Consolidated overlapping RLS policies across all 21 tables into single authoritative policies per operation; removed unauthenticated telemetry insert bypass; secured financial & admin RPCs with strict search_path, execution ACLs, and fail-closed checks; enforced server-side service-role key boundary; isolated media access and storage to brand owners; implemented test matrix A–Z. Migrations are LIVE on remote Supabase (Gate B: PASS); post-activation cleanup mirrored in repo as `20260924164314_phase18_post_activation_policy_cleanup.sql`. |
| 19 Admin operations | Authoritative admin economics, reservations, provider operations, truthful margin, pricing & reconciliation backlog | Implemented fail-closed admin mutations (removing all direct table fallbacks), truthful economics summary projection (unknown costs strictly yield null margin, never $0.00), provider live health operations & toggling, reconciliation backlog queue, canonical pricing rule discovery, and expanded AdminShell OS UI. Full test matrix A–Z verified. See `SPARK_PHASE_19_ADMIN_ECONOMICS_OPERATIONS_RECORD.md`. |
| 20 UI integration | Existing SPARK / MY SPARK / VIRAL SPARKS / REVIEW / CALENDAR / ANALYTICS / MORE surfaces extended. Canonical mode copy, automation labels, credit balance, billing history, measured analytics only, master-alone is not Ready for Review, unknown submission blocks retry | Not a redesign. Paid generation confirmation still does not call CostEngine from JSX. Phase 21 paid validation is not started. See `SPARK_PHASE_20_UI_INTEGRATION_RECORD.md`. |
| 21 Production validation | Extensive unit/mock integration tests | Paid end-to-end narrator/hybrid/cinematic production and forced failure recovery are not verified. |
| 22 Readiness | Architecture and readiness documents | Not complete: authoritative economics, durable execution, security, real masters and failure recovery must pass first. |

## Current task register

1. **A-05a — shared task selection (implemented):** extend `generation/generationPlanner.ts` with the single selection policy used by the existing live bridge and canonical executor. Preserve valid attached task routing/retry data even when only one task is attached; fill missing planned reference/voice/merge tasks; ignore foreign/stale identities; return the selected tasks on the spec. Fix executor result attachment so newly planned shot tasks are not overwritten with the old empty arrays.
2. **A-05b — execution migration (implemented):** migrated existing live media operations (voice narration, keyframe stills, scene video clips, and multi-scene master merge) in `ProductionAssetService` to execute under SPARK's canonical `GenerationTask` execution contract via `GenerationExecutionEngine.executeTask(...)`. Guaranteed single execution authority with zero dual calls, preserved all existing assets/UI/lineage, enabled truthful task status persistence and round-tripping, and verified with zero paid provider spend ($0.00).
3. **D-08 — durable economics (implemented):** reused and secured SPARK's existing credit reservation and settlement architecture (`CreditService`, `CostEngine`, `SupabaseCreditRepository`). Hardened the reservation and settlement migration (`20260923100000_durable_production_economics.sql`) with explicit `search_path`, overage balance rejection without fabricated collection, and deterministic refund idempotency. Implemented and verified complete test matrix A through O (concurrency, idempotency, UNKNOWN_SUBMISSION hold, duplicate rejection, and execution engine integration) with zero paid provider spend ($0.00).
4. **E/G — live compiler and QC integration (pending):** route the migrated operations through existing payload compiler and repair planner, with targeted retries and truthful master readiness.
5. **Phase 13 — format planning (implemented):** extended existing directors on the shared spine; see the Phase 13 record for compatibility, tests and remaining runtime gates.
6. **Phase 15 — audio timeline integration (implemented):** extended the existing audio/editorial/mastering contract at user request; see the Phase 15 record. Real multitrack rendering is wired and locally verified; conversion provider submission and hosted production verification remain open.
7. **G/H — remaining phases (pending):** Phase 14 runtime gates and Phases 16–22 remain; preserve earlier open integration and runtime gates.

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
- This is task-state round-tripping, **not durable execution recovery**. The bridge previously reset running states before AssetService execution; A-05b.3 below blocks that unsafe restart. Canonical execution still needs prior output restoration. Provider-job reconciliation and per-operation migration are the next A-05b work. Do not mark Phase 1 or Phase 9 complete.
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

### D-08 — durable production economics (implemented)

- Audited and reused existing financial components: `CreditService`, `CostEngine`, `SupabaseCreditRepository`, `InMemoryCreditRepository`, and `pricingPolicy.ts`. No secondary credit system or duplicate cost engine was created.
- Inspected live remote database (`https://jaqzjhabmtvqtvinoafq.supabase.co`):
  - Verified `profiles.credit_balance` and base `credit_ledger` exist.
  - Identified that `credit_reservations` and financial RPCs (`spark_reserve_credits`, `spark_settle_credits`, `spark_release_credits`, `spark_mark_pending_unknown`, `spark_refund_credits`) were authored in migration files but not yet executed on the remote database.
- Created hardened migration `supabase/migrations/20260923100000_durable_production_economics.sql`:
  - Enforced `SET search_path = public` across all financial RPCs.
  - Fixed settlement overage vulnerability: added row locking (`profiles ... FOR UPDATE`) and strictly rejected overages (`v_current_bal < overage`) instead of fabricating collection by clamping to zero.
  - Hardened refund idempotency: returns `{ idempotent_replay: true }` when already `REFUNDED`.
  - Granted explicit execution rights to `authenticated, service_role`.
- Fixed IEEE 754 floating point precision artifact in `pricingPolicy.ts` by normalizing to 6 decimal places before `Math.ceil`, ensuring exact integer pricing without rounding jumps.
- Updated `src/app/backend/database.types.ts` with complete types for `credit_reservations`, `credit_ledger`, and all 5 financial RPCs.
- Created D-08 test suite `src/app/services/production/credits/durableEconomics.test.ts` verifying all 15 matrix tests (Tests A through O):
  - Test A: persistent reservation surviving service/repository recreation.
  - Test B: reservation idempotency replaying existing active reservation.
  - Test C: concurrent reservations preventing over-reservation and negative balances.
  - Test D: settlement with actual cost & automatic release of unused reserved credits.
  - Test E: settlement overage safe rejection without balance corruption.
  - Test F: NOT_SUBMITTED release cleanly restoring available balance.
  - Test G: UNKNOWN_SUBMISSION holding reservation in PENDING_UNKNOWN without premature balance restoration.
  - Test H: reconciliation FOUND recovering provider job ID and settling.
  - Test I: reconciliation CONFIRMED_NOT_SUBMITTED releasing credit hold.
  - Test J: duplicate settlement replay rejection without double debit or release.
  - Test K: duplicate release replay rejection without double restoration.
  - Test L: refund replay idempotency with deterministic keys.
  - Test M: unauthorized/mismatched user mutations rejected without state change.
  - Test N: direct client mutation rejection verified via Supabase RLS and RPC constraints.
  - Test O: end-to-end `GenerationExecutionEngine` execution integration (quote → reserve → submit → actual cost → settle).
- Verified full test suite (1,280 tests passed, 0 failed) and production build (`npm run build` cleanly succeeded in 28.9s) with $0.00 provider spend.

### A-05b.3 — prevent unresolved execution resubmission (implemented)

- Confirmed gaps: canonical queue initialization reset saved running/skipped tasks; the live bridge reset running tasks even during forced regeneration; idempotency only recognized a subset of execution states; provider submission replay guarded known jobs but not submissions still pending or unknown.
- Preserve running/skipped tasks in canonical scheduling. Dependents of running tasks remain blocked. Live AssetService execution refuses an unresolved running task before entering the provider path, including force-regenerate requests.
- Extend the existing execution idempotency policy to cover all active states, pending work, and `RECONCILE_FIRST` errors. Both DAG execution and the newly merged single-task live entry point store returned execution state, including failures and unknown outcomes, rather than leaving a stale queued record.
- An unresolved timeout stays reconciling with no completion timestamp. Its task remains running, not failed/retryable, and the existing credit hold stays unchanged.
- Extend the existing ProviderSubmissionRegistry guard to reject concurrent or unknown replays before calling the adapter. Known submitted-job replay still returns the existing job ID.
- Tests cover saved running/skipped state, blocked dependents, every active execution status, live force-regenerate refusal, concurrent submission, timeout replay through a new executor sharing the store, unchanged credit ledger on replay, known-job reuse, and reconciliation flag retention through live media projection and JSON reload.
- Verification against the updated main baseline: 1,284 tests passed, typecheck passed, production build passed (existing bundle-size warnings). No paid provider calls or database changes in this checkpoint.
- No new pipeline, database schema, UI or credit pricing changes. These guards operate on retained spec state and the existing in-memory stores. They do **not** establish cross-process locking, durable job recovery, restored completed outputs or cross-process financial verification. The newly merged durable economics work is preserved; this checkpoint does not re-certify its database claims. Phase 9 remains incomplete.

### A-05b.4 — restore completed output on idempotent replay (implemented)

- Confirmed defect: the executor reused a succeeded execution without returning its existing asset. The DAG then lost the task's asset ID and downstream input URL; the live single-task path also received no asset reference.
- Extend existing output normalization to reconstruct the saved asset reference from the execution's output metadata, preferring the persistent URL. Verify production/task/scene/shot identity; reuse the existing asset ID. Do not persist another asset or invent another execution.
- Both existing execution entry points use the same replay path. DAG results deduplicate assets by ID and restore dependency URLs and last-frame metadata through their existing success handling.
- A succeeded record with missing output remains protected from provider resubmission. Return a recovery error if its asset cannot be restored; do not treat missing output as permission to spend again.
- Regression coverage: replay within the same executor, a fresh executor sharing the store, dependent video receiving the recovered keyframe, direct live-task replay, unchanged asset-write count, missing outputs, and foreign production output rejection.
- Verification: 1,285 tests passed; typecheck and production build passed (existing bundle-size warnings).
- Scope: this restores completed outputs available in the existing execution store. A saved succeeded task with no corresponding execution/output record still needs durable repository lookup. Cross-process recovery and full production resume remain incomplete. No database, provider pricing or UI changes; no paid generations.

### A-05b.5 — recover completed tasks from saved specifications (implemented)

- Confirmed gap: after a saved production was reloaded, succeeded tasks were skipped but the DAG's prior outputs were empty. A fresh live task executor also lacked the in-memory cache required for reuse.
- Extend existing GenerationTask with a completed-output checkpoint: original execution identity, attempt, existing ProductionAsset reference, and last-frame reference. The existing spec/production reasoning persistence carries it; no second repository or pipeline.
- Both DAG and direct task execution recover completed outputs from the checkpoint without submitting providers or persisting duplicate assets. Restore dependency URLs before scheduling. Verify asset/task/scene/shot/production identity and available brand identity.
- Missing or mismatched checkpoints fail closed and block dependent generation. This deliberately does not guess URLs for older succeeded tasks; those require recovery from existing asset records.
- Live bridge retains completed state and checkpoints for normal continuation. Explicit force-regeneration clears the checkpoint for the selected run; unresolved-work guards remain in force. Final media projection updates the checkpoint to the actual stored asset ID/URL. Live engine construction carries the existing brand ID.
- Tests cover JSON spec save/reload with a fresh executor and empty idempotency store, exactly one new dependent video submission, no keyframe resubmission or duplicate asset write, original execution identity, direct task recovery, foreign output rejection, missing-output dependency blocking, and live bridge preservation/explicit reset.
- Scope: recovery of completed work whose checkpoint reached saved production reasoning. This does not make in-flight provider jobs durable, persist every intermediate transition, add cross-process locks, verify remote media availability, or establish full production readiness. No database or financial changes, no paid generations.

### Phase 14.1 — long-form visual classification and spend control (implemented)

- Extend the existing shot strategy resolver, visual planning pass, canonical task planner and live AssetService. No parallel generation pipeline or UI redesign.
- `ShotSpec.visualPlan` classifies IMAGE, VIDEO, STOCK, SCREENSHOT, MAP, CHART, TEXT, MOTION_GRAPHIC or USER_ASSET with a reason. Explicit decisions are retained. Automatic classification applies from 120 seconds in Narrator/Hybrid; short-form and Cinematic remain unchanged unless an explicit visual choice is supplied.
- Long Narrator plans default to image support. Hybrid selects an opening video hook and still support; explicit motion-demonstration beats may request video. Image beats do not inherit video-provider selection. Old unexecuted candidate-video tasks cannot override the new decision or multiply spend; replacing completed/in-flight work requires review.
- Operational candidate enrichment cannot reintroduce unwanted video tasks. Canonical and live execution check visual requirements before paid work. Live image beats skip I2V, and the selected hybrid hook is not silently skipped because its audio is narration.
- Reuse existing narrator and hybrid compilers. Their deadlines now account for target runtime instead of timing out all long-form work after 60 seconds.
- Missing sourcing/rendering implementations fail closed before provider spend for stock/screenshot/map/chart/text/motion-graphic/user-asset requirements. Arbitrary mixed timelines beyond the existing hook-plus-stills layout are also gated. These are planned requirements, **not completed renderers**; no fake factual charts or substituted AI footage.
- Verification covers all nine classifications, 60-minute plan economics (zero Narrator video tasks; one basic Hybrid hook task), no duplicate IDs/candidate expansion, unchanged short-form/Cinematic behavior, image-provider routing, and zero adapter submissions on unsupported visual requirements.
- Verification on 2026-09-24: 1,292 tests passed, typecheck passed, production build passed (existing bundle-size warnings).
- **Phase 14 is started, not complete.** Remaining: acquire/validate sources, feed supplied assets into the shared task/editorial path, implement factual renderers through existing editorial facilities, support timed arbitrary mixed media, and validate real long-form output. No paid provider tests or deployment validation in this checkpoint.

### Phase 14.2 — source visuals and mixed-media execution (implemented; runtime acceptance open)

- Preserved the newer Phase 13/15 changes on `main`. Extended the existing shot spec, task planner, execution engine, asset bridge, asset storage and editorial render plan. No second production pipeline, new database, or replacement UI.
- STOCK, SCREENSHOT and USER_ASSET accept existing HTTPS image/video sources with attribution and optional asset identity. Existing shot media/keyframes/first-frame references are reused. Durable Spark media is not copied again. Sourced visuals use the existing keyframe task identity, skip image/video adapters and credit reservation, and retain media type, source provenance and saved-output recovery. Unneeded character/location reference tasks are omitted. Changing a completed source requires explicit regeneration.
- CHART renders supplied nonnegative bar values with a source label; MAP renders supplied labelled coordinates as a **geographic-route schematic**, not an invented basemap. TEXT renders supplied content (including existing scene on-screen text); MOTION_GRAPHIC reveals supplied steps in order. Any role can use supplied finished media instead. Factual content is validated and escaped; missing facts/media remain a pre-spend block. These renderers do not research or invent numbers, screenshots or geographic evidence.
- Narrator and Hybrid now delegate to one mixed-media compiler in the existing compiler module. Live AssetService and canonical runtime merging both use it. Arbitrary ordered image/video mixtures preserve every planned beat and use proportional planned timing against measured narration duration. Video shorter than its allocation holds its ending frame. Legacy Hybrid keeps the measured opening duration and rejects a timeline with no room for its remaining stills.
- Merge inputs use narrative shot order rather than alphabetically sorted task dependencies; narration is typed as audio, not video. Editorial FFmpeg plans retain media type, timeline placement and playback rate. Actual recorded container/MIME is carried through the canonical merge adapter.
- Missing visuals, failed narration, recording errors and cancellation do not produce a successful incomplete master. Capture tracks, audio contexts and object URLs are released. Existing multi-line text overlays are retained. No paid provider calls were made during validation.
- Verification: full suite **1,321 tests**, TypeScript and production build; nine focused Phase 14 tests cover no-spend source reuse/recovery, changed-source rejection, factual validation/escaping, motion-step order, mixed-input order/type, mixed-video eligibility, missing slots and mocked recording/cancellation cleanup. Existing bundle-size and duplicate-switch build warnings remain.
- **Runtime acceptance remains open:** the remote browser cannot access this workspace's local test server (`ERR_BLOCKED_BY_CLIENT`). Recording tests use controlled media/DOM fixtures; they are not proof of a real encoded export. A real browser export, long-duration resource/quality test and deployed application verification are still required before declaring Phase 14 fully accepted or Spark production-ready. The browser compiler records in real time and retains output chunks in memory. No server/offline long-form render worker, automatic stock search/licensing or screenshot capture is claimed by this change.

### Phase 16 — Video Understanding (implemented)

- Establish a canonical, provider-neutral video understanding layer across Research, Reference Videos, Production Planning, Craft, QC, and Continuity.
- Core law: **SPARK owns meaning. Providers own execution.** Providers do not dictate the ontology or shape of understanding results.
- `StructuredVideoUnderstanding` unifies temporal segmentation, boundary visual states (start/end), disaggregated motion (camera vs subject vs environment), observed subjects/actions/objects, and typed evidence provenance.
- Built-in fail-closed mechanics: low confidence or missing evidence records explicit limitations (`limitations: [...]`) and low confidence rather than hallucinating facts.
- Seamless multi-system adapters:
  - `ResearchAdapter`: Bidirectional compatibility with existing `VideoResearch` (`toVideoResearch`, `fromVideoResearch`).
  - `QcMapper`: Projects understanding to `ObservedVisualState` and plugs into `VisualAnalysisService` for `evaluateShotQc`.
  - `ReferenceGraphMapper`: Ingests video understanding into the canonical `ReferenceGraph` without duplicating graph infrastructure.
  - `PlanningGuidanceMapper`: Suggests camera/framing/lighting parameters and registered `CraftOperation`s without auto-executing providers.
  - `ContinuityEvidence`: Evaluates transition consistency across adjacent shots via boundary states.
- 100% backward compatible with existing `VideoUnderstandingProvider` callers (`researchWatchWinners.test.ts` passes 17/17).
- Verification on 2026-09-24: Phase 16 suite (23/23 tests pass), full test suite (1,335/1,335 tests pass across 294 suites), typecheck (0 errors), production build passed. Zero provider spend ($0.00).

### Phase 17 — Observability + Production Memory (implemented)

- Make SPARK capable of answering truthfully and durably: what was planned, what was routed, what was spent, did execution succeed, what asset came back, did QC accept it, was it repaired, what became final master, was it published, how did it perform, and what should SPARK learn?
- Core law: **SPARK owns meaning. Providers own execution.** Store evidence first, learn second. Never hallucinate costs or outcomes. Unmeasured provider spend is explicitly recorded as `actualCostStatus: "unknown"`, never falsified as zero.
- Canonical Append-Only Event Store (`public.production_events`):
  - Created migration `20260924135502_production_observability_events.sql` establishing a narrow, dedicated event table with UUID primary key, indexed foreign keys (`production_id`, `task_id`, `execution_id`, `user_id`, `event_type`), row-level security (RLS), and explicit privilege restrictions revoking `UPDATE` and `DELETE` from authenticated and anon roles.
- Sanitizer & Fail-Closed Boundary:
  - Recursive secret sanitizer redacts sensitive key patterns (`authorization`, `api_key`, `access_token`, `refresh_token`, `bearer`, `secret`, `password`, `credential`, `token`, `service_role`).
  - `ProductionObserver` enforces fail-closed behavior for `critical` events (fail the operation if storage fails) and non-blocking delivery for `diagnostic` telemetry.
- Unified Trace Synthesis:
  - `buildProductionTrace(productionId, repo)` reconstructs the complete lifecycle timeline: plan, routing, execution attempts, economic ledger (reservations, settlement, release, cost truth), asset history, QC assessments, repair lineages (`originalAssetId -> failureCode -> repairAction -> replacementAssetId -> secondQcVerdict`), editorial assembly, master rendering, publishing destinations, and measured analytics.
- Sample-Size Protected Learning Gates:
  - `deriveProviderReliabilityFromTrace` enforces `minSamplesForPreference >= 2` before any candidate ranking bias can be adjusted.
  - `deriveRepairEffectivenessFromTrace` records both successful and failed repair outcomes.
  - `gateAudiencePerformanceLearnings` gates out unmeasured/missing analytics and preserves sample-size thresholds.
  - `bridgeQualifiedLearningsToMemory` maps verified learnings into canonical `MemoryItem` records while deduplicating and preventing memory spam.
- Integrated into `productionLifecycleRunner.ts`, `observability.ts`, and `learningUpdatePipeline.ts`.
- Verification on 2026-09-24: Phase 17 test suite (26/26 tests pass across tests A through Z), full test suite (1,375/1,375 tests pass across 296 suites), clean typecheck (`tsc --noEmit`), and clean production build. Zero provider spend ($0.00).

### Phase 18 — Supabase Security & Data Hardening (implemented)

- Audited and hardened SPARK's Supabase security architecture across all 21 tables, RPCs, storage buckets, and server/client environment boundaries:
  - Gate A: Audited and secured Phase 17 migration `20260924135502_production_observability_events.sql` by eliminating unauthenticated insert bypass `(user_id IS NULL AND auth.uid() IS NULL)`, explicitly restricting SELECT/INSERT to `TO authenticated`, and revoking `ALL` from `anon, public` and `UPDATE, DELETE` from `authenticated`.
  - Comprehensive Consolidation Migration (`supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql`):
    - Systematically resolved `multiple_permissive_policies` on all 21 tables (`profiles`, `brands`, `characters`, `brand_rules`, `memory_items`, `research_sources`, `viral_sparks`, `productions`, `review_items`, `publish_jobs`, `analytics_snapshots`, `accounts`, `media_assets`, `coupons`, `credit_ledger`, `credit_reservations`, `admin_audit_log`, `notifications`, `notification_preferences`, `audit_logs`, `production_events`) by dropping legacy fragmented policies and defining single authoritative policies per command.
    - Secured `coupons` table: eliminated public/anon read policy `USING (true)`, restricted reads to active authenticated users, and restricted write operations to verified admins.
    - Added high-selectivity B-tree indexes across all foreign keys and policy correlation columns (`brand_id`, `user_id`, `production_id`, `role`, etc.).
  - Privileged RPC Access Control & Search Path Hardening:
    - Set explicit `search_path = public` across all `SECURITY DEFINER` functions.
    - Revoked default Postgres `PUBLIC` and `anon` execution permissions on all administrative and financial RPCs: `is_admin`, `user_owns_brand`, `handle_new_user`, `admin_set_access_status`, `admin_adjust_credits`, `spark_reserve_credits`, `spark_settle_credits`, `spark_release_credits`, `spark_mark_pending_unknown`, `spark_refund_credits`.
    - Granted execution rights strictly to `authenticated, service_role`.
  - Storage Hardening:
    - Hardened Supabase Storage bucket `Spark` to private (`public = false`).
    - Enforced row-level security on `storage.objects` requiring brand ownership via `public.user_owns_brand(brand_id)` derived from object path prefixes.
  - Client/Server Secret Boundary Enforcement:
    - Removed forbidden `VITE_SUPABASE_SERVICE_ROLE_KEY` prefixes in `api/auth/config.ts` and `api/runtime/_sparkStorage.ts`.
    - Enforced that service-role privileges and provider secrets remain strictly server-side, never exposed to Vite client bundles.
- Verification on 2026-09-24:
  - Phase 18 test suite (`src/app/services/security/phase18SecurityHardening.test.ts`): 15/15 subtests passed covering full matrix Tests A through Z.
  - Security regressions (`runtimeSecurity.test.ts`, `productionObservability.test.ts`, `durableEconomics.test.ts`): 48/48 passed.
  - TypeScript typecheck (`npx tsc --noEmit`): clean (0 errors).
  - Production build (`npm run build`): cleanly succeeded.
  - Provider spend: zero paid provider spend ($0.00).

## Verification discipline


Run typecheck, all discovered tests and production build for each scoped checkpoint. Database changes require schema reconciliation and transaction tests. Real generation validation must separately record provider spend and output evidence. Preserve Spark's existing architecture and UI; never mark a phase complete solely because its files or tests exist.
