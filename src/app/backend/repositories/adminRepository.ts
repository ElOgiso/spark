import type {
  ProfileRow,
  CreditLedgerRow,
  CouponRow,
  AdminAuditLogRow,
  BrandRow,
  CreditReservationRow,
  ProductionEventRow,
} from "../database.types";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import type { RepositoryResult } from "./repositoryTypes";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";
import { deleteWorkspace } from "../workspaceSync";
import type {
  AdminEconomicsSummary,
  AdminReservationItem,
  AdminPendingUnknownItem,
  AdminReconciliationBacklogItem,
  AdminProviderHealthItem,
  AdminPricingModelItem,
  AdminPaginationFilter,
  PaginatedResult,
} from "../../services/admin/types";
import { PricingRegistry } from "../../services/production/economics/pricingRegistry";
import { DEFAULT_PRICING_POLICY } from "../../services/production/credits/pricingPolicy";
import { ServiceHealthMonitor } from "../../services/runtime/serviceHealthMonitor";

export interface AdminUserListItem extends ProfileRow {
  brand_name?: string | null;
  brand_niche?: string | null;
}

/**
 * Verify caller is an authenticated admin in Supabase before executing mutations.
 * Hardened in Phase 19: queries authoritative database function `is_admin` first,
 * then checks profile role/is_super_admin, and strictly fails closed.
 */
