/** Validate destinations before attaching server credentials. Never follow redirects. */
export function providerEndpoint(provider: string, endpoint: unknown): string {
  const hosts: Record<string, string> = {
    openai: 'api.openai.com', anthropic: 'api.anthropic.com',
    google: 'generativelanguage.googleapis.com', gemini: 'generativelanguage.googleapis.com',
    xai: 'api.x.ai', grok: 'api.x.ai', elevenlabs: 'api.elevenlabs.io',
    higgsfield: 'api.higgsfield.ai',
  };
  const host = hosts[provider];
  if (!host || typeof endpoint !== 'string' || !endpoint.trim()) throw new Error('Unsupported provider endpoint');
  const url = new URL(endpoint, provider === 'higgsfield' ? `https://${host}/` : undefined);
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || url.hash) {
    throw new Error('Unsupported provider endpoint');
  }
  return url.toString();
}
