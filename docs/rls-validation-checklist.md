# RLS Validation Checklist

These checks are pending until a Spark-only Supabase project is created and the Phase 7 migration is applied.

1. User A can read their own profile.
2. User A cannot read User B's profile.
3. User A can create their own brand.
4. User A cannot access User B's brand.
5. User A can create brand-owned memory.
6. User A cannot read another user's memory.
7. Notifications are scoped to the authenticated user.
8. Anonymous users cannot read private app data.
9. No public read policies exist.
10. The frontend never uses a service role key.

Run these tests only against a Spark-owned Supabase project. Do not run them against unrelated projects.
