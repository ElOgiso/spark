/**
 * Authoritative Credit Service: Single entry point for quoting, reserving, settling, releasing, and refunding Spark Credits.
 */

import type {
  CreditPricingPolicy,
  CreditQuote,
  CreditReservation,
  CreditSettlement,
  CreditTransaction,
} from "./types";
import {
  DEFAULT_PRICING_POLICY,
  convertUsdToCredits,
  getPricingPolicy,
} from "./pricingPolicy";
import {
  ICreditRepository,
  InMemoryCreditRepository,
} from "./creditRepository";

export class CreditService {
  private static instance: CreditService | null = null;
  private repo: ICreditRepository;

  constructor(repo?: ICreditRepository) {
    this.repo = repo || new InMemoryCreditRepository();
  }

  static getInstance(): CreditService {
    if (!CreditService.instance) {
      CreditService.instance = new CreditService();
    }
    return CreditService.instance;
  }

  static setInstance(service: CreditService): void {
    CreditService.instance = service;
  }

  quote(params: {
    estimatedCostUsd: number;
    generationId: string;
    isBillable?: boolean;
    policyVersion?: string;
  }): CreditQuote {
    const policy = getPricingPolicy(params.policyVersion || DEFAULT_PRICING_POLICY.version);
    const isBillable = params.isBillable !== false && params.estimatedCostUsd > 0;
    const credits = convertUsdToCredits(params.estimatedCostUsd, policy, isBillable);

    return {
      quoteId: `quote_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
      generationId: params.generationId,
      estimatedProviderCostUsd: params.estimatedCostUsd,
      sparkCredits: credits,
      pricingPolicyVersion: policy.version,
      roundingPolicy: policy.rounding,
      isBillable,
      createdAt: new Date().toISOString(),
    };
  }

  async reserve(params: {
    quote: CreditQuote;
    userId: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    const key = params.idempotencyKey || `res_key_${params.userId}_${params.quote.generationId}`;
    return this.repo.reserve({
      userId: params.userId,
      generationId: params.quote.generationId,
      amount: params.quote.sparkCredits,
      idempotencyKey: key,
      pricingPolicyVersion: params.quote.pricingPolicyVersion,
      estimatedProviderCostUsd: params.quote.estimatedProviderCostUsd,
      metadata: params.metadata,
    });
  }

  async settle(params: {
    reservationId: string;
    userId: string;
    actualProviderCostUsd: number;
    idempotencyKey?: string;
    policyVersion?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ settlement: CreditSettlement; idempotentReplay: boolean }> {
    const policy = getPricingPolicy(params.policyVersion || DEFAULT_PRICING_POLICY.version);
    const actualCredits = convertUsdToCredits(params.actualProviderCostUsd, policy, params.actualProviderCostUsd > 0);
    const key = params.idempotencyKey || `settle_key_${params.userId}_${params.reservationId}`;

    return this.repo.settle({
      userId: params.userId,
      reservationId: params.reservationId,
      actualAmount: actualCredits,
      idempotencyKey: key,
      actualProviderCostUsd: params.actualProviderCostUsd,
      metadata: params.metadata,
    });
  }

  async release(params: {
    reservationId: string;
    userId: string;
    idempotencyKey?: string;
    reason?: string;
  }): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    const key = params.idempotencyKey || `release_key_${params.userId}_${params.reservationId}`;
    return this.repo.release({
      userId: params.userId,
      reservationId: params.reservationId,
      idempotencyKey: key,
      reason: params.reason,
    });
  }

  async markPendingUnknown(params: {
    reservationId: string;
    userId: string;
    reason?: string;
  }): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    return this.repo.markPendingUnknown({
      userId: params.userId,
      reservationId: params.reservationId,
      reason: params.reason,
    });
  }

  async refund(params: {
    reservationId: string;
    userId: string;
    amount: number;
    idempotencyKey?: string;
    reason?: string;
  }): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    const key = params.idempotencyKey || `refund_key_${params.userId}_${params.reservationId}_${Date.now()}`;
    return this.repo.refund({
      userId: params.userId,
      reservationId: params.reservationId,
      amount: params.amount,
      idempotencyKey: key,
      reason: params.reason,
    });
  }

  async getBalance(userId: string): Promise<number> {
    return this.repo.getBalance(userId);
  }

  async setBalance(userId: string, balance: number): Promise<void> {
    if (this.repo.setBalance) {
      await this.repo.setBalance(userId, balance);
    }
  }

  async getLedger(userId: string): Promise<CreditTransaction[]> {
    return this.repo.getLedger(userId);
  }

  async getReservation(reservationId: string): Promise<CreditReservation | null> {
    return this.repo.getReservation(reservationId);
  }
}
