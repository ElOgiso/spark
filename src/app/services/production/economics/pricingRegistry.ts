/**
 * SPARK Phase 7 — Pricing Registry.
 *
 * Canonical registry for verified provider/model pricing rules with full
 * provenance tracking (source, sourceType, confidence, effectiveDates).
 * Supports exact lookups, overrides, registration, and test reset.
 */

import type { PricingRule, PricingProvenance } from "./types";

export const DEFAULT_PRICING_RULES: PricingRule[] = [
  // Kling AI
  {
    providerId: "kling",
    modelId: "kling-v1-6",
    modality: "video",
    currency: "USD",
    billingScheme: "per_second",
    ratePerSecondUsd: 0.07,
    resolutionMultipliers: { "720p": 1.0, "1080p": 1.5 },
    audioAddOnUsd: 0.05,
    provenance: {
      source: "Kling AI Official API Pricing 2026",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 0.95,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      notes: "Standard Kling 1.6 video tier: $0.07/sec, 1.5x for 1080p",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "kling-2026.1",
  },
  {
    providerId: "kling",
    modelId: "kling-v2-6",
    modality: "video",
    currency: "USD",
    billingScheme: "per_second",
    ratePerSecondUsd: 0.07,
    resolutionMultipliers: { "720p": 1.0, "1080p": 1.5 },
    audioAddOnUsd: 0.05,
    provenance: {
      source: "Kling AI Official API Pricing 2026",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 0.95,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      notes: "Standard Kling 2.6 video tier: $0.07/sec, 1.5x for 1080p",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "kling-2026.1",
  },

  // ByteDance / Seedance
  {
    providerId: "bytedance",
    modelId: "seedance-v1",
    modality: "video",
    currency: "USD",
    billingScheme: "per_second",
    ratePerSecondUsd: 0.06,
    resolutionMultipliers: { "720p": 1.0, "1080p": 1.4 },
    provenance: {
      source: "ByteDance Ark Official Pricing",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 0.90,
      verifiedAt: "2026-08-15T00:00:00.000Z",
      notes: "Seedance v1 standard generation rate",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "seedance-2026.1",
  },
  {
    providerId: "bytedance",
    modelId: "bytedance/seedance-v1",
    modality: "video",
    currency: "USD",
    billingScheme: "per_second",
    ratePerSecondUsd: 0.06,
    resolutionMultipliers: { "720p": 1.0, "1080p": 1.4 },
    provenance: {
      source: "ByteDance Ark Official Pricing",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 0.90,
      verifiedAt: "2026-08-15T00:00:00.000Z",
      notes: "Seedance v1 fully-qualified name",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "seedance-2026.1",
  },

  // Grok / xAI
  {
    providerId: "grok",
    modelId: "grok-imagine",
    modality: "image",
    currency: "USD",
    billingScheme: "per_image",
    ratePerImageUsd: 0.05,
    provenance: {
      source: "xAI Developer Documentation",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 0.90,
      verifiedAt: "2026-08-01T00:00:00.000Z",
      notes: "Grok Imagine single output rate",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "grok-2026.1",
  },

  // OpenAI
  {
    providerId: "openai",
    modelId: "dall-e-3",
    modality: "image",
    currency: "USD",
    billingScheme: "per_image",
    ratePerImageUsd: 0.04,
    resolutionMultipliers: { "1024x1024": 1.0, "1024x1792": 2.0, "1792x1024": 2.0 },
    provenance: {
      source: "OpenAI Pricing Page",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 1.0,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      notes: "DALL-E 3 standard 1024x1024 is $0.040, HD/widescreen is $0.080",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "openai-2026.1",
  },
  {
    providerId: "openai",
    modelId: "sora",
    modality: "video",
    currency: "USD",
    billingScheme: "per_second",
    ratePerSecondUsd: 0.20,
    resolutionMultipliers: { "720p": 1.0, "1080p": 1.5 },
    provenance: {
      source: "OpenAI Video API Benchmark Estimation",
      sourceType: "INTERNAL_ESTIMATE",
      confidence: 0.75,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      notes: "Internal estimate pending public self-serve API pricing",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "openai-2026.1",
  },
  {
    providerId: "openai",
    modelId: "tts-1",
    modality: "audio",
    currency: "USD",
    billingScheme: "per_character",
    ratePer1kCharactersUsd: 0.015,
    provenance: {
      source: "OpenAI Audio API Pricing",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 1.0,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      notes: "OpenAI TTS standard rate: $0.015 / 1,000 characters",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "openai-2026.1",
  },

  // ElevenLabs
  {
    providerId: "elevenlabs",
    modelId: "eleven_multilingual_v2",
    modality: "audio",
    currency: "USD",
    billingScheme: "per_character",
    ratePer1kCharactersUsd: 0.30,
    provenance: {
      source: "ElevenLabs API Tier Rate Table",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 0.95,
      verifiedAt: "2026-08-20T00:00:00.000Z",
      notes: "ElevenLabs standard tier: $0.30 / 1,000 characters",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "elevenlabs-2026.1",
  },

  // Google Veo
  {
    providerId: "gemini",
    modelId: "veo-2",
    modality: "video",
    currency: "USD",
    billingScheme: "per_second",
    ratePerSecondUsd: 0.15,
    resolutionMultipliers: { "720p": 1.0, "1080p": 1.5 },
    provenance: {
      source: "Google Cloud Vertex AI Pricing Preview",
      sourceType: "OFFICIAL_PROVIDER",
      confidence: 0.85,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      notes: "Google Veo 2 preview rate",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "google-2026.1",
  },

  // Higgsfield
  {
    providerId: "higgsfield",
    modelId: "seedance-2.5-r2v",
    modality: "video",
    currency: "USD",
    billingScheme: "per_second",
    ratePerSecondUsd: 0.08,
    provenance: {
      source: "Higgsfield Documentation",
      sourceType: "PROVIDER_API",
      confidence: 0.85,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      notes: "Higgsfield Seedance 2.5 R2V rate",
    },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingVersion: "higgsfield-2026.1",
  },
];

class PricingRegistryImpl {
  private rules: Map<string, PricingRule> = new Map();

  constructor() {
    this.reset();
  }

  private key(providerId: string, modelId: string): string {
    return `${providerId.toLowerCase()}::${modelId.toLowerCase()}`;
  }

  /** Look up a pricing rule by providerId and modelId. */
  getPricingRule(providerId: string, modelId: string): PricingRule | null {
    const direct = this.rules.get(this.key(providerId, modelId));
    if (direct) return direct;

    // Optional provider-wide wildcard fallback
    const wildcard = this.rules.get(this.key(providerId, "*"));
    if (wildcard) return wildcard;

    return null;
  }

  /** Register or update a pricing rule. */
  registerPricingRule(rule: PricingRule): void {
    this.rules.set(this.key(rule.providerId, rule.modelId), { ...rule });
  }

  /** List all active pricing rules. */
  getAllPricingRules(): PricingRule[] {
    return Array.from(this.rules.values());
  }

  /** Reset registry to default seeded rules (for testing). */
  reset(): void {
    this.rules.clear();
    for (const rule of DEFAULT_PRICING_RULES) {
      this.rules.set(this.key(rule.providerId, rule.modelId), { ...rule });
    }
  }
}

export const PricingRegistry = new PricingRegistryImpl();
