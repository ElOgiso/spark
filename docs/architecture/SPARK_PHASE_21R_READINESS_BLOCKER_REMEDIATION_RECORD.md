# SPARK Phase 21R — Readiness Blocker Remediation Record

Starting SHA: `70837326364b71df033ce4356e918fd19db8c660` (`test(production): record phase 21 full validation`)

Implementation commit: `e3198b29c0a41127a81368d5235296d1f15dfcd1` (`fix(production): attach durable credits and close video bypass`)

Branch: `main` only. Live Supabase project referenced by the client: `jaqzjhabmtvqtvinoafq`.

Phase 21 outcome remains **FAIL**. This checkpoint does not certify production readiness and does not start Phase 22.

## What changed

Live generate now reaches the existing `GenerationExecutionEngine` with `CreditService.getInstance()`, `userId`, and `requireCredits`.

- `SparkContext.generateProductionAssets`, the auto-chain generate call, scene repair, and `AutonomousEngine` pass the user id when they have one.
- `productionService.generateAssetsForProduction` attaches `CreditService` even if a caller forgets it, and defaults `requireCredits` on.
- Unknown provider cost fails before submit. It is not reserved as zero and not treated as free.
- Insufficient credits still fail inside `CreditService.reserve` before `submitWithReliability`.

In-flight identity uses the existing idempotency store plus `production_events`, not a new job table.

- `createDurableIdempotencyStore` flushes the execution (id, task, production, attempt, provider, model, provider job id when known, reservation id, status) before provider submit.
- A second engine that hydrates the same journal does not call submit again.
- `UNKNOWN_SUBMISSION` checkpoints before reconciliation. `PENDING_UNKNOWN` stays held. Restart does not resubmit.
- `NOT_SUBMITTED` releases the reservation. No provider job id is claimed.

Paid video submit outside the engine:

- `requestProductionVideoClip(` remains only in `videoI2vAdapter.ts` (the engine transport) and its own definition.
- `AIProviderOrchestrator.execute` rejects `Video Generation` before fetch.
- `ProductionAssetService` no longer calls `videoGeneration` or `storyboardImages`. Missing canonical video/keyframe tasks fail before spend, or the existing planner supplies the task and `engine.executeTask` runs it.
- `fixProductionScene` regenerates the affected still and video only through the engine.
- Storyboard-sheet and thumbnail provider submits in AssetService were closed. Per-shot keyframes remain the canonical still path.

`conversation_sessions`:

- Live 404 was a missing table, not an empty RLS read. Repo migration `20260804180000_conversation_sessions.sql` created a UUID id and no RLS. The client uses text ids (`session-...`).
- New migration `supabase/migrations/20260926013000_conversation_sessions_secure.sql` creates/aligns a text id, enables RLS, and grants `authenticated` owner CRUD only. Anon is revoked.
- The repository no longer treats a remote error as an empty local success. Create/update/delete throw when Supabase is configured and the write fails.
- The migration was **not applied**. No service role or Supabase CLI session was available. Live PostgREST will still 404 until it is applied.

## What was not proven

No service role, no Spark provider keys, and no Spark Vercel project were available. Sandbox `XAI_API_KEY` was not used.

Not executed:

- Disposable Supabase test user, profile, brand, or credit grant
- Live `spark_reserve_credits` / settle / release against `jaqzjhabmtvqtvinoafq`
- Narrator, Hybrid, or Cinematic provider master
- Genuine-media QC or RepairPlanner chain
- Browser product flow at 1440 or 390
- Double-click and force-regenerate in the browser
- Deployed app, deployed FFmpeg, deployed audio master, LUFS
- Supabase security advisor after the new migration
- Cross-user media or financial checks beyond the existing unit suite

Provider spend: **$0.00**. Submissions: **0**. Credits reserved, consumed, released, refunded, and pending on the live ledger: **none**.

## Verification

- `npx tsc --noEmit`: 0 errors
- `node scripts/run-tests.mjs`: 1433 pass / 0 fail / 297 suites
- `npm run build`: pass (existing chunk-size warnings)
- New tests: `src/app/services/production/execution/durableExecution.phase21r.test.ts`
  - reserve → submit → settle
  - NOT_SUBMITTED → release
  - UNKNOWN_SUBMISSION → PENDING_UNKNOWN → second store does not resubmit
  - pre-submit checkpoint → second engine does not resubmit
  - unknown cost does not reserve or submit
  - source scan of `requestProductionVideoClip(`

FFmpeg unit tests remain in that suite and passed. That is local, not deployed.

## Remaining paid image paths

These were not the Phase 21 `requestProductionVideoClip` fallback, and they were not removed:

- `ensureAssetBibleAssets` still calls `ModelRouter.executeCategoryRequest("storyboardImages")` for prop sheets during production prep.
- Character, location, and onboarding studios still generate images through ModelRouter. They are not the live shot executor.
- Engine image/voice transport remains `createRuntimeAdapterPorts` (`submitImage` / `submitVoice`). That is inside the engine, after reservation when `requireCredits` is set.

## Blocker classification

| # | Blocker | Status |
| --- | --- | --- |
| 1 | Live generate does not reserve or settle Spark credits | PARTIAL |
| 2 | In-flight provider job identity dies with the process | PARTIAL |
| 3 | `requestProductionVideoClip` spend path beside the engine | PARTIAL |
| 4 | Real Narrator / Hybrid / Cinematic masters | OPEN |
| 5 | Genuine-media QC → repair | OPEN |
| 6 | Authenticated product browser flow | OPEN |
| 7 | Deployed Spark runtime | OPEN |
| 8 | `conversation_sessions` 404 | PARTIAL |

## Outcome

**FAIL**

Phase 22 was not started. SPARK is not production-ready.
