import { Zap, CheckSquare, Workflow, Radio, BarChart3, Settings } from "lucide-react";

interface NavItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const navItems: NavItem[] = [
  { name: "Command", icon: Zap, path: "/" },
  { name: "Review", icon: CheckSquare, path: "/review" },
  { name: "Flow", icon: Workflow, path: "/flow" },
  { name: "Channels", icon: Radio, path: "/channels" },
  { name: "Insights", icon: BarChart3, path: "/insights" },
  { name: "Studio", icon: Settings, path: "/studio" },
];

interface NavigationProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function Navigation({ currentPath = "/", onNavigate }: NavigationProps) {
  return (
    <nav className="w-64 h-screen bg-nav-background border-r border-border flex flex-col">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-xl font-medium text-foreground tracking-tight">
          Spark Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">AI Creative OS</p>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;

          return (
            <button
              key={item.name}
              onClick={() => onNavigate?.(item.path)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${
                  isActive
                    ? "bg-accent text-nav-active shadow-sm"
                    : "text-nav-foreground hover:bg-nav-hover hover:text-foreground"
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
