import { Search, Bell, ChevronDown, Radio } from "lucide-react";

interface TopBarProps {
  workspaceName?: string;
  channelName?: string;
  notificationCount?: number;
  userName?: string;
  userRole?: string;
  showChannelSwitcher?: boolean;
}

export function TopBar({
  workspaceName = "Main Workspace",
  channelName,
  notificationCount = 3,
  userName = "Alex Rivera",
  userRole = "Director",
  showChannelSwitcher = false,
}: TopBarProps) {
  return (
    <div className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        {showChannelSwitcher ? (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
            <Radio className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-medium">{channelName || "Select Channel"}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
            <span className="text-sm font-medium">{workspaceName}</span>
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
        <button className="relative p-2 rounded-lg hover:bg-accent/20 transition-colors">
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          )}
        </button>

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
