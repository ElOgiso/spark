# SPARK release status

Release candidate: **READY**
Live launch: **DEFERRED**

Code baseline: `main` after Phase 22 (see the Phase 22 record for the ending SHA).

Database migrations: `production_events` and `credit_reservations` are on the live project and closed to anon. `conversation_sessions` is **not** applied. That migration is required before live launch.

Provider certification: **DEFERRED.** No provider calls in Phase 22. Spend $0.00.

Deployment certification: **DEFERRED.** No Spark deployment was created.

Known blockers before live launch:

- Apply `supabase/migrations/20260926013000_conversation_sessions_secure.sql`
- Configure server provider keys and a disposable validation user
- Run the deferred Narrator, Hybrid, and Cinematic acceptance script
- Certify deployed FFmpeg and one real QC/repair pass

Not code debt: the absence of provider credits.

Next required action: when provider credits exist, follow the live acceptance order in `SPARK_PHASE_22_PRODUCTION_READINESS_RECORD.md`. Do not start a new feature phase first.
