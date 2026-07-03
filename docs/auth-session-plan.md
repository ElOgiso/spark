# Auth Session Plan

Phase 8 adds a session foundation without forcing every user to sign in.

## Current Behavior

- Spark opens normally in demo/local mode by default.
- `VITE_REQUIRE_AUTH=false` keeps the visible app accessible.
- `VITE_USE_SUPABASE=false` keeps Supabase disabled.
- Auth UI is reachable from More/Profile areas but does not replace the app shell.

## Demo/Local Mode

When Supabase is not configured, Spark:

- keeps using local mock persistence,
- shows local demo status,
- disables real sign-in fields,
- avoids backend crashes,
- keeps the operating loop visible.

## Authenticated Mode

When Supabase is configured and a user signs in, Spark:

- restores the Supabase session,
- exposes `currentUser`, `session`, `loading`, and `isAuthenticated`,
- bootstraps a profile row,
- ensures one default brand exists,
- keeps backend errors sanitized.

## Required Auth Flag

`VITE_REQUIRE_AUTH=true` shows `AuthGate` before Spark opens.

This flag remains off by default. It should only be enabled after the Spark Supabase project, migration, auth settings, RLS checks, and fallback checks are complete.

## Profile Bootstrap

The profile id matches `auth.users.id`. The initial display name comes from user metadata or the email prefix. The default role is `Director`.

## Brand Bootstrap

The first authenticated session ensures the user has a brand. The default brand is created once, not on every reload. If local mock brand data is available, the repository can use it as the seed.

Default fallback:

- name: `Tech Insights Nigeria`
- niche: `AI & Technology Education`
- automation mode: `balanced`

## Future Work

- Connect backend-loaded data into the active Spark state.
- Add explicit local-to-backend migration controls.
- Add invite/team management after auth hardening.
- Add platform OAuth in a later phase.
- Add publish queue execution after platform integrations exist.
- Add analytics import after real account connections exist.
