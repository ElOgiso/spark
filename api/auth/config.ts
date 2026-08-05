import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless API endpoint to securely expose OAuth client IDs from environment variables
 * to the frontend. Secrets are NEVER returned.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
    const xClientId = process.env.X_CLIENT_ID || process.env.VITE_TWITTER_CLIENT_ID || process.env.VITE_X_CLIENT_ID || '';

    return res.status(200).json({
      googleClientId,
      xClientId,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve configuration', detail: error.message });
  }
}
