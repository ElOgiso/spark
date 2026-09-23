import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerEndpoint } from './_providerEndpoint.js';
import { requireRuntimeUser } from './_requestAuth.js';
import execute from './execute.js';

test('provider credentials cannot be routed to arbitrary hosts or URL credentials', () => {
  for (const endpoint of ['https://attacker.invalid/v1', 'https://api.openai.com.attacker.invalid/', 'https://api.openai.com@attacker.invalid/', 'http://api.openai.com/', 'https://api.openai.com:444/', 'https://user@api.openai.com/']) {
    assert.throws(() => providerEndpoint('openai', endpoint));
  }
  assert.throws(() => providerEndpoint('unknown', 'https://api.openai.com/'));
  assert.equal(providerEndpoint('openai', 'https://api.openai.com/v1/responses'), 'https://api.openai.com/v1/responses');
  assert.equal(providerEndpoint('higgsfield', '/bytedance/seedance'), 'https://api.higgsfield.ai/bytedance/seedance');
  assert.throws(() => providerEndpoint('higgsfield', '//attacker.invalid/path'));
});

test('unauthenticated generation is rejected before any credential or network access', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected network'); };
  let status = 0;
  const res = { status(value: number) { status = value; return this; }, json() { return this; } } as any;
  try {
    assert.equal(await requireRuntimeUser({ headers: {} } as any, res), null);
    assert.equal(status, 401);
    await execute({ method: 'POST', headers: {}, body: { provider: 'openai', endpoint: 'https://attacker.invalid' } } as any, res);
    assert.equal(status, 401);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('runtime requires a verified active user and ownership of the requested brand', async (t) => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = 'https://auth.spark.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
  t.after(() => {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previous.key;
  });
  let active = true;
  let owned = true;
  t.mock.method(globalThis, 'fetch', async (input: any, init: any) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer verified-session');
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: 'owner' }));
    if (url.pathname === '/rest/v1/profiles') return new Response(JSON.stringify({ access_status: active ? 'active' : 'banned' }));
    if (url.pathname === '/rest/v1/brands') {
      assert.equal(url.searchParams.get('owner_id'), 'eq.owner');
      return new Response(JSON.stringify(owned ? { id: 'brand' } : null));
    }
    throw new Error('Unexpected network request');
  });
  let status = 0;
  const res = { status(value: number) { status = value; return this; }, json() { return this; } } as any;
  const req = { headers: { authorization: 'Bearer verified-session' }, body: { brandId: 'brand' } } as any;
  assert.equal(await requireRuntimeUser(req, res), 'owner');
  active = false;
  assert.equal(await requireRuntimeUser(req, res), null);
  assert.equal(status, 403);
  active = true;
  owned = false;
  assert.equal(await requireRuntimeUser(req, res), null);
  assert.equal(status, 403);
});
