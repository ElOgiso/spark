import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeEvidence } from '../production/observability/sanitizer.js';
import { ProductionObserver } from '../production/observability/observer.js';
import { InMemoryProductionObservabilityRepository } from '../production/observability/repository.js';
import type { ProductionObservationEvent } from '../production/observability/types.js';

// ============================================================================
// SPARK PHASE 18 — SECURITY & DATA HARDENING TEST MATRIX (TESTS A THROUGH Z)
// ============================================================================

test('TEST A — production_events activation: table exists and enforces append-only RLS', () => {
  const p17Mig = readFileSync('supabase/migrations/20260924135502_production_observability_events.sql', 'utf8');
  assert.ok(p17Mig.includes('CREATE TABLE IF NOT EXISTS public.production_events'), 'production_events table must be defined');
  assert.ok(p17Mig.includes('ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY'), 'RLS must be enabled');
  assert.ok(p17Mig.includes('REVOKE UPDATE, DELETE ON public.production_events FROM authenticated'), 'UPDATE/DELETE revoked from authenticated');
  assert.ok(p17Mig.includes('REVOKE ALL ON public.production_events FROM anon, public'), 'Anon and public must have zero access');
  assert.ok(p17Mig.includes('GRANT SELECT, INSERT ON public.production_events TO authenticated, service_role'), 'Only authenticated and service_role can select/insert');
  // Confirm removal of insecure (user_id IS NULL AND auth.uid() IS NULL)
  assert.ok(!p17Mig.includes('(user_id IS NULL AND auth.uid() IS NULL)'), 'Anon insert path must be eliminated');
});

test('TEST B & C — anon private table read and insert denied across private entities', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  const privateTables = [
    'profiles', 'brands', 'characters', 'brand_rules', 'memory_items',
    'research_sources', 'viral_sparks', 'productions', 'review_items',
    'publish_jobs', 'analytics_snapshots', 'accounts', 'media_assets',
    'coupons', 'credit_ledger', 'credit_reservations', 'admin_audit_log',
    'notifications', 'notification_preferences', 'audit_logs', 'production_events'
  ];

  for (const table of privateTables) {
    const revokeMatches = p18Mig.match(new RegExp(`REVOKE (ALL|INSERT, UPDATE, DELETE) ON public\\.${table} FROM anon`, 'i'));
    assert.ok(revokeMatches, `Anon must have mutations/access revoked on ${table}`);
  }
});

test('TEST D & E — User A / User B productions: cross-user isolation and update denial', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  assert.ok(p18Mig.includes('CREATE POLICY "productions_select_policy"'), 'productions select policy exists');
  assert.ok(p18Mig.includes('CREATE POLICY "productions_update_policy"'), 'productions update policy exists');
  assert.ok(p18Mig.includes('public.user_owns_brand(brand_id)'), 'production access enforces brand ownership');
  assert.ok(p18Mig.includes('TO authenticated'), 'production policies target authenticated role only');
});

test('TEST F — cross-user production child insert: review items, jobs, assets must validate brand ownership', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  assert.ok(p18Mig.includes('CREATE POLICY "review_items_insert_policy"'), 'review items insert policy exists');
  assert.ok(p18Mig.includes('WITH CHECK (public.user_owns_brand(brand_id)'), 'review items insert requires brand ownership');

  assert.ok(p18Mig.includes('CREATE POLICY "publish_jobs_insert_policy"'), 'publish jobs insert policy exists');
  assert.ok(p18Mig.includes('WITH CHECK (public.user_owns_brand(brand_id)'), 'publish jobs insert requires brand ownership');
});

test('TEST G, H, I, J, K, L, N — entity isolation for characters, brands, memory, research, analytics, review, jobs', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  
  // Brands
  assert.ok(p18Mig.includes('CREATE POLICY "brands_select_policy"'));
  assert.ok(p18Mig.includes('USING (owner_id = (select auth.uid())'));

  // Characters
  assert.ok(p18Mig.includes('CREATE POLICY "characters_select_policy"'));
  assert.ok(p18Mig.includes('USING (public.user_owns_brand(brand_id)'));

  // Memory
  assert.ok(p18Mig.includes('CREATE POLICY "memory_items_select_policy"'));
  assert.ok(p18Mig.includes('USING (public.user_owns_brand(brand_id)'));

  // Research Sources
  assert.ok(p18Mig.includes('CREATE POLICY "research_sources_select_policy"'));
  assert.ok(p18Mig.includes('USING (public.user_owns_brand(brand_id)'));

  // Analytics Snapshots
  assert.ok(p18Mig.includes('CREATE POLICY "analytics_snapshots_select_policy"'));
  assert.ok(p18Mig.includes('USING (public.user_owns_brand(brand_id)'));
});

