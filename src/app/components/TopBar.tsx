import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Radio, Check, Plus, CreditCard, Settings, Key, LogOut, ShieldCheck, Zap, Brain, TrendingUp, CheckSquare, Calendar as CalendarIcon, BarChart3, MoreHorizontal } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { useSpark } from "../state/SparkContext";

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

export function TopBar({
  pageName = "Spark",
  userName = "Alex Rivera",
  userRole = "Director",
  onNavigate,
}: TopBarProps) {
  const { accounts } = useSpark() as any;
  const [workspaces, setWorkspaces] = useState<string[]>([
    "Tech Insights Nigeria",
    "Creative Studio",
    "Personal Brand"
  ]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("Tech Insights Nigeria");
  const [selectedAccount, setSelectedAccount] = useState("@TechInsightsNG");
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
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
    <div className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 select-none relative z-40">
      <div className="flex items-center gap-6">
        
        {/* Workspace Switcher Dropdown (next to search) */}
        <div ref={workspaceRef} className="relative">
          <button
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/5 hover:bg-accent/15 border border-border/40 hover:border-border transition-all active:scale-[0.98] cursor-pointer animate-in fade-in"
          >
            <Radio className="w-4 h-4 text-accent-foreground animate-pulse" />
            <span className="text-sm font-medium">{selectedWorkspace} · {selectedAccount}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isWorkspaceOpen ? "rotate-180" : ""}`} />
          </button>

          {isWorkspaceOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150 max-h-[480px] overflow-y-auto">
              {/* Workspaces Section */}
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2.5 pb-2 border-b border-border/40 mb-2">Switch Workspace</p>
              <div className="space-y-1 mb-3">
                {workspaces.map((ws) => (
                  <button
                    key={ws}
                    onClick={() => {
                      setSelectedWorkspace(ws);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-all hover:bg-accent/15 cursor-pointer ${selectedWorkspace === ws ? "bg-accent/10 text-foreground" : "text-muted-foreground"}`}
                  >
                    <span className="font-medium">{ws}</span>
                    {selectedWorkspace === ws && <Check className="w-3.5 h-3.5 text-accent-foreground" />}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const name = prompt("Enter new workspace name:");
                    if (name && name.trim()) {
                      setWorkspaces([...workspaces, name.trim()]);
                      setSelectedWorkspace(name.trim());
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-accent-foreground hover:bg-accent/15 cursor-pointer font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Fresh Workspace</span>
                </button>
              </div>

              {/* Accounts Section */}
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2.5 pb-2 border-b border-border/40 mb-2 mt-4">Switch Social Account</p>
              <div className="space-y-1">
                {accounts.map((acc: any) => (
                  <button
                    key={acc.handle}
                    onClick={() => {
                      setSelectedAccount(acc.handle || acc.name);
                      setIsWorkspaceOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-all hover:bg-accent/15 cursor-pointer ${selectedAccount === (acc.handle || acc.name) ? "bg-accent/10 text-foreground" : "text-muted-foreground"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${acc.status === "connected" ? "bg-success" : "bg-muted-foreground/45"}`} />
                      <div>
                        <p className="font-medium text-[11px] leading-none">{acc.platform}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{acc.handle || acc.name}</p>
                      </div>
                    </div>
                    {selectedAccount === (acc.handle || acc.name) && <Check className="w-3.5 h-3.5 text-accent-foreground animate-in zoom-in-75" />}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setIsWorkspaceOpen(false);
                    handleNavigate("/more/accounts");
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-accent-foreground hover:bg-accent/15 cursor-pointer font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Connect New Account</span>
                </button>
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
