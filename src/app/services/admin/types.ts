/**
 * SPARK Phase 19 — Admin Economics & Operations Contracts.
 *
 * Permanent Architectural Law: SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 * Admin is an authoritative visibility and controlled operational layer over
 * existing canonical authorities (CostEngine, CreditService, Observability, Health).
 *
 * Invariants:
 * 1. Unknown provider cost is NEVER $0.00 — it is UNKNOWN, and margin is undefined.
 * 2. Margin requires both revenue-side valuation and provider actual cost to be known.
 * 3. All administrative mutations fail closed: RPC failure -> return error, never bypass.
 * 4. All administrative mutations write to admin_audit_log.
 */

import type { PricingRule, CostStatus } from "../production/economics/types";
import type { HealthStatus } from "../runtime/serviceHealthMonitor";

export interface AdminEconomicsSummary {
  /** Total credits currently held in active reservations */
  totalCreditsActiveReserved: number;
  /** Total credits permanently settled/consumed */
  totalCreditsSettled: number;
  /** Total credits released back to users */
  totalCreditsReleased: number;
  /** Total credits refunded back to users */
  totalCreditsRefunded: number;
  /** Credits held in PENDING_UNKNOWN reservations (exposure) */
  pendingUnknownExposureCredits: number;
  /** Count of reservations currently in PENDING_UNKNOWN status */
  pendingUnknownCount: number;
  /** Total provider actual costs known in USD */
  totalKnownProviderCostUsd: number;
  /** Total provider estimated costs in USD across active reservations */
  totalEstimatedProviderCostUsd: number;
  /** Count of executions with unknown or unmeasured provider cost */
  unknownProviderCostCount: number;
  /** Overall cost confidence status */
  overallCostStatus: CostStatus;
  /** Nominal revenue value of settled credits based on pricing policy (USD) */
  grossSettledRevenueUsd: number;
  /** Nominal revenue value of pending unknown exposure (USD) */
  pendingUnknownExposureUsd: number;
  /**
   * Actual net margin in USD.
   * STRICT INVARIANT: null if any unknown/unmeasured costs exist in the evaluated period.
   */
  actualMarginUsd: number | null;
  /** Margin percentage (0-100), null if actualMarginUsd is null */
  marginPercentage: number | null;
  /** Active pricing policy version */
  pricingPolicyVersion: string;
  /** Canonical valuation per credit in USD (e.g. 0.01 = $0.01 per credit) */
  creditValuationUsd: number;
  /** Total users count */
  totalUsersCount: number;
  /** Total credits in user balances */
  totalCirculatingCredits: number;
}

export interface AdminReservationItem {
  id: string;
  userId: string;
  userEmail?: string | null;
  generationId: string;
  amount: number;
  status: "ACTIVE" | "SETTLED" | "RELEASED" | "PENDING_UNKNOWN" | "REFUNDED" | string;
  consumedAmount: number;
  releasedAmount: number;
  idempotencyKey: string;
  pricingPolicyVersion: string;
  estimatedProviderCostUsd: number;
  actualProviderCostUsd: number | null;
  actualCostStatus: "EXACT" | "ESTIMATED" | "UNKNOWN";
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AdminPendingUnknownItem {
  reservationId: string;
  userId: string;
  userEmail?: string | null;
  generationId: string;
  amount: number;
  estimatedProviderCostUsd: number;
  actualProviderCostUsd: number | null;
  createdAt: string;
  ageMinutes: number;
  reason?: string;
}

export interface AdminReconciliationBacklogItem {
  id: string;
  reservationId: string;
  userId: string;
  generationId: string;
  amount: number;
  status: string;
  createdAt: string;
  ageMinutes: number;
  requiresAction: boolean;
  recommendedAction: "RECONCILE_NOW" | "RELEASE_CREDITS" | "INSPECT_PROVIDER";
}

export interface AdminProviderHealthItem {
  providerId: string;
  name: string;
  status: HealthStatus;
  latencyMs: number;
  errorRate: number;
  lastCheck: string;
  enabled: boolean;
  pricingRulesCount: number;
  pricingRules: PricingRule[];
}

export interface AdminPricingModelItem {
  providerId: string;
  modelId: string;
  modality: string;
  billingScheme: string;
  rateDescription: string;
  baseRateUsd?: number;
  ratePerSecondUsd?: number;
  ratePerImageUsd?: number;
  ratePer1kCharactersUsd?: number;
  pricingVersion: string;
  provenanceSource: string;
  provenanceType: string;
  confidence: number;
  verifiedAt?: string;
}

export interface AdminOperationsIncidentItem {
  id: string;
  timestamp: string;
  category: "UNKNOWN_EXPOSURE" | "EXECUTION_FAILURE" | "RECONCILIATION_STALL" | "SECURITY_DENIAL";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  metadata?: Record<string, unknown>;
}

export interface AdminPaginationFilter {
  page?: number;
  pageSize?: number;
  status?: string;
  userId?: string;
  providerId?: string;
  since?: string;
  until?: string;
  query?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
