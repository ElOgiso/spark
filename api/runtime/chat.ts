import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health/status probe for the SPARK runtime edge.
 * Client chat orchestration runs in the browser OS layer (IntentRouter).
 * Live model traffic uses /api/runtime/execute with server-side keys.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const keys = {
    openai: Boolean(process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || process.env.VITE_OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.VITE_ANTHROPIC_API_KEY),
    google: Boolean(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY),
    xai: Boolean(process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.VITE_XAI_API_KEY),
  };

  return res.status(200).json({
    status: "ok",
    service: "spark-runtime-chat",
    message: "Chat gateway healthy. Model calls require /api/runtime/execute + provider keys.",
    providersConfigured: keys,
    anyProviderConfigured: Object.values(keys).some(Boolean),
  });
}
