import { Zap, CheckSquare, Workflow, BarChart3, MoreHorizontal } from "lucide-react";

type NavTab = "command" | "review" | "flow" | "insights" | "more";

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingReviews?: number;
}

const navItems = [
  { id: "command" as const, label: "Command", icon: Zap },
  { id: "review" as const, label: "Review", icon: CheckSquare },
  { id: "flow" as const, label: "Flow", icon: Workflow },
  { id: "insights" as const, label: "Insights", icon: BarChart3 },
  { id: "more" as const, label: "More", icon: MoreHorizontal },
];

export function BottomNavigation({
  activeTab,
  onTabChange,
  pendingReviews,
}: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const showBadge = item.id === "review" && pendingReviews && pendingReviews > 0;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                flex flex-col items-center justify-center gap-1 py-3 px-4 min-w-[60px]
                transition-all duration-200 relative
                ${isActive ? "text-foreground" : "text-muted-foreground"}
              `}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {showBadge && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-medium text-white">
                      {pendingReviews > 9 ? "9+" : pendingReviews}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
