import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLiveAndStaticCatalog,
  clearLiveCatalogCache,
} from './_modelCatalogLive.js';
import {
  MODEL_CATALOG,
  getModelsForProviderAndCapability,
  getModelLabel,
  mergeLiveModelsIntoCatalog,
  clearClientLiveCatalog,
} from '../../src/app/services/runtime/modelCatalog.js';
import { listImageModelsForProvider, saveGeneratorLocalAiPreference } from '../../src/app/services/runtime/generatorLocalAiPreference.js';
import { listVideoModelsForProvider, buildPreferredVideoAiPreferenceUpdate } from '../../src/app/services/runtime/preferredVideoAiPreference.js';

test('Hybrid Live Model Catalog — Baseline and Static Spine', async () => {
  clearLiveCatalogCache();
  const catalog = await getLiveAndStaticCatalog(true);

  assert.equal(catalog.status, 'ok');
  assert.equal(catalog.source, 'live+static');
  assert.ok(typeof catalog.fetchedAt === 'number');

  // Verify all providers exist
  const expectedProviders = [
    'openai',
    'claude',
    'gemini',
    'grok',
    'kling',
    'seedance',
    'elevenlabs',
    'higgsfield',
  ];
  for (const prov of expectedProviders) {
    assert.ok(catalog.modelsByProvider[prov], `Provider ${prov} must exist in modelsByProvider`);
    assert.ok(catalog.modelsByProvider[prov].length > 0, `Provider ${prov} must have models`);
  }

  // Verify Higgsfield static spine is kept without fake live calls
  const higgsfieldModels = catalog.modelsByProvider.higgsfield;
  const soul2 = higgsfieldModels.find((m) => m.id === 'soul-2');
  assert.ok(soul2, 'soul-2 must exist in higgsfield models');
  assert.ok(soul2.recommended, 'soul-2 must remain recommended');

  const seedance25 = higgsfieldModels.find((m) => m.id === 'seedance-2.5-i2v' || m.id === 'seedance-2.5');
  assert.ok(seedance25, 'seedance-2.5-i2v must exist in higgsfield models');
  assert.ok(seedance25.recommended, 'seedance-2.5-i2v must remain recommended');
});

test('Hybrid Live Model Catalog — Policy Filtering and Normalization', async () => {
  // Test client-side merge with simulated live models from server
  clearClientLiveCatalog();

  const mockOpenAiLive = [
    {
      id: 'gpt-5.6', // existing in static
      label: 'GPT-5.6 Flagship',
      capabilities: ['Chat', 'Reasoning', 'Vision', 'Video Understanding'] as any[],
      source: 'live+static' as const,
      status: 'stable' as const,
    },
    {
      id: 'gpt-4.5-preview-2026', // brand new live model
      label: 'GPT-4.5 Preview 2026',
      capabilities: ['Chat', 'Reasoning', 'Vision', 'Video Understanding'] as any[],
      source: 'live' as const,
      status: 'stable' as const,
    },
    {
      id: 'gpt-image-2.0', // brand new image model
      label: 'GPT Image 2.0 (OpenAI Live)',
      capabilities: ['Image Generation'] as any[],
      source: 'live' as const,
      status: 'stable' as const,
    },
  ];

  const mockGrokLive = [
    {
      id: 'grok-3-vision', // new live model
      label: 'Grok 3 Vision',
      capabilities: ['Chat', 'Reasoning', 'Vision', 'Video Understanding'] as any[],
      source: 'live' as const,
      status: 'stable' as const,
    },
    {
      id: 'grok-imagine-video-ultra', // new video model
      label: 'Grok Imagine Video Ultra',
      capabilities: ['Video Generation'] as any[],
      source: 'live' as const,
      status: 'stable' as const,
    },
  ];

  mergeLiveModelsIntoCatalog({
    openai: mockOpenAiLive,
    grok: mockGrokLive,
  });

  // 1. Check getModelsForProviderAndCapability for Chat
  const openaiChatModels = getModelsForProviderAndCapability('openai', 'Chat');
  assert.ok(openaiChatModels.some((m) => m.id === 'gpt-4.5-preview-2026'), 'New live model must be included in Chat models');
  assert.ok(openaiChatModels.some((m) => m.id === 'gpt-5.6'), 'Existing static model must be preserved');

  // 2. Check getModelLabel resolves new live model
  const label = getModelLabel('openai', 'gpt-4.5-preview-2026');
  assert.equal(label, 'GPT-4.5 Preview 2026');

  // 3. Check generatorLocalAiPreference image models include gpt-image-2.0
  const imageModels = listImageModelsForProvider('openai');
  assert.ok(imageModels.some((m) => m.id === 'gpt-image-2.0'), 'New live image model must be in imageModels');

  // User can select and persist the new live model
  const brandId = '00000000-0000-4000-8000-000000000099';
  const savedPref = saveGeneratorLocalAiPreference('characterStudio', brandId, {
    providerId: 'openai',
    modelId: 'gpt-image-2.0',
  });
  assert.equal(savedPref.modelId, 'gpt-image-2.0');

  // 4. Check preferredVideoAiPreference video models include grok-imagine-video-ultra
  const videoModels = listVideoModelsForProvider('grok');
  assert.ok(videoModels.some((m) => m.id === 'grok-imagine-video-ultra'), 'New live video model must be in videoModels');

  // User can select and persist the new live video model
  const videoUpdate = buildPreferredVideoAiPreferenceUpdate({
    providerId: 'grok',
    modelId: 'grok-imagine-video-ultra',
  });
  assert.equal(videoUpdate.formatPatch.preferredVideoModel, 'grok-imagine-video-ultra');
  assert.equal(videoUpdate.aiSettings.models.videoGeneration, 'grok-imagine-video-ultra');

  clearClientLiveCatalog();
});

