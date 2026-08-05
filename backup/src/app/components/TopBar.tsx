import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, CreditCard, Settings, Key, LogOut, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { useSpark } from "../state/SparkContext";
import { useAuth } from "../state/AuthContext";
import { Button } from "./ds";

interface TopBarProps {
  pageName?: string;
  accountName?: string;
  userName?: string;
  userRole?: string;
  showAccountSwitcher?: boolean;
  onNavigate?: (path: string) => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
}

interface SearchItem {
  name: string;
  path: string;
  category: string;
}

const searchItems: SearchItem[] = [
  { name: "Dashboard / Home", path: "/", category: "Navigation" },
  { name: "My Spark AI Workspace", path: "/my-spark", category: "Navigation" },
  { name: "Viral Sparks Generator", path: "/viral-sparks", category: "Navigation" },
  { name: "Creative Review Queue", path: "/review", category: "Workflow" },
  { name: "Content Calendar & Planner", path: "/calendar", category: "Workflow" },
  { name: "Channel Analytics Dashboard", path: "/analytics", category: "Analytics" },
  { name: "Workspace Storage Assets", path: "/more/assets", category: "Settings" },
  { name: "AI Memory & Brand Rules", path: "/more/memory", category: "Settings" },
  { name: "Connected Channels & Accounts", path: "/more/accounts", category: "Settings" },
  { name: "Theme & Visual Appearance", path: "/more/theme", category: "Settings" },
  { name: "Billing, Plans & Subscriptions", path: "/more/billing", category: "Settings" },
  { name: "Developer API & Webhooks", path: "/more/api", category: "Settings" },
];

export function TopBar({
  onNavigate,
  onOpenAuth,
}: TopBarProps) {
  const auth = useAuth();
  const { brand } = useSpark() as any;

  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const displayName = auth.profile?.display_name || auth.currentUser?.email || (auth.isAuthenticated ? "Creator" : null);
  const userRole = auth.profile?.role || (auth.isAuthenticated ? "Director" : "");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setIsWorkspaceOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
    setIsProfileOpen(false);
    setIsWorkspaceOpen(false);
    setIsSearchFocused(false);
    setSearchQuery("");
  };

  const filteredSearch = searchItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6 select-none relative z-40 shadow-sm">
      <div className="flex items-center gap-6">
        {/* Workspace Switcher */}
        <div ref={workspaceRef} className="relative">
          <button
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/5 hover:bg-accent/15 border border-border/40 hover:border-border transition-all active:scale-[0.98] cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold tracking-tight">{brand?.name || "Spark Workspace"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {isWorkspaceOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in duration-150">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/40 mb-1">
                Active Brand OS
              </div>
              <div className="px-3 py-2 rounded-lg bg-accent/20 border border-accent/30 text-xs font-semibold flex items-center justify-between">
                <span>{brand?.name || "Spark Workspace"}</span>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          )}
        </div>

        {/* Global Quick Search */}
        <div ref={searchRef} className="relative hidden md:block">
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search sections, channels, settings..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/40 border border-border/40 hover:border-border/60 focus:border-accent/40 focus:outline-none transition-colors text-xs"
            />
          </div>

          {isSearchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 mt-2 w-96 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl z-50 max-h-[350px] overflow-y-auto scrollbar-none animate-in fade-in duration-150">
              {filteredSearch.length > 0 ? (
                <div className="space-y-1">
                  {filteredSearch.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleNavigate(item.path)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs hover:bg-accent/15 transition-all cursor-pointer"
                    >
                      <div>
                        <p className="font-medium text-xs">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.path}</p>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-accent-foreground bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">{item.category}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No matching workspace results found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationCenter onNavigate={handleNavigate} />

        {/* User Profile / Auth State */}
        {auth.isAuthenticated && displayName ? (
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-lg hover:bg-accent/10 border border-transparent hover:border-border/40 transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="text-right">
                <p className="text-xs font-semibold">{displayName}</p>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{userRole}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center border border-purple-500/40 text-purple-200">
                <span className="text-xs font-bold">
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in duration-150">
                <div className="px-3 py-2.5 border-b border-border/40 mb-2">
                  <p className="text-xs font-semibold leading-none">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{userRole} · Media Workspace Administrator</p>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => handleNavigate("/more")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-all cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" /> Account Settings
                  </button>
                  <button
                    onClick={() => handleNavigate("/more/billing")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-all cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Billing & Subscription
                  </button>
                  <button
                    onClick={() => handleNavigate("/more/api")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-all cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" /> API Keys & Access
                  </button>
                  <div className="h-[1px] bg-border/40 my-1" />
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      void auth.signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<LogIn className="w-3.5 h-3.5" />}
              onClick={() => onOpenAuth ? onOpenAuth("signin") : handleNavigate("/more")}
            >
              Sign In
            </Button>
            <Button
              variant="accent"
              size="sm"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => onOpenAuth ? onOpenAuth("signup") : handleNavigate("/more")}
            >
              Get Started
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
