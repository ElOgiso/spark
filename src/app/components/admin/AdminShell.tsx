import React, { useState, useEffect } from "react";
import { Inbox, Users, Coins, Ticket, ShieldCheck, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { SparkLogo } from "../SparkLogo";

export type AdminTab = "inbox" | "people" | "credits" | "coupons";

interface AdminShellProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function AdminShell({ currentPath = "/admin/inbox", onNavigate }: AdminShellProps) {
  const auth = useAuth();

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

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "inbox", label: "Inbox", icon: <Inbox className="w-4 h-4" /> },
    { id: "people", label: "People", icon: <Users className="w-4 h-4" /> },
    { id: "credits", label: "Credits", icon: <Coins className="w-4 h-4" /> },
    { id: "coupons", label: "Coupons", icon: <Ticket className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] text-white flex flex-col antialiased selection:bg-purple-500/30">
      {/* Top Admin Header */}
      <header className="h-16 border-b border-white/[0.09] px-4 sm:px-6 flex items-center justify-between bg-[#0B0F17]/90 backdrop-blur-md sticky top-0 z-50">
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
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Admin Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
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
            </button>
          );
        })}
      </div>

      {/* Main Admin Content Canvas */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Tab 1: Inbox (Default Landing) */}
        {activeTab === "inbox" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Inbox</h1>
              <p className="text-xs text-white/50 mt-1">Pending workspace approvals & onboarding reviews.</p>
            </div>

            {/* Calm Onboard Empty State */}
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
          </div>
        )}

        {/* Tab 2: People */}
        {activeTab === "people" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">People</h1>
              <p className="text-xs text-white/50 mt-1">All creators, directors, and workspace owners.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-8 space-y-3">
              <div className="flex items-center gap-3 text-purple-300">
                <Users className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-white">User Accounts & Workspace Directory</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Central user management, status overrides (active, pending, banned), and brand workspace associations.
              </p>
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

            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-8 space-y-3">
              <div className="flex items-center gap-3 text-purple-300">
                <Coins className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-white">Credit Allocations & Quota Controls</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Grant custom generation credits, adjust monthly brand allowances, and inspect AI generation usage.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Coupons */}
        {activeTab === "coupons" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Coupons</h1>
              <p className="text-xs text-white/50 mt-1">VIP invite codes, promotional access & onboarding bypass passes.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-8 space-y-3">
              <div className="flex items-center gap-3 text-purple-300">
                <Ticket className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-white">Promotional Codes & Access Passes</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Generate single-use or campaign invite codes to bypass approval gates and grant starter credits.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
