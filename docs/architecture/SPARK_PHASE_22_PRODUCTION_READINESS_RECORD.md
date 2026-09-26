# SPARK Phase 22 — Production Readiness Record

Starting SHA: `31c96fea9226af2fd98cb22e31fb642bb399c137` (`docs(production): record phase 21R implementation commit`)

Phase 21R implementation (already on that baseline): `e3198b29c0a41127a81368d5235296d1f15dfcd1`

Readiness commit: `PENDING_READINESS_SHA`

Ending SHA: `PENDING_ENDING_SHA`

Branch: `main` only. Live Supabase project: `jaqzjhabmtvqtvinoafq`.

This checkpoint does **not** live-certify providers, does **not** create a Spark deployment, and does **not** start Phase 23.

Final status: **RELEASE CANDIDATE READY — LIVE ACCEPTANCE DEFERRED**

Release Candidate Gate: **PASS**
Live Launch Gate: **DEFERRED**

Provider spend this phase: **$0.00**. No paid provider was called. Mock Higgsfield tests print `[I2V BILLABLE]` from fixtures. That is not a charge.

## What this phase changed

- Asset-bible sheets are Option B. `ensureAssetBibleAssets` will not call `ModelRouter` unless the caller passes `studioBilling` (`CreditService` + `userId`). Unknown price and a missing quote fail before submit. A thrown submit releases the reservation.
- `ProductionAssetService` no longer imports or calls `ensureAssetBibleAssets`. Production generate cannot spend on bible sheets.
- `phase22ReleaseCandidate.test.ts` locks the refusal, duplicate-vs-force execute, the conversation migration text, and the generate-path closures.
- Configuration, migration manifest, runbooks, release status, and the current-authority banner in `PRODUCTION_OS_ARCHITECTURE.md` were written. Historical phase notes were not rewritten as if they were current.
- `conversation_sessions` was **not** applied live. No Vercel project was created.

## Authority map

SPARK owns meaning. Providers own execution. One production spine:

| Domain | Authority |
| --- | --- |
| Semantic meaning | `ProductionSpec` / `ShotSpec` / `ReferenceGraph` / `StyleBible` |
| Craft | Craft Engine / `CraftOperation` |
| Capability truth | Capability Registry |
| Routing | Canonical production capability router |
| Economics | `CostEngine` |
| Credits | `CreditService` |
| Compilation | `ProviderPayloadCompiler` |
| Execution | `GenerationExecutionEngine` |
| Provider transport | Provider adapters (`videoI2vAdapter` is the video transport; `runtimePorts.submitImage` is the image transport after the engine reserves) |
| QC | Canonical QC stack |
| Repair | `RepairPlanner` |
| Observability | `production_events` / `ProductionObserver` |
| Learning | Existing CreativeLearning pipeline, sample-size gates |
| Admin economics | Phase 19 projection over the same credit and event authorities |
| Kill switch | `ProductionGenerationGuard.assertEnabled` |

No second router, ledger, QC stack, generate engine, publisher, or pipeline was added.

## Asset-bible decision — Option B

Asset-bible generation is **not** a production DAG shot.

It is a reusable studio-sheet operation. Paid submit is allowed only with an explicit user-authorized billing context:

- Caller must pass `studioBilling`.
- Quote uses `CostEngine` (`openai` / `dall-e-3`, $0.04 per image, unless a non-`auto` preferred provider is passed).
- Unknown price refuses. It is not reserved as zero and not labeled free.
- Reserve key: `bible_${productionId}_${tag}`.
- Success settles the estimate. A throw releases, then rethrows.
- Durable Spark storage upload stays after the priced submit.

`generateAssets` does not call this function. A production run does not silently mint bible sheets.

## Paid-path inventory

Classification: A canonical production, B non-production creative tool, C onboarding / asset studio, D test, E legacy/invalid.

