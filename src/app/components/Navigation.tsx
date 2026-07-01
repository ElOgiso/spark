import { Zap, Brain, TrendingUp, CheckSquare, Calendar, BarChart3, MoreHorizontal } from "lucide-react";

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
  const isActive = (path: string) => {
    if (path === "/review") return currentPath === "/review" || currentPath === "/review/creative";
    return currentPath === path;
  };

  return (
    <nav className="w-56 h-screen bg-nav-background border-r border-border flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-foreground" />
          <h1 className="text-lg font-medium text-foreground tracking-tight">
            Spark
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">AI Media OS</p>
      </div>

      <div className="flex-1 px-3 py-4 space-y-0.5">
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

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium">AR</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">Alex Rivera</p>
            <p className="text-xs text-muted-foreground">Director</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
