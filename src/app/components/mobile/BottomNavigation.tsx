import { Zap, TrendingUp, CheckSquare, BarChart3, MoreHorizontal } from "lucide-react";

type NavTab = "spark" | "viral-sparks" | "review" | "analytics" | "more";

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingReviews?: number;
}

const navItems = [
  { id: "spark" as const, label: "Spark", icon: Zap },
  { id: "viral-sparks" as const, label: "Viral", icon: TrendingUp },
  { id: "review" as const, label: "Review", icon: CheckSquare },
  { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
  { id: "more" as const, label: "More", icon: MoreHorizontal },
];

export function BottomNavigation({
  activeTab,
  onTabChange,
  pendingReviews,
}: BottomNavigationProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 max-w-md mx-auto"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}
    >
      <div className="flex items-center justify-around px-2 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (activeTab === ("my-spark" as any) && item.id === "more");
          const showBadge = item.id === "review" && Boolean(pendingReviews && pendingReviews > 0);

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                flex flex-col items-center justify-center gap-1 py-1.5 px-3 min-w-[56px]
                transition-all duration-200 relative active:scale-95
                ${isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}
              `}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "text-accent-foreground" : ""}`} />
                {showBadge && (
                  <div className="absolute -top-1 -right-1.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-medium text-white">
                      {(pendingReviews ?? 0) > 9 ? "9+" : pendingReviews}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
