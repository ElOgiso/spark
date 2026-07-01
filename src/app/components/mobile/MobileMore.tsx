import {
  Settings,
  Zap,
  Plug,
  Bell,
  Users,
  CreditCard,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";

type AutomationMode = "manual" | "balanced" | "autonomous";

interface MobileMoreProps {
  automationMode?: AutomationMode;
}

export function MobileMore({ automationMode = "balanced" }: MobileMoreProps) {
  const modeConfig = {
    manual: {
      label: "Manual",
      description: "All decisions require approval",
      color: "text-warning",
    },
    balanced: {
      label: "Balanced",
      description: "AI handles routine, humans approve strategic",
      color: "text-accent-foreground",
    },
    autonomous: {
      label: "Autonomous",
      description: "AI makes most decisions",
      color: "text-success",
    },
  };

  const settingsSections = [
    {
      title: "Organization",
      items: [
        { icon: Settings, label: "Workspace Settings", badge: null },
        { icon: Users, label: "Team Management", badge: "3 members" },
        { icon: CreditCard, label: "Billing", badge: "Pro Plan" },
      ],
    },
    {
      title: "Configuration",
      items: [
        { icon: Zap, label: "Automation Settings", badge: "Balanced" },
        { icon: Plug, label: "Integrations", badge: "8 connected" },
        { icon: Bell, label: "Notifications", badge: null },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help Center", badge: null },
        { icon: Shield, label: "Privacy & Security", badge: null },
      ],
    },
  ];

  const currentMode = modeConfig[automationMode];

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">More</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Settings and management
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-2xl font-medium">
            AR
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-medium">Alex Rivera</h2>
            <p className="text-sm text-muted-foreground">Director</p>
            <p className="text-sm text-muted-foreground">alex@mediaos.ai</p>
          </div>
        </div>
        <button className="w-full py-2.5 px-4 rounded-lg border border-border hover:bg-accent/10 transition-colors text-sm font-medium">
          Edit Profile
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5" />
          <h2 className="text-base font-medium">Automation Mode</h2>
        </div>
        <div className={`p-3 rounded-lg bg-accent/10 border border-accent/20`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-medium ${currentMode.color}`}>
              {currentMode.label}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentMode.description}
          </p>
        </div>
      </div>

      {settingsSections.map((section) => (
        <div key={section.title}>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3 px-1">
            {section.title}
          </h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {section.items.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === section.items.length - 1;

              return (
                <button
                  key={item.label}
                  className={`
                    w-full flex items-center gap-3 p-4 text-left
                    hover:bg-accent/5 active:bg-accent/10 transition-colors
                    ${!isLast ? "border-b border-border/50" : ""}
                  `}
                >
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="text-xs text-muted-foreground">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive font-medium text-sm">
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      <div className="text-center text-xs text-muted-foreground pb-4">
        Media OS v1.0.0
      </div>
    </div>
  );
}
