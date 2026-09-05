# Phase 1 — Video Runtime Boundary Hardening

## 1. Baseline

| Field | Value |
|-------|--------|
| Audited commit | `82b84603bb5d59c08cdefa7934408b6a8ba14728` |
| Branch (work) | `cursor/phase1-video-runtime-harden-c524` |
| Base | `main` @ audited commit |
| Date | 2026-09-05 |
| Package | `spark-media-os` (`"type": "module"`, npm) |
| Initial state | Clean working tree on `main`; live UI path uses `ProductionAssetService` → `requestProductionVideoClip` → `POST /api/runtime/video` |

Config notes inspected before edits:

- `tsconfig` includes `src` only (API routes are not part of `tsc --noEmit`)
- Vite builds the SPA; Vercel serves `api/**` as serverless functions
- Existing scripts: `typecheck`, `test` (`tsx --test …`), `build` (`vite build`)

## 2. Root Cause

The repository declares `"type": "module"`. Under Node ESM, bare relative imports such as `./_videoContract` do not resolve to `./_videoContract.js` / `.ts` without bundler rewriting.

`api/runtime/video.ts` imported `./_videoContract` without an extension. That is unsafe for any execution path that loads the handler via native ESM resolution (or any tool that does not rewrite local import specifiers). TypeScript’s NodeNext/bundler conventions expect the **runtime** specifier `./_videoContract.js` even when the source file is `.ts`.

Separately, Grok’s in-process poll loop waited up to **6 minutes** while `config.maxDuration` is **300** seconds. The function could be killed mid-poll by the platform before returning a structured timeout error.

## 3. Changes

| File | Why |
|------|-----|
| `api/runtime/video.ts` | ESM-safe `./_videoContract.js` import; Grok poll capped at 4 minutes under `maxDuration` |
| `api/runtime/videoContract.test.ts` | Import contract via `./_videoContract.js` (same ESM rule) |
| `src/app/services/production/productionVideoRequest.ts` | Fail loud on `success === false` and missing `videoUrl` even when HTTP status is 200 |
| `api/runtime/videoRuntimeBoundary.test.ts` | Regression coverage for ESM import, frames contract, fail-loud client behavior, poll budget |
| `package.json` | Include new boundary test in `npm test` |
| `docs/PHASE_1_VIDEO_RUNTIME_HARDENING.md` | This report |

No UI, ModelRouter, Production OS DAG, QC, or provider-adapter redesign.

## 4. Runtime Path (verified from source)

```
ProductionAssetService
  → requestProductionVideoClip (productionVideoRequest.ts)
  → POST /api/runtime/video
  → resolveClipFrames + VideoClipRequest (_videoContract)
  → provider branch already in video.ts (grok / kling / seedance / mux)
  → build*Body + generate* + poll
  → video URL (+ optional lastFrameDataUrl)
  → caller persists assets / continues production → Review
```

Provider selection for live stills→motion remains centralized in ModelRouter / capability routing / `videoI2vAdapter` before the HTTP call. The API route continues to dispatch on the `provider` field it already received; Phase 1 did not add a second router.

`videoFrameExtractor` / last-frame continuity for Shot B is unchanged; Phase 1 only ensures start/end frame fields still normalize through `resolveClipFrames` and provider body builders.

## 5. Tests

| Validation | Command | Result |
|------------|---------|--------|
| Typecheck | `npm run typecheck` | PASS |
| Tests | `npm test` | PASS (209 pass / 0 fail) |
| Build | `npm run build` | PASS |
| Runtime-specific | `videoRuntimeBoundary.test.ts` (via `npm test`) | PASS |

## 6. Deployment Assessment

With the `.js` import specifier, the video runtime local contract module is aligned with Node ESM resolution expectations used by this repo’s `"type": "module"` package and typical Vercel Node function packaging.

**No production Vercel deployment was performed in this phase.** Load-safety is assessed from module configuration + source + tests, not from a live deploy.

## 7. Remaining Risks (observations only — not Phase 1 work)

- **Seedance / Kling poll timeouts** (`SEEDANCE_POLL_TIMEOUT_MS` 20m, `KLING_POLL_TIMEOUT_MS` 15m) still exceed `maxDuration: 300`. Long provider jobs can still hit the serverless wall; durable async job/resume belongs in later phases.
- **Real provider credentials** and live provider latency are environment-dependent; unit tests mock HTTP.
- **Mux / FFmpeg** serverless availability remains a known limitation; client fallback must stay explicitly marked (`success: false` / `fallbackToClient`), never as a genuine generate success.
- **Dual production spines** (live UI path vs Production OS DAG) are intentionally untouched.
- Persistence / Review / mastering / QC / YouTube / performance learning wiring are out of Phase 1 scope.

## 8. Phase 2 Readiness

**Ready to begin Phase 2 planning:** Single Production Generate Spine — *after* this hardening lands on the integration branch / `main`.

Phase 1 does **not** merge spines. Phase 2 should assume:

- Live video HTTP boundary loads its contract module correctly
- Client I2V requests refuse silent fake success
- Grok in-process polling is bounded under serverless `maxDuration`

Do not start Phase 2 implementation from this document alone; follow the published sequence after merge review.
