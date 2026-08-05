import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, endpoint, payload } = req.body;

    const keys = {
      openai: process.env.OPEN_AI_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_AI_API_KEY,
      xai: process.env.XAI_API_KEY
    };

    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    let targetUrl = endpoint;

    if (provider === 'openai') {
      headers['Authorization'] = `Bearer ${keys.openai || ''}`;
    } else if (provider === 'anthropic') {
      headers['x-api-key'] = keys.anthropic || '';
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (provider === 'google') {
      const delimiter = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${delimiter}key=${keys.google || ''}`;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const responseData = await response.json();
    return res.status(200).json(responseData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
