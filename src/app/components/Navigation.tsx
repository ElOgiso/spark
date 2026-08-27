import { useState, useRef, useEffect } from "react";
import { Zap, Brain, TrendingUp, CheckSquare, Calendar, BarChart3, MoreHorizontal, Crown, User, LogOut, Settings, CreditCard, Key, ShieldCheck } from "lucide-react";
import { useAuth } from "../state/AuthContext";
import { SparkLogo } from "./SparkLogo";

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
        <div className="flex items-center gap-3">
          <SparkLogo variant="superspark" className="w-8 h-8 flex-shrink-0" />
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Spark
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">Media Operating System</p>
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
                    ? "bg-accent text-nav-active shadow-sm font-semibold"
                    : "text-nav-foreground hover:bg-nav-hover hover:text-foreground"
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-border/50 relative" ref={dropdownRef}>
        <button
          onClick={() => setProfileOpen((prev) => !prev)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-nav-hover transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-200 text-xs font-bold border border-purple-500/30">
            {userDisplayName.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{userDisplayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{auth.currentUser?.email || "Pro Plan"}</p>
          </div>
        </button>

        {profileOpen && (
          <div className="absolute bottom-16 left-3 right-3 bg-popover border border-border rounded-xl p-2 shadow-2xl z-50 animate-in fade-in duration-150 space-y-1">
            {auth.isAdmin && (
              <button
                onClick={() => {
                  setProfileOpen(false);
                  onNavigate?.("/admin/inbox");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 font-medium transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Admin access</span>
              </button>
            )}
            <button
              onClick={() => {
                setProfileOpen(false);
                onNavigate?.("/more");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-accent/15 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
