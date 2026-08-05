# Backend Foundation Plan

## What Was Added

Phase 7 adds the backend foundation for Spark to move from local mock state toward authenticated, user-owned Supabase data without changing the current UI flow.

- `.env.example`
- Optional Supabase browser client in `src/app/backend/supabaseClient.ts`
- Auth-ready service in `src/app/backend/authService.ts`
- Temporary typed database interfaces in `src/app/backend/database.types.ts`
- Repository adapters under `src/app/backend/repositories/`
- Local-to-backend sync bridge in `src/app/backend/syncService.ts`
- Auth-ready placeholder components in `src/app/components/auth/`
- Supabase migration in `supabase/migrations/`
- Vite env typing in `src/vite-env.d.ts`

## Tables Added

The migration prepares these core tables for the Spark operating loop:

- `profiles`
- `brands`
- `characters`
- `brand_rules`
- `memory_items`
- `accounts`
- `viral_sparks`
- `productions`
- `review_items`
- `publish_jobs`
- `analytics_snapshots`
- `notifications`
- `notification_preferences`
- `audit_logs`

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the public Supabase values:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_USE_SUPABASE=false
```

Set `VITE_USE_SUPABASE=true` only when a Supabase project is configured.

## Current Limitations

- The current Spark UI still uses local mock state and local persistence.
- Auth is prepared but not enforced.
- Supabase reads and writes are available only through the adapter layer.
- No OAuth publishing, platform API publishing, AI generation, video rendering, payments, or Stripe work was added.
- Backend sync is intentionally a bridge, not a full migration.
- No remote Supabase migration has been applied.
- Supabase project selection is pending; do not apply this migration to unrelated projects.

## RLS Rules

The migration enables RLS on every table.

- Profiles are visible and editable only by the owning user.
- Brands can only be selected, inserted, updated, or deleted by their owner.
- Brand-owned rows use `user_owns_brand(brand_id)` for select, insert, update, and delete policies.
- Notifications can only be selected or updated by their assigned user.
- Notification preferences can only be selected or updated by their assigned user.
- Audit logs can be read by the user or by the owner of the related brand.
- There are no public read policies.

## Local And Mock Fallback

Supabase is optional. If `VITE_USE_SUPABASE` is not `true`, or if URL/key values are missing, `isSupabaseConfigured()` returns `false`, no client is created, and repository functions return safe unconfigured results. The existing local mock state continues to run.

## Repository Adapter Strategy

UI components should not import Supabase directly. Backend calls are prepared through repositories:

- `brandRepository`
- `memoryRepository`
- `productionRepository`
- `reviewRepository`
- `calendarRepository`
- `analyticsRepository`
- `notificationRepository`

Each repository checks whether Supabase is configured, returns typed results, and falls back safely when the backend is unavailable. Errors are intentionally sanitized so raw backend messages do not become user-facing copy.

## Future Auth Phase

The next auth phase should:

- Mount `AuthGate` intentionally where needed.
- Add profile creation after sign-up.
- Restore sessions on app boot.
- Move user-owned brand selection into authenticated state.
- Keep local fallback available for development.

## Future OAuth Phase

Platform OAuth should remain server-mediated:

- Do not place platform access tokens in frontend source.
- Exchange OAuth codes server-side.
- Store encrypted token records only in backend-controlled tables or functions.
- Add platform adapter services after auth is stable.

## Future Publish Queue Phase

Publishing should move through `publish_jobs` with:

- Approval gates
- Retry state
- Failure reasons
- Audit logging
- Manual export fallback

## Future Analytics Import Phase

Analytics imports should write to `analytics_snapshots`, optionally linking learned insights back to `memory_items`.

## Security Notes

- Never commit real keys.
- Never use Supabase service role keys in frontend code.
- Only the public publishable/anon key belongs in Vite client env.
- Backend errors are sanitized before reaching repositories.
- RLS must stay enabled for all user-owned data.

## Migration Status

The migration has been reviewed locally but has not been applied to a remote Supabase project. Supabase CLI was not available in this workspace, so no local Supabase migration validation was run.

## Known TypeScript Debt

Phase 7.1 added `npm run typecheck` and resolved the type errors that were blocking a clean check. There is no known remaining TypeScript debt after this stabilization pass.

## Phase 8 Next Steps

Phase 8 should connect backend sync deliberately after a dedicated Supabase project exists:

- Create or select a Spark-only Supabase project.
- Apply and validate migrations in that project.
- Add profile bootstrap after sign-up.
- Mount auth intentionally without blocking the current app prematurely.
- Map local Spark state into backend records.
- Keep OAuth, publishing APIs, payments, and AI generation for later phases.

## Phase 8 Status

Phase 8 adds the activation path and auth session foundation, but it still does not apply migrations remotely.

- Added `VITE_REQUIRE_AUTH=false` as the default auth-gate flag.
- Added CLI-optional Supabase type generation through `npm run supabase:types`.
- Added `AuthContext` and `sessionService` for session restore, sign-in, sign-up, sign-out, loading state, and sanitized auth errors.
- Added profile bootstrap through `profileRepository`.
- Added idempotent default brand bootstrap through `brandRepository`.
- Extended `syncService` with backend status, authenticated bootstrap, brand, memory, and notification load hooks.
- Mounted auth safely in More/Profile areas without forcing login by default.
- Documented project activation and RLS validation steps.

No Spark Supabase project has been linked yet, and no remote migration has been applied yet.
