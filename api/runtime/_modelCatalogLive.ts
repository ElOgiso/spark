import { MODEL_CATALOG, type ProviderModel, type ModelCapability } from '../../src/app/services/runtime/modelCatalog.js';
import type { AIProviderId } from '../../src/app/domain/types.js';

export interface LiveCatalogModel extends ProviderModel {
  source: 'live' | 'static' | 'live+static';
  raw?: any;
}

export interface LiveCatalogResult {
  status: 'ok';
  providers: Record<string, boolean>;
  modelsByProvider: Record<string, LiveCatalogModel[]>;
  fetchedAt: number;
  source: 'live+static';
}

interface CacheEntry {
  timestamp: number;
  result: LiveCatalogResult;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 6000; // 6s per upstream

let memoryCache: CacheEntry | null = null;
let inflightPromise: Promise<LiveCatalogResult> | null = null;

function getProviderKey(provider: string): string | undefined {
  const p = process.env;
  switch (provider) {
    case 'openai':
      return p.OPENAI_API_KEY || p.OPEN_AI_KEY || p.VITE_OPENAI_API_KEY;
    case 'grok':
    case 'xai':
      return p.XAI_API_KEY || p.GROK_API_KEY || p.VITE_XAI_API_KEY;
    case 'gemini':
    case 'google':
      return p.GOOGLE_AI_API_KEY || p.GEMINI_API_KEY || p.VITE_GEMINI_API_KEY || p.VITE_GOOGLE_AI_API_KEY;
    case 'claude':
    case 'anthropic':
      return p.ANTHROPIC_API_KEY || p.CLAUDE_API_KEY || p.VITE_ANTHROPIC_API_KEY;
    case 'elevenlabs':
      return p.elevenlabs_API_Key || p.ELEVENLABS_API_KEY || p.ELEVEN_LABS_API_KEY || p.VITE_ELEVENLABS_API_KEY;
    default:
      return undefined;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Provider Live Fetchers
// ---------------------------------------------------------------------------

async function fetchOpenAiLiveModels(key: string): Promise<LiveCatalogModel[]> {
  const res = await fetchWithTimeout('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`OpenAI models HTTP ${res.status}`);
  const json: any = await res.json();
  const data: Array<{ id: string }> = Array.isArray(json?.data) ? json.data : [];

  const denySubstrings = [
    'embedding',
    'moderation',
    'whisper',
    'babbage',
    'davinci',
    'curie',
    'ada',
    'canary',
    'ft:',
    'instruct',
    'realtime-preview',
    'audio-preview',
  ];

  const allowPrefixes = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-', 'dall-e-', 'tts-1'];

  const liveModels: LiveCatalogModel[] = [];

  for (const item of data) {
    const id = item.id.toLowerCase();
    if (denySubstrings.some((d) => id.includes(d))) continue;
    if (!allowPrefixes.some((p) => id.startsWith(p))) continue;

    let capabilities: ModelCapability[] = ['Chat', 'Reasoning'];
    if (id.startsWith('dall-e') || id.includes('image')) {
      capabilities = ['Image Generation'];
    } else if (id.startsWith('tts-1')) {
      capabilities = ['Text To Speech'];
    } else if (id.includes('vision') || id.includes('4o') || id.includes('5')) {
      capabilities = ['Chat', 'Reasoning', 'Vision', 'Video Understanding'];
    } else if (id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) {
      capabilities = ['Chat', 'Reasoning'];
    }

    liveModels.push({
      id: item.id,
      label: `${item.id}`,
      capabilities,
      source: 'live',
      status: 'stable',
    });
  }

  return liveModels;
}

async function fetchGrokLiveModels(key: string): Promise<LiveCatalogModel[]> {
  const res = await fetchWithTimeout('https://api.x.ai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`xAI models HTTP ${res.status}`);
  const json: any = await res.json();
  const data: Array<{ id: string }> = Array.isArray(json?.data) ? json.data : [];

  const liveModels: LiveCatalogModel[] = [];

  for (const item of data) {
    const id = item.id.toLowerCase();
    if (id.includes('embedding') || id.includes('moderation')) continue;

    let capabilities: ModelCapability[] = ['Chat', 'Reasoning', 'Vision', 'Video Understanding'];
    if (id.includes('video') || id.includes('imagine-video')) {
      capabilities = ['Video Generation'];
    } else if (id.includes('image') || id.includes('imagine')) {
      capabilities = ['Image Generation'];
    }

    liveModels.push({
      id: item.id,
      label: item.id,
      capabilities,
      source: 'live',
      status: 'stable',
    });
  }

  return liveModels;
}

async function fetchGeminiLiveModels(key: string): Promise<LiveCatalogModel[]> {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    { method: 'GET' }
  );
  if (!res.ok) throw new Error(`Gemini models HTTP ${res.status}`);
  const json: any = await res.json();
  const models: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }> = Array.isArray(
    json?.models
  )
    ? json.models
    : [];

  const liveModels: LiveCatalogModel[] = [];

  for (const item of models) {
    const cleanId = item.name.replace(/^models\//, '');
    const lower = cleanId.toLowerCase();

    if (
      lower.includes('embedding') ||
      lower.includes('aqa') ||
      lower.includes('bison') ||
      lower.includes('tuning') ||
      lower.includes('learnlm')
    ) {
      continue;
    }

    let capabilities: ModelCapability[] = ['Chat', 'Reasoning', 'Vision', 'Video Understanding'];
    if (lower.startsWith('veo') || lower.includes('video')) {
      capabilities = ['Video Generation'];
    } else if (lower.startsWith('imagen') || lower.includes('image')) {
      capabilities = ['Image Generation'];
    }

    liveModels.push({
      id: cleanId,
      label: item.displayName ? `${item.displayName} (${cleanId})` : cleanId,
      capabilities,
      source: 'live',
      status: 'stable',
    });
  }

  return liveModels;
}

async function fetchClaudeLiveModels(key: string): Promise<LiveCatalogModel[]> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) throw new Error(`Claude models HTTP ${res.status}`);
  const json: any = await res.json();
  const data: Array<{ id: string; display_name?: string }> = Array.isArray(json?.data) ? json.data : [];

  const liveModels: LiveCatalogModel[] = [];

  for (const item of data) {
    if (!item.id.toLowerCase().startsWith('claude')) continue;

    liveModels.push({
      id: item.id,
      label: item.display_name ? `${item.display_name} (${item.id})` : item.id,
      capabilities: ['Chat', 'Reasoning', 'Vision', 'Video Understanding'],
      source: 'live',
      status: 'stable',
    });
  }

  return liveModels;
}

async function fetchElevenLabsLiveModels(key: string): Promise<LiveCatalogModel[]> {
  const res = await fetchWithTimeout('https://api.elevenlabs.io/v1/models', {
    method: 'GET',
    headers: { 'xi-api-key': key },
  });
  if (!res.ok) throw new Error(`ElevenLabs models HTTP ${res.status}`);
  const data: Array<{ model_id: string; name?: string; can_do_text_to_speech?: boolean }> = await res.json();

  const liveModels: LiveCatalogModel[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.can_do_text_to_speech === false) continue;
      liveModels.push({
        id: item.model_id,
        label: item.name ? `${item.name} (${item.model_id})` : item.model_id,
        capabilities: ['Text To Speech'],
        source: 'live',
        status: 'stable',
      });
    }
  }

