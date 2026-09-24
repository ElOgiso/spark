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
  BarChart3,
  Layers,
  Activity,
  Tag,
  AlertTriangle,
  FileText,
  Clock,
  TrendingUp,
  AlertCircle,
  Power,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { SparkLogo } from "../SparkLogo";
import { MainLogoAnimated } from "../ui/SparkAnimatedLogo";
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
  getAdminEconomicsSummary,
  getAdminReservations,
  getAdminPendingUnknown,
  getAdminReconciliationBacklog,
  getAdminProviderOperations,
  setProviderOperationStatus,
  getAdminPricingConfig,
  getAdminAuditLog,
  AdminUserListItem,
} from "../../backend/repositories/adminRepository";
import type { CreditLedgerRow, CouponRow, AdminAuditLogRow } from "../../backend/database.types";
import type {
  AdminEconomicsSummary,
  AdminReservationItem,
  AdminPendingUnknownItem,
  AdminReconciliationBacklogItem,
  AdminProviderHealthItem,
  AdminPricingModelItem,
  PaginatedResult,
} from "../../services/admin/types";
import { CreditAdjustmentModal } from "./modals/CreditAdjustmentModal";
import { CreateCouponModal } from "./modals/CreateCouponModal";
import { DeleteUserModal } from "./modals/DeleteUserModal";