| Caller | Class | Notes |
| --- | --- | --- |
| `GenerationExecutionEngine` → adapter → `requestProductionVideoClip` in `videoI2vAdapter.ts` | A | Only non-test production caller of that function besides its definition. Credits reserved by the engine first. |
| `runtimePorts.submitImage` → `storyboardImages` | A | Engine image transport. Not a second spender. |
| `ensureAssetBibleAssets` `submitPricedStudioSheet` | B, studio boundary | Option B. Refuses without `studioBilling`. Not on the generate spine. |
| `CharacterStudioModal`, `SupportCharacterModal`, `LocationPlateStudioModal` | C | Explicit user action. Still unmetered by `CreditService`. Not rebuilt. P1. |
| `BrandGenesisFlow`, `OnboardingWizard`, `MobileConversationalFlow` | C | Onboarding image calls. Unmetered. P1. |
| `SparkContext` character image around the studio path | C | Explicit studio action, not `generateAssets`. Unmetered. P1. |
| `geminiService`, `sessionTitleService`, `productionIntentInterpreter`, `viralSparkGate`, `compileNarrativeScript`, `topicIntelligence`, `scriptQualityGates`, video understanding | Planning / research | Not production visual spend. Not gated this phase. |
| Tests (`failClosedVideoSubmit`, `productionExecution.p4`, `videoReferenceWiring`, `sparkBytesPersist`, guard respect) | D | Fixtures. |
| `ProductionAssetService` video / storyboard / `requestProductionVideoClip` | Closed | Those strings are absent. Phase 22 test asserts it. |
| `AIProviderOrchestrator` video generation | Closed in 21R | Throws before fetch. |

## Economics

Production execution still uses `CostEngine` then `CreditService` (`requireCredits` on the live generate path from Phase 21R). Ledger types remain `RESERVATION`, `RELEASE`, `CONSUMPTION`, `REFUND`, `PENDING_UNKNOWN`. 100 credits = $1, ceil, minimum 1.

Unknown cost does not reserve as zero.

Studio sheets use the same `CreditService` when billing is passed. They do not invent a second ledger.

Simulated coverage already in the suite, re-run this phase (not a new ledger):

- Durable economics matrix (reserve / settle / release / overage rejection / unknown hold) in `durableEconomics` tests.
- Phase 22 duplicate execute: one shared store, balance 200, `requireCredits`, one submit; `forceNewExecution` is a second submit and a different execution id.
- Asset-bible tests pass `studioBilling` on spend paths. The GPU-failure case still surfaces the provider error after reserve-and-release. The no-billing case records the refusal and leaves `ModelRouter` at 0 calls.

## Durable execution

Unchanged mechanism from Phase 21R, re-affirmed rather than replaced:

- `createDurableIdempotencyStore` checkpoints `execution_checkpoint` before `submitWithReliability`.
- Same task + attempt hydrates and does not submit twice.
- `UNKNOWN_SUBMISSION` stays unresolved and holds `PENDING_UNKNOWN`. Restart does not retry.
- `CONFIRMED_NOT_SUBMITTED` releases.
- Reconciliation tests in the existing suite resolve simulated completed and confirmed-failed outcomes.
- `forceNewExecution` skips succeeded reuse. It does not skip in-flight reconciliation.

Phase 22 added the duplicate-versus-force proof in `phase22ReleaseCandidate.test.ts`. It did not duplicate the whole 21R matrix.

## Compiler, QC, repair, cancellation

- Compiler: `GenerationExecutionEngine.executeTask` still compiles with `ProviderPayloadCompiler` before the adapter. Locally verified. Not re-proven against a live provider.
- QC / repair: existing tests still require a repair to change the semantic request and recompile. Genuine media QC was not run. That is deferred live acceptance, not a new engine.
- Cancellation: `SparkContext` ignores a second Generate while a controller exists unless force regenerate aborts. Unknown submitted work is not marked cancelled by that guard.
- Failed master stays a master retry. Completed shots are not re-reserved by the runbook.

## Media

Local FFmpeg mastering tests remain inside the full suite, including Phase 15 narration placement and music ducking. `scripts/ensure-media-runtime.mjs` is still `postinstall`. Deployed FFmpeg and measured LUFS were not executed. **DEFERRED.**