test('Hybrid Live Model Catalog — Mocked Upstream Provider Live Fetchers', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  try {
    process.env.OPENAI_API_KEY = 'mock-openai-key';
    process.env.XAI_API_KEY = 'mock-xai-key';
    process.env.GEMINI_API_KEY = 'mock-gemini-key';
    process.env.ANTHROPIC_API_KEY = 'mock-anthropic-key';
    process.env.ELEVENLABS_API_KEY = 'mock-elevenlabs-key';

    globalThis.fetch = (async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('api.openai.com')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'gpt-4.5-preview' },
              { id: 'text-embedding-3-small' },
              { id: 'dall-e-3' },
              { id: 'o3-mini' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('api.x.ai')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'grok-3-latest' },
              { id: 'grok-imagine-video-pro' },
              { id: 'text-embedding-grok' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            models: [
              { name: 'models/veo-2.0-generate-preview', displayName: 'Veo 2 Preview' },
              { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
              { name: 'models/embedding-001' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('api.anthropic.com')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'claude-3-7-sonnet-latest', display_name: 'Claude 3.7 Sonnet' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('api.elevenlabs.io')) {
        return new Response(
          JSON.stringify([
            { model_id: 'eleven_flash_v2_5', name: 'Eleven Flash V2.5', can_do_text_to_speech: true },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('{}', { status: 404 });
    }) as any;

    clearLiveCatalogCache();
    const result = await getLiveAndStaticCatalog(true);

    // 1. OpenAI checks
    const openai = result.modelsByProvider.openai;
    assert.ok(openai.some((m) => m.id === 'gpt-4.5-preview'), 'gpt-4.5-preview must be live');
    assert.ok(openai.some((m) => m.id === 'o3-mini'), 'o3-mini must be live');
    assert.ok(!openai.some((m) => m.id.includes('embedding')), 'Embeddings must be filtered out');

    // 2. Grok checks
    const grok = result.modelsByProvider.grok;
    const grokVideo = grok.find((m) => m.id === 'grok-imagine-video-pro');
    assert.ok(grokVideo, 'grok-imagine-video-pro must be present');
    assert.ok(grokVideo.capabilities.includes('Video Generation'), 'grok-imagine-video-pro must have Video Generation capability');
    assert.ok(!grok.some((m) => m.id.includes('embedding')), 'Embeddings must be filtered out from Grok');

    // 3. Gemini checks
    const gemini = result.modelsByProvider.gemini;
    const veo = gemini.find((m) => m.id === 'veo-2.0-generate-preview');
    assert.ok(veo, 'veo-2.0-generate-preview must be present without models/ prefix');
    assert.ok(veo.capabilities.includes('Video Generation'), 'veo must have Video Generation');
    assert.ok(!gemini.some((m) => m.id.includes('embedding')), 'Embedding models must be filtered out from Gemini');

    // 4. Claude checks
    const claude = result.modelsByProvider.claude;
    assert.ok(claude.some((m) => m.id === 'claude-3-7-sonnet-latest'), 'claude-3-7-sonnet-latest must be present');

    // 5. ElevenLabs checks
    const elevenlabs = result.modelsByProvider.elevenlabs;
    assert.ok(elevenlabs.some((m) => m.id === 'eleven_flash_v2_5'), 'eleven_flash_v2_5 must be present');
    const flashModel = elevenlabs.find((m) => m.id === 'eleven_flash_v2_5');
    assert.ok(flashModel?.capabilities.includes('Text To Speech'), 'ElevenLabs model must have Text To Speech');
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    clearLiveCatalogCache();
  }
});