export async function verifyAdminCaller(actorId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true; // Local demo mode
  const supabase = getSupabaseClient();
  if (!supabase) return true;

  try {
    // 1. Check database function `is_admin` first (authoritative database RPC)
    const { data: rpcIsAdmin, error: rpcErr } = await (supabase as any).rpc("is_admin", {
      user_id: actorId,
    });
    if (!rpcErr && typeof rpcIsAdmin === "boolean") {
      return rpcIsAdmin;
    }

    // 2. Check role = 'admin' on profile
    const { data: roleData, error: roleErr } = await (supabase.from("profiles") as any)
      .select("role")
      .eq("id", actorId)
      .maybeSingle();

    if (!roleErr && roleData?.role === "admin") {
      return true;
    }

    // 3. Check is_super_admin if available
    try {
      const { data: superData } = await (supabase.from("profiles") as any)
        .select("is_super_admin")
        .eq("id", actorId)
        .maybeSingle();

      if (Boolean(superData?.is_super_admin)) {
        return true;
      }
    } catch {
      // is_super_admin column not present or not migrated
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Helper to record administrative actions in the audit log.
 */
export async function logAdminAction(
  actorId: string,
  action: string,
  targetUserId: string | null,
  meta: Record<string, any> = {}
): Promise<void> {
  console.log(`[SPARK ADMIN AUDIT] actor=${actorId} action=${action} target=${targetUserId}`, meta);
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    await (supabase.from("admin_audit_log") as any).insert({
      actor_id: actorId,
      action,
      target_user_id: targetUserId,
      meta,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[AdminRepository] Audit log notice:", err);
  }
}

/**
 * 1. Get Pending Approvals (Inbox)
 */
export async function getPendingApprovals(): Promise<RepositoryResult<AdminUserListItem[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<AdminUserListItem[]>();

  try {
    const { data: profiles, error } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("access_status", "pending_approval")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("access_status")) {
        console.warn("[AdminRepository] access_status column pending migration, returning empty inbox list.");
        return { data: [], error: null, source: "supabase" };
      }
      return repositoryError<AdminUserListItem[]>(error.message);
    }

    const userIds = (profiles || []).map((p: any) => p.id);
    let brandsMap: Record<string, BrandRow> = {};
    if (userIds.length > 0) {
      const { data: brands } = await (supabase.from("brands") as any)
        .select("*")
        .in("owner_id", userIds);

      (brands || []).forEach((b: BrandRow) => {
        brandsMap[b.owner_id] = b;
      });
    }

    const items: AdminUserListItem[] = (profiles || []).map((p: any) => ({
      ...p,
      brand_name: brandsMap[p.id]?.name || null,
      brand_niche: brandsMap[p.id]?.niche || null,
    }));

    return { data: items, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<AdminUserListItem[]>(err?.message || "Failed to load pending approvals");
  }
}

/**
 * 2. Get All Users (People)
 */
export async function getAllPeople(query?: string): Promise<RepositoryResult<AdminUserListItem[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<AdminUserListItem[]>();

  try {
    let builder = (supabase.from("profiles") as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      builder = builder.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data: profiles, error } = await builder;
    if (error) return repositoryError<AdminUserListItem[]>(error.message);

    const userIds = (profiles || []).map((p: any) => p.id);
    let brandsMap: Record<string, BrandRow> = {};
    if (userIds.length > 0) {
      const { data: brands } = await (supabase.from("brands") as any)
        .select("*")
        .in("owner_id", userIds);

      (brands || []).forEach((b: BrandRow) => {
        brandsMap[b.owner_id] = b;
      });
    }

    const items: AdminUserListItem[] = (profiles || []).map((p: any) => ({
      ...p,
      brand_name: brandsMap[p.id]?.name || null,
      brand_niche: brandsMap[p.id]?.niche || null,
    }));

    return { data: items, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<AdminUserListItem[]>(err?.message || "Failed to load users");
  }
}

/**
 * 3. Approve User
 * Hardened in Phase 19: Fail-closed on RPC failure, NO direct table update fallback.
 * Uses admin_adjust_credits RPC for initial credit onboarding if needed.
 */
export async function approveUser(targetUserId: string, actorId: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const rpcRes = await (supabase as any).rpc("admin_set_access_status", {
      target_user_id: targetUserId,
      new_status: "active",
    });

    if (rpcRes.error) {
      return repositoryError<boolean>(rpcRes.error.message || "Failed to approve user via RPC");
    }
    if (rpcRes.data === false) {
      return repositoryError<boolean>("profile not found");
    }

    // Verify user profile exists and has active access status
    const { data: verified, error: verifyErr } = await (supabase.from("profiles") as any)
      .select("id, access_status, credit_balance")
      .eq("id", targetUserId)
      .maybeSingle();

    if (verifyErr || !verified || verified.access_status !== "active") {
      return repositoryError<boolean>("profile verification failed after approval");
    }

    // Onboarding credit grant through secure admin_adjust_credits RPC if balance < 50
    const currentBal = Number(verified.credit_balance) || 0;
    if (currentBal < 50) {
      const grantDelta = 50 - currentBal;
      await (supabase as any).rpc("admin_adjust_credits", {
        target_user_id: targetUserId,
        delta: grantDelta,
        reason: "Initial onboarding grant on approval",
      });
    }

    await logAdminAction(actorId, "APPROVE_USER", targetUserId);
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to approve user");
  }
}

/**
 * 4. Reject User
 * Hardened in Phase 19: Fail-closed on RPC failure, NO direct table update fallback.
 */
export async function rejectUser(targetUserId: string, actorId: string, reason?: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const rpcRes = await (supabase as any).rpc("admin_set_access_status", {
      target_user_id: targetUserId,
      new_status: "rejected",
    });

    if (rpcRes.error) {
      return repositoryError<boolean>(rpcRes.error.message || "Failed to reject user via RPC");
    }
    if (rpcRes.data === false) {
      return repositoryError<boolean>("profile not found");
    }

    await logAdminAction(actorId, "REJECT_USER", targetUserId, { reason });
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to reject user");
  }
}

/**
 * 5. Ban User
 * Hardened in Phase 19: Fail-closed on RPC failure, NO direct table update fallback.
 */
export async function banUser(targetUserId: string, actorId: string, reason?: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const rpcRes = await (supabase as any).rpc("admin_set_access_status", {
      target_user_id: targetUserId,
      new_status: "banned",
    });

    if (rpcRes.error) {
      return repositoryError<boolean>(rpcRes.error.message || "Failed to ban user via RPC");
    }
    if (rpcRes.data === false) {
      return repositoryError<boolean>("profile not found");
    }

    await logAdminAction(actorId, "BAN_USER", targetUserId, { reason });
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to ban user");
  }
}

/**
 * 6. Unban User
 * Hardened in Phase 19: Fail-closed on RPC failure, NO direct table update fallback.
 */
export async function unbanUser(targetUserId: string, actorId: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const rpcRes = await (supabase as any).rpc("admin_set_access_status", {
      target_user_id: targetUserId,
      new_status: "active",
    });

    if (rpcRes.error) {
      return repositoryError<boolean>(rpcRes.error.message || "Failed to unban user via RPC");
    }
    if (rpcRes.data === false) {
      return repositoryError<boolean>("profile not found");
    }

    await logAdminAction(actorId, "UNBAN_USER", targetUserId);
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to unban user");
  }
}

