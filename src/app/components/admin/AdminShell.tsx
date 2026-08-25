import React, { useState, useEffect, useCallback } from "react";
import {
  Inbox,
  Users,
  Coins,
  Ticket,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Check,
  XCircle,
  Ban,
  Trash2,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { SparkLogo } from "../SparkLogo";
import {
  getPendingApprovals,
  getAllPeople,
  approveUser,
  rejectUser,
  banUser,
  unbanUser,
  adjustCredits,
  getCreditLedger,
  listCoupons,
  createCoupon,
  toggleCouponActive,
  deleteUser,
  AdminUserListItem,
} from "../../backend/repositories/adminRepository";
import type { CreditLedgerRow, CouponRow } from "../../backend/database.types";
import { CreditAdjustmentModal } from "./modals/CreditAdjustmentModal";
import { CreateCouponModal } from "./modals/CreateCouponModal";
import { DeleteUserModal } from "./modals/DeleteUserModal";

export type AdminTab = "inbox" | "people" | "credits" | "coupons";

interface AdminShellProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function AdminShell({ currentPath = "/admin/inbox", onNavigate }: AdminShellProps) {
  const auth = useAuth();
  const actorId = auth.currentUser?.id || "admin";

  // Derive active tab from subpath
  const getTabFromPath = (path: string): AdminTab => {
    const clean = path.toLowerCase().split("?")[0].replace(/\/$/, "");
    if (clean.endsWith("/people")) return "people";
    if (clean.endsWith("/credits")) return "credits";
    if (clean.endsWith("/coupons")) return "coupons";
    return "inbox";
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => getTabFromPath(currentPath));

  useEffect(() => {
    setActiveTab(getTabFromPath(currentPath));
  }, [currentPath]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const targetPath = tab === "inbox" ? "/admin/inbox" : `/admin/${tab}`;
    if (onNavigate) {
      onNavigate(targetPath);
    }
    if (typeof window !== "undefined" && window.history && window.history.pushState) {
      window.history.pushState({}, "", targetPath);
    }
  };

  // State
  const [pendingUsers, setPendingUsers] = useState<AdminUserListItem[]>([]);
  const [people, setPeople] = useState<AdminUserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [creditLedger, setCreditLedger] = useState<CreditLedgerRow[]>([]);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modals state
  const [creditTargetUser, setCreditTargetUser] = useState<AdminUserListItem | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserListItem | null>(null);
  const [createCouponOpen, setCreateCouponOpen] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [pendingRes, peopleRes, ledgerRes, couponsRes] = await Promise.all([
        getPendingApprovals(),
        getAllPeople(searchQuery),
        getCreditLedger(),
        listCoupons(),
      ]);

      if (pendingRes.data) setPendingUsers(pendingRes.data);
      if (peopleRes.data) setPeople(peopleRes.data);
      if (ledgerRes.data) setCreditLedger(ledgerRes.data);
      if (couponsRes.data) setCoupons(couponsRes.data);
    } catch (err) {
      console.warn("[AdminShell] loadData notice:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  const handleApprove = async (user: AdminUserListItem) => {
    try {
      setActionLoadingId(user.id);
      await approveUser(user.id, actorId);
      setPendingUsers((prev) => prev.filter((p) => p.id !== user.id));
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "active" } : p))
      );
    } catch (err) {
      console.warn("[Admin] handleApprove notice:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (user: AdminUserListItem) => {
    try {
      setActionLoadingId(user.id);
      await rejectUser(user.id, actorId, "Rejected by administrator");
      setPendingUsers((prev) => prev.filter((p) => p.id !== user.id));
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "rejected" } : p))
      );
    } catch (err) {
      console.warn("[Admin] handleReject notice:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBan = async (user: AdminUserListItem) => {
    try {
      setActionLoadingId(user.id);
      await banUser(user.id, actorId, "Banned by administrator");
      setPendingUsers((prev) => prev.filter((p) => p.id !== user.id));
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "banned" } : p))
      );
    } catch (err) {
      console.warn("[Admin] handleBan notice:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnban = async (user: AdminUserListItem) => {
    try {
      setActionLoadingId(user.id);
      await unbanUser(user.id, actorId);
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "active" } : p))
      );
    } catch (err) {
      console.warn("[Admin] handleUnban notice:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCredits = async (delta: number, reason: string) => {
    if (!creditTargetUser) return;
    const res = await adjustCredits(creditTargetUser.id, delta, reason, actorId);
    if (res.data !== null && res.data !== undefined) {
      const newBal = res.data;
      setPeople((prev) =>
        prev.map((p) => (p.id === creditTargetUser.id ? { ...p, credit_balance: newBal } : p))
      );
      const ledgerRes = await getCreditLedger();
      if (ledgerRes.data) setCreditLedger(ledgerRes.data);
    }
  };

  const handleConfirmCreateCoupon = async (payload: {
    code: string;
    amount: number;
    max_redemptions: number;
    expires_at?: string | null;
  }) => {
    const res = await createCoupon(payload, actorId);
    if (res.data) {
      setCoupons((prev) => [res.data!, ...prev]);
    }
  };

  const handleToggleCoupon = async (couponId: string, currentActive: boolean) => {
    try {
      setActionLoadingId(couponId);
      await toggleCouponActive(couponId, !currentActive, actorId);
      setCoupons((prev) =>
        prev.map((c) => (c.id === couponId ? { ...c, active: !currentActive } : c))
      );
    } catch (err) {
      console.warn("[Admin] handleToggleCoupon notice:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDeleteUser = async (userId: string, email: string) => {
    await deleteUser(userId, email, actorId);
    setPendingUsers((prev) => prev.filter((p) => p.id !== userId));
    setPeople((prev) => prev.filter((p) => p.id !== userId));
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "inbox", label: "Inbox", icon: <Inbox className="w-4 h-4" />, badge: pendingUsers.length },
    { id: "people", label: "People", icon: <Users className="w-4 h-4" />, badge: people.length },
    { id: "credits", label: "Credits", icon: <Coins className="w-4 h-4" /> },
    { id: "coupons", label: "Coupons", icon: <Ticket className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] text-white flex flex-col antialiased selection:bg-purple-500/30">
      {/* Top Admin Header */}
      <header className="h-16 border-b border-white/[0.09] px-4 sm:px-6 flex items-center justify-between bg-[#0B0F17]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <SparkLogo className="w-7 h-7 sm:w-8 sm:h-8" variant="superspark" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">SPARK</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                Admin
              </span>
            </div>
          </div>

          {/* Desktop Navigation Pill Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.035] p-1 rounded-xl border border-white/[0.09]">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-purple-600/30 text-white border border-purple-500/40 shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-purple-500 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Admin Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => loadData()}
            title="Refresh Admin Data"
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
          </button>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.035] border border-white/[0.09] text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white/80 font-medium truncate max-w-[140px]">
              {auth.profile?.display_name || auth.currentUser?.email || "Admin"}
            </span>
          </div>

          <button
            onClick={() => onNavigate ? onNavigate("/") : (window.location.pathname = "/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-semibold text-white transition-all cursor-pointer active:scale-95"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden sm:inline">Executive App</span>
          </button>

          <button
            onClick={() => void auth.signOut()}
            title="Sign out"
            className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden border-b border-white/[0.09] bg-[#0B0F17]/95 px-4 py-2 flex items-center justify-between gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-purple-600/30 text-white border border-purple-500/40"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {Boolean(item.badge && item.badge > 0) && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-[9px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Admin Content Canvas */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Tab 1: Inbox (Default Landing) */}
        {activeTab === "inbox" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Inbox</h1>
                <p className="text-xs text-white/50 mt-1">Pending workspace approvals & onboarding reviews.</p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                {pendingUsers.length} awaiting review
              </span>
            </div>

            {pendingUsers.length === 0 ? (
              /* Calm Onboard Empty State */
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-12 text-center space-y-4 max-w-lg mx-auto my-12">
                <div className="w-14 h-14 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-300">
                  <Inbox className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white tracking-tight">No sparks waiting.</p>
                  <p className="text-xs text-white/50 leading-relaxed max-w-xs mx-auto">
                    New creator workspaces awaiting executive review will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-white/20"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{user.display_name || "Creator"}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 uppercase">
                          Pending Approval
                        </span>
                      </div>
                      <p className="text-xs text-white/60 font-mono">{user.email || user.id}</p>
                      {user.brand_name && (
                        <p className="text-xs text-purple-300/80">
                          Workspace: <span className="font-semibold">{user.brand_name}</span>{" "}
                          {user.brand_niche && <span className="text-white/40">({user.brand_niche})</span>}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(user)}
                        disabled={actionLoadingId === user.id}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleReject(user)}
                        disabled={actionLoadingId === user.id}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/80 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleBan(user)}
                        disabled={actionLoadingId === user.id}
                        className="p-1.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive transition-all cursor-pointer"
                        title="Ban User"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: People */}
        {activeTab === "people" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">People</h1>
                <p className="text-xs text-white/50 mt-1">All creators, directors, and workspace owners.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* People List */}
            <div className="space-y-3">
              {people.map((user) => {
                const status = user.access_status || "active";
                const isUserAdmin = user.role === "admin";
                return (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-white/20"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{user.display_name || "Creator"}</span>

                        {/* Status Chip */}
                        {status === "active" && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 uppercase">
                            Active
                          </span>
                        )}
                        {status === "pending_approval" && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 uppercase">
                            Pending
                          </span>
                        )}
                        {status === "banned" && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 text-destructive uppercase">
                            Banned
                          </span>
                        )}
                        {status === "rejected" && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/30 text-zinc-300 uppercase">
                            Rejected
                          </span>
                        )}

                        {/* Role Chip */}
                        {isUserAdmin && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 uppercase font-bold">
                            Admin
                          </span>
                        )}

                        {/* Credits Badge */}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] border border-white/10 text-white/80">
                          🪙 {user.credit_balance ?? 0} credits
                        </span>
                      </div>

                      <p className="text-xs text-white/60 font-mono">{user.email || user.id}</p>
                      {user.brand_name && (
                        <p className="text-xs text-purple-300/80">
                          Workspace: <span className="font-semibold">{user.brand_name}</span>{" "}
                          {user.brand_niche && <span className="text-white/40">({user.brand_niche})</span>}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {status === "pending_approval" && (
                        <button
                          onClick={() => handleApprove(user)}
                          disabled={actionLoadingId === user.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      {status === "banned" ? (
                        <button
                          onClick={() => handleUnban(user)}
                          disabled={actionLoadingId === user.id}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          Unban User
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBan(user)}
                          disabled={actionLoadingId === user.id || isUserAdmin}
                          title="Ban from SPARK"
                          className="px-2.5 py-1.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive text-xs font-semibold transition-all cursor-pointer disabled:opacity-30"
                        >
                          Ban
                        </button>
                      )}

                      <button
                        onClick={() => setCreditTargetUser(user)}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5 text-purple-300" />
                        <span>Credits ±</span>
                      </button>

                      <button
                        onClick={() => setDeleteTargetUser(user)}
                        disabled={isUserAdmin}
                        title="Delete User"
                        className="p-1.5 rounded-xl text-white/40 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Credits */}
        {activeTab === "credits" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Credits</h1>
              <p className="text-xs text-white/50 mt-1">Generation quotas, model provider balances & manual grants.</p>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-1">
                <span className="text-white/40 text-xs font-mono uppercase">Total Users</span>
                <p className="text-2xl font-bold text-white font-mono">{people.length}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-1">
                <span className="text-white/40 text-xs font-mono uppercase">Total Credits Distributed</span>
                <p className="text-2xl font-bold text-purple-300 font-mono">
                  {people.reduce((acc, u) => acc + (u.credit_balance || 0), 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-1">
                <span className="text-white/40 text-xs font-mono uppercase">Recent Ledger Events</span>
                <p className="text-2xl font-bold text-white font-mono">{creditLedger.length}</p>
              </div>
            </div>

            {/* Recent Ledger */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white/80">Recent Credit Adjustments</h3>
              {creditLedger.length === 0 ? (
                <div className="p-8 rounded-2xl border border-white/[0.09] bg-white/[0.02] text-center text-xs text-white/40">
                  No credit adjustment records logged yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {creditLedger.map((row) => (
                    <div
                      key={row.id}
                      className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold ${
                              row.delta > 0 ? "text-emerald-400" : "text-destructive"
                            }`}
                          >
                            {row.delta > 0 ? `+${row.delta}` : row.delta} credits
                          </span>
                          <span className="text-white/60 font-medium">{row.reason}</span>
                        </div>
                        <p className="text-[11px] text-white/40 font-mono">User ID: {row.user_id}</p>
                      </div>
                      <span className="text-[10px] text-white/40 font-mono">
                        {new Date(row.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Coupons */}
        {activeTab === "coupons" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Coupons</h1>
                <p className="text-xs text-white/50 mt-1">VIP invite codes, promotional access & onboarding bypass passes.</p>
              </div>

              <button
                onClick={() => setCreateCouponOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Coupon</span>
              </button>
            </div>

            {/* Coupons List */}
            {coupons.length === 0 ? (
              <div className="p-12 rounded-2xl border border-white/[0.09] bg-white/[0.035] text-center space-y-3">
                <Ticket className="w-8 h-8 mx-auto text-white/30" />
                <p className="text-sm font-semibold text-white">No coupon codes created yet.</p>
                <p className="text-xs text-white/50">Click Create Coupon to issue promotional codes.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm tracking-wider text-purple-300">
                        {coupon.code}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          coupon.active
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                            : "bg-white/5 border border-white/10 text-white/40"
                        }`}
                      >
                        {coupon.active ? "Active" : "Disabled"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                      <div>
                        <span className="text-[10px] uppercase font-mono block text-white/40">Grants</span>
                        <span className="font-semibold text-white">{coupon.amount} credits</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono block text-white/40">Redemptions</span>
                        <span className="font-semibold text-white">
                          {coupon.redeemed_count} / {coupon.max_redemptions}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                      <span className="text-[10px] text-white/40 font-mono">
                        {coupon.expires_at ? `Exp: ${new Date(coupon.expires_at).toLocaleDateString()}` : "No expiry"}
                      </span>
                      <button
                        onClick={() => handleToggleCoupon(coupon.id, coupon.active)}
                        disabled={actionLoadingId === coupon.id}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white transition-all cursor-pointer"
                      >
                        {coupon.active ? "Disable Code" : "Enable Code"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <CreditAdjustmentModal
        isOpen={!!creditTargetUser}
        user={creditTargetUser}
        onClose={() => setCreditTargetUser(null)}
        onConfirm={handleConfirmCredits}
      />

      <CreateCouponModal
        isOpen={createCouponOpen}
        onClose={() => setCreateCouponOpen(false)}
        onConfirm={handleConfirmCreateCoupon}
      />

      <DeleteUserModal
        isOpen={!!deleteTargetUser}
        user={deleteTargetUser}
        onClose={() => setDeleteTargetUser(null)}
        onConfirm={handleConfirmDeleteUser}
      />
    </div>
  );
}
