import { getSupabaseClient } from './supabaseClient';

/** Attach Spark's session only to our own runtime, never to a provider URL. */
export async function runtimeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!path.startsWith('/api/runtime/')) return fetch(input, init);
  const client = getSupabaseClient();
  const session = client ? await client.auth.getSession() : null;
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const token = session?.data.session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