Mixed-media compiler tests (ordering, missing media fail-closed, cancellation resource release) passed in the same suite. Factual visual tests passed. No new media product was added.

## Security

Static and suite evidence, not a new security project:

- Phase 18 tests T–Z remain green: no client `credit_balance` update, no client ledger insert, service role not in frontend, secret sanitization, financial RPC anon revoke.
- `VITE_YOUTUBE_API_KEY` is a restricted public research key if set. It is not a service role. Documented in `SPARK_RUNTIME_CONFIGURATION.md`.
- Provider secrets and `SUPABASE_SERVICE_ROLE_KEY` are server-only. This record contains no secret values.
- Conversation migration: text id, RLS `(select auth.uid()) = user_id`, `REVOKE ALL ON public.conversation_sessions FROM anon, public`. Repository throws `conversation_sessions ${action} failed` instead of treating a remote failure as local success.
- Older `SECURITY DEFINER` migrations `20260825120000` and `20260921120000` may omit `search_path`. Later `20260923100000` and `20260924145147` `CREATE OR REPLACE` with `search_path` are the authoritative definitions. Applied history was not rewritten.
- Storage: runbook forbids making the bucket public to bypass a 403. Phase 18 owner-scoped media policies were not weakened.
- Authorization does not add a new `user_metadata` or email check.

## Database

Anon REST probe on 2026-09-26, publishable key only:

| Table | HTTP | Meaning |
| --- | --- | --- |
| `conversation_sessions` | 404 `PGRST205` | Table not in schema cache |
| `production_events` | 401 `42501` | Exists, anon denied |
| `credit_reservations` | 401 `42501` | Exists, anon denied |

Full filename list: `docs/architecture/SPARK_MIGRATION_MANIFEST.md`.

`20260926013000_conversation_sessions_secure.sql`: repo **READY**, live **NOT APPLIED**, **REQUIRED BEFORE LIVE LAUNCH**. This phase did not apply it.

`credit_reservations` and `production_events` are applied at table level. Do not describe them as awaiting a first apply. Do not re-apply the economics migration blindly.

## Configuration and operations

- `docs/architecture/SPARK_RUNTIME_CONFIGURATION.md` — client-safe, server, OAuth, optional provider keys, FFmpeg postinstall. No values.
- `docs/operations/SPARK_RUNBOOKS.md` — provider outage, unknown submission, credit dispute, failed master, Supabase outage, storage failure, publish failure, disable generation, rollback.
- Emergency spend stop is the existing generation guard. In-flight unknown jobs stay held. Chat and planning are not the kill switch.
- Rollback is redeploy the previous Vercel deployment plus a forward-fix migration. No `git reset --hard`, no force-push, no database wipe. Do not attach SPARK to `elogiso-art`.

## UI

No redesign. Locked nav stays SPARK, MY SPARK, VIRAL SPARKS, REVIEW, CALENDAR, ANALYTICS, MORE.

Phase 20 surfaces remain the user states (loading through failed, including unknown submission blocking retry). Analytics still uses measured `platformAnalytics`. Missing analytics is not fabricated as zero in that path. This phase did not add demo metrics.

Support identifiers for operators: `productionId`, `taskId`, `executionId`, `reservationId`, `providerJobId`, `assetId`. They stay in events and admin, not a new user-facing ID wall.

## Deployment

No Spark Vercel project exists on team `fairestmans-projects` (only `elogiso-art` was previously observed). This phase did not create or change a deployment.

Deployment certification: **DEFERRED**.

Build warnings that did not fail the build: duplicate `case` clauses in `MoreSubPages.tsx` for `/more/credit-control`, `/more/generation-controls`, and `/more/production-settings` (later clauses are dead), large chunk warning, and dynamic-import chunk notes. Not treated as a release-candidate failure. Dead switch cases are P2, not a second router.

## Verification

