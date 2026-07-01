import { useState } from "react";
import {
  Zap,
  Archive,
  Brain,
  Link,
  CreditCard,
  Code,
  Users,
  FileText,
  HelpCircle,
  Bell,
  Shield,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

type AutomationMode = "manual" | "balanced" | "autonomous";

export function MobileMore() {
  const [automationMode, setAutomationMode] = useState<AutomationMode>("balanced");

  const modeConfig = {
    manual: { label: "Manual", description: "All decisions require approval", color: "text-warning" },
    balanced: { label: "Balanced", description: "AI handles routine, you approve strategic", color: "text-accent-foreground" },
    autonomous: { label: "Autonomous", description: "AI makes most decisions", color: "text-success" },
  };

  const sections = [
    {
      title: "Brand",
      items: [
        { icon: Archive, label: "Assets", badge: "47 files" },
        { icon: Brain, label: "Memory", badge: "24 rules" },
        { icon: Link, label: "Accounts", badge: "4 active" },
      ],
    },
    {
      title: "Workspace",
      items: [
        { icon: CreditCard, label: "Billing", badge: "Pro Plan" },
        { icon: Code, label: "API", badge: null },
        { icon: Users, label: "Team", badge: "1 member" },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: Bell, label: "Notifications", badge: null },
        { icon: Shield, label: "Privacy", badge: null },
      ],
    },
    {
      title: "Legal & Support",
      items: [
        { icon: HelpCircle, label: "Support", badge: null },
        { icon: FileText, label: "Legal", badge: null },
      ],
    },
  ];

  const currentMode = modeConfig[automationMode];

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">More</h1>
        <p className="text-sm text-muted-foreground mt-1">Settings and management</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-medium">
            AR
          </div>
          <div className="flex-1">
            <h2 className="text-base font-medium">Alex Rivera</h2>
            <p className="text-sm text-muted-foreground">Director</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <span className="text-xs text-success">Pro Plan</span>
            </div>
          </div>
        </div>
        <button className="w-full py-2.5 px-4 rounded-lg border border-border hover:bg-accent/10 transition-colors text-sm font-medium">
          Edit Profile
        </button>
      </div>

      {/* Automation Mode */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3 px-1">Automation Mode</h3>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className={`p-3 rounded-lg bg-accent/10 border border-accent/20`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium ${currentMode.color}`}>{currentMode.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">{currentMode.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {(["manual", "balanced", "autonomous"] as AutomationMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setAutomationMode(mode)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  automationMode === mode
                    ? "bg-accent text-foreground"
                    : "bg-background border border-border text-muted-foreground"
                }`}
              >
                {modeConfig[mode].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      {sections.map((section) => (
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
                  className={`w-full flex items-center gap-3 p-4 text-left hover:bg-accent/5 active:bg-accent/10 transition-colors ${!isLast ? "border-b border-border/50" : ""}`}
                >
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="text-xs text-muted-foreground">{item.badge}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="text-center text-xs text-muted-foreground pb-4">
        Spark v2.0.0 · AI Media OS
      </div>
    </div>
  );
}
