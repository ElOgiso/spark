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

test('video generation rejects with 402 Insufficient credits BEFORE any provider HTTP when balance is too low', async (t) => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = 'https://auth.spark.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
  t.after(() => {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previous.key;
  });

  const { CreditService } = await import('../../src/app/services/production/credits/creditService.js');
  const creditService = CreditService.getInstance();
  await creditService.setBalance('owner', 0); // 0 credits available

  let providerFetches = 0;
  t.mock.method(globalThis, 'fetch', async (input: any, init: any) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: 'owner' }));
    if (url.pathname === '/rest/v1/profiles') return new Response(JSON.stringify({ access_status: 'active', credit_balance: 0 }));
    if (url.pathname === '/rest/v1/brands') return new Response(JSON.stringify({ id: '00000000-0000-0000-0000-000000000001' }));
    // Any external provider fetch
    providerFetches++;
    throw new Error('Provider HTTP should not be called when balance is insufficient');
  });

  let status = 0;
  let jsonResult: any = null;
  const res = {
    setHeader() { return this; },
    status(value: number) { status = value; return this; },
    json(obj: any) { jsonResult = obj; return this; },
  } as any;

  const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer verified-session' },
    body: {
      provider: 'kling',
      prompt: 'A cinematic drone shot of a coastline',
      imageUrl: dataUri,
      firstFrameUrl: dataUri,
      firstFrameDataUri: dataUri,
      brandId: '00000000-0000-0000-0000-000000000001',
      productionId: 'prod-test',
      shotIndex: 1,
      attempt: 1,
    },
  } as any;

  const videoHandler = (await import('./video.js')).default;
  await videoHandler(req, res);
  assert.equal(status, 402);
  assert.match(jsonResult?.error, /Insufficient credits/);
  assert.equal(providerFetches, 0, 'Zero provider HTTP fetches occurred');
});

test('oauth callback rejects forged brandId when brand is not owned by the user', async (t) => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    gId: process.env.GOOGLE_CLIENT_ID,
    gSec: process.env.GOOGLE_CLIENT_SECRET,
  };
  process.env.SUPABASE_URL = 'https://auth.spark.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  t.after(() => {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previous.key;
    if (previous.gId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous.gId;
    if (previous.gSec === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = previous.gSec;
  });

  const brandId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const legitUserId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const attackerUserId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  t.mock.method(globalThis, 'fetch', async (input: any, init: any) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: attackerUserId }));
    if (url.pathname === '/rest/v1/brands') {
      // Return brand owned by legitUser, but caller is attackerUser
      return new Response(JSON.stringify({ id: brandId, owner_id: legitUserId }));
    }
    if (url.hostname === 'oauth2.googleapis.com') {
      return new Response(JSON.stringify({
        access_token: 'secret-access-token',
        refresh_token: 'secret-refresh-token',
        expires_in: 3600,
      }));
    }
    if (url.hostname === 'www.googleapis.com') {
      return new Response(JSON.stringify({
        items: [{ id: 'UC123', snippet: { title: 'Test Channel' } }],
      }));
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });

  let status = 0;
  let jsonResult: any = null;
  const res = {
    setHeader() { return this; },
    status(value: number) { status = value; return this; },
    json(obj: any) { jsonResult = obj; return this; },
  } as any;

  // State encodes attacker trying to attach legitUser's brand
  const statePayload = Buffer.from(JSON.stringify({ brandId, userId: attackerUserId })).toString('base64url');
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer verified-session' },
    body: {
      code: 'auth-code',
      state: `spark_oauth_12345_${statePayload}`,
      redirect_uri: 'https://spark.invalid/callback',
      workspace_id: brandId,
    },
  } as any;

  const googleCallback = (await import('../auth/google/callback.js')).default;
  await googleCallback(req, res);
  assert.equal(status, 403);
});

