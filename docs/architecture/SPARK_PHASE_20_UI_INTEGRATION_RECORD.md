# SPARK Phase 20 — UI Integration Record

Starting SHA: `b62d424298637c42a7b7327dbd6037ac60dd28f3`
Branch: `main`
Database: no Phase 20 migration.
Provider spend: `$0.00`

## Law

Existing navigation stays SPARK, MY SPARK, VIRAL SPARKS, REVIEW, CALENDAR, ANALYTICS, MORE.
No second review, dashboard, or production state. Presentation helpers live in `src/app/services/production/ui/userProductionExperience.ts`. Pricing conversion uses `convertUsdToCredits` only when a canonical estimate object is already attached. The UI does not invent USD.

## Surfaces reused

- Desktop nav: `Navigation.tsx` reads `LOCKED_PRIMARY_NAV`
- Mobile: `BottomNavigation.tsx` keeps the same destinations that fit a bottom bar (SPARK, VIRAL SPARKS, REVIEW, ANALYTICS, MORE). MY SPARK and CALENDAR stay reachable from MORE. Calendar route opens the existing `Calendar` page.
- Modes: `MySpark.tsx`, `MobileMySpark.tsx`, `MoreSubPages.tsx` use Narrator / Hybrid / Cinematic copy. Internal keys remain express / standard / deep.
- Automation stays a separate control: Manual Review Required, Approval Required, Autonomous.
- Production OFF copy in settings: chat and planning stay available; generation spend does not.
- Credits: `TopBar` and `/more/billing` read `auth.creditBalance` (profile `credit_balance`). Billing history reads `createCreditRepository().getLedger` and `presentLedgerEntry`. Review generate actions show an attached canonical estimate, or "Estimate unavailable". A known estimate above the loaded balance disables generate and says "Not enough Spark Credits" with a Billing action. No direct ledger writes. JSX does not price a click itself.
- Analytics: `Analytics.tsx` and `MobileAnalytics.tsx` no longer seed demo views, hook multipliers, audience claims, or revenue. Empty state uses `ANALYTICS_EMPTY_COPY`.
- Review: `CreativeReview.tsx` and `MobileCreativeReview.tsx` show `userSafeGenerationMessage`, block regenerate while submission evidence is unknown, and map live progress through `presentLifecycleProgress` without inventing a percent. Review identity shows Narrator / Hybrid / Cinematic, not provider or model ids.
- Master merge: `SparkContext.mergeProductionScenes` sets status with `reviewStatusAfterMaster`. A master URL alone becomes Checking Quality, not Ready for Review, unless lifecycle `deliverableReady` is true. QC `passed: false` becomes Needs Edit.
- Publish failure and blocked publish use `NotificationService` instead of `alert`. Post-publish learning no longer stamps a fake audience score of 75.
- Production OFF copy on More, mobile More, and production settings: Super Spark, planning, and chat stay available. Generation spend does not.

## Not claimed

- JSX does not call CostEngine to price a click. Unknown or missing attached estimates stay "Estimate unavailable" and do not render as 0 or Free.
- Mobile is not a seven-tab clone of desktop.
- Phase 21 paid narrator/hybrid/cinematic validation was not run.
- Live Supabase was not migrated.

## Tests

`src/app/services/production/ui/userProductionExperience.test.ts`: 11/11 pass (navigation, mode copy, unknown cost, insufficient credits, unknown submission, progress percent, ledger language, master-alone readiness, empty analytics copy).

`npx tsc --noEmit`: 0 errors after Phase 20.

`node scripts/run-tests.mjs`: 1425 pass, 2 fail, 1427 tests, 296 suites. The two failures are `api/runtime/audioMaster.test.ts` (`spawnSync ffmpeg-static ENOENT`). They do not import Phase 20 UI. No provider spend.

`npm run build`: passed (`vite build`, 9.16s). Existing duplicate-case warnings in `MoreSubPages.tsx` (`/more/credit-control`, `/more/generation-controls`, `/more/production-settings`) were already in the file and were not introduced here.

Browser visual pass of desktop and mobile widths was not executed in this environment.
