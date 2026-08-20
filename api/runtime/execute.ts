import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, endpoint, payload, method = 'POST' } = req.body;

    const keys = {
      openai: process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || process.env.VITE_OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.VITE_ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY,
      xai: process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.VITE_XAI_API_KEY,
      elevenlabs: process.env.elevenlabs_API_Key || process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY,
    };

    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    let targetUrl = endpoint;

    if (provider === 'openai') {
      if (!keys.openai) return res.status(400).json({ error: 'OpenAI API Key not configured in Vercel environment variables (OPENAI_API_KEY).' });
      headers['Authorization'] = `Bearer ${keys.openai}`;
    } else if (provider === 'xai' || provider === 'grok') {
      if (!keys.xai) return res.status(400).json({ error: 'xAI Grok API Key not configured in Vercel environment variables (XAI_API_KEY or GROK_API_KEY).' });
      headers['Authorization'] = `Bearer ${keys.xai}`;
    } else if (provider === 'anthropic') {
      if (!keys.anthropic) return res.status(400).json({ error: 'Anthropic Claude API Key not configured in Vercel environment variables (ANTHROPIC_API_KEY).' });
      headers['x-api-key'] = keys.anthropic;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (provider === 'google' || provider === 'gemini') {
      if (!keys.google) return res.status(400).json({ error: 'Google Gemini API Key not configured in Vercel environment variables (GEMINI_API_KEY or GOOGLE_AI_API_KEY).' });
      headers['x-goog-api-key'] = keys.google;
      const delimiter = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${delimiter}key=${keys.google}`;
    } else if (provider === 'elevenlabs') {
      if (!keys.elevenlabs) return res.status(400).json({ error: 'ElevenLabs API Key not configured in Vercel environment variables (ELEVENLABS_API_KEY).' });
      headers['xi-api-key'] = keys.elevenlabs;
    }

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };

    if (method.toUpperCase() !== 'GET' && payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('audio/') || contentType.includes('application/octet-stream') || targetUrl.includes('/audio/speech')) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mime = contentType.includes('audio/') ? contentType.split(';')[0] : 'audio/mpeg';
      return res.status(200).json({
        dataUrl: `data:${mime};base64,${base64}`,
        audioBase64: base64,
        mimeType: mime,
      });
    }

    const responseData = await response.json();
    return res.status(200).json(responseData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}

