import { Search, ChevronDown, Radio } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

interface TopBarProps {
  pageName?: string;
  accountName?: string;
  userName?: string;
  userRole?: string;
  showAccountSwitcher?: boolean;
  onNavigate?: (path: string) => void;
}

export function TopBar({
  pageName = "Platform",
  accountName,
  userName = "Alex Rivera",
  userRole = "Director",
  showAccountSwitcher = false,
  onNavigate,
}: TopBarProps) {
  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      console.warn("onNavigate not provided to TopBar, cannot navigate to:", path);
    }
  };

  return (
    <div className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        {showAccountSwitcher ? (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
            <Radio className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-medium">{accountName || "Select Account"}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
            <span className="text-sm font-medium">{pageName}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-input-background border border-transparent hover:border-border focus:border-accent focus:outline-none transition-colors text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationCenter onNavigate={handleNavigate} />

        <button className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
          <div className="text-right">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
            <span className="text-sm font-medium">
              {userName.split(" ").map((n) => n[0]).join("")}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
