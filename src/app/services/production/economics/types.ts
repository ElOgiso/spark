/**
 * SPARK Phase 7 — Cost Engine & Economic Optimization Contracts.
 *
 * Defines the canonical data structures for provider-side economics,
 * pre-flight cost estimation, post-generation actual usage accounting,
 * attempt-level cost accumulation, and pricing provenance.
 *
 * NOTE: Provider economics are distinct from Spark Credits (Phase 8).
 * All monetary amounts are canonical USD numbers.
 */

import type { MediaModality, GenerationMode } from "../capability/types";

export type CostStatus = "EXACT" | "ESTIMATED" | "UNKNOWN" | "FAILED";

export type PricingSourceType =
  | "OFFICIAL_PROVIDER"
  | "PROVIDER_API"
  | "ADMIN_CONFIG"
  | "INTERNAL_ESTIMATE"
  | "UNKNOWN";

export type BillingScheme =
  | "flat_per_generation"
  | "per_second"
  | "per_image"
  | "per_character"
  | "configuration_tiered";

export interface PricingProvenance {
  source: string;
  sourceType: PricingSourceType;
  confidence: number; // 0.0 to 1.0
  verifiedAt?: string;
  notes?: string;
}

export interface CostBreakdown {
  baseAmount?: number;
  durationCost?: number;
  resolutionModifier?: number;
  audioCost?: number;
  configurationModifiers?: number;
  inputReferenceCost?: number;
  otherCharges?: number;
  details?: Record<string, number>;
}

export interface PricingRule {
  providerId: string;
  modelId: string;
  modality: MediaModality;
  currency: "USD";
  billingScheme: BillingScheme;
  baseRateUsd?: number;
  ratePerSecondUsd?: number;
  ratePerImageUsd?: number;
  ratePer1kCharactersUsd?: number;
  durationMultipliers?: Record<number, number>;
  resolutionMultipliers?: Record<string, number>;
  audioAddOnUsd?: number;
  provenance: PricingProvenance;
  effectiveFrom: string;
  effectiveTo?: string;
  pricingVersion: string;
}

export interface CostEstimationRequest {
  providerId: string;
  modelId: string;
  modality: MediaModality;
  generationMode?: GenerationMode;
  durationSeconds?: number;
  resolution?: string;
  aspectRatio?: string;
  includeAudio?: boolean;
  referenceCount?: number;
  characterCount?: number;
  imageCount?: number;
  configuration?: Record<string, unknown>;
}

export interface CostEstimate {
  providerId: string;
  modelId: string;
  modality: MediaModality;
  currency: "USD";
  amount: number | null; // null when status is UNKNOWN or FAILED
  unit: "per_generation" | "per_second" | "per_image" | "per_character" | "per_minute";
  quantity: number;
  status: CostStatus;
  pricingVersion: string;
  pricingSource: PricingProvenance;
  breakdown?: CostBreakdown;
  minAmount?: number | null;
  maxAmount?: number | null;
}

export interface ProviderUsageReport {
  durationSeconds?: number;
  resolution?: string;
  imageCount?: number;
  characterCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  computeUnits?: number;
  billedDurationSeconds?: number;
  raw?: Record<string, unknown>;
}

export interface AttemptCostRecord {
  attemptIndex: number;
  providerJobId?: string;
  status: "succeeded" | "failed" | "timeout" | "unknown";
  amount: number | null;
  costStatus: CostStatus;
  currency: "USD";
  usage?: ProviderUsageReport;
  timestamp: string;
  error?: string;
}

export interface ActualCostCalculationRequest {
  providerId: string;
  modelId: string;
  modality: MediaModality;
  usage?: ProviderUsageReport;
  requestConfig?: CostEstimationRequest;
  estimateId?: string;
  submissionState?: "succeeded" | "failed" | "timeout" | "unknown";
}

export interface ActualProviderCost {
  providerId: string;
  modelId: string;
  modality: MediaModality;
  currency: "USD";
  amount: number | null;
  status: CostStatus;
  pricingVersion: string;
  pricingSource: PricingProvenance;
  breakdown?: CostBreakdown;
  usage?: ProviderUsageReport;
  attempts?: AttemptCostRecord[];
  accumulatedCost?: number | null;
  estimateId?: string;
}

export interface BudgetEvaluationResult {
  approved: boolean;
  reason: "UNDER_BUDGET" | "EXCEEDS_BUDGET" | "UNKNOWN_COST";
  maxProviderCost?: number;
  estimatedCost: number | null;
  costStatus: CostStatus;
  detail: string;
}