  return liveModels;
}

// ---------------------------------------------------------------------------
// Hybrid Merger: Static Spine + Live Models
// ---------------------------------------------------------------------------

function mergeStaticAndLiveForProvider(
  provider: AIProviderId,
  staticModels: ProviderModel[],
  liveModels: LiveCatalogModel[]
): LiveCatalogModel[] {
  const result: LiveCatalogModel[] = [];
  const seenIds = new Set<string>();

  // 1. Static models always form the baseline and priority
  for (const m of staticModels) {
    const normalizedId = m.id.trim();
    seenIds.add(normalizedId.toLowerCase());

    const isAlsoInLive = liveModels.some((l) => l.id.trim().toLowerCase() === normalizedId.toLowerCase());
    result.push({
      ...m,
      source: isAlsoInLive ? 'live+static' : 'static',
    });
  }

  // 2. Append new live models not present in static catalog
  for (const l of liveModels) {
    const normalizedId = l.id.trim();
    if (!seenIds.has(normalizedId.toLowerCase())) {
      seenIds.add(normalizedId.toLowerCase());
      result.push(l);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main Public Resolver
// ---------------------------------------------------------------------------

export async function getLiveAndStaticCatalog(forceRefresh = false): Promise<LiveCatalogResult> {
  const now = Date.now();
  if (!forceRefresh && memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.result;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const providersStatus: Record<string, boolean> = {
        openai: Boolean(getProviderKey('openai')),
        grok: Boolean(getProviderKey('grok')),
        xai: Boolean(getProviderKey('grok')),
        gemini: Boolean(getProviderKey('gemini')),
        google: Boolean(getProviderKey('gemini')),
        claude: Boolean(getProviderKey('claude')),
        anthropic: Boolean(getProviderKey('claude')),
        elevenlabs: Boolean(getProviderKey('elevenlabs')),
      };

      // Check Higgsfield via helper if available
      try {
        const { resolveHiggsfieldCredentials } = await import('./_higgsfieldClient.js');
        providersStatus.higgsfield = Boolean(resolveHiggsfieldCredentials());
      } catch {
        providersStatus.higgsfield = false;
      }

      // Concurrently fetch live models for keyed providers (safe per provider)
      const [openaiLive, grokLive, geminiLive, claudeLive, elevenlabsLive] = await Promise.all([
        providersStatus.openai ? fetchOpenAiLiveModels(getProviderKey('openai')!).catch(() => []) : Promise.resolve([]),
        providersStatus.grok ? fetchGrokLiveModels(getProviderKey('grok')!).catch(() => []) : Promise.resolve([]),
        providersStatus.gemini ? fetchGeminiLiveModels(getProviderKey('gemini')!).catch(() => []) : Promise.resolve([]),
        providersStatus.claude ? fetchClaudeLiveModels(getProviderKey('claude')!).catch(() => []) : Promise.resolve([]),
        providersStatus.elevenlabs
          ? fetchElevenLabsLiveModels(getProviderKey('elevenlabs')!).catch(() => [])
          : Promise.resolve([]),
      ]);

      const modelsByProvider: Record<string, LiveCatalogModel[]> = {};

      // Build merged catalog for all known providers in MODEL_CATALOG
      for (const provCatalog of MODEL_CATALOG) {
        const provId = provCatalog.provider;
        let liveList: LiveCatalogModel[] = [];
        if (provId === 'openai') liveList = openaiLive;
        else if (provId === 'grok') liveList = grokLive;
        else if (provId === 'gemini') liveList = geminiLive;
        else if (provId === 'claude') liveList = claudeLive;
        else if (provId === 'elevenlabs') liveList = elevenlabsLive;
        // Higgsfield, Kling, Seedance, Runway, Luma remain static spine only!

        modelsByProvider[provId] = mergeStaticAndLiveForProvider(provId, provCatalog.models, liveList);
      }

      const result: LiveCatalogResult = {
        status: 'ok',
        providers: providersStatus,
        modelsByProvider,
        fetchedAt: Date.now(),
        source: 'live+static',
      };

      memoryCache = { timestamp: Date.now(), result };
      return result;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

export function clearLiveCatalogCache(): void {
  memoryCache = null;
  inflightPromise = null;
}