Commands, this completion pass, cwd `/tmp/spark`:

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `node scripts/run-tests.mjs` | `# tests 1437` `# suites 297` `# pass 1437` `# fail 0` `# skipped 0` exit 0 |
| `npm run build` | `vite build` exit 0, built in 9.56s |

`node scripts/run-tests.mjs` sets `VITE_USE_SUPABASE=false`. FFmpeg mastering tests are inside the 1437 and stayed green.

## Release checklist

| Item | Status |
| --- | --- |
| Architecture — one spine | PASS |
| Tests | PASS |
| Build | PASS |
| Security boundaries | PASS |
| Economics local | PASS |
| Execution durability local | PASS |
| QC simulation | PASS |
| Genuine-media QC | DEFERRED |
| Media / local FFmpeg | PASS |
| Deployed FFmpeg / LUFS | DEFERRED |
| Database migrations present | PASS |
| `conversation_sessions` live apply | DEFERRED — required before launch |
| Deployment | DEFERRED |
| Provider configuration live | DEFERRED |
| Observability tables | PASS (events live, anon denied) |
| Admin economics | PASS (no second finance system) |
| Runbooks | PASS |
| Live provider acceptance | DEFERRED |

## Readiness matrix

| Area | Status |
| --- | --- |
| Architecture | READY |
| Economics | READY LOCALLY |
| Execution | READY LOCALLY |
| Security | READY |
| Data | READY WITH DEFERRED LIVE APPLY (`conversation_sessions`) |
| UI | READY |
| Operations | READY |
| Deployment | DEFERRED |
| Provider certification | DEFERRED |

## Deferred live acceptance (do not run until credits exist)

Stop on the first unexplained failure. Cap each visual at one 5–10 second clip. Prefer the lowest-cost eligible model. Do not widen into a suite of variations.

1. Configure server provider keys. Do not put them in `VITE_` variables.
2. Apply `20260926013000_conversation_sessions_secure.sql`. Confirm the table is no longer `PGRST205`. Confirm anon is still denied.
3. Create a disposable validation user. Read the starting credit balance.
4. Narrator, one 5–10 second generation. Inspect reservation, settlement, `production_events`, and the master URL.
5. Hybrid, one 5–10 second generation. Same inspection.
6. Cinematic, one minimal generation. Same inspection.
7. One controlled QC failure and one repair that changes the semantic request, then recompile. Not a replay of the same request.
8. Deployed Spark runtime (not `elogiso-art`): FFmpeg present, one master, loudness measured rather than assumed.
9. Publish gate only after a real master exists. Do not invent a calendar slot.
10. Confirm spend matches the ledger. Unknown cost must not appear as $0.

## Debt

**Not code debt:** missing provider credits. That is deferred live acceptance.

**P0 launch blocker (not a Phase 22 software failure):**

- Apply the conversation_sessions migration before any launch that syncs sessions.
- Provider keys, disposable user, and the acceptance script above.
- A real Spark deployment. Do not reuse `elogiso-art`.
- Deployed FFmpeg and one genuine QC/repair.

**P1 after launch, or before if a studio spend incident matters:**

- Character, location, support-character, brand-genesis, and onboarding image calls still spend through `ModelRouter` without `CreditService`. They are explicit user actions. They were classified, not rebuilt.
- Higgsfield is not live-certified.
- Uploaded-reference understanding is not the live VIRAL SPARKS source.

**P2:**

- Duplicate `case` clauses in `MoreSubPages.tsx` (build warning only).
- Phase 14 long browser export not accepted.
- Lifecycle still reports heuristic estimates until a live actual is attached. Settlement rules themselves are not heuristic.

**P3:**

- Chunk-size warning on the main bundle.

## Gates

Release Candidate Gate: **PASS**

Live Launch Gate: **DEFERRED**

Outcome: **RELEASE CANDIDATE READY — LIVE ACCEPTANCE DEFERRED**

Phase 23 was not started. There is no automatic next feature phase. The next action, only when provider credits exist, is live provider certification using the ordered list above.
