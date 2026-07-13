import { Zap, Brain, TrendingUp, CheckSquare, Calendar, BarChart3, MoreHorizontal, Crown } from "lucide-react";

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
    if (path === "/review") return currentPath.startsWith("/review");
    if (path === "/more") return currentPath.startsWith("/more") || currentPath === "/terms" || currentPath === "/privacy";
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
        <p className="text-xs text-muted-foreground mt-1">Spark · Media Operating System</p>
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

      <div className="p-3 border-t border-border/50">
        <button
          onClick={() => onNavigate?.("/more/billing")}
          className="group relative w-full flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-2.5 text-left select-none overflow-hidden cursor-pointer active:scale-98 transition-all duration-200"
        >
          {/* Reflective shine effect */}
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />

          {/* 3D Iridescent Soap Bubble Overlay */}
          <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
            {/* Soft moving rainbow oil/soap film - highly subtle for legibility */}
            <div className="absolute inset-0 opacity-[0.06] bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-blue-500 via-indigo-500 to-purple-500 bg-[length:200%_auto] animate-iridescent" />
            
            {/* Bubble reflection top curved highlight */}
            <div className="absolute top-[0.5px] inset-x-1.5 h-[30%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent" />
          </div>

          {/* Left Icon */}
          <div className="relative flex items-center justify-center w-7 h-7 rounded bg-accent/20 border border-accent/25 text-accent-foreground shrink-0 z-20">
            <span className="absolute inset-0 rounded bg-accent/20 blur-xs animate-pulse" />
            <Crown className="w-3.5 h-3.5 relative" />
          </div>

          {/* Text Content */}
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
