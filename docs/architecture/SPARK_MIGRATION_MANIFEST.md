# SPARK migration manifest

Live project: `jaqzjhabmtvqtvinoafq`.

This phase did **not** apply migrations. Status is from repository files plus an anon REST probe on 2026-09-26.

Probe meaning: HTTP 401 / `42501` means the table exists and anon is denied. HTTP 404 / `PGRST205` means the table is not in the schema cache.

| Migration | Purpose | Repo | Live | Required before launch |
| --- | --- | --- | --- | --- |
| `20260703024500_backend_foundation.sql` | Base app tables | Present | Not re-audited row by row | Historical |
| `20260727120000_accounts_oauth_unique.sql` | OAuth uniqueness | Present | Not re-probed | Historical |
| `20260804180000_conversation_sessions.sql` | First sessions table, UUID id, no RLS | Present | Not applied (table 404) | Superseded by the secure migration |
| `20260807120000_production_assets.sql` | Production assets | Present | Not re-probed | Historical |
| `20260819180000_profiles_and_research_sources.sql` | Profiles, research | Present | `profiles` answered in earlier audits | Historical |
| `20260825120000_admin_controls_and_credits.sql` | Early admin/credit helpers | Present | Superseded by later credit/security migrations | Historical |
| `20260830001500_media_assets_rls.sql` | Media RLS | Present | Not re-probed | Yes, if not already live |
| `20260909140000_admin_and_auth_sync.sql` | Admin/auth sync | Present | Phase 18 treated admin helpers as live | Historical |
| `20260910120000_admin_approve_fix.sql` | Approval RPC | Present | Same | Historical |
| `20260921120000_credit_reservation_and_settlement.sql` | Reservation tables and RPCs | Present | `credit_reservations` exists (anon denied) | Applied at table level |
| `20260923011759_protect_profile_privileges.sql` | Profile privilege lock | Present | Phase 18 live | Applied |
| `20260923083000_profile_update_policy_with_check.sql` | Profile update check | Present | Phase 18 live | Applied |
| `20260923100000_durable_production_economics.sql` | Hardened credit RPCs, `search_path` | Present | Table exists; RPC bodies were not re-executed this phase | Already represented live; do not re-apply blindly |
| `20260924135502_production_observability_events.sql` | `production_events` | Present | Table exists (anon denied) | Applied |
| `20260924145147_phase18_security_and_data_hardening.sql` | RLS, admin, financial ACL | Present | Recorded live in Phase 18 | Applied |
| `20260924164314_phase18_post_activation_policy_cleanup.sql` | Policy cleanup | Present | Recorded live in Phase 18 | Applied |
| `20260926013000_conversation_sessions_secure.sql` | Text session ids, owner RLS, no anon | Present | **Not applied** (PostgREST 404) | **REQUIRED BEFORE LIVE LAUNCH** |

Forward-fix, not a database wipe, if a later apply of `20260926013000` fails. Do not drop production data to "roll back" sessions.