/**
 * 7. Adjust Credits (+ / -)
 * Hardened in Phase 19: Strictly fail-closed on RPC failure.
 * ZERO direct table update fallbacks — no bypassing database constraints.
 */
export async function adjustCredits(
  targetUserId: string,
  delta: number,
  reason: string,
  actorId: string
): Promise<RepositoryResult<number>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<number>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: Math.max(0, delta), error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<number>();

  try {
    const rpcRes = await (supabase as any).rpc("admin_adjust_credits", {
      target_user_id: targetUserId,
      delta,
      reason,
    });

    if (rpcRes.error) {
      return repositoryError<number>(rpcRes.error.message || "Failed to adjust credits via RPC");
    }

    if (typeof rpcRes.data === "number") {
      await logAdminAction(actorId, "ADJUST_CREDITS", targetUserId, {
        delta,
        newBalance: rpcRes.data,
        reason,
      });
      return { data: rpcRes.data, error: null, source: "supabase" };
    }

    return repositoryError<number>("Invalid response from admin_adjust_credits RPC");
  } catch (err: any) {
    return repositoryError<number>(err?.message || "Failed to adjust credits");
  }
}

/**
 * 8. Get Credit Ledger History
 */
export async function getCreditLedger(targetUserId?: string): Promise<RepositoryResult<CreditLedgerRow[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<CreditLedgerRow[]>();

  try {
    let builder = (supabase.from("credit_ledger") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (targetUserId) {
      builder = builder.eq("user_id", targetUserId);
    }

    const { data, error } = await builder;
    if (error) return repositoryError<CreditLedgerRow[]>(error.message);
    return { data: data || [], error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<CreditLedgerRow[]>(err?.message || "Failed to load credit ledger");
  }
}

/**
 * 9. List Coupons
 */
export async function listCoupons(): Promise<RepositoryResult<CouponRow[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<CouponRow[]>();

  try {
    const { data, error } = await (supabase.from("coupons") as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return repositoryError<CouponRow[]>(error.message);
    return { data: data || [], error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<CouponRow[]>(err?.message || "Failed to load coupons");
  }
}

/**
 * 10. Create Coupon
 */
export async function createCoupon(
  payload: { code: string; amount: number; max_redemptions: number; expires_at?: string | null },
  actorId: string
): Promise<RepositoryResult<CouponRow>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<CouponRow>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) {
    const mock: CouponRow = {
      id: `coupon-${Date.now()}`,
      code: payload.code.toUpperCase().trim(),
      amount: payload.amount,
      max_redemptions: payload.max_redemptions,
      redeemed_count: 0,
      expires_at: payload.expires_at || null,
      active: true,
      created_at: new Date().toISOString(),
    };
    return { data: mock, error: null, source: "local" };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<CouponRow>();

  try {
    const row = {
      code: payload.code.toUpperCase().trim(),
      amount: payload.amount,
      max_redemptions: payload.max_redemptions,
      redeemed_count: 0,
      expires_at: payload.expires_at || null,
      active: true,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from("coupons") as any)
      .insert(row)
      .select("*")
      .single();

    if (error) return repositoryError<CouponRow>(error.message);

    await logAdminAction(actorId, "CREATE_COUPON", null, { code: row.code, amount: row.amount });
    return { data, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<CouponRow>(err?.message || "Failed to create coupon");
  }
}

/**
 * 11. Toggle Coupon Active / Disabled
 */
export async function toggleCouponActive(
  couponId: string,
  active: boolean,
  actorId: string
): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const { error } = await (supabase.from("coupons") as any)
      .update({ active })
      .eq("id", couponId);

    if (error) return repositoryError<boolean>(error.message);

    await logAdminAction(actorId, active ? "ENABLE_COUPON" : "DISABLE_COUPON", null, { couponId });
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to toggle coupon state");
  }
}

/**
 * 12. Delete User
 */
export async function deleteUser(
  targetUserId: string,
  targetEmail: string,
  actorId: string
): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    await logAdminAction(actorId, "DELETE_USER", targetUserId, { email: targetEmail });

    const { data: userBrands } = await (supabase.from("brands") as any)
      .select("id")
      .eq("owner_id", targetUserId);

    for (const b of userBrands || []) {
      await deleteWorkspace(b.id, targetUserId);
    }

    const { error } = await (supabase.from("profiles") as any)
      .delete()
      .eq("id", targetUserId);

    if (error) return repositoryError<boolean>(error.message);
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to delete user");
  }
}

