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

/**
 * Authoritative Supabase Credit Repository calling PostgreSQL RPCs:
 * - spark_reserve_credits
 * - spark_settle_credits
 * - spark_release_credits
 * - spark_mark_pending_unknown
 */
export class SupabaseCreditRepository implements ICreditRepository {
  private client: any;

  constructor(client?: any) {
    this.client = client;
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    try {
      const { getSupabaseClient } = await import("../../../backend/supabaseClient");
      const c = getSupabaseClient();
      if (c) return c;
    } catch {}
    const url = (typeof process !== "undefined" && (process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL)) || "";
    const key =
      (typeof process !== "undefined" &&
        (process.env?.SUPABASE_SERVICE_ROLE_KEY ||
          process.env?.SUPABASE_ANON_KEY ||
          process.env?.SUPABASE_PUBLISHABLE_KEY ||
          process.env?.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
      "";
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      this.client = createClient(url, key);
      return this.client;
    }
    throw new Error("Supabase client is not configured for CreditRepository");
  }

  async getBalance(userId: string): Promise<number> {
    const sb = await this.getClient();
    const { data, error } = await sb
      .from("profiles")
      .select("credit_balance")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return 0;
    return typeof data.credit_balance === "number" ? data.credit_balance : 0;
  }

  async reserve(params: ReserveParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    const sb = await this.getClient();
    const { data, error } = await sb.rpc("spark_reserve_credits", {
      p_user_id: params.userId,
      p_generation_id: params.generationId,
      p_amount: params.amount,
      p_idempotency_key: params.idempotencyKey,
      p_pricing_policy_version: params.pricingPolicyVersion,
      p_estimated_provider_cost_usd: params.estimatedProviderCostUsd,
      p_metadata: params.metadata || {},
    });
    if (error) {
      throw new Error(`Credit reservation failed: ${error.message || String(error)}`);
    }
    const res: CreditReservation = {
      id: data.id,
      userId: data.user_id,
      generationId: data.generation_id,
      amount: data.amount,
      status: data.status,
      consumedAmount: data.consumed_amount || 0,
      releasedAmount: data.released_amount || 0,
      idempotencyKey: params.idempotencyKey,
      pricingPolicyVersion: params.pricingPolicyVersion,
      estimatedProviderCostUsd: params.estimatedProviderCostUsd,
      metadata: params.metadata || {},
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
    };
    return { reservation: res, idempotentReplay: Boolean(data.idempotent_replay) };
  }

  async settle(params: SettleParams): Promise<{ settlement: CreditSettlement; idempotentReplay: boolean }> {
    const sb = await this.getClient();
    const { data, error } = await sb.rpc("spark_settle_credits", {
      p_user_id: params.userId,
      p_reservation_id: params.reservationId,
      p_actual_amount: params.actualAmount,
      p_idempotency_key: params.idempotencyKey,
      p_actual_provider_cost_usd: params.actualProviderCostUsd,
      p_metadata: params.metadata || {},
    });
    if (error) {
      throw new Error(`Credit settlement failed: ${error.message || String(error)}`);
    }
    const settlement: CreditSettlement = {
      id: data.id,
      reservationId: data.id,
      userId: data.user_id,
      generationId: data.generation_id,
      actualAmount: data.consumed_amount || params.actualAmount,
      status: "COMPLETED",
      idempotencyKey: params.idempotencyKey,
      actualProviderCostUsd: params.actualProviderCostUsd,
      metadata: params.metadata || {},
      createdAt: data.created_at || new Date().toISOString(),
    };
    return { settlement, idempotentReplay: Boolean(data.idempotent_replay) };
  }

  async release(params: ReleaseParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    const sb = await this.getClient();
    const { data, error } = await sb.rpc("spark_release_credits", {
      p_user_id: params.userId,
      p_reservation_id: params.reservationId,
      p_idempotency_key: params.idempotencyKey,
      p_reason: params.reason || "cancelled_or_pre_acceptance_failure",
    });
    if (error) {
      throw new Error(`Credit release failed: ${error.message || String(error)}`);
    }
    const res: CreditReservation = {
      id: data.id,
      userId: params.userId,
      generationId: data.generation_id,
      amount: data.amount || 0,
      status: data.status,
      consumedAmount: 0,
      releasedAmount: data.released_amount || 0,
      idempotencyKey: params.idempotencyKey,
      pricingPolicyVersion: "spark-credit-v1.0",
      estimatedProviderCostUsd: 0,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { reservation: res, idempotentReplay: Boolean(data.idempotent_replay) };
  }

  async markPendingUnknown(params: PendingUnknownParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    const sb = await this.getClient();
    const { data, error } = await sb.rpc("spark_mark_pending_unknown", {
      p_user_id: params.userId,
      p_reservation_id: params.reservationId,
      p_reason: params.reason || "unknown_provider_outcome",
    });
    if (error) {
      throw new Error(`Mark pending unknown failed: ${error.message || String(error)}`);
    }
    const res: CreditReservation = {
      id: data.id,
      userId: params.userId,
      generationId: data.generation_id,
      amount: data.amount || 0,
      status: "PENDING_UNKNOWN",
      consumedAmount: 0,
      releasedAmount: 0,
      idempotencyKey: `unknown_${params.reservationId}`,
      pricingPolicyVersion: "spark-credit-v1.0",
      estimatedProviderCostUsd: 0,
      metadata: { reason: params.reason },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { reservation: res, idempotentReplay: Boolean(data.idempotent_replay) };
  }

  async refund(params: RefundParams): Promise<{ reservation: CreditReservation; idempotentReplay: boolean }> {
    const sb = await this.getClient();
    const { error } = await sb.rpc("admin_adjust_credits", {
      target_user_id: params.userId,
      credit_delta: params.amount,
      adjustment_reason: `REFUND: ${params.reason || "reconciliation_refund"}`,
    });
    if (error) {
      throw new Error(`Credit refund failed: ${error.message || String(error)}`);
    }
    const res: CreditReservation = {
      id: params.reservationId,
      userId: params.userId,
      generationId: `refund_${params.reservationId}`,
      amount: params.amount,
      status: "REFUNDED",
      consumedAmount: 0,
      releasedAmount: 0,
      idempotencyKey: params.idempotencyKey,
      pricingPolicyVersion: "spark-credit-v1.0",
      estimatedProviderCostUsd: 0,
      metadata: { reason: params.reason },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { reservation: res, idempotentReplay: false };
  }

  async getLedger(userId: string): Promise<CreditTransaction[]> {
    const sb = await this.getClient();
    const { data, error } = await sb
      .from("credit_ledger")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      generationId: d.generation_id,
      reservationId: d.reservation_id,
      type: d.transaction_type || (d.delta > 0 ? "REFUND" : "CONSUMPTION"),
      delta: d.delta,
      reason: d.reason,
      createdAt: d.created_at,
      metadata: d.metadata,
    }));
  }

  async getReservation(reservationId: string): Promise<CreditReservation | null> {
    const sb = await this.getClient();
    const { data, error } = await sb
      .from("credit_reservations")
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      generationId: data.generation_id,
      amount: data.amount,
      status: data.status,
      consumedAmount: data.consumed_amount || 0,
      releasedAmount: data.released_amount || 0,
      idempotencyKey: data.idempotency_key,
      pricingPolicyVersion: data.pricing_policy_version,
      estimatedProviderCostUsd: data.estimated_provider_cost_usd,
      actualProviderCostUsd: data.actual_provider_cost_usd,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

