# Spark screen rollout — 12 October 2026

## Product rule

Spark remains the same Media Operating System. Change arrangement and presentation, not product identity or the production spine. Keep the approved obsidian/violet language, conversational setup and six purpose-based profiles. Preserve SPARK, MY SPARK, VIRAL SPARKS, REVIEW, CALENDAR, ANALYTICS and MORE.

One authoritative feature implementation; desktop/mobile are responsive presentations, not independent business logic. Multiple entry points may open the same editor. Do not retain a competing editor or alternate theme-specific workflow as a permanent fallback.

Sources: `SPARK_EXPERIENCE_GUIDE.md`, Notion Design Source of Truth, Experience Council Plan and Product Boundary; existing Production OS architecture. The newer explicit no-duplicate instruction replaces the older council proposal to keep a legacy UI rollback mode. Git history is the rollback mechanism.

## What remains and what it should become

| Order | Screen group | Intended experience | Backend authority / wiring | Consolidation |
| --- | --- | --- | --- | --- |
| 1 | SPARK Home | Calm operational overview: current purpose, work needing attention, real media and next useful action; no generic performance dashboard | SparkContext hydrated workspace; review records; publish jobs/receipts; existing chat | Replace four home variants with one responsive Home; retain one reusable player |
| 2 | VIRAL SPARKS + research/source detail | Evidence-led discovery with origin, freshness, why it fits, one selected brief and contextual chat | Current research adapters, source repositories, viralSpark registry and createProductionFromSpark | One discovery list/detail and one create action; no parallel generator |
| 3 | REVIEW queue + Creative Review + processing/recovery | One production workspace: brief → storyboard/shots → candidate selection → QC → master → approval. Clear blocked/unknown outcomes | Canonical ProductionSpec, executor/DAG, lineage, QC, cost/credit gates and existing review methods | Merge desktop/mobile presentation and review filters; remove sample items and hard-coded status heuristics |
| 4 | CALENDAR + publish confirmation + outcome detail | Actual scheduled jobs, destination-specific confirmation, processing/error recovery and verified platform receipts | CalendarAggregationService, publishPolicy, distributionService, publishJobs and platform reconciliation | One schedule/confirmation path, not another production or upload engine |
| 5 | ANALYTICS + post insight | Observed metrics with scope, source and time window; evidence-led next experiment; unavailable/stale is distinct from zero | analyticsPipeline, performance intelligence and memory bridge | One shared analytics projection; no synthetic dashboards or competing learning systems |
| 6 | Asset studios + private library + series/cast/world | Shared media-first catalog; versioned character/voice/set/prop controls; explicit brand/series/scene scope | Existing asset studios, media_assets/private storage, reference graph, continuity and production-series canon | One editor per asset type; profile and MORE link to it rather than recreating it |
| 7 | MY SPARK private controls + MORE/accounts/settings/billing/memory/team | Profile remains primary. Settings are grouped operational controls; connection status distinguishes login, identity, publish and analytics capabilities | Existing authenticated repositories, workspace settings, OAuth, profile/credit ledger, memory and rules | Remove duplicate generation-control cases and overlapping account/settings forms; preserve legal/access boundaries |
| 8 | Shared chrome + ongoing Spark conversation + auth/admin polish | Consistent workspace identity, responsive navigation, one contextual conversation, accessible feedback and errors | Existing router, AuthContext, sessions, notifications and role-protected admin services | No second chat, account switcher, permission authority or branding system |

Onboarding and six profile layouts already have their first implementation, not a complete visual/functional certification. They require regression checks in every batch. The remaining route groups contain many detail and state screens; eight groups is not a claim of only eight individual screens.

## Phase 1: begin with Home

- Replace DefaultSparkHome, DefaultMobileHome, DesktopSparkMediaHome and DonorSparkMediaHome business views with one responsive Home.
- Extract the existing full-screen player so existing gallery/activity callers keep the same feature.
- Home reads saved workspace state; never starts generation, publishing, research or payment just by rendering or opening chat.
- Review clicks target the exact production in the current Creative Review route. Scheduled/export/published outcomes come from actual jobs, never IDs such as `p7` or a production label alone.
- Remove inferred views/revenue/retention and synthetic trends. Performance belongs in ANALYTICS; Home provides a link, not a duplicate dashboard.
- Add real workspace loading/error/retry feedback. A failed core repository load must not overwrite saved state with empty arrays and claim success.
- Keep user changes to the existing chat-logo image untouched and excluded from this batch's commit.

## Gates for every batch

1. Inventory all active callers and source of truth before editing. Mark legacy unused code separately from live features.
2. Use common projection/presentation helpers and existing mutation services. No new provider router, ledger, production tables or duplicated feature state.
3. Check loading, empty, populated, error/retry, workspace switch and mobile behavior; test pure projections and action routing.
4. Preserve drafts, media identities, account attribution, locks and publication evidence. Double actions and unknown outcomes must not duplicate spend or posts.
5. Typecheck, test and production build; authenticated live checks before claiming backend end-to-end completion. No paid generation or public publication without a defined test scope.
6. Ship one bounded batch to main, verify its deployment, then advance. Record deferred provider/OAuth/account checks explicitly.

## Acceptance evidence / current scope

Batch 1 is Home consolidation and workspace hydration feedback only. It is not the redesign of review, calendar, analytics or studios. Existing live-login, provider generation, OAuth and publication gaps remain separate release gates. No sample data should enter the live app to make screens look populated.

Home tests cover receipt-backed counts, scheduled-job evidence, workspace isolation, loading/empty/error/local/populated markup and shared mobile mounting. CSS has mobile, keyboard focus and reduced-motion rules. These automated checks are not a rendered authenticated desktop/mobile visual pass. That pass needs live account access; no authentication bypass or sample-data route was added.

The full test suite exposed an existing retention-policy fixture at a floating-point rounding boundary as wall-clock milliseconds advanced. Its test clock is now deterministic; production retention behavior was not changed.

Batch 1 verification: 1,486 tests passed, TypeScript passed and Vite production build passed. Authenticated rendered Home, gallery player interactions and live workspace-switch checks remain unverified. No provider generation or public publication was performed.
