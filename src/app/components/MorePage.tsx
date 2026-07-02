import { useState } from "react";
import { TopBar } from "./TopBar";
import { Button } from "./ds";
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
  LogOut,
  X,
  User,
  Mail
} from "lucide-react";

interface MorePageProps {
  onNavigate: (path: string) => void;
}

type AutomationMode = "manual" | "balanced" | "autonomous";

export function MorePage({ onNavigate }: MorePageProps) {
  const [automationMode, setAutomationMode] = useState<AutomationMode>("balanced");
  const [profile, setProfile] = useState({
    name: "Alex Rivera",
    email: "alex@techinsightsng.com",
    role: "Director"
  });

  // Modals state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);

  // Edit Profile form state
  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editRole, setEditRole] = useState(profile.role);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile({
      name: editName,
      email: editEmail,
      role: editRole
    });
    setShowEditProfile(false);
  };

  const automationConfig = {
    manual: { label: "Manual", desc: "All decisions require your approval", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    balanced: { label: "Balanced", desc: "AI handles routine, you approve strategy", color: "text-accent-foreground", bg: "bg-accent/20", border: "border-accent/40" },
    autonomous: { label: "Autonomous", desc: "AI operates independently, you set direction", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  };

  const cfg = automationConfig[automationMode];

  const sections = [
    {
      title: "Brand",
      items: [
        { icon: Archive, label: "Assets", description: "Brand media, templates, approved files", meta: "4 files", action: () => onNavigate("/more/assets") },
        { icon: Brain, label: "Memory", description: "Learned patterns and brand rules", meta: "10 rules", action: () => onNavigate("/more/memory") },
        { icon: Link, label: "Accounts", description: "Connected publishing accounts", meta: "3 active", action: () => onNavigate("/more/accounts") },
      ],
    },
    {
      title: "Account & Team",
      items: [
        { icon: CreditCard, label: "Billing", description: "Plan, usage, and invoices", meta: "Pro Plan", action: () => onNavigate("/more/billing") },
        { icon: Code, label: "API", description: "API keys and developer access", meta: "2 keys", action: () => onNavigate("/more/api") },
        { icon: Users, label: "Team", description: "Members, roles, and permissions", meta: "2 members", action: () => onNavigate("/more/team") },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: Bell, label: "Notifications", description: "Alert types and delivery settings", meta: "Active", action: () => onNavigate("/more/notifications") },
        { icon: Shield, label: "Privacy", description: "Data retention and visibility settings", meta: "Secure", action: () => onNavigate("/more/privacy") },
      ],
    },
    {
      title: "Legal & Support",
      items: [
        { icon: HelpCircle, label: "Support", description: "Contact support and view status", meta: "Nominal", action: () => onNavigate("/more/support") },
        { icon: FileText, label: "Legal", description: "Terms of service, privacy policy", meta: "2 documents", action: () => onNavigate("/more/legal") },
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
      <TopBar pageName="More" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-8">

          <h1 className="text-3xl font-medium">More</h1>

          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-medium text-accent-foreground">
                  {profile.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-lg font-medium">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.role} · {profile.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <span className="text-xs text-success">Pro Plan · Active</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditName(profile.name);
                  setEditEmail(profile.email);
                  setEditRole(profile.role);
                  setShowEditProfile(true);
                }}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 text-sm font-medium transition-colors"
              >
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
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground mb-3">Automation Mode</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground mb-4">Controls how independently Spark operates your media brand</p>
              <div className="grid grid-cols-3 gap-3">
                {(["manual", "balanced", "autonomous"] as AutomationMode[]).map((mode) => {
                  const itemCfg = automationConfig[mode];
                  const isActive = automationMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setAutomationMode(mode)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        isActive ? `${itemCfg.bg} ${itemCfg.border}` : "bg-background border-border hover:border-accent/30"
                      }`}
                    >
                      <p className={`text-sm font-medium mb-1 ${isActive ? itemCfg.color : "text-muted-foreground"}`}>
                        {itemCfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug">{itemCfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Settings Sections */}
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground mb-3">{section.title}</h2>
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

          {/* Sign Out Trigger */}
          <div className="pt-4 border-t border-border/50 flex flex-col items-center gap-4">
            <button
              onClick={() => setShowSignOut(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <div className="text-center text-[10px] text-muted-foreground pb-4 uppercase tracking-wider font-mono">
              Spark · Media Operating System · v4.12
            </div>
          </div>

        </div>
      </main>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-lg relative">
            <button
              onClick={() => setShowEditProfile(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-accent-foreground" />
              Edit Profile
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role / Position</label>
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setShowEditProfile(false)} variant="outline">
                  Cancel
                </Button>
                <Button type="submit" variant="accent">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign Out Modal */}
      {showSignOut && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-lg text-center relative">
            <button
              onClick={() => setShowSignOut(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Sign Out</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Sign out will be connected when authentication is enabled.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => setShowSignOut(false)} variant="accent" className="w-full">
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