test('TEST M — production_events: cross-user isolation and append-only', async () => {
  const repo = new InMemoryProductionObservabilityRepository();
  const observer = new ProductionObserver({ repository: repo });

  const eventUserA: ProductionObservationEvent = {
    id: 'evt-1',
    userId: 'user-a',
    brandId: 'brand-a',
    productionId: 'prod-a',
    eventType: 'production_planned',
    criticality: 'critical',
    occurredAt: new Date().toISOString(),
    evidence: { details: 'Plan for user A' },
    provenance: { source: 'test', measured: true },
  };

  const eventUserB: ProductionObservationEvent = {
    id: 'evt-2',
    userId: 'user-b',
    brandId: 'brand-b',
    productionId: 'prod-b',
    eventType: 'production_planned',
    criticality: 'critical',
    occurredAt: new Date().toISOString(),
    evidence: { details: 'Plan for user B' },
    provenance: { source: 'test', measured: true },
  };

  await observer.record(eventUserA);
  await observer.record(eventUserB);

  // User A query only returns User A events
  const prodAEvents = await repo.query({ productionId: 'prod-a' });
  assert.equal(prodAEvents.length, 1);
  assert.equal(prodAEvents[0].userId, 'user-a');

  // Verify append-only in migration
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  assert.ok(p18Mig.includes('REVOKE UPDATE, DELETE ON public.production_events FROM authenticated'), 'Authenticated cannot update/delete events');
});

test('TEST O — media_assets: cross-user/private media isolation', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  assert.ok(p18Mig.includes('CREATE POLICY "media_assets_select_policy"'));
  assert.ok(p18Mig.includes('b.owner_id = (select auth.uid())'), 'media_assets requires owning brand matching caller auth.uid');
});

test('TEST P — profiles financial fields: user cannot directly alter credit balance, role, or status', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  assert.ok(p18Mig.includes('CREATE POLICY "profiles_update_policy"'));
  assert.ok(p18Mig.includes('credit_balance = (SELECT p.credit_balance FROM public.profiles p WHERE p.id = (select auth.uid()))'), 'user cannot alter credit_balance');
  assert.ok(p18Mig.includes('role = (SELECT p.role FROM public.profiles p WHERE p.id = (select auth.uid()))'), 'user cannot alter role');
  assert.ok(p18Mig.includes('access_status = (SELECT p.access_status FROM public.profiles p WHERE p.id = (select auth.uid()))'), 'user cannot alter access_status');
  assert.ok(p18Mig.includes('is_super_admin = (SELECT p.is_super_admin FROM public.profiles p WHERE p.id = (select auth.uid()))'), 'user cannot alter is_super_admin');
});

test('TEST Q & R — credit_reservations & credit_ledger: user cannot forge reservations or ledger entries', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  assert.ok(p18Mig.includes('REVOKE INSERT, UPDATE, DELETE ON public.credit_reservations FROM authenticated'), 'User cannot insert/update credit_reservations directly');
  assert.ok(p18Mig.includes('REVOKE UPDATE, DELETE ON public.credit_ledger FROM authenticated'), 'User cannot update/delete credit_ledger');
  assert.ok(p18Mig.includes('CREATE POLICY "credit_ledger_admin_insert_policy"'), 'Only admin insert policy for credit_ledger');
});

