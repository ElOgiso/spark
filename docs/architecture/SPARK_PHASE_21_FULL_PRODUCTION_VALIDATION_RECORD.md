# SPARK Phase 21 — Full Production Validation Record

Starting SHA: `9daf9eaf0a028003b209672823e29e0b15de822a`
Previous: `3d293464bbc10d3b69a61fb3b57e3e2e4306b849`
Branch: `main`
Outcome: **FAIL**
Phase 22: not started. SPARK is not production-ready.

## Environment

| Surface | What ran |
| --- | --- |
| Local | `/tmp/spark` on Linux. Node test runner, `tsc`, Vite build, Vite dev `http://127.0.0.1:3000`, Playwright Chromium 153. |
| Preview / deployed | Not validated. The connected Vercel team `fairestmans-projects` has one project, `elogiso-art`. It is not this Spark app. No Spark deployment URL was available. |
| Supabase | Live project `jaqzjhabmtvqtvinoafq` answered `GET /auth/v1/health` 200 (GoTrue). No service-role key was present. No rows were written. No user balances, brands, or productions were changed. |
| Test identity | None. No disposable authenticated user could be created. Local browser used no account. |
| Provider keys | Not present for Spark server providers (no `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, Higgsfield, Kling, or Ark key in this environment). The sandbox `XAI_API_KEY` belongs to the agent runtime, not the Spark project, and was not used. |

Provider spend: **$0.00**. Spark credits reserved, consumed, released, refunded, and `PENDING_UNKNOWN`: **none**. No paid submission was attempted.

## Baseline after FFmpeg restore

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS, 0 errors |
| `node scripts/run-tests.mjs` | PASS, 1427/1427, 296 suites |
| `npm run build` | PASS, Vite production build |

The previous 2 failures in `api/runtime/audioMaster.test.ts` are resolved in this environment.

## 21.1 FFmpeg

Classification: **package install gap, not a mastering-logic failure.**

`ffmpeg-static@5.3.0` is the canonical binary for `api/runtime/_audioMaster.ts`. The npm package exports a path, but the binary is downloaded by `install.js` and is not inside the tarball. This checkout had the package and no binary (`exists: false`), so `spawnSync` returned `ENOENT`. `@ffprobe-installer/linux-x64/ffprobe` was present but not executable (`EACCES`).

Fix, without rewriting the audio pipeline:

- `scripts/ensure-media-runtime.mjs` runs the official `ffmpeg-static` installer when the binary is missing and sets the execute bit on ffmpeg and ffprobe.
- `package.json` `postinstall` calls that script.

Local render evidence (narration placed on a 2s lavfi master, no provider spend):

| Field | Value |
| --- | --- |
| Binary | `node_modules/ffmpeg-static/ffmpeg` |
| Version | ffmpeg 7.0.2-static |
| Exit | 0 |
| Output | 21945 bytes |
| Container | `mov,mp4,m4a,3gp,3g2,mj2` |
| Duration | 2.0s |
| Audio | present |

`audioMaster.test.ts`: 4/4 pass, including narration placement (old baked audio removed, narration at the planned offset, visual stream hash unchanged) and looped music ducked under the speech window.

Measured LUFS on a production master: **NOT TESTED**. The runtime measures `loudnorm` only when `plan.audioMastering` is set. The local proof render did not request a loudness target, so no integrated LUFS or true peak is claimed. Hosted Vercel inclusion of `ffmpeg-static/ffmpeg` was not re-proven on a deployment.

Video concat in `api/runtime/video.ts` still looks up `ffmpeg` on `PATH`. That is a separate mechanism from audio mastering. It was not the failing test.

## Live spine (code, this SHA)

`generateProductionAssets` → `productionService.generateAssetsForProduction` → `runProductionLifecycle` → `createLiveAssetExecuteAdapter` → `executeProductionViaAssetBridge` → `ProductionAssetService.generateAssets`.

That function builds `GenerationExecutionEngine` only when a spec and tasks exist. The UI caller does **not** pass `creditService` or a durable idempotency store. The engine therefore uses `createMemoryIdempotencyStore()`.

Video inside `generateAssets`:

- If a matching video `GenerationTask` exists, `engine.executeTask` runs. That path calls `ProviderPayloadCompiler.compile` and would reserve credits only when `creditService` and `userId` are set. They are not set on the live call.
- Otherwise it calls `requestProductionVideoClip`, which POSTs `/api/runtime/video` with no credit reservation and no compiler.

So the canonical classes exist, and unit tests exercise them, but the live UI path does not prove estimate → reserve → submit → settle.

## Economics

No live reservation was opened.

Engine behavior from existing tests (not a new pipeline): `CreditService` + in-memory/supabase repository tests and `productionObservability.test.ts` still assert `UNKNOWN_SUBMISSION` keeps `PENDING_UNKNOWN` and does not invent a zero cost. Those tests passed inside the 1427. They are not a substitute for a paid production.

Live UI: a known attached estimate can disable Review generate (Phase 20). The click itself still does not reserve.

## Failure recovery

| Case | Result |
| --- | --- |
| NOT_SUBMITTED | NOT TESTED on a live production. Engine unit coverage exists and passed with the suite. Live `requestProductionVideoClip` has no reservation to release. |
| UNKNOWN_SUBMISSION | Engine/observability tests PASS. Live UI blocks unsafe retry when submission evidence is already on the production (Phase 20). A controlled live adapter run through `GenerationExecutionEngine` + `CreditService` + UI together was not executed here. |
| Reconciliation both branches | NOT TESTED against a provider status API. |
| Provider failure after submit | NOT TESTED. |
| QC failure → RepairPlanner → replacement asset → second QC | NOT TESTED on genuine media. |
| Cancellation | NOT TESTED against a live provider. Abort exists in the engine and in Higgsfield adapter tests (mocked). |
| Double generate | Code defect fixed on the user entry point: a second `generateProductionAssets(id, false)` while a controller exists now returns instead of aborting and starting another run. Explicit `forceRegenerate` still aborts the in-flight controller. Not exercised in a browser because login was blocked. |
| Force regenerate | NOT TESTED live. |
| Failure budget | NOT TESTED live. |
| Reload / resume | **FAIL / BLOCKER.** Default execution identity is an in-memory idempotency map. A new process does not see the provider job id, reservation, or in-flight execution. Completed media can still be on the production row if it was persisted, but in-flight recovery is not durable. |
| In-flight process kill | Same blocker. Not hidden. |

## Browser

Playwright Chromium, local Vite only.

1. With the public Supabase URL configured: cold load plays `SplashReel` (full-bleed portrait frames, YouTube/Instagram/Pinterest marks). Unauthenticated routing log: `routing: AUTH`. Product nav was not in the DOM during the splash.
2. `sessionStorage.spark_splash_played = true` skips the reel. Both 1440×900 and 390×844 render the auth shell: “Create Your Account”, email, password, “Begin Brand Genesis”, “Sign In”. No console `pageerror`. One console resource error: `conversation_sessions` REST 404 against `jaqzjhabmtvqtvinoafq`.
3. Product flow SPARK → VIRAL SPARKS → Create → Generate → Review → Approve was **NOT TESTED**. The client treats Supabase as configured via `DEFAULT_SUPABASE_URL` in `supabaseClient.ts`, so demo sign-in is disabled, and no test password exists.
4. Deployed browser: **NOT TESTED**.

Screenshots were captured locally and were not committed. The splash frames are full-bleed portraits; the useful result is the auth shell text above.

## Supabase read-only probe

Using the publishable key already committed in `.env.example`. No writes.

| Request | Status |
| --- | --- |
| `/auth/v1/health` | 200 |
| `profiles?select=id&limit=1` | 200, body `[]` (no rows returned; not proof of a cross-user read) |
| `production_events?select=id&limit=1` | 401 |
| `credit_reservations?select=id&limit=1` | 401 |

Cross-user media denial and financial RPC ACLs were not re-executed as authenticated User A / User B. Phase 18 tests in the suite still pass. No RLS policy was loosened. No Phase 21 migration.

`conversation_sessions` 404 from the running app is a live schema/API mismatch. Not patched in this phase.

## Modes

| Run | Result |
| --- | --- |
| Narrator real | NOT TESTED. No provider key, no test user, no production id. |
| Hybrid real | NOT TESTED. |
| Cinematic real | NOT TESTED. |
| Higgsfield live adapter | NOT TESTED. Not forced. Mocked Higgsfield tests in the suite passed. Phase 11 coverage remains unverified on a real request. |

## Audio / mixed media / factual

| Item | Result |
| --- | --- |
| Audio mastering binary | PASS locally. See 21.1. |
| Narration + ducked music on a synthetic master | PASS (`audioMaster.test.ts`). |
| Measured loudness | NOT TESTED. |
| Paid mixed-media master | NOT TESTED. |
| Long timeline from supplied assets | NOT TESTED in this pass. Existing Phase 14 unit tests passed inside the suite. |
| Factual chart/map/text on a final timeline | NOT TESTED as a rendered export. |

## Review / publish / analytics / learning

NOT TESTED on a completed production. Publish was not sent to any social account. Analytics were not fabricated. Learning gates were not fed a fake audience score.

## Observability / secrets

No new production trace was written. Existing secret-sanitization tests passed in the suite. No API key was logged by this validation.

## Validation matrix

| Case | Result |
| --- | --- |
| Narrator real run | NOT TESTED |
| Hybrid real run | NOT TESTED |
| Cinematic real run | NOT TESTED |
| QC pass on genuine media | NOT TESTED |
| QC failure | NOT TESTED |
| Repair | NOT TESTED |
| NOT_SUBMITTED live | NOT TESTED |
| UNKNOWN_SUBMISSION live engine+credits+UI | NOT TESTED |
| UNKNOWN_SUBMISSION unit/observability | PASS |
| Reconciliation success | NOT TESTED |
| Reconciliation failure | NOT TESTED |
| Reload / resume | FAIL |
| In-flight durability | FAIL |
| Cancellation live | NOT TESTED |
| Double generate | PARTIAL (code now ignores a non-force duplicate; not browser-proven) |
| Force regenerate | NOT TESTED |
| Insufficient credits UI | PARTIAL (Phase 20 helper and review disable exist; not browser-proven) |
| Audio mastering | PASS |
| Mixed media export | NOT TESTED |
| Review approve | NOT TESTED |
| Needs edit | NOT TESTED |
| Publish blocked | NOT TESTED |
| Production trace of a real run | NOT TESTED |
| Security regression live authenticated | NOT TESTED |
| Anon financial tables | PASS (401) |
| Mobile UI | PARTIAL (auth shell at 390; product shell not reached) |
| Desktop UI | PARTIAL (auth shell at 1440; product shell not reached) |
| Typecheck / unit suite / build | PASS |

## Defects fixed in this phase

- Missing `ffmpeg-static` binary and non-executable ffprobe.
- `generateProductionAssets` aborted an in-flight run and started another when Generate was invoked again without force. A non-force duplicate now returns.
- Initial progress no longer invents `percent: 1` or prints the internal mode key in uppercase. It uses the Narrator / Hybrid / Cinematic label and leaves percent unset.

## Blockers

1. Live generate does not reserve or settle Spark credits.
2. In-flight provider job identity does not survive process or browser termination (memory idempotency).
3. `requestProductionVideoClip` remains a spend path beside the engine when a video task is missing.
4. No real Narrator, Hybrid, or Cinematic master was produced.
5. No genuine-media QC or repair chain was observed.
6. Browser could not enter the product because there is no Phase 21 test user, and the hardcoded Supabase URL disables demo auth.
7. Deployed runtime, including Vercel FFmpeg and serverless audio master, was not checked.
8. `conversation_sessions` returns 404 from the live project.

## Phase outcome

**FAIL**

NEXT is not Phase 22. Readiness stays blocked until a controlled test identity can run one short production through estimate, reservation, one provider submit, asset, QC, master, review, and a restart that does not double-spend.