export type AdminTab =
  | "inbox"
  | "people"
  | "credits"
  | "coupons"
  | "economics"
  | "reservations"
  | "providers"
  | "pricing"
  | "operations"
  | "audit";

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
    if (clean.endsWith("/economics")) return "economics";
    if (clean.endsWith("/reservations")) return "reservations";
    if (clean.endsWith("/providers")) return "providers";
    if (clean.endsWith("/pricing")) return "pricing";
    if (clean.endsWith("/operations")) return "operations";
    if (clean.endsWith("/audit")) return "audit";
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

  // Base State
  const [pendingUsers, setPendingUsers] = useState<AdminUserListItem[]>([]);
  const [people, setPeople] = useState<AdminUserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [creditLedger, setCreditLedger] = useState<CreditLedgerRow[]>([]);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  // Phase 19 Operational State
  const [economicsSummary, setEconomicsSummary] = useState<AdminEconomicsSummary | null>(null);
  const [reservationsData, setReservationsData] = useState<PaginatedResult<AdminReservationItem> | null>(null);
  const [reservationPage, setReservationPage] = useState(1);
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>("");
  const [pendingUnknownItems, setPendingUnknownItems] = useState<AdminPendingUnknownItem[]>([]);
  const [backlogItems, setBacklogItems] = useState<AdminReconciliationBacklogItem[]>([]);
  const [providerHealthList, setProviderHealthList] = useState<AdminProviderHealthItem[]>([]);
  const [pricingRulesList, setPricingRulesList] = useState<AdminPricingModelItem[]>([]);
  const [auditLogData, setAuditLogData] = useState<PaginatedResult<AdminAuditLogRow> | null>(null);
  const [auditPage, setAuditPage] = useState(1);

  // Modals state
  const [creditTargetUser, setCreditTargetUser] = useState<AdminUserListItem | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserListItem | null>(null);
  const [createCouponOpen, setCreateCouponOpen] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setOperationError(null);
      const [
        pendingRes,
        peopleRes,
        ledgerRes,
        couponsRes,
        economicsRes,
        reservationsRes,
        unknownRes,
        backlogRes,
        providersRes,
        pricingRes,
        auditRes,
      ] = await Promise.all([
        getPendingApprovals(),
        getAllPeople(searchQuery),
        getCreditLedger(),
        listCoupons(),
        getAdminEconomicsSummary(),
        getAdminReservations({ page: reservationPage, pageSize: 15, status: reservationStatusFilter || undefined }),
        getAdminPendingUnknown(),
        getAdminReconciliationBacklog(),
        getAdminProviderOperations(),
        getAdminPricingConfig(),
        getAdminAuditLog({ page: auditPage, pageSize: 20 }),
      ]);

      if (pendingRes.data) setPendingUsers(pendingRes.data);
      if (peopleRes.data) setPeople(peopleRes.data);
      if (ledgerRes.data) setCreditLedger(ledgerRes.data);
      if (couponsRes.data) setCoupons(couponsRes.data);
      if (economicsRes.data) setEconomicsSummary(economicsRes.data);
      if (reservationsRes.data) setReservationsData(reservationsRes.data);
      if (unknownRes.data) setPendingUnknownItems(unknownRes.data);
      if (backlogRes.data) setBacklogItems(backlogRes.data);
      if (providersRes.data) setProviderHealthList(providersRes.data);
      if (pricingRes.data) setPricingRulesList(pricingRes.data);
      if (auditRes.data) setAuditLogData(auditRes.data);
    } catch (err: any) {
      console.warn("[AdminShell] loadData notice:", err);
      setOperationError(err?.message || "Failed to load admin data");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, reservationPage, reservationStatusFilter, auditPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  const handleApprove = async (user: AdminUserListItem) => {
    try {
      setOperationError(null);
      setActionLoadingId(user.id);
      const res = await approveUser(user.id, actorId);
      if (res.error || res.data !== true) {
        setOperationError(`Approval failed: ${res.error || "Profile access status was not updated"}`);
        return;
      }
      setPendingUsers((prev) => prev.filter((p) => p.id !== user.id));
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "active" } : p))
      );
    } catch (err: any) {
      console.warn("[Admin] handleApprove notice:", err);
      setOperationError(err?.message || "Failed to approve user");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (user: AdminUserListItem) => {
    try {
      setOperationError(null);
      setActionLoadingId(user.id);
      const res = await rejectUser(user.id, actorId, "Rejected by administrator");
      if (res.error || res.data !== true) {
        setOperationError(`Reject failed: ${res.error || "Profile access status was not updated"}`);
        return;
      }
      setPendingUsers((prev) => prev.filter((p) => p.id !== user.id));
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "rejected" } : p))
      );
    } catch (err: any) {
      console.warn("[Admin] handleReject notice:", err);
      setOperationError(err?.message || "Failed to reject user");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBan = async (user: AdminUserListItem) => {
    try {
      setOperationError(null);
      setActionLoadingId(user.id);
      const res = await banUser(user.id, actorId, "Banned by administrator");
      if (res.error || res.data !== true) {
        setOperationError(`Ban failed: ${res.error || "Profile access status was not updated"}`);
        return;
      }
      setPendingUsers((prev) => prev.filter((p) => p.id !== user.id));
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "banned" } : p))
      );
    } catch (err: any) {
      console.warn("[Admin] handleBan notice:", err);
      setOperationError(err?.message || "Failed to ban user");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnban = async (user: AdminUserListItem) => {
    try {
      setOperationError(null);
      setActionLoadingId(user.id);
      const res = await unbanUser(user.id, actorId);
      if (res.error) {
        setOperationError(`Unban failed: ${res.error}`);
        return;
      }
      setPeople((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, access_status: "active" } : p))
      );
    } catch (err: any) {
      console.warn("[Admin] handleUnban notice:", err);
      setOperationError(err?.message || "Failed to unban user");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCredits = async (delta: number, reason: string) => {
    if (!creditTargetUser) return;
    setOperationError(null);
    const res = await adjustCredits(creditTargetUser.id, delta, reason, actorId);
    if (res.error) {
      throw new Error(res.error);
    }
    if (res.data !== null && res.data !== undefined) {
      const newBal = res.data;
      setPeople((prev) =>
        prev.map((p) => (p.id === creditTargetUser.id ? { ...p, credit_balance: newBal } : p))
      );
      const [ledgerRes, econRes] = await Promise.all([
        getCreditLedger(),
        getAdminEconomicsSummary(),
      ]);
      if (ledgerRes.data) setCreditLedger(ledgerRes.data);
      if (econRes.data) setEconomicsSummary(econRes.data);
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

  const handleToggleProvider = async (providerId: string, currentEnabled: boolean) => {
    try {
      setActionLoadingId(providerId);
      const res = await setProviderOperationStatus(providerId, !currentEnabled, actorId);
      if (res.data) {
        setProviderHealthList((prev) =>
          prev.map((p) =>
            p.providerId === providerId
              ? { ...p, enabled: !currentEnabled, status: !currentEnabled ? "healthy" : "disabled" }
              : p
          )
        );
      }
    } catch (err: any) {
      setOperationError(err?.message || "Failed to toggle provider");
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
    { id: "economics", label: "Economics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "reservations", label: "Reservations", icon: <Layers className="w-4 h-4" /> },
    { id: "providers", label: "Providers", icon: <Activity className="w-4 h-4" /> },
    { id: "pricing", label: "Pricing", icon: <Tag className="w-4 h-4" /> },
    {
      id: "operations",
      label: "Operations",
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: backlogItems.length > 0 ? backlogItems.length : undefined,
    },
    { id: "credits", label: "Credits", icon: <Coins className="w-4 h-4" /> },
    { id: "coupons", label: "Coupons", icon: <Ticket className="w-4 h-4" /> },
    { id: "audit", label: "Audit Log", icon: <FileText className="w-4 h-4" /> },
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
                Admin OS
              </span>
            </div>
          </div>

          {/* Desktop Navigation Pill Tabs */}
          <nav className="hidden xl:flex items-center gap-1 bg-white/[0.035] p-1 rounded-xl border border-white/[0.09]">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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

      {/* Sub-Navigation Bar for Small & Medium Screens */}
      <div className="xl:hidden border-b border-white/[0.09] bg-[#0B0F17]/95 px-4 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-purple-600/30 text-white border border-purple-500/40"
                  : "text-white/50 hover:text-white hover:bg-white/5"
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
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {operationError && (
          <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-xs text-destructive flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{operationError}</span>
            </div>
            <button
              onClick={() => setOperationError(null)}
              className="text-white/60 hover:text-white ml-2 cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 1: Inbox */}
        {/* ========================================================================= */}
        {activeTab === "inbox" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Inbox</h1>
                <p className="text-xs text-white/50 mt-1">Sparks waiting for approval</p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                {pendingUsers.length} awaiting review
              </span>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-12 text-center space-y-5 max-w-lg mx-auto my-12 animate-in fade-in duration-300">
                <div className="flex items-center justify-center">
                  <MainLogoAnimated size={56} />
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

        {/* ========================================================================= */}
        {/* Tab 2: People */}
        {/* ========================================================================= */}
        {activeTab === "people" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">People</h1>
                <p className="text-xs text-white/50 mt-1">All creators, directors, and workspace owners.</p>
              </div>

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

                        {isUserAdmin && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 uppercase font-bold">
                            Admin
                          </span>
                        )}

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

        {/* ========================================================================= */}
        {/* Tab 3: Phase 19 Economics Overview */}
        {/* ========================================================================= */}
        {activeTab === "economics" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Economics Overview</h1>
                <p className="text-xs text-white/50 mt-1">
                  Canonical financial projection: revenue value, provider spend, pending exposure & actual margin.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-white/60">
                  Policy: <strong className="text-purple-300">{economicsSummary?.pricingPolicyVersion || "spark-credit-v1.0"}</strong> (100 cr/$1)
                </span>
              </div>
            </div>

            {/* Top Key KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Gross Settled Revenue */}
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-1">
                <span className="text-white/40 text-[11px] font-mono uppercase tracking-wider">Gross Settled Revenue</span>
                <p className="text-2xl font-bold text-emerald-400 font-mono">
                  ${economicsSummary?.grossSettledRevenueUsd?.toFixed(2) ?? "0.00"}
                </p>
                <p className="text-[11px] text-white/50 font-mono">
                  From {economicsSummary?.totalCreditsSettled ?? 0} settled credits
                </p>
              </div>

              {/* Card 2: Known Provider Spend */}
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-1">
                <span className="text-white/40 text-[11px] font-mono uppercase tracking-wider">Known Provider Spend</span>
                <p className="text-2xl font-bold text-amber-300 font-mono">
                  ${economicsSummary?.totalKnownProviderCostUsd?.toFixed(4) ?? "0.0000"}
                </p>
                <p className="text-[11px] text-white/50 font-mono">
                  Across verified provider invoices
                </p>
              </div>

              {/* Card 3: Actual Net Margin */}
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-1">
                <span className="text-white/40 text-[11px] font-mono uppercase tracking-wider">Actual Net Margin</span>
                {economicsSummary?.actualMarginUsd !== null && economicsSummary?.actualMarginUsd !== undefined ? (
                  <>
                    <p className="text-2xl font-bold text-purple-300 font-mono">
                      ${economicsSummary.actualMarginUsd.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-emerald-400 font-mono">
                      Margin: {economicsSummary.marginPercentage?.toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-zinc-400 font-mono flex items-center gap-1.5">
                      <span>UNKNOWN</span>
                    </p>
                    <p className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{economicsSummary?.unknownProviderCostCount ?? 0} unmeasured executions</span>
                    </p>
                  </>
                )}
              </div>

              {/* Card 4: Pending Unknown Exposure */}
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-1">
                <span className="text-white/40 text-[11px] font-mono uppercase tracking-wider">Unknown Exposure</span>
                <p className="text-2xl font-bold text-rose-400 font-mono">
                  ${economicsSummary?.pendingUnknownExposureUsd?.toFixed(2) ?? "0.00"}
                </p>
                <p className="text-[11px] text-white/50 font-mono">
                  {economicsSummary?.pendingUnknownCount ?? 0} reservations ({economicsSummary?.pendingUnknownExposureCredits ?? 0} credits)
                </p>
              </div>
            </div>

            {/* Secondary Economics Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Credit Flow Breakdown */}
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-purple-400" />
                  <span>Credit Movement & Liquidity</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.05]">
                    <span className="text-white/60">Circulating User Balances</span>
                    <span className="font-mono font-bold text-white">{economicsSummary?.totalCirculatingCredits ?? 0} credits</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.05]">
                    <span className="text-white/60">Active In-Flight Holds</span>
                    <span className="font-mono font-bold text-amber-300">{economicsSummary?.totalCreditsActiveReserved ?? 0} credits</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.05]">
                    <span className="text-white/60">Settled (Consumed)</span>
                    <span className="font-mono font-bold text-emerald-400">{economicsSummary?.totalCreditsSettled ?? 0} credits</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.05]">
                    <span className="text-white/60">Released (Unused Return)</span>
                    <span className="font-mono font-bold text-white/80">{economicsSummary?.totalCreditsReleased ?? 0} credits</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-white/60">Refunded to Users</span>
                    <span className="font-mono font-bold text-purple-300">{economicsSummary?.totalCreditsRefunded ?? 0} credits</span>
                  </div>
                </div>
              </div>

              {/* Truthful Architecture Invariant Note */}
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-400" />
                  <span>Permanent Economic Law</span>
                </h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  <strong>SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.</strong>
                </p>
                <ul className="text-xs text-white/50 space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li>Provider actual cost is measured from returned billable usage evidence, never assumed free.</li>
                  <li>When provider execution state is <code className="text-amber-300">TIMEOUT</code> or <code className="text-amber-300">UNKNOWN</code>, actual cost is strictly recorded as <code className="text-purple-300">UNKNOWN</code>.</li>
                  <li>Margin is computed only when both nominal credit revenue value and provider cost are truthfully verified.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 4: Reservations */}
        {/* ========================================================================= */}
        {activeTab === "reservations" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Reservations</h1>
                <p className="text-xs text-white/50 mt-1">Authoritative credit reservations, settlements, holds & provider costs.</p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={reservationStatusFilter}
                  onChange={(e) => {
                    setReservationStatusFilter(e.target.value);
                    setReservationPage(1);
                  }}
                  className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="" className="bg-[#0B0F17]">All Statuses</option>
                  <option value="ACTIVE" className="bg-[#0B0F17]">ACTIVE</option>
                  <option value="SETTLED" className="bg-[#0B0F17]">SETTLED</option>
                  <option value="RELEASED" className="bg-[#0B0F17]">RELEASED</option>
                  <option value="PENDING_UNKNOWN" className="bg-[#0B0F17]">PENDING_UNKNOWN</option>
                  <option value="REFUNDED" className="bg-[#0B0F17]">REFUNDED</option>
                </select>
              </div>
            </div>

            {/* Reservations Table */}
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.07] bg-white/[0.02] text-white/40 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Reservation ID / Task</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Held</th>
                      <th className="py-3 px-4">Consumed / Released</th>
                      <th className="py-3 px-4">Provider Cost</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {!reservationsData || reservationsData.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-white/40">
                          No reservations found for selected filter.
                        </td>
                      </tr>
                    ) : (
                      reservationsData.items.map((r) => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono text-purple-300 block">{r.id.slice(0, 8)}...</span>
                            <span className="text-[10px] text-white/40 font-mono">gen: {r.generationId.slice(0, 8)}...</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-white/80">
                            {r.userEmail || `${r.userId.slice(0, 8)}...`}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {r.amount} cr
                          </td>
                          <td className="py-3 px-4 font-mono text-white/70">
                            <span className="text-emerald-400">{r.consumedAmount}c</span> /{" "}
                            <span className="text-white/40">{r.releasedAmount}r</span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {r.actualCostStatus === "EXACT" && r.actualProviderCostUsd !== null ? (
                              <span className="text-emerald-400">${r.actualProviderCostUsd.toFixed(4)}</span>
                            ) : r.actualCostStatus === "ESTIMATED" ? (
                              <span className="text-amber-300">~${r.estimatedProviderCostUsd.toFixed(4)}</span>
                            ) : (
                              <span className="text-rose-400 font-bold">UNKNOWN</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {r.status === "ACTIVE" && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                                ACTIVE
                              </span>
                            )}
                            {r.status === "SETTLED" && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                                SETTLED
                              </span>
                            )}
                            {r.status === "RELEASED" && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50">
                                RELEASED
                              </span>
                            )}
                            {r.status === "PENDING_UNKNOWN" && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">
                                PENDING_UNKNOWN
                              </span>
                            )}
                            {r.status === "REFUNDED" && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
                                REFUNDED
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-white/40">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              {reservationsData && reservationsData.totalPages > 1 && (
                <div className="p-3 border-t border-white/[0.07] bg-white/[0.02] flex items-center justify-between text-xs">
                  <span className="text-white/40">
                    Page {reservationsData.page} of {reservationsData.totalPages} ({reservationsData.total} items)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReservationPage((p) => Math.max(1, p - 1))}
                      disabled={reservationsData.page <= 1}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setReservationPage((p) => Math.min(reservationsData.totalPages, p + 1))}
                      disabled={reservationsData.page >= reservationsData.totalPages}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 5: Providers & Live Health */}
        {/* ========================================================================= */}
        {activeTab === "providers" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Providers & Live Health</h1>
              <p className="text-xs text-white/50 mt-1">
                Measured latency, error rate telemetry, active pricing schemes & circuit breakers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providerHealthList.map((p) => {
                const isHealthy = p.status === "healthy";
                const isDegraded = p.status === "degraded";
                const isDisabled = p.status === "disabled" || !p.enabled;

                return (
                  <div
                    key={p.providerId}
                    className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 space-y-4 transition-all hover:border-white/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-sm text-white">{p.name}</h3>
                        <span className="text-[10px] font-mono text-white/40 uppercase">{p.providerId}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                          isDisabled
                            ? "bg-zinc-500/10 border border-zinc-500/30 text-zinc-400"
                            : isHealthy
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                            : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    {/* Telemetry Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <span className="text-[10px] uppercase font-mono block text-white/40">Latency</span>
                        <span className="font-mono font-bold text-white">{p.latencyMs} ms</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <span className="text-[10px] uppercase font-mono block text-white/40">Error Rate</span>
                        <span className="font-mono font-bold text-white">{(p.errorRate * 100).toFixed(2)}%</span>
                      </div>
                    </div>

                    {/* Pricing Rules Count */}
                    <div className="flex items-center justify-between text-xs text-white/60 pt-2 border-t border-white/[0.06]">
                      <span>Active Models: <strong>{p.pricingRulesCount}</strong></span>
                      <button
                        onClick={() => handleToggleProvider(p.providerId, p.enabled)}
                        disabled={actionLoadingId === p.providerId}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          p.enabled
                            ? "bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{p.enabled ? "Disable" : "Enable"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 6: Pricing Registry */}
        {/* ========================================================================= */}
        {activeTab === "pricing" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Pricing Registry</h1>
              <p className="text-xs text-white/50 mt-1">
                Canonical provider rates, billing schemes, versioning and provenance tracking.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.07] bg-white/[0.02] text-white/40 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Provider / Model</th>
                      <th className="py-3 px-4">Modality</th>
                      <th className="py-3 px-4">Billing Scheme</th>
                      <th className="py-3 px-4">Rate</th>
                      <th className="py-3 px-4">Version</th>
                      <th className="py-3 px-4">Provenance Source</th>
                      <th className="py-3 px-4">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {pricingRulesList.map((rule, idx) => (
                      <tr key={`${rule.providerId}-${rule.modelId}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{rule.modelId}</span>
                          <span className="text-[10px] text-purple-300 font-mono">{rule.providerId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 uppercase">
                            {rule.modality}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-white/70">
                          {rule.billingScheme}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {rule.rateDescription}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-white/50">
                          {rule.pricingVersion}
                        </td>
                        <td className="py-3 px-4 text-white/70 truncate max-w-[200px]" title={rule.provenanceSource}>
                          {rule.provenanceSource}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="text-emerald-400">{(rule.confidence * 100).toFixed(0)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 7: Operations & Backlog */}
        {/* ========================================================================= */}
        {activeTab === "operations" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Operations & Incidents</h1>
              <p className="text-xs text-white/50 mt-1">
                Reconciliation backlog, stalled reservations, and unknown exposure resolution.
              </p>
            </div>

            {/* Backlog Items */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Active Reconciliation Backlog ({backlogItems.length})</span>
              </h3>

              {backlogItems.length === 0 ? (
                <div className="p-8 rounded-2xl border border-white/[0.09] bg-white/[0.02] text-center text-xs text-white/40">
                  Zero items in reconciliation backlog. All provider jobs and reservations are clean.
                </div>
              ) : (
                <div className="space-y-2">
                  {backlogItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-300">
                            Hold: {item.amount} credits
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {item.status}
                          </span>
                          <span className="text-white/40 font-mono">Age: {item.ageMinutes} mins</span>
                        </div>
                        <p className="text-[11px] text-white/50 font-mono">
                          Reservation: {item.reservationId} | User: {item.userId}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-purple-300 px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                          {item.recommendedAction}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exposure Queue */}
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>Pending Unknown Exposure ({pendingUnknownItems.length})</span>
              </h3>

              {pendingUnknownItems.length === 0 ? (
                <div className="p-8 rounded-2xl border border-white/[0.09] bg-white/[0.02] text-center text-xs text-white/40">
                  Zero reservations in PENDING_UNKNOWN state.
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingUnknownItems.map((u) => (
                    <div
                      key={u.reservationId}
                      className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-rose-300">{u.amount} credits held</span>
                          <span className="text-white/40 font-mono">Age: {u.ageMinutes}m</span>
                        </div>
                        <p className="text-[11px] text-white/60">{u.reason}</p>
                      </div>
                      <span className="font-mono text-[10px] text-white/40">
                        {new Date(u.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 8: Credits (Existing) */}
        {/* ========================================================================= */}
        {activeTab === "credits" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Credits</h1>
              <p className="text-xs text-white/50 mt-1">Generation quotas, model provider balances & manual grants.</p>
            </div>

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

        {/* ========================================================================= */}
        {/* Tab 9: Coupons (Existing) */}
        {/* ========================================================================= */}
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

        {/* ========================================================================= */}
        {/* Tab 10: Admin Audit Log */}
        {/* ========================================================================= */}
        {activeTab === "audit" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Admin Audit Log</h1>
              <p className="text-xs text-white/50 mt-1">Immutable audit trail of all executive and administrative actions.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.07] bg-white/[0.02] text-white/40 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Target User</th>
                      <th className="py-3 px-4">Metadata</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {!auditLogData || auditLogData.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-white/40">
                          No audit log records found.
                        </td>
                      </tr>
                    ) : (
                      auditLogData.items.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-purple-300">
                            {log.action}
                          </td>
                          <td className="py-3 px-4 font-mono text-white/70">
                            {log.actor_id.slice(0, 8)}...
                          </td>
                          <td className="py-3 px-4 font-mono text-white/60">
                            {log.target_user_id ? `${log.target_user_id.slice(0, 8)}...` : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-white/50 truncate max-w-[280px]">
                            {JSON.stringify(log.meta)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-white/40">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Audit Pagination */}
              {auditLogData && auditLogData.totalPages > 1 && (
                <div className="p-3 border-t border-white/[0.07] bg-white/[0.02] flex items-center justify-between text-xs">
                  <span className="text-white/40">
                    Page {auditLogData.page} of {auditLogData.totalPages} ({auditLogData.total} logs)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={auditLogData.page <= 1}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAuditPage((p) => Math.min(auditLogData.totalPages, p + 1))}
                      disabled={auditLogData.page >= auditLogData.totalPages}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
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
