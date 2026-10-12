# Spark runtime repair — October 2026

## Applied database fixes

Production project: `jaqzjhabmtvqtvinoafq`. The project was resumed on October 10.

- Restored `conversation_sessions` with text IDs and authenticated owner policies; added the missing conversation-message session field.
- Restored the existing executive session, director summary, timeline and production-assets contracts. All new tables have RLS, owner/brand policies, authenticated CRUD grants and no anonymous grants. Canonical media writes still use `media_assets`.
- Removed the permissive PUBLIC storage policy. The replacement supports the canonical `brands/<brand-id>/...` paths and ownership-proven legacy paths, without unsafe UUID casts. No objects were deleted or moved; the bucket remains private.
- Credit reservation replay now checks the owner and original request parameters. Pending-unknown transitions check reservation ownership. Refunds require an administrator or server reconciliation, check reservation ownership, cap the amount to held/consumed credits, and reject mismatched replay parameters.
- Storage authorization uses authoritative brand/production ownership, never editable media metadata. A rollback test attempts to claim another brand's file through metadata and confirms denial.
- Local filenames for the new migrations match the production migration versions. Earlier migration-history drift is not silently replayed or rewritten.

## Application fixes

- Conversation hydration waits for the authenticated user and resolved workspace, reacts to workspace changes and ignores stale responses. The sign-up route no longer attempts anonymous conversation-table access.
- Server persistence and client production uploads return signed private playback URLs, not unusable public endpoints. `storagePath` remains the durable identity. The existing `publicUrl` compatibility field may contain a signed URL; it does not mean the bucket is public.
- Workspace hydration renews stored private/signed and legacy-public Spark URLs. Other hosts and durable path fields are unchanged; denied/missing media is unavailable. The existing preview re-sign flow now actually signs URLs.
- Removed public-URL fallbacks in workspace media upload/listing and director-audio cache checks.

## Verification evidence and limits

`scripts/verification/runtime-schema-security.sql` was executed successfully against production with transaction rollback. It asserts owner CRUD, cross-brand denial, storage upload/select/update, anonymous storage read/write denial, cross-owner reservation protection, refund authorization/caps and exactly-once refund replay. All fixtures and credit changes are rolled back.

Automated tests cover private server playback, signing failure, legacy URL renewal, deduplication, origin isolation and denied media. All 1,479 tests, TypeScript and the production build passed. Unit tests use the existing disabled-production-client test environment; they do not certify real provider generation.

PostgREST recognizes all five restored tables: anonymous probes return 401 permission denial, not the former 404 missing-table response.

Remaining work requiring account/product decisions or live evidence:

- End-to-end authenticated login, workspace switching, actual generation and publication are not certified by SQL fixtures or public-browser inspection.
- Two historical productions have unknown provider outcomes. They were not retried, marked successful, or refunded without evidence.
- TikTok and Meta OAuth configuration needs real application IDs/keys; none are invented or copied from unrelated connectors.
- Leaked-password protection remains a Supabase configuration/plan task. No billing upgrade was made.
- Six legacy tables remain deny-by-default with no RLS policies. Do not invent ownership rules or open them to silence advisor notices.
- Authenticated SECURITY DEFINER advisor notices remain for intentional, guarded RPCs. This is not a claim that every financial workflow has been independently certified. Longer-term provider-confirmed settlement and server-owned reconciliation deserve a separate review.
- Legacy unowned storage objects remain private. They need an ownership-backed migration rather than restoring anonymous access.
- Signed URLs are time-limited; renewal occurs at hydration and through the existing preview recovery path. Arbitrary externally saved links are not permanent publication URLs.
- Build output still has large chunks. No monitoring service or paid plan was added.

Do not describe this repair as all features or all security issues fixed.