// =============================================================================
// PHASE 19 — CANONICAL ADMIN ECONOMICS & OPERATIONS LAYER
// =============================================================================

/**
 * 13. Get Admin Economics Summary
 * Truthful financial projection:
 * - SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 * - Unknown provider costs NEVER look like $0.00.
 * - Margin is computed strictly when both revenue value and provider cost are known.
 * - Credit valuation follows canonical pricing policy (e.g. 100 credits = $1.00 USD).
 */
export async function getAdminEconomicsSummary(
  filter?: { since?: string; until?: string; userId?: string }
): Promise<RepositoryResult<AdminEconomicsSummary>> {
  const creditValuationUsd = 1 / DEFAULT_PRICING_POLICY.creditsPerUsd; // 0.01 ($0.01 per credit)
  const defaultPolicyVersion = DEFAULT_PRICING_POLICY.version;

  if (!isSupabaseConfigured()) {
    // Return structured local mock summary
    const mockSummary: AdminEconomicsSummary = {
      totalCreditsActiveReserved: 0,
      totalCreditsSettled: 0,
      totalCreditsReleased: 0,
      totalCreditsRefunded: 0,
      pendingUnknownExposureCredits: 0,
      pendingUnknownCount: 0,
      totalKnownProviderCostUsd: 0,
      totalEstimatedProviderCostUsd: 0,
      unknownProviderCostCount: 0,
      overallCostStatus: "EXACT",
      grossSettledRevenueUsd: 0,
      pendingUnknownExposureUsd: 0,
      actualMarginUsd: 0,
      marginPercentage: 0,
      pricingPolicyVersion: defaultPolicyVersion,
      creditValuationUsd,
      totalUsersCount: 0,
      totalCirculatingCredits: 0,
    };
    return { data: mockSummary, error: null, source: "local" };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<AdminEconomicsSummary>();

  try {
    // 1. Query reservations
    let resQuery = (supabase.from("credit_reservations") as any).select("*");
    if (filter?.userId) resQuery = resQuery.eq("user_id", filter.userId);
    if (filter?.since) resQuery = resQuery.gte("created_at", filter.since);
    if (filter?.until) resQuery = resQuery.lte("created_at", filter.until);

    const { data: reservations, error: resError } = await resQuery;
    if (resError) return repositoryError<AdminEconomicsSummary>(resError.message);

    // 2. Query profiles for total circulating credits and user count
    const { data: profiles, error: profError } = await (supabase.from("profiles") as any)
      .select("credit_balance");
    if (profError) return repositoryError<AdminEconomicsSummary>(profError.message);

    const totalUsersCount = (profiles || []).length;
    const totalCirculatingCredits = (profiles || []).reduce(
      (acc: number, p: any) => acc + (Number(p.credit_balance) || 0),
      0
    );

    // 3. Accumulate economics from reservations
    let totalCreditsActiveReserved = 0;
    let totalCreditsSettled = 0;
    let totalCreditsReleased = 0;
    let totalCreditsRefunded = 0;
    let pendingUnknownExposureCredits = 0;
    let pendingUnknownCount = 0;
    let totalKnownProviderCostUsd = 0;
    let totalEstimatedProviderCostUsd = 0;
    let unknownProviderCostCount = 0;

    for (const r of (reservations || []) as CreditReservationRow[]) {
      const amount = Number(r.amount) || 0;
      const consumed = Number(r.consumed_amount) || 0;
      const released = Number(r.released_amount) || 0;
      const estimatedCost = Number(r.estimated_provider_cost_usd) || 0;
      totalEstimatedProviderCostUsd += estimatedCost;

      if (r.status === "ACTIVE") {
        totalCreditsActiveReserved += Math.max(0, amount - consumed - released);
      } else if (r.status === "SETTLED") {
        totalCreditsSettled += consumed;
        totalCreditsReleased += released;
      } else if (r.status === "RELEASED") {
        totalCreditsReleased += released || amount;
      } else if (r.status === "PENDING_UNKNOWN") {
        pendingUnknownExposureCredits += amount;
        pendingUnknownCount += 1;
        unknownProviderCostCount += 1;
      } else if (r.status === "REFUNDED") {
        totalCreditsRefunded += amount;
      }

      // Provider actual cost accounting
      if (r.actual_provider_cost_usd !== null && r.actual_provider_cost_usd !== undefined) {
        totalKnownProviderCostUsd += Number(r.actual_provider_cost_usd);
      } else if (r.status === "SETTLED") {
        // Settled but missing actual provider cost evidence
        unknownProviderCostCount += 1;
      }
    }

    // 4. Calculate gross revenue and margin with fail-safe unknown economics semantics
    const grossSettledRevenueUsd = Number((totalCreditsSettled * creditValuationUsd).toFixed(4));
    const pendingUnknownExposureUsd = Number(
      (pendingUnknownExposureCredits * creditValuationUsd).toFixed(4)
    );

    let actualMarginUsd: number | null = null;
    let marginPercentage: number | null = null;
    let overallCostStatus: "EXACT" | "ESTIMATED" | "UNKNOWN" = "EXACT";

    if (unknownProviderCostCount > 0 || pendingUnknownCount > 0) {
      // PERMANENT ARCHITECTURAL LAW: If any provider costs are unknown,
      // actual margin is strictly NULL / undefined. Never falsify as zero!
      overallCostStatus = "UNKNOWN";
      actualMarginUsd = null;
      marginPercentage = null;
    } else {
      actualMarginUsd = Number((grossSettledRevenueUsd - totalKnownProviderCostUsd).toFixed(4));
      marginPercentage =
        grossSettledRevenueUsd > 0
          ? Number(((actualMarginUsd / grossSettledRevenueUsd) * 100).toFixed(2))
          : 0;
    }

    const summary: AdminEconomicsSummary = {
      totalCreditsActiveReserved,
      totalCreditsSettled,
      totalCreditsReleased,
      totalCreditsRefunded,
      pendingUnknownExposureCredits,
      pendingUnknownCount,
      totalKnownProviderCostUsd: Number(totalKnownProviderCostUsd.toFixed(4)),
      totalEstimatedProviderCostUsd: Number(totalEstimatedProviderCostUsd.toFixed(4)),
      unknownProviderCostCount,
      overallCostStatus,
      grossSettledRevenueUsd,
      pendingUnknownExposureUsd,
      actualMarginUsd,
      marginPercentage,
      pricingPolicyVersion: defaultPolicyVersion,
      creditValuationUsd,
      totalUsersCount,
      totalCirculatingCredits,
    };

    return { data: summary, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<AdminEconomicsSummary>(err?.message || "Failed to load economics summary");
  }
}

/**
 * 14. Get Admin Reservations with Pagination & Truthful Status
 */
export async function getAdminReservations(
  filter?: AdminPaginationFilter
): Promise<RepositoryResult<PaginatedResult<AdminReservationItem>>> {
  const page = Math.max(1, filter?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter?.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!isSupabaseConfigured()) {
    return {
      data: { items: [], total: 0, page, pageSize, totalPages: 0 },
      error: null,
      source: "local",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<PaginatedResult<AdminReservationItem>>();

  try {
    let countBuilder = (supabase.from("credit_reservations") as any).select("*", {
      count: "exact",
      head: true,
    });
    let queryBuilder = (supabase.from("credit_reservations") as any).select("*");

    if (filter?.status) {
      countBuilder = countBuilder.eq("status", filter.status);
      queryBuilder = queryBuilder.eq("status", filter.status);
    }
    if (filter?.userId) {
      countBuilder = countBuilder.eq("user_id", filter.userId);
      queryBuilder = queryBuilder.eq("user_id", filter.userId);
    }
    if (filter?.since) {
      countBuilder = countBuilder.gte("created_at", filter.since);
      queryBuilder = queryBuilder.gte("created_at", filter.since);
    }
    if (filter?.until) {
      countBuilder = countBuilder.lte("created_at", filter.until);
      queryBuilder = queryBuilder.lte("created_at", filter.until);
    }

    const { count, error: countErr } = await countBuilder;
    if (countErr) return repositoryError<PaginatedResult<AdminReservationItem>>(countErr.message);

    const { data: rows, error: dataErr } = await queryBuilder
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (dataErr) return repositoryError<PaginatedResult<AdminReservationItem>>(dataErr.message);

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Fetch user profiles to enrich with email
    const userIds = Array.from(new Set((rows || []).map((r: any) => r.user_id)));
    let userEmailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await (supabase.from("profiles") as any)
        .select("id, email, display_name")
        .in("id", userIds);
      (profiles || []).forEach((p: any) => {
        userEmailMap[p.id] = p.email || p.display_name || p.id;
      });
    }

    const items: AdminReservationItem[] = (rows || []).map((r: CreditReservationRow) => {
      let actualCostStatus: "EXACT" | "ESTIMATED" | "UNKNOWN" = "EXACT";
      if (r.status === "PENDING_UNKNOWN") {
        actualCostStatus = "UNKNOWN";
      } else if (r.status === "ACTIVE") {
        actualCostStatus = "ESTIMATED";
      } else if (r.actual_provider_cost_usd === null || r.actual_provider_cost_usd === undefined) {
        actualCostStatus = "UNKNOWN";
      }

      return {
        id: r.id,
        userId: r.user_id,
        userEmail: userEmailMap[r.user_id] || null,
        generationId: r.generation_id,
        amount: r.amount,
        status: r.status,
        consumedAmount: r.consumed_amount,
        releasedAmount: r.released_amount,
        idempotencyKey: r.idempotency_key,
        pricingPolicyVersion: r.pricing_policy_version,
        estimatedProviderCostUsd: Number(r.estimated_provider_cost_usd),
        actualProviderCostUsd:
          r.actual_provider_cost_usd !== null && r.actual_provider_cost_usd !== undefined
            ? Number(r.actual_provider_cost_usd)
            : null,
        actualCostStatus,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        metadata: (r.metadata as Record<string, unknown>) || undefined,
      };
    });

    return {
      data: { items, total, page, pageSize, totalPages },
      error: null,
      source: "supabase",
    };
  } catch (err: any) {
    return repositoryError<PaginatedResult<AdminReservationItem>>(
      err?.message || "Failed to load reservations"
    );
  }
}

/**
 * 15. Get Pending Unknown Reservations (Exposure Queue)
 */
export async function getAdminPendingUnknown(): Promise<RepositoryResult<AdminPendingUnknownItem[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<AdminPendingUnknownItem[]>();

  try {
    const { data: rows, error } = await (supabase.from("credit_reservations") as any)
      .select("*")
      .eq("status", "PENDING_UNKNOWN")
      .order("created_at", { ascending: false });

    if (error) return repositoryError<AdminPendingUnknownItem[]>(error.message);

    const now = Date.now();
    const items: AdminPendingUnknownItem[] = (rows || []).map((r: CreditReservationRow) => {
      const createdTime = Date.parse(r.created_at);
      const ageMinutes = Math.max(0, Math.round((now - createdTime) / 60000));
      const meta = (r.metadata as any) || {};

      return {
        reservationId: r.id,
        userId: r.user_id,
        generationId: r.generation_id,
        amount: r.amount,
        estimatedProviderCostUsd: Number(r.estimated_provider_cost_usd),
        actualProviderCostUsd:
          r.actual_provider_cost_usd !== null && r.actual_provider_cost_usd !== undefined
            ? Number(r.actual_provider_cost_usd)
            : null,
        createdAt: r.created_at,
        ageMinutes,
        reason: meta.reason || meta.error || "Submission timed out or unknown outcome",
      };
    });

    return { data: items, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<AdminPendingUnknownItem[]>(
      err?.message || "Failed to load pending unknown reservations"
    );
  }
}

/**
 * 16. Get Reconciliation Backlog
 */
export async function getAdminReconciliationBacklog(): Promise<
  RepositoryResult<AdminReconciliationBacklogItem[]>
> {
  if (!isSupabaseConfigured()) return { data: [], error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<AdminReconciliationBacklogItem[]>();

  try {
    // Backlog consists of:
    // 1. All PENDING_UNKNOWN reservations
    // 2. ACTIVE reservations older than 60 minutes
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await (supabase.from("credit_reservations") as any)
      .select("*")
      .or(`status.eq.PENDING_UNKNOWN,and(status.eq.ACTIVE,created_at.lte.${oneHourAgo})`)
      .order("created_at", { ascending: true });

    if (error) return repositoryError<AdminReconciliationBacklogItem[]>(error.message);

    const now = Date.now();
    const backlog: AdminReconciliationBacklogItem[] = (rows || []).map((r: CreditReservationRow) => {
      const createdTime = Date.parse(r.created_at);
      const ageMinutes = Math.max(0, Math.round((now - createdTime) / 60000));

      let recommendedAction: "RECONCILE_NOW" | "RELEASE_CREDITS" | "INSPECT_PROVIDER" = "RECONCILE_NOW";
      if (ageMinutes > 180) {
        recommendedAction = "RELEASE_CREDITS";
      } else if (ageMinutes > 60) {
        recommendedAction = "INSPECT_PROVIDER";
      }

      return {
        id: `backlog-${r.id}`,
        reservationId: r.id,
        userId: r.user_id,
        generationId: r.generation_id,
        amount: r.amount,
        status: r.status,
        createdAt: r.created_at,
        ageMinutes,
        requiresAction: ageMinutes > 30,
        recommendedAction,
      };
    });

    return { data: backlog, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<AdminReconciliationBacklogItem[]>(
      err?.message || "Failed to load reconciliation backlog"
    );
  }
}

/**
 * 17. Get Provider Operations & Live Health
 */
export async function getAdminProviderOperations(): Promise<
  RepositoryResult<AdminProviderHealthItem[]>
> {
  try {
    const healthMonitor = ServiceHealthMonitor.getInstance();
    const allRules = PricingRegistry.getAllPricingRules();

    // Group rules by provider
    const rulesByProvider = new Map<string, typeof allRules>();
    for (const rule of allRules) {
      const pId = rule.providerId.toLowerCase();
      if (!rulesByProvider.has(pId)) {
        rulesByProvider.set(pId, []);
      }
      rulesByProvider.get(pId)!.push(rule);
    }

    const providerNames: Record<string, string> = {
      kling: "Kling AI",
      bytedance: "ByteDance / Seedance",
      grok: "xAI / Grok",
      openai: "OpenAI",
      elevenlabs: "ElevenLabs",
      gemini: "Google DeepMind / Veo",
      higgsfield: "Higgsfield AI",
    };

    const items: AdminProviderHealthItem[] = [];
    for (const [pId, rules] of rulesByProvider.entries()) {
      const metrics = healthMonitor.getMetrics(pId);
      items.push({
        providerId: pId,
        name: providerNames[pId] || pId.toUpperCase(),
        status: metrics.status,
        latencyMs: metrics.latencyMs,
        errorRate: metrics.errorRate,
        lastCheck: metrics.lastCheck,
        enabled: metrics.status !== "disabled",
        pricingRulesCount: rules.length,
        pricingRules: rules,
      });
    }

    return { data: items, error: null, source: isSupabaseConfigured() ? "supabase" : "local" };
  } catch (err: any) {
    return repositoryError<AdminProviderHealthItem[]>(
      err?.message || "Failed to load provider operations"
    );
  }
}

/**
 * 18. Toggle Provider Operational State (Enable / Disable)
 */
export async function setProviderOperationStatus(
  providerId: string,
  enabled: boolean,
  actorId: string
): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  try {
    const healthMonitor = ServiceHealthMonitor.getInstance();
    const current = healthMonitor.getMetrics(providerId);

    healthMonitor.setMetrics(providerId, {
      ...current,
      status: enabled ? "healthy" : "disabled",
      lastCheck: new Date().toISOString(),
    });

    await logAdminAction(actorId, enabled ? "ENABLE_PROVIDER" : "DISABLE_PROVIDER", null, {
      providerId,
      status: enabled ? "healthy" : "disabled",
    });

    return { data: true, error: null, source: isSupabaseConfigured() ? "supabase" : "local" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to toggle provider status");
  }
}

/**
 * 19. Get Canonical Pricing Configurations
 */
export async function getAdminPricingConfig(): Promise<RepositoryResult<AdminPricingModelItem[]>> {
  try {
    const rules = PricingRegistry.getAllPricingRules();

    const items: AdminPricingModelItem[] = rules.map((r) => {
      let rateDescription = "N/A";
      switch (r.billingScheme) {
        case "per_second":
          rateDescription = `$${r.ratePerSecondUsd ?? 0} / sec`;
          break;
        case "per_image":
          rateDescription = `$${r.ratePerImageUsd ?? 0} / image`;
          break;
        case "per_character":
          rateDescription = `$${r.ratePer1kCharactersUsd ?? 0} / 1k chars`;
          break;
        case "flat_per_generation":
          rateDescription = `$${r.baseRateUsd ?? 0} flat`;
          break;
        default:
          rateDescription = `$${r.baseRateUsd ?? 0}`;
      }

      return {
        providerId: r.providerId,
        modelId: r.modelId,
        modality: r.modality,
        billingScheme: r.billingScheme,
        rateDescription,
        baseRateUsd: r.baseRateUsd,
        ratePerSecondUsd: r.ratePerSecondUsd,
        ratePerImageUsd: r.ratePerImageUsd,
        ratePer1kCharactersUsd: r.ratePer1kCharactersUsd,
        pricingVersion: r.pricingVersion,
        provenanceSource: r.provenance.source,
        provenanceType: r.provenance.sourceType,
        confidence: r.provenance.confidence,
        verifiedAt: r.provenance.verifiedAt,
      };
    });

    return { data: items, error: null, source: isSupabaseConfigured() ? "supabase" : "local" };
  } catch (err: any) {
    return repositoryError<AdminPricingModelItem[]>(
      err?.message || "Failed to load pricing configurations"
    );
  }
}

/**
 * 20. Get Admin Audit Log with Pagination
 */
export async function getAdminAuditLog(
  filter?: AdminPaginationFilter
): Promise<RepositoryResult<PaginatedResult<AdminAuditLogRow>>> {
  const page = Math.max(1, filter?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter?.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!isSupabaseConfigured()) {
    return {
      data: { items: [], total: 0, page, pageSize, totalPages: 0 },
      error: null,
      source: "local",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<PaginatedResult<AdminAuditLogRow>>();

  try {
    let countBuilder = (supabase.from("admin_audit_log") as any).select("*", {
      count: "exact",
      head: true,
    });
    let queryBuilder = (supabase.from("admin_audit_log") as any).select("*");

    if (filter?.query) {
      countBuilder = countBuilder.ilike("action", `%${filter.query}%`);
      queryBuilder = queryBuilder.ilike("action", `%${filter.query}%`);
    }

    const { count, error: countErr } = await countBuilder;
    if (countErr) return repositoryError<PaginatedResult<AdminAuditLogRow>>(countErr.message);

    const { data: rows, error: dataErr } = await queryBuilder
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (dataErr) return repositoryError<PaginatedResult<AdminAuditLogRow>>(dataErr.message);

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: { items: rows || [], total, page, pageSize, totalPages },
      error: null,
      source: "supabase",
    };
  } catch (err: any) {
    return repositoryError<PaginatedResult<AdminAuditLogRow>>(
      err?.message || "Failed to load admin audit log"
    );
  }
}
