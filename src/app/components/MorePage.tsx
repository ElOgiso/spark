import { useState } from "react";
import { TopBar } from "./TopBar";
import { Button, SectionHeader, PageHeader } from "./ds";
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
  AlertCircle,
} from "lucide-react";

interface MorePageProps {
  onNavigate: (path: string) => void;
}

type AutomationMode = "manual" | "balanced" | "autonomous";

export function MorePage({ onNavigate }: MorePageProps) {
  const [automationMode, setAutomationMode] = useState<AutomationMode>("balanced");

  const automationConfig = {
    manual: { label: "Manual", desc: "All decisions require your approval", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    balanced: { label: "Balanced", desc: "AI handles routine, you approve strategy", color: "text-accent-foreground", bg: "bg-accent/20", border: "border-accent/40" },
    autonomous: { label: "Autonomous", desc: "AI operates independently, you set direction", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  };

  const aMode = automationConfig[automationMode];

  const sections = [
    {
      title: "Brand",
      items: [
        { icon: Archive, label: "Assets", description: "Brand media, templates, approved files", meta: "47 files" },
        { icon: Brain, label: "Memory", description: "Learned patterns and brand rules", meta: "24 rules", action: () => onNavigate("/my-spark") },
        { icon: Link, label: "Accounts", description: "Connected publishing accounts", meta: "4 active", action: () => onNavigate("/my-spark") },
      ],
    },
    {
      title: "Workspace",
      items: [
        { icon: CreditCard, label: "Billing", description: "Plan, usage, and invoices", meta: "Pro Plan" },
        { icon: Code, label: "API", description: "API keys and developer access", meta: null },
        { icon: Users, label: "Team", description: "Members, roles, and permissions", meta: "1 member" },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: Bell, label: "Notifications", description: "Alert types and delivery settings", meta: null },
        { icon: Shield, label: "Privacy", description: "Data retention and visibility settings", meta: null },
      ],
    },
    {
      title: "Legal & Support",
      items: [
        { icon: HelpCircle, label: "Support", description: "Contact support and view status", meta: null },
        { icon: FileText, label: "Legal", description: "Terms of service, privacy policy", meta: null },
      ],
    },
  ];

  const stats = [
    { label: "Productions This Month", value: "187" },
    { label: "AI Decisions Made", value: "1,204" },
    { label: "Hours Saved (est.)", value: "94h" },
    { label: "Plan", value: "Pro" },
  ];

  return (
    <>
      <TopBar workspaceName="More" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-8">

          <h1 className="text-3xl font-medium">More</h1>

          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-medium">
                  AR
                </div>
                <div>
                  <p className="text-lg font-medium">Alex Rivera</p>
                  <p className="text-sm text-muted-foreground">Director · alex@techinsightsng.com</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <span className="text-xs text-success">Pro Plan · Active</span>
                  </div>
                </div>
              </div>
              <button className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 text-sm font-medium transition-colors">
                Edit Profile
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/50">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-medium">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Automation Mode */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Automation Mode</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground mb-4">Controls how independently Spark operates your media brand</p>
              <div className="grid grid-cols-3 gap-3">
                {(["manual", "balanced", "autonomous"] as AutomationMode[]).map((mode) => {
                  const cfg = automationConfig[mode];
                  const isActive = automationMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setAutomationMode(mode)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        isActive ? `${cfg.bg} ${cfg.border}` : "bg-background border-border hover:border-accent/30"
                      }`}
                    >
                      <p className={`text-sm font-medium mb-1 ${isActive ? cfg.color : "text-muted-foreground"}`}>
                        {cfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug">{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Settings Sections */}
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">{section.title}</h2>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {section.items.map((item, i) => {
                  const Icon = item.icon;
                  const isLast = i === section.items.length - 1;
                  return (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-accent/5 active:bg-accent/10 transition-colors ${!isLast ? "border-b border-border/50" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                      {item.meta && (
                        <span className="text-xs text-muted-foreground mr-2">{item.meta}</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
      </main>
    </>
  );
}
