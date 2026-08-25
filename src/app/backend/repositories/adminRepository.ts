import type { ProfileRow, CreditLedgerRow, CouponRow, AdminAuditLogRow, BrandRow } from "../database.types";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import type { RepositoryResult } from "./repositoryTypes";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";
import { deleteWorkspace } from "../workspaceSync";

export interface AdminUserListItem extends ProfileRow {
  brand_name?: string | null;
  brand_niche?: string | null;
}

/**
 * Verify caller is an authenticated admin in Supabase before executing mutations.
 */
async function verifyAdminCaller(actorId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true; // Local demo mode
  const supabase = getSupabaseClient();
  if (!supabase) return true;

  try {
    const { data, error } = await (supabase.from("profiles") as any)
      .select("role, is_super_admin")
      .eq("id", actorId)
      .maybeSingle();

    if (error || !data) return false;
    return data.role === "admin" || Boolean(data.is_super_admin);
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

    if (error) return repositoryError<AdminUserListItem[]>(error.message);

    // Fetch brands owned by these profiles to enrich context
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
 */
export async function approveUser(targetUserId: string, actorId: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const { error } = await (supabase.from("profiles") as any)
      .update({
        access_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) return repositoryError<boolean>(error.message);

    await logAdminAction(actorId, "APPROVE_USER", targetUserId);
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to approve user");
  }
}

/**
 * 4. Reject User
 */
export async function rejectUser(targetUserId: string, actorId: string, reason?: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const { error } = await (supabase.from("profiles") as any)
      .update({
        access_status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) return repositoryError<boolean>(error.message);

    await logAdminAction(actorId, "REJECT_USER", targetUserId, { reason });
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to reject user");
  }
}

/**
 * 5. Ban User
 */
export async function banUser(targetUserId: string, actorId: string, reason?: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const { error } = await (supabase.from("profiles") as any)
      .update({
        access_status: "banned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) return repositoryError<boolean>(error.message);

    await logAdminAction(actorId, "BAN_USER", targetUserId, { reason });
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to ban user");
  }
}

/**
 * 6. Unban User
 */
export async function unbanUser(targetUserId: string, actorId: string): Promise<RepositoryResult<boolean>> {
  const isAdmin = await verifyAdminCaller(actorId);
  if (!isAdmin) return repositoryError<boolean>("Unauthorized: caller is not an admin");

  if (!isSupabaseConfigured()) return { data: true, error: null, source: "local" };
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<boolean>();

  try {
    const { error } = await (supabase.from("profiles") as any)
      .update({
        access_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) return repositoryError<boolean>(error.message);

    await logAdminAction(actorId, "UNBAN_USER", targetUserId);
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to unban user");
  }
}

/**
 * 7. Adjust Credits (+ / -)
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
    // 1. Read current credit balance
    const { data: profile, error: readErr } = await (supabase.from("profiles") as any)
      .select("credit_balance")
      .eq("id", targetUserId)
      .maybeSingle();

    if (readErr) return repositoryError<number>(readErr.message);

    const currentBalance = Number(profile?.credit_balance ?? 0);
    const newBalance = Math.max(0, currentBalance + delta);

    // 2. Update profile credit_balance
    const { error: updateErr } = await (supabase.from("profiles") as any)
      .update({
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateErr) return repositoryError<number>(updateErr.message);

    // 3. Insert credit ledger entry
    await (supabase.from("credit_ledger") as any).insert({
      user_id: targetUserId,
      admin_id: actorId,
      delta,
      reason,
      created_at: new Date().toISOString(),
    });

    // 4. Record audit log
    await logAdminAction(actorId, "ADJUST_CREDITS", targetUserId, {
      previousBalance: currentBalance,
      delta,
      newBalance,
      reason,
    });

    return { data: newBalance, error: null, source: "supabase" };
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
    // 1. Audit log before deletion
    await logAdminAction(actorId, "DELETE_USER", targetUserId, { email: targetEmail });

    // 2. Delete all brands owned by target user
    const { data: userBrands } = await (supabase.from("brands") as any)
      .select("id")
      .eq("owner_id", targetUserId);

    for (const b of userBrands || []) {
      await deleteWorkspace(b.id, targetUserId);
    }

    // 3. Delete user profile
    const { error } = await (supabase.from("profiles") as any)
      .delete()
      .eq("id", targetUserId);

    if (error) return repositoryError<boolean>(error.message);
    return { data: true, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<boolean>(err?.message || "Failed to delete user");
  }
}