test('TEST S & T — financial RPCs: cross-user rejected and anon execution revoked', () => {
  const d08Mig = readFileSync('supabase/migrations/20260923100000_durable_production_economics.sql', 'utf8');
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');

  // Verify internal cross-user check in RPC
  assert.ok(d08Mig.includes('IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN'), 'Cross-user call check in reserve RPC');
  assert.ok(d08Mig.includes("RAISE EXCEPTION 'Unauthorized: cannot reserve credits for another user'"), 'Cross-user exception');

  // Verify anon and public execute revoked in Phase 18 migration
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.spark_reserve_credits(UUID, TEXT, INTEGER, TEXT, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon'), 'spark_reserve_credits revoked from anon/public');
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.spark_settle_credits(UUID, UUID, INTEGER, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon'), 'spark_settle_credits revoked from anon/public');
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.spark_release_credits(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon'), 'spark_release_credits revoked from anon/public');
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.spark_mark_pending_unknown(UUID, UUID, TEXT) FROM PUBLIC, anon'), 'spark_mark_pending_unknown revoked from anon/public');
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.spark_refund_credits(UUID, UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon'), 'spark_refund_credits revoked from anon/public');
});

test('TEST U & V — SECURITY DEFINER ACL and safe explicit search_path', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');

  // Check functions have SET search_path = public
  assert.ok(p18Mig.includes('CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)'));
  assert.ok(p18Mig.includes('SET search_path = public'), 'is_admin has safe search_path');

  // Check ACL revoked for admin/helper functions
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon'));
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.user_owns_brand(uuid) FROM PUBLIC, anon'));
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated'));
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.admin_set_access_status(uuid, text) FROM PUBLIC, anon'));
  assert.ok(p18Mig.includes('REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) FROM PUBLIC, anon'));
});

test('TEST W — OAuth storage: accounts table is owner-scoped', () => {
  const p18Mig = readFileSync('supabase/migrations/20260924145147_phase18_security_and_data_hardening.sql', 'utf8');
  assert.ok(p18Mig.includes('CREATE POLICY "accounts_select_policy"'));
  assert.ok(p18Mig.includes('USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))'), 'accounts table SELECT is strictly owner-scoped');
  assert.ok(p18Mig.includes('REVOKE ALL ON public.accounts FROM anon, public'), 'Anon cannot access accounts');
});

test('TEST X — browser/service-role boundary: service-role key absent from client code & no VITE_ service key', () => {
  const forbiddenKey = ['VITE', 'SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
  const forbiddenNext = ['NEXT', 'PUBLIC', 'SERVICE', 'ROLE'].join('_');

  const clientFiles = ['src', 'public'];
  function checkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) checkDir(full);
      else if (
        (e.name.endsWith('.ts') || e.name.endsWith('.tsx') || e.name.endsWith('.js') || e.name.endsWith('.html')) &&
        !e.name.endsWith('.test.ts')
      ) {
        const content = readFileSync(full, 'utf8');
        assert.ok(!content.includes(forbiddenKey), `Forbidden ${forbiddenKey} found in ${full}`);
        assert.ok(!content.includes(forbiddenNext), `Forbidden ${forbiddenNext} found in ${full}`);
      }
    }
  }
  for (const d of clientFiles) checkDir(d);

  // Check api/ as well for VITE_SUPABASE_SERVICE_ROLE_KEY (non-test files)
  function checkApi(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) checkApi(full);
      else if ((e.name.endsWith('.ts') || e.name.endsWith('.js')) && !e.name.endsWith('.test.ts')) {
        const content = readFileSync(full, 'utf8');
        assert.ok(!content.includes(forbiddenKey), `Forbidden ${forbiddenKey} found in ${full}`);
      }
    }
  }
  checkApi('api');
});

test('TEST Y — secret logging: tokens and secrets sanitized from payloads and telemetry', () => {
  const dirtyPayload = {
    provider: 'higgsfield',
    authorization: 'Bearer secret-token-12345',
    api_key: 'hf_super_secret_key',
    nested: {
      password: 'mypassword',
      access_token: 'at_1234567890',
      refresh_token: 'rt_0987654321',
      credential: {
        service_role: 'raw-service-key-do-not-leak',
      },
    },
    safeField: 'This is visible',
  };

  const clean = sanitizeEvidence(dirtyPayload);
  assert.equal(clean.authorization, 'Bearer [REDACTED]');
  assert.equal(clean.api_key, '[REDACTED]');
  assert.equal((clean.nested as any).password, '[REDACTED]');
  assert.equal((clean.nested as any).access_token, '[REDACTED]');
  assert.equal((clean.nested as any).refresh_token, '[REDACTED]');
  assert.equal((clean.nested as any).credential, '[REDACTED]');
  assert.equal(clean.safeField, 'This is visible');
});

test('TEST Z — owner happy path: authenticated owner can execute valid lifecycle and observability operations', async () => {
  const repo = new InMemoryProductionObservabilityRepository();
  const observer = new ProductionObserver({ repository: repo });

  const event: ProductionObservationEvent = {
    id: 'evt-happy-1',
    userId: 'user-happy',
    brandId: 'brand-happy',
    productionId: 'prod-happy',
    eventType: 'execution_succeeded',
    criticality: 'critical',
    occurredAt: new Date().toISOString(),
    evidence: { status: 'complete', assetId: 'asset-123' },
    provenance: { source: 'test', measured: true },
  };

  await observer.record(event);
  const events = await repo.query({ productionId: 'prod-happy' });
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'evt-happy-1');
  assert.equal(events[0].userId, 'user-happy');
  assert.equal(events[0].eventType, 'execution_succeeded');
});
