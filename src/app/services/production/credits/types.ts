/**
/**
 * Canonical Spark Credit domain types.
 * Strict separation: Provider USD (Phase 7) vs Spark Credits (Phase 8).
 */

export type CreditState =
  | "AVAILABLE"
  | "RESERVED"
  | "CONSUMED"
  | "RELEASED"
  | "REFUNDED"
  | "PENDING_UNKNOWN";

export type CreditTransactionType =
  | "RESERVATION"
  | "RELEASE"
  | "CONSUMPTION"
  | "REFUND"
  | "ADMIN_ADJUSTMENT"
  | "PENDING_UNKNOWN";

export interface CreditPricingPolicy {
  version: string;
  creditsPerUsd: number;
  marginMultiplier: number;
  rounding: "ceil" | "round" | "floor";
  minimumCharge: number;
}

export interface CreditQuote {
  quoteId: string;
  generationId: string;
  estimatedProviderCostUsd: number;
  sparkCredits: number;
  pricingPolicyVersion: string;
  roundingPolicy: "ceil" | "round" | "floor";
  isBillable: boolean;
  createdAt: string;
}

export interface CreditReservation {
  id: string;
  userId: string;
  generationId: string;
  amount: number;
  status: CreditState;
  consumedAmount: number;
  releasedAmount: number;
  idempotencyKey: string;
  pricingPolicyVersion: string;
  estimatedProviderCostUsd: number;
  actualProviderCostUsd?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreditSettlement {
  reservationId: string;
  userId: string;
  generationId: string;
  reservedCredits: number;
  consumedCredits: number;
  releasedCredits: number;
  actualProviderCostUsd: number;
  status: "CONSUMED" | "PENDING_UNKNOWN" | "RELEASED";
  settledAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  generationId?: string;
  reservationId?: string;
  type: CreditTransactionType;
  delta: number;
  reason: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
