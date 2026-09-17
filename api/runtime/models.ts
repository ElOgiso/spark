import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLiveAndStaticCatalog } from './_modelCatalogLive.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const forceRefresh = req.query?.refresh === 'true' || req.query?.force === 'true';
    const result = await getLiveAndStaticCatalog(forceRefresh);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[models] handler error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to resolve model catalog' });
  }
}
