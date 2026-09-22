/**
 * Authoritative Credit Repository: Concurrency-safe, transactional, idempotent.
 * Provides Supabase RPC caller and high-performance In-Memory transactional store.
 */

import type {
  CreditReservation,
  CreditSettlement,
  CreditTransaction,
} from "./types";

export interface ReserveParams {
  userId: string;
  generationId: string;
  amount: number;
  idempotencyKey: string;
  pricingPolicyVersion: string;
  estimatedProviderCostUsd: number;
  metadata?: Record<string, unknown>;
}

export interface SettleParams {
  userId: string;
  reservationId: string;
  actualAmount: number;
  idempotencyKey: string;
  actualProviderCostUsd: number;
  metadata?: Record<string, unknown>;
}

export interface ReleaseParams {
  userId: string;
  reservationId: string;
  idempotencyKey: string;
  reason?: string;
}

export interface PendingUnknownParams {
  userId: string;
  reservationId: string;
  reason?: string;
}

export interface RefundParams {
  userId: string;
  reservationId: string;
  amount: number;
  idempotencyKey: string;
  reason?: string;
}

export interface ICreditRepository {
  getBalance(userId: string): Promise<number>;
  setBalance?(userId: string, balance: number): Promise<void>;
  reserve(params: ReserveParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }>;
  settle(params: SettleParams): Promise<{ settlement: CreditSettlement; idempotentReplay: boolean }>;
  release(params: ReleaseParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }>;
  markPendingUnknown(params: PendingUnknownParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }>;
  refund(params: RefundParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }>;
  getLedger(userId: string): Promise<CreditTransaction[]>;
  getReservation(reservationId: string): Promise<CreditReservation | null>;
}

/**
 * Concurrency-safe In-Memory implementation for tests, CI, and local mode.
 */
export class InMemoryCreditRepository implements ICreditRepository {
  private balances = new Map<string, number>();
  private reservations = new Map<string, CreditReservation>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> reservationId
  private ledger: CreditTransaction[] = [];
  private userLocks = new Map<string, Promise<void>>();

