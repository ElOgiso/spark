# Supabase Activation Plan

Phase 8 prepares Spark to activate Supabase without assuming a project already exists.

## Project Choice

- Create a Spark-only Supabase project.
- Do not use an NFT Marketplace project.
- Do not use an ELOGISO HQ project.
- Do not apply Spark migrations to unrelated Supabase projects.

## Activation Steps

1. Create a new Supabase project for Spark.
2. Install the Supabase CLI locally if it is not already available.
3. Link the local repo to the Spark project with `supabase link`.
4. Apply the local migration with `supabase db push`.
5. Generate project types with `npm run supabase:types`.
6. Copy `.env.example` to `.env.local`.
7. Add `VITE_SUPABASE_URL`.
8. Add `VITE_SUPABASE_PUBLISHABLE_KEY`.
9. Set `VITE_USE_SUPABASE=true`.
10. Keep `VITE_REQUIRE_AUTH=false` until the auth flow is intentionally required.
11. Run `npm install`, `npm run build`, and `npm run typecheck`.

## CLI Support

If the Supabase CLI is available, use:

```sh
supabase link
supabase db push
npm run supabase:types
```

The normal Vite build does not require the Supabase CLI.

## Manual Path

If the Supabase CLI is not available:

1. Open the Spark Supabase project SQL editor.
2. Apply `supabase/migrations/20260703024500_backend_foundation.sql`.
3. Confirm all tables were created.
4. Confirm RLS is enabled on every table.
5. Confirm no public read policies exist.
6. Add local env values in `.env.local`.
7. Run `npm run build` and `npm run typecheck`.

## Validation

- Validate email sign-up and sign-in.
- Validate profile bootstrap after first authenticated session.
- Validate default brand bootstrap without duplicates.
- Validate RLS using `docs/rls-validation-checklist.md`.
- Validate local/mock fallback still works with `VITE_USE_SUPABASE=false`.

No real keys belong in this document or in Git.
