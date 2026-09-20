# SPARK Implementation Contract

Phase 0 architecture contract for `ElOgiso/spark` (`main` @ `d3d960d56ba577f5f7d5eef49d7906a7b9d99d59`).

This document is derived from the live repository, Notion SPARK constitution, and existing `docs/` audits. It does **not** implement later phases.

**Status of this phase:** Phase 0 documentation only. Phase 1 (Architecture Consolidation) is next and is **not** started here.

---

## 11.1 Product principles

SPARK is an AI Media Operating System. Users operate **Brands**, not prompts.

Engineering must preserve:

- Hide complexity. Provider/model language stays off the primary UX.
- Mobile is native, not a scaled desktop.
- AI systems are infrastructure, not destinations.
- Analytics explain **why**, not only what.
- Quality and beauty matter.
- SPARK should feel like an intelligent media company.

Locked navigation (do not redesign in architecture work):

`SPARK` · `MY SPARK` · `VIRAL SPARKS` · `REVIEW` · `CALENDAR` · `ANALYTICS` · `MORE`

Locked identity objects: Character, Brand, Niche, Audio, Accounts, Production Modes, Memory, Intelligence.

Production modes: Narrator · Hybrid · Cinematic (user-chosen, not auto-switched).

Automation modes: Manual Review Required · Approval Required · Autonomous.

SPARK is **not**: a prompt → generate → download app, a provider marketplace, a generic SaaS dashboard, ELOGISO.Art, Make.com, or a LinkedIn tool.

---

## 11.2 Engineering principle

**SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.**

SPARK decides story, scene, shot, references, creative intent, quality, capabilities, constraints, cost policy, failure policy, and QC pass/fail.

Providers decide API calls, provider parameters, job handling, and media execution details.

Provider implementation must not become SPARK's conceptual architecture.

---

## 11.3 Canonical production spine

### SPEC EXPECTATION

```
ProductionSpec → SceneSpec → ShotSpec → GenerationTask → Execution → ProductionAsset → QC → Editorial
```

### CURRENT IMPLEMENTATION (verified)

**Canonical / newer layer (exists, heavily tested, not the only live path):**

| Concept | Path |
|---|---|
| ProductionSpec | `src/app/services/production/specification/productionSpec.ts` |
| SceneSpec | `.../specification/sceneSpec.ts` |
| ShotSpec | `.../specification/shotSpec.ts` |
| GenerationTask | `.../specification/generationTask.ts` |
| AssetSpec | `.../specification/assetSpec.ts` |
| RoutingSpec | `.../specification/routingSpec.ts` |
| ContinuitySpec | `.../specification/continuitySpec.ts` |
| QualitySpec | `.../specification/qualitySpec.ts` |
| Adapters (legacy → spec) | `.../specification/adapters.ts` |
| DAG | `src/app/services/production/dag/` |
| QC / hardening | `src/app/services/production/hardening/` + `productionQc.*.test.ts` |
| Editorial | `src/app/services/production/editorial/` |
| OS compilers (meaning) | `src/app/services/production/os/` |
| Capability | `src/app/services/production/capability/` |

**Legacy / live path (still authoritative for user-triggered generate):**

```
UI (SparkContext / Review / Generate)
  → ProductionService (`src/app/services/productionService.ts`)
  → ProductionBriefService
  → ProductionGenerationGuard / gates
  → ProductionAssetService (`src/app/services/production/productionAssetService.ts`)
  → ModelRouter (`src/app/services/runtime/modelRouter.ts`)
  → providers (`src/app/services/runtime/providers/`, `api/runtime/`)
  → ProductionAsset persistence
  → Review
```

Compatibility names (do not blindly rename):

| Canonical | Live / compatibility |
|---|---|
| ProductionSpec | `Production` + `ProductionBrief` |
| SceneSpec | `ProductionScene` / brief.storyboard |
| ShotSpec | often collapsed into scene/clip today on the live path |
| GenerationTask | provider job / `/api/runtime/video` request |
| ProductionAsset | `production_assets` + in-memory generatedAssets |

**Authority today (Phase 0 inventory — consolidation is Phase 1):**

| Responsibility | Current authority |
|---|---|
| User generate / persist / Review media | Live path: SparkContext → ProductionAssetService |
| Semantic planning types / DAG / QC tests | Canonical specification + production OS modules |
| Model selection | Single `ModelRouter` class in `src/app/services/runtime/modelRouter.ts` |
| Creative prompt text | OS compilers under `production/os/` and `compileLive*Prompt.ts` (AssetService should execute, not invent meaning) |
| Credits | `profiles.credit_balance` + `public.credit_ledger` |
| Provider HTTP | `api/runtime/` + runtime providers |

SPEC EXPECTATION vs CURRENT: both spines exist. Live generate still goes through ProductionAssetService. Specification types exist and are tested, but the two paths are not fully consolidated.

---

## 11.4 Future target architecture