  private async acquireLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    while (this.userLocks.has(userId)) {
      await this.userLocks.get(userId);
    }
    let resolver: () => void = () => {};
    const lock = new Promise<void>((r) => {
      resolver = r;
    });
    this.userLocks.set(userId, lock);
    try {
      return await fn();
    } finally {
      this.userLocks.delete(userId);
      resolver();
    }
  }

  async getBalance(userId: string): Promise<number> {
    return this.balances.get(userId) ?? 50; // Default 50 credits
  }

  async setBalance(userId: string, balance: number): Promise<void> {
    this.balances.set(userId, Math.max(0, balance));
  }

  async reserve(params: ReserveParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    return this.acquireLock(params.userId, async () => {
      if (params.amount < 0) throw new Error(`Invalid reservation amount: ${params.amount}`);

      const existingResId = this.idempotencyIndex.get(params.idempotencyKey);
      if (existingResId) {
        const existing = this.reservations.get(existingResId);
        if (existing) return { reservation: existing, idempotentReplay: true };
      }

      const currentBalance = await this.getBalance(params.userId);
      if (currentBalance < params.amount) {
        throw new Error(`Insufficient credits: requested ${params.amount}, available ${currentBalance}`);
      }

      // Deduct balance
      this.balances.set(params.userId, currentBalance - params.amount);

      const reservation: CreditReservation = {
        id: `res_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`,
        userId: params.userId,
        generationId: params.generationId,
        amount: params.amount,
        status: "RESERVED",
        consumedAmount: 0,
        releasedAmount: 0,
        idempotencyKey: params.idempotencyKey,
        pricingPolicyVersion: params.pricingPolicyVersion,
        estimatedProviderCostUsd: params.estimatedProviderCostUsd,
        metadata: params.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.reservations.set(reservation.id, reservation);
      this.idempotencyIndex.set(params.idempotencyKey, reservation.id);

      this.ledger.push({
        id: `tx_${Math.random().toString(36).slice(2, 11)}`,
        userId: params.userId,
        generationId: params.generationId,
        reservationId: reservation.id,
        type: "RESERVATION",
        delta: -params.amount,
        reason: `RESERVATION: ${params.generationId} (${params.amount} credits)`,
        createdAt: new Date().toISOString(),
        metadata: params.metadata,
      });

      return { reservation, idempotentReplay: false };
    });
  }

  async settle(params: SettleParams): Promise<{ settlement: CreditSettlement; idempotentReplay: boolean }> {
    return this.acquireLock(params.userId, async () => {
      const res = this.reservations.get(params.reservationId);
      if (!res) throw new Error(`Reservation not found: ${params.reservationId}`);
      if (res.userId !== params.userId) throw new Error("Reservation user mismatch");

      if (res.status === "CONSUMED") {
        const settlement: CreditSettlement = {
          reservationId: res.id,
          userId: res.userId,
          generationId: res.generationId,
          reservedCredits: res.amount,
          consumedCredits: res.consumedAmount,
          releasedCredits: res.releasedAmount,
          actualProviderCostUsd: res.actualProviderCostUsd || 0,
          status: "CONSUMED",
          settledAt: res.updatedAt,
        };
        return { settlement, idempotentReplay: true };
      }

      if (res.status !== "RESERVED" && res.status !== "PENDING_UNKNOWN") {
        throw new Error(`Cannot settle reservation in status: ${res.status}`);
      }

      const actualAmount = Math.max(0, params.actualAmount);
      const consumed = actualAmount;
      const overage = Math.max(0, actualAmount - res.amount);
      const unused = Math.max(0, res.amount - actualAmount);

      if (unused > 0) {
        const currentBal = await this.getBalance(params.userId);
        this.balances.set(params.userId, currentBal + unused);
        this.ledger.push({
          id: `tx_${Math.random().toString(36).slice(2, 11)}`,
          userId: params.userId,
          generationId: res.generationId,
          reservationId: res.id,
          type: "RELEASE",
          delta: unused,
          reason: `SETTLEMENT_RELEASE_UNUSED: ${res.generationId} (${unused} credits released)`,
          createdAt: new Date().toISOString(),
          metadata: params.metadata,
        });
      } else if (overage > 0) {
        const currentBal = await this.getBalance(params.userId);
        this.balances.set(params.userId, Math.max(0, currentBal - overage));
        this.ledger.push({
          id: `tx_${Math.random().toString(36).slice(2, 11)}`,
          userId: params.userId,
          generationId: res.generationId,
          reservationId: res.id,
          type: "CONSUMPTION",
          delta: -overage,
          reason: `SETTLEMENT_OVERAGE: ${res.generationId} (${overage} additional credits consumed)`,
          createdAt: new Date().toISOString(),
          metadata: params.metadata,
        });
      }

      this.ledger.push({
        id: `tx_${Math.random().toString(36).slice(2, 11)}`,
        userId: params.userId,
        generationId: res.generationId,
        reservationId: res.id,
        type: "CONSUMPTION",
        delta: 0,
        reason: `SETTLEMENT_CONSUMED: ${res.generationId} (${consumed} credits consumed)`,
        createdAt: new Date().toISOString(),
        metadata: params.metadata,
      });

      res.status = "CONSUMED";
      res.consumedAmount = consumed;
      res.releasedAmount = unused;
      res.actualProviderCostUsd = params.actualProviderCostUsd;
      res.updatedAt = new Date().toISOString();
      res.metadata = { ...res.metadata, ...params.metadata };

      const settlement: CreditSettlement = {
        reservationId: res.id,
        userId: res.userId,
        generationId: res.generationId,
        reservedCredits: res.amount,
        consumedCredits: consumed,
        releasedCredits: unused,
        actualProviderCostUsd: params.actualProviderCostUsd,
        status: "CONSUMED",
        settledAt: res.updatedAt,
      };

      return { settlement, idempotentReplay: false };
    });
  }

  async release(params: ReleaseParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    return this.acquireLock(params.userId, async () => {
      const res = this.reservations.get(params.reservationId);
      if (!res) throw new Error(`Reservation not found: ${params.reservationId}`);
      if (res.userId !== params.userId) throw new Error("Reservation user mismatch");

      if (res.status === "RELEASED") {
        return { reservation: res, idempotentReplay: true };
      }

      if (res.status !== "RESERVED" && res.status !== "PENDING_UNKNOWN") {
        throw new Error(`Cannot release reservation in status: ${res.status}`);
      }

      if (res.amount > 0) {
        const currentBal = await this.getBalance(params.userId);
        this.balances.set(params.userId, currentBal + res.amount);

        this.ledger.push({
          id: `tx_${Math.random().toString(36).slice(2, 11)}`,
          userId: params.userId,
          generationId: res.generationId,
          reservationId: res.id,
          type: "RELEASE",
          delta: res.amount,
          reason: `RELEASE: ${res.generationId} (${params.reason || "pre_acceptance_failure"})`,
          createdAt: new Date().toISOString(),
          metadata: { reason: params.reason },
        });
      }

      res.status = "RELEASED";
      res.releasedAmount = res.amount;
      res.updatedAt = new Date().toISOString();

      return { reservation: res, idempotentReplay: false };
    });
  }

  async markPendingUnknown(params: PendingUnknownParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    return this.acquireLock(params.userId, async () => {
      const res = this.reservations.get(params.reservationId);
      if (!res) throw new Error(`Reservation not found: ${params.reservationId}`);

      if (res.status === "PENDING_UNKNOWN") {
        return { reservation: res, idempotentReplay: true };
      }

      if (res.status !== "RESERVED") {
        throw new Error(`Cannot mark ${res.status} as PENDING_UNKNOWN`);
      }

      res.status = "PENDING_UNKNOWN";
      res.updatedAt = new Date().toISOString();
      res.metadata = { ...res.metadata, pendingReason: params.reason };

      this.ledger.push({
        id: `tx_${Math.random().toString(36).slice(2, 11)}`,
        userId: params.userId,
        generationId: res.generationId,
        reservationId: res.id,
        type: "PENDING_UNKNOWN",
        delta: 0,
        reason: `HOLD_PROTECTED: ${res.generationId} (PENDING_UNKNOWN: ${params.reason || "unknown_outcome"})`,
        createdAt: new Date().toISOString(),
      });

      return { reservation: res, idempotentReplay: false };
    });
  }

  async refund(params: RefundParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    return this.acquireLock(params.userId, async () => {
      const res = this.reservations.get(params.reservationId);
      if (!res) throw new Error(`Reservation not found: ${params.reservationId}`);
      if (params.amount <= 0) throw new Error(`Refund amount must be positive: ${params.amount}`);

      if (res.status === "REFUNDED") {
        return { reservation: res, idempotentReplay: true };
      }

      const currentBal = await this.getBalance(params.userId);
      this.balances.set(params.userId, currentBal + params.amount);

      this.ledger.push({
        id: `tx_${Math.random().toString(36).slice(2, 11)}`,
        userId: params.userId,
        generationId: res.generationId,
        reservationId: res.id,
        type: "REFUND",
        delta: params.amount,
        reason: `REFUND: ${res.generationId} (${params.reason || "reconciliation_refund"})`,
        createdAt: new Date().toISOString(),
        metadata: { reason: params.reason },
      });

      res.status = "REFUNDED";
      res.updatedAt = new Date().toISOString();

      return { reservation: res, idempotentReplay: false };
    });
  }

  async getLedger(userId: string): Promise<CreditTransaction[]> {
    return this.ledger.filter((t) => t.userId === userId);
  }

  async getReservation(reservationId: string): Promise<CreditReservation | null> {
    return this.reservations.get(reservationId) || null;
  }
}
