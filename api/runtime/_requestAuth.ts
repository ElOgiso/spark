import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Validate the bearer with Auth; decoded client claims are never authorization. */
export async function requireRuntimeUser(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const header = req.headers?.authorization;
  const token = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header)?.[1] : undefined;
  if (!token) {
    res.status(401).json({ error: 'Sign in to use Spark generation.' });
    return null;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(503).json({ error: 'Runtime authentication is not configured.' });
    return null;
  }
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Session expired. Sign in again.' });
      return null;
    }
    const { data: profile, error: profileError } = await client.from('profiles')
      .select('access_status').eq('id', data.user.id).maybeSingle();
    if (profileError || profile?.access_status !== 'active') {
      res.status(403).json({ error: 'An active Spark account is required.' });
      return null;
    }
    const brandId = req.body?.brandId;
    if (brandId !== undefined) {
      const { data: brand, error: brandError } = await client.from('brands')
        .select('id').eq('id', brandId).eq('owner_id', data.user.id).maybeSingle();
      if (brandError || !brand) {
        res.status(403).json({ error: 'Brand access denied.' });
        return null;
      }
    }
    return data.user.id;
  } catch {
    res.status(503).json({ error: 'Unable to verify session.' });
    return null;
  }
}