test('oauth callback never returns access_token or refresh_token in response JSON', async (t) => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    gId: process.env.GOOGLE_CLIENT_ID,
    gSec: process.env.GOOGLE_CLIENT_SECRET,
  };
  process.env.SUPABASE_URL = 'https://auth.spark.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  t.after(() => {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previous.key;
    if (previous.gId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous.gId;
    if (previous.gSec === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = previous.gSec;
  });

  const brandId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const legitUserId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

  t.mock.method(globalThis, 'fetch', async (input: any, init: any) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: legitUserId }));
    if (url.pathname === '/rest/v1/brands') {
      return new Response(JSON.stringify({ id: brandId, owner_id: legitUserId }));
    }
    if (url.pathname === '/rest/v1/accounts') {
      return new Response(JSON.stringify([]));
    }
    if (url.hostname === 'oauth2.googleapis.com') {
      return new Response(JSON.stringify({
        access_token: 'secret-google-access-token',
        refresh_token: 'secret-google-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }));
    }
    if (url.hostname === 'www.googleapis.com') {
      return new Response(JSON.stringify({
        items: [{
          id: 'UC123',
          snippet: { title: 'Spark Channel', customUrl: '@spark' },
        }],
      }));
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });

  let status = 0;
  let jsonResult: any = null;
  const res = {
    setHeader() { return this; },
    status(value: number) { status = value; return this; },
    json(obj: any) { jsonResult = obj; return this; },
  } as any;

  const statePayload = Buffer.from(JSON.stringify({ brandId, userId: legitUserId })).toString('base64url');
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer verified-session' },
    body: {
      code: 'auth-code',
      state: `spark_oauth_12345_${statePayload}`,
      redirect_uri: 'https://spark.invalid/callback',
      workspace_id: brandId,
    },
  } as any;

  const googleCallback = (await import('../auth/google/callback.js')).default;
  await googleCallback(req, res);
  assert.equal(status, 200);
  assert.equal(jsonResult.access_token, undefined, 'access_token must not be returned');
  assert.equal(jsonResult.refresh_token, undefined, 'refresh_token must not be returned');
  assert.equal(jsonResult.success, true);
  assert.ok(jsonResult.profile);
});

test('x oauth callback rejects forged brandId and never returns tokens in response JSON', async (t) => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    xId: process.env.X_CLIENT_ID,
    xSec: process.env.X_CLIENT_SECRET,
  };
  process.env.SUPABASE_URL = 'https://auth.spark.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
  process.env.X_CLIENT_ID = 'test-x-client-id';
  process.env.X_CLIENT_SECRET = 'test-x-client-secret';
  t.after(() => {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previous.key;
    if (previous.xId === undefined) delete process.env.X_CLIENT_ID; else process.env.X_CLIENT_ID = previous.xId;
    if (previous.xSec === undefined) delete process.env.X_CLIENT_SECRET; else process.env.X_CLIENT_SECRET = previous.xSec;
  });

  const brandId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const legitUserId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const attackerUserId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  t.mock.method(globalThis, 'fetch', async (input: any, init: any) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: legitUserId }));
    if (url.pathname === '/rest/v1/brands') {
      return new Response(JSON.stringify({ id: brandId, owner_id: legitUserId }));
    }
    if (url.pathname === '/rest/v1/accounts') {
      return new Response(JSON.stringify([]));
    }
    if (url.hostname === 'api.twitter.com') {
      if (url.pathname.includes('/users/me')) {
        return new Response(JSON.stringify({
          data: {
            id: 'x123',
            username: 'spark_official',
            name: 'Spark',
          },
        }));
      }
      return new Response(JSON.stringify({
        access_token: 'secret-x-access-token',
        refresh_token: 'secret-x-refresh-token',
        expires_in: 7200,
        token_type: 'Bearer',
      }));
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });

  let status = 0;
  let jsonResult: any = null;
  const res = {
    setHeader() { return this; },
    status(value: number) { status = value; return this; },
    json(obj: any) { jsonResult = obj; return this; },
  } as any;

  // 1. Legitimate user succeeds and tokens are omitted
  const statePayload = Buffer.from(JSON.stringify({ brandId, userId: legitUserId })).toString('base64url');
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer verified-session' },
    body: {
      code: 'auth-code',
      code_verifier: 'code-verifier-12345',
      state: `spark_oauth_12345_${statePayload}`,
      redirect_uri: 'https://spark.invalid/callback',
      workspace_id: brandId,
    },
  } as any;

  const xCallback = (await import('../auth/x/callback.js')).default;
  await xCallback(req, res);
  assert.equal(status, 200);
  assert.equal(jsonResult.access_token, undefined, 'access_token must not be returned');
  assert.equal(jsonResult.refresh_token, undefined, 'refresh_token must not be returned');
  assert.equal(jsonResult.success, true);
  assert.ok(jsonResult.profile);

  // 2. Attacker cannot forge brand
  const forgedState = Buffer.from(JSON.stringify({ brandId, userId: attackerUserId })).toString('base64url');
  const forgedReq = {
    method: 'POST',
    headers: { authorization: 'Bearer verified-session' },
    body: {
      code: 'auth-code',
      code_verifier: 'code-verifier-12345',
      state: `spark_oauth_12345_${forgedState}`,
      redirect_uri: 'https://spark.invalid/callback',
      workspace_id: brandId,
    },
  } as any;

  await xCallback(forgedReq, res);
  assert.equal(status, 403);
});