Architectural **target** (not Phase 0 work):

```
USER
 → SPARK DIRECTOR / ASTRA
 → PRODUCTION INTENT
 → SCRIPT ENGINE
 → VISUAL DIRECTOR
 → SCENE / SHOT
 → CRAFT ENGINE
 → CAPABILITY ENGINE
 → MODEL ROUTER
 → PROVIDER ADAPTER
 → GENERATION
 → VISUAL QC
 → TIMELINE
 → AUDIO
 → MASTER QC
 → MP4
 → PUBLISHING
```

Do not implement this stack in Phase 0.

Note: later commits on `main` already added pieces of script/topic/distribution OS modules (`compileNarrativeScript.ts`, `topicIntelligence.ts`, `compileShortsSelectionPlan.ts`). Those are extensions of the OS compiler pattern, not a second product. Phase 1 must attach them to one spine rather than grow a third path.

---

## 11.5 Existing systems that must be extended (not duplicated)

Verified on `main`:

- ProductionSpec / SceneSpec / ShotSpec / GenerationTask — `src/app/services/production/specification/`
- ProductionAsset + ProductionAssetService — `productionAssetService.ts`
- Cinematography — `src/app/services/production/cinematography/`
- Shot / visual preproduction — `preproduction/`, `productionCinematic.p5.test.ts`
- Capability routing — `src/app/services/production/capability/` + `runtime/providerCapabilities.ts`
- Model routing — `src/app/services/runtime/modelRouter.ts` (**only this class** in live `src/`)
- Continuity — `src/app/services/production/continuity/` + `liveContinuityBridge.ts`
- References — `lockedProductionReferences.ts`, `production/assets/`
- QC / repair / hardening — `hardening/`, `characterSheetGate.ts`, `viralSparkGate`, QC tests
- Editorial — `src/app/services/production/editorial/`
- Generation lifecycle — `generation/`, `execution/productionExecutionBridge.ts`
- Credit ledger — `supabase/migrations/20260909140000_admin_and_auth_sync.sql`, `adminRepository.ts`
- Provider adapters — `src/app/services/runtime/providers/`, `api/runtime/`
- OS meaning compilers — `src/app/services/production/os/`

**Do not treat `src - Copy/` as a second architecture.** It is a duplicate tree in the repo. Live authority is `src/`.

---

## 11.6 Known future consolidation areas

Documented for later phases. Not implemented here:

- Duplicate routing authorities (capability registry vs ModelRouter vs settings preferences)
- Overlapping production paths (spec/DAG vs ProductionAssetService live generate)
- Cost-aware routing
- Provider-neutral CraftOperation
- ReferenceGraph / StyleBible as named systems (reference + look-bible pieces already exist — extend them)
- Provider payload compiler
- Credit reservation / settlement (ledger exists; reservation state machine does not)
- Provider submission idempotency
- Expanded adapter contract
- QC → repair → reroute as one loop
- FormatDirector / AudioDirector / VideoUnderstandingEngine
- Production Memory
- Observability
- Supabase hardening
- Admin economics

---

## NON-NEGOTIABLE INVARIANTS

1. Do not create duplicate production systems.
2. Do not create a second ModelRouter. Live class: `src/app/services/runtime/modelRouter.ts`.
3. Do not create a second credit ledger. Foundation remains `profiles.credit_balance` and `credit_ledger`.
4. Do not replace ProductionSpec / SceneSpec / ShotSpec if they can be extended.
5. Do not replace existing continuity infrastructure if it can be extended.
6. Do not replace existing QC infrastructure if it can be extended.
7. Do not hard-code provider pricing in the frontend.
8. Do not make provider-specific models the conceptual language of ShotSpec.
9. Provider-specific implementation belongs behind provider adapters/compilers.
10. User-facing SPARK UX must not expose unnecessary provider/model complexity.
11. Do not redesign SPARK UI/navigation as part of backend architecture work.
12. Do not move the entire application to Supabase Edge Functions because they exist.
13. Never fabricate provider capabilities, prices, job states, or generation results.
14. Financial operations must eventually be transactional and idempotent.
15. Unknown provider submission must be treated as unknown until reconciled.
16. A failed generation must not automatically become a successful credit charge.
17. Existing working behavior takes precedence over theoretical architectural elegance.

---

## Repo facts (Phase 0 inspection)

- Framework: React 18 + Vite 6 + TypeScript ~5.8
- Package name: `spark-media-os`
- Scripts: `dev`, `build` (`vite build`), `typecheck` (`tsc --noEmit`), `test` (tsx --test …), `supabase:types`
- No lint script in `package.json`
- Lockfiles present: `package-lock.json`, `bun.lock`; `pnpm-workspace.yaml` also present
- Backend: Vite app + `api/` runtime routes + Supabase (`supabase/`)
- Tests: large production OS suite under `src/app/services/production/*.test.ts` (no paid provider calls in those unit files by design)
