import { useState, useRef, useEffect } from "react";
import { Zap, Brain, TrendingUp, CheckSquare, Calendar, BarChart3, MoreHorizontal, Crown, User, LogOut, Settings, CreditCard, Key, ShieldCheck } from "lucide-react";
import { useAuth } from "../state/AuthContext";

interface NavItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const navItems: NavItem[] = [
  { name: "Spark", icon: Zap, path: "/" },
  { name: "My Spark", icon: Brain, path: "/my-spark" },
  { name: "Viral Sparks", icon: TrendingUp, path: "/viral-sparks" },
  { name: "Review", icon: CheckSquare, path: "/review" },
  { name: "Calendar", icon: Calendar, path: "/calendar" },
  { name: "Analytics", icon: BarChart3, path: "/analytics" },
  { name: "More", icon: MoreHorizontal, path: "/more" },
];

interface NavigationProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function Navigation({ currentPath = "/", onNavigate }: NavigationProps) {
  const auth = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const isActive = (path: string) => {
    if (path === "/review") return currentPath.startsWith("/review");
    if (path === "/more") return currentPath.startsWith("/more") || currentPath === "/terms" || currentPath === "/privacy";
    return currentPath === path;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await auth.signOut();
  };

  const userDisplayName = auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || "Executive User";

  return (
    <nav className="w-56 h-screen bg-nav-background border-r border-border flex flex-col flex-shrink-0 relative">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-foreground" />
          <h1 className="text-lg font-medium text-foreground tracking-tight">
            Spark
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Spark · Media Operating System</p>
      </div>

      <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.name}
              onClick={() => onNavigate?.(item.path)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${
                  active
                    ? "bg-accent text-nav-active shadow-sm"
                    : "text-nav-foreground hover:bg-nav-hover hover:text-foreground"
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{item.name}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-border/50 space-y-2 relative" ref={dropdownRef}>
        {/* User Profile Avatar Card */}
        {auth.isAuthenticated && (
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-card border border-border/80 hover:border-blue-500/40 text-left transition-all"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                {userDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{userDisplayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{auth.currentUser?.email}</p>
              </div>
            </div>
            <MoreHorizontal className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          </button>
        )}

        {/* User Profile Dropdown */}
        {profileOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border rounded-xl shadow-2xl p-2 z-50 space-y-1 backdrop-blur-xl text-xs">
            <div className="px-2 py-1.5 border-b border-border/50 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Session Status</span>
              <span className="flex items-center text-emerald-400 font-mono">
                <ShieldCheck className="w-3 h-3 mr-1" /> Active
              </span>
            </div>

            <button
              onClick={() => { setProfileOpen(false); onNavigate?.("/more/profile"); }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => { setProfileOpen(false); onNavigate?.("/more/workspace"); }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>

            <button
              onClick={() => { setProfileOpen(false); onNavigate?.("/more/billing"); }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Billing</span>
            </button>

            <button
              onClick={() => { setProfileOpen(false); onNavigate?.("/more/integrations"); }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>API Credentials</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-red-950/20 text-red-400 hover:bg-red-950/40 transition-colors border border-red-500/20 mt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="font-medium">Global Sign Out</span>
            </button>
          </div>
        )}

        {/* Pro Plan Indicator */}
        <button
          onClick={() => onNavigate?.("/more/billing")}
          className="group relative w-full flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-2.5 text-left select-none overflow-hidden cursor-pointer active:scale-98 transition-all duration-200"
        >
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />
          <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06] bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-blue-500 via-indigo-500 to-purple-500 bg-[length:200%_auto] animate-iridescent" />
            <div className="absolute top-[0.5px] inset-x-1.5 h-[30%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent" />
          </div>

          <div className="relative flex items-center justify-center w-7 h-7 rounded bg-accent/20 border border-accent/25 text-accent-foreground shrink-0 z-20">
            <span className="absolute inset-0 rounded bg-accent/20 blur-xs animate-pulse" />
            <Crown className="w-3.5 h-3.5 relative" />
          </div>

          <div className="flex-1 min-w-0 z-20">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-foreground leading-none truncate">Pro Plan</span>
              <span className="text-[8px] font-bold text-accent-foreground bg-accent/20 border border-accent/30 px-1 py-0.2 rounded-sm uppercase tracking-wider shrink-0">PRO</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-none mt-1 truncate">Enterprise billing · Aug 1</p>
          </div>
        </button>
      </div>
    </nav>
  );
}

