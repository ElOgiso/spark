import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Radio, Check, CreditCard, Settings, Key, LogOut, ShieldCheck, Zap, Brain, TrendingUp, CheckSquare, Calendar as CalendarIcon, BarChart3, MoreHorizontal } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

interface TopBarProps {
  pageName?: string;
  accountName?: string;
  userName?: string;
  userRole?: string;
  showAccountSwitcher?: boolean;
  onNavigate?: (path: string) => void;
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
  { name: "Billing, Plans & Subscriptions", path: "/more/billing", category: "Settings" },
  { name: "Developer API & Webhooks", path: "/more/api", category: "Settings" },
];

const pages = [
  { name: "Spark", path: "/", icon: Zap },
  { name: "My Spark", path: "/my-spark", icon: Brain },
  { name: "Viral Sparks", path: "/viral-sparks", icon: TrendingUp },
  { name: "Review", path: "/review", icon: CheckSquare },
  { name: "Calendar", path: "/calendar", icon: CalendarIcon },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "More", path: "/more", icon: MoreHorizontal },
];

export function TopBar({
  pageName = "Spark",
  userName = "Alex Rivera",
  userRole = "Director",
  onNavigate,
}: TopBarProps) {
  const [isPageSelectorOpen, setIsPageSelectorOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const pageSelectorRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pageSelectorRef.current && !pageSelectorRef.current.contains(event.target as Node)) {
        setIsPageSelectorOpen(false);
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
    setIsPageSelectorOpen(false);
    setIsSearchFocused(false);
    setSearchQuery("");
  };

  const filteredSearch = searchItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Resolve active page icon
  const currentPageObj = pages.find(p => p.name.toLowerCase() === pageName.toLowerCase()) || pages[0];
  const PageIcon = currentPageObj.icon;

  return (
    <div className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 select-none relative z-40">
      <div className="flex items-center gap-6">
        
        {/* Page Switcher Dropdown (Spark Dropdown next to search) */}
        <div ref={pageSelectorRef} className="relative">
          <button
            onClick={() => setIsPageSelectorOpen(!isPageSelectorOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/5 hover:bg-accent/15 border border-border/40 hover:border-border transition-all active:scale-[0.98] cursor-pointer"
          >
            <PageIcon className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-medium">{pageName}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isPageSelectorOpen ? "rotate-180" : ""}`} />
          </button>

          {isPageSelectorOpen && (
            <div className="absolute left-0 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2.5 pb-2 border-b border-border/40 mb-2">Switch Workspace Page</p>
              <div className="space-y-1">
                {pages.map((p) => {
                  const Icon = p.icon;
                  const isActive = p.name.toLowerCase() === pageName.toLowerCase();
                  return (
                    <button
                      key={p.name}
                      onClick={() => handleNavigate(p.path)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-all hover:bg-accent/15 cursor-pointer ${isActive ? "bg-accent/10 text-foreground" : "text-muted-foreground"}`}
                    >
                      <Icon className="w-4 h-4 text-accent-foreground" />
                      <span className="font-medium text-xs flex-1">{p.name}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-accent-foreground animate-in zoom-in-75" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live Search Box */}
        <div ref={searchRef} className="relative">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search sections, channels, settings..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-input-background border border-transparent hover:border-border/60 focus:border-accent/40 focus:outline-none transition-colors text-sm"
            />
          </div>

          {isSearchFocused && (searchQuery.trim().length > 0 || isSearchFocused) && (
            <div className="absolute left-0 mt-2 w-96 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl z-50 max-h-[350px] overflow-y-auto scrollbar-none animate-in fade-in slide-in-from-top-1 duration-150">
              {filteredSearch.length > 0 ? (
                <div className="space-y-1">
                  {filteredSearch.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleNavigate(item.path)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm hover:bg-accent/15 transition-all cursor-pointer"
                    >
                      <div>
                        <p className="font-medium text-xs leading-none">{item.name}</p>
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

        {/* User Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-lg hover:bg-accent/10 border border-transparent hover:border-border/40 transition-all active:scale-[0.98] cursor-pointer"
          >
            <div className="text-right">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">{userRole}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center border border-accent-foreground/10 text-accent-foreground">
              <span className="text-sm font-medium">
                {userName.split(" ").map((n) => n[0]).join("")}
              </span>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* User Profile Details header */}
              <div className="px-3 py-2.5 border-b border-border/40 mb-2">
                <p className="text-xs font-semibold leading-none">{userName}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{userRole} · Media Workspace Administrator</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-semibold text-success bg-success/15 border border-success/20 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-2.5 h-2.5" /> Pro Member
                </div>
              </div>

              {/* Action Buttons */}
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
                    alert("Logging out from Spark Media OS workspace...");
                    window.location.reload();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout Workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
