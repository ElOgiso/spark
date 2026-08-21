import { useMemo, useState } from "react";
import { TopBar } from "./TopBar";
import { Button } from "./ds";
import { AuthPanel } from "./auth/AuthPanel";
import { useAuth } from "../state/AuthContext";
import { useSpark } from "../state/SparkContext";
import { listLiveConnectedAccounts } from "../services/socialIntegrationService";
import { getStoredTheme, applyTheme, THEME_OPTIONS, ThemeMode } from "../theme";
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
  LogIn,
  X,
  User,
  Palette,
  Sparkles,
  Tag
} from "lucide-react";

interface MorePageProps {
  onNavigate: (path: string) => void;
}

type AutomationMode = "manual" | "balanced" | "autonomous";

export function MorePage({ onNavigate }: MorePageProps) {
  const auth = useAuth();
  const spark = useSpark() as any;
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [automationMode, setAutomationMode] = useState<AutomationMode>(
    () => (spark?.automationMode as AutomationMode) || "balanced"
  );
  const [profile, setProfile] = useState({
    name: auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || "Creator",
    email: auth.currentUser?.email || "",
    role: auth.profile?.role || "Director"
  });

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

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
    if (editName) auth.updateProfile?.(editName, editEmail || undefined);
    setShowEditProfile(false);
  };

  const automationConfig = {
    manual: { label: "Manual", desc: "All decisions require your approval", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    balanced: { label: "Balanced", desc: "AI handles routine, you approve strategy", color: "text-accent-foreground", bg: "bg-accent/20", border: "border-accent/40" },
    autonomous: { label: "Autonomous", desc: "AI operates independently, you set direction", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  };

  const cfg = automationConfig[automationMode];
  const profileName = auth.profile?.display_name ?? profile.name;
  const profileEmail = auth.currentUser?.email ?? profile.email;
  const profileRole = auth.profile?.role ?? profile.role;

  const liveConnected = useMemo(() => {
    const fromTokens = listLiveConnectedAccounts();
    if (fromTokens.length > 0) return fromTokens;
    const fromCtx = (spark?.accounts || []).filter((a: any) => a.status === "connected");
    return fromCtx.map((a: any) => ({ platform: a.platform, handle: a.handle }));
  }, [spark?.accounts]);

  const connectedCount = liveConnected.length;
  const memoryCount = Array.isArray(spark?.memoryItems) ? spark.memoryItems.length : 0;
  const productionCount = Array.isArray(spark?.productions) ? spark.productions.length : 0;
  const assetCount = Array.isArray(spark?.assets) ? spark.assets.length : 0;
  const offersList = Array.isArray(spark?.offers) ? spark.offers : [];
  const defaultOffer = offersList.find((o: any) => o.active && o.isDefault) || offersList.find((o: any) => o.active);
  const marketerMeta = offersList.length === 0 ? "No Offers" : defaultOffer ? `${defaultOffer.title}` : `${offersList.length} active`;

  const sections = [
    {
      title: "Brand",
      items: [
        {
          icon: Zap,
          label: "My Spark",
          description: "Brand identity, rules, & research studio",
          meta: "Brand & Research",
          action: () => onNavigate("/my-spark"),
        },
        {
          icon: Archive,
          label: "Assets",
          description: "Brand media, templates, approved files",
          meta: assetCount === 0 ? "Empty" : `${assetCount} file${assetCount === 1 ? "" : "s"}`,
          action: () => onNavigate("/more/assets"),
        },
        {
          icon: Brain,
          label: "Memory",
          description: "Learned patterns and brand rules",
          meta: memoryCount === 0 ? "Empty" : `${memoryCount} rule${memoryCount === 1 ? "" : "s"}`,
          action: () => onNavigate("/more/memory"),
        },
        {
          icon: Tag,
          label: "Marketer",
          description: "Offers SPARK promotes in content",
          meta: marketerMeta,
          action: () => onNavigate("/more/marketer"),
        },
        {
          icon: Link,
          label: "Accounts",
          description: "Connected publishing accounts",
          meta: connectedCount === 0 ? "None" : `${connectedCount} active`,
          action: () => onNavigate("/more/accounts"),
        },
      ],
    },
    {
      title: "Account & Team",
      items: [
        {
          icon: CreditCard,
          label: "Billing",
          description: "Plan, usage, and invoices",
          meta: "Not set",
          action: () => onNavigate("/more/billing"),
        },
        {
          icon: Code,
          label: "API",
          description: "API keys and developer access",
          meta: "None",
          action: () => onNavigate("/more/api"),
        },
        {
          icon: Brain,
          label: "Integrations",
          description: "Connected AI, MCP, and local services",
          meta: "Open",
          action: () => onNavigate("/more/integrations"),
        },
        {
          icon: Sparkles,
          label: "AI Preferences",
          description: "Task routing models (Super Spark, Research, Production, etc.)",
          meta: "Best Available (Default)",
          action: () => onNavigate("/more/ai-preferences"),
        },
        {
          icon: Users,
          label: "Team",
          description: "Members, roles, and permissions",
          meta: auth.isAuthenticated ? "1 member" : "—",
          action: () => onNavigate("/more/team"),
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: Bell,
          label: "Notifications",
          description: "Alert types and delivery settings",
          meta: "Settings",
          action: () => onNavigate("/more/notifications"),
        },
        {
          icon: Shield,
          label: "Privacy",
          description: "Data retention and visibility settings",
          meta: "Settings",
          action: () => onNavigate("/more/privacy"),
        },
      ],
    },
    {
      title: "Legal & Support",
      items: [
        {
          icon: HelpCircle,
          label: "Support",
          description: "Contact support and view status",
          meta: "Open",
          action: () => onNavigate("/more/support"),
        },
        {
          icon: FileText,
          label: "Legal",
          description: "Terms of service, privacy policy",
          meta: "2 documents",
          action: () => onNavigate("/more/legal"),
        },
      ],
    },
    {
      title: "Appearance & Theme",
      items: [
        {
          icon: Palette,
          label: "Theme & Visual Appearance",
          description: "Switch default theme (Obsidian Violet, Classic Slate, Studio Light)",
          meta: THEME_OPTIONS.find((t) => t.id === currentTheme)?.name || "Obsidian Violet",
          action: () => onNavigate("/more/theme"),
        },
      ],
    },
  ];

  const stats = [
    { label: "Productions", value: String(productionCount) },
    { label: "Connected accounts", value: String(connectedCount) },
    { label: "Memory items", value: String(memoryCount) },
    { label: "Account", value: auth.isAuthenticated ? "Signed in" : "Guest" },
  ];

  return (
    <>
      <TopBar pageName="More" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-8">

          <h1 className="text-3xl font-medium">More</h1>

          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-medium text-accent-foreground">
                  {profileName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "S"}
                </div>
                <div>
                  <p className="text-lg font-medium">{profileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {profileRole}
                    {profileEmail ? ` · ${profileEmail}` : ""}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {auth.isAuthenticated ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs text-success">Signed in</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Not signed in</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const name = prompt("Enter workspace/brand name to switch to:", spark?.brand?.name || "Creative Studio");
                    if (name && name.trim()) {
                      if (typeof spark?.updateBrand === "function") {
                        spark.updateBrand({ ...spark.brand, name: name.trim() });
                      }
                      alert(`Successfully switched active workspace to: ${name.trim()}`);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg border border-border hover:bg-accent/20 text-sm font-medium transition-colors flex items-center gap-1.5 text-foreground cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Switch Workspace</span>
                </button>
                <button
                  onClick={() => {
                    setEditName(profileName);
                    setEditEmail(profileEmail || "");
                    setEditRole(profileRole || "Director");
                    setShowEditProfile(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 text-sm font-medium transition-colors cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>
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

          {/* Auth Status */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Spark Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {auth.isAuthenticated
                  ? `Signed in as ${profileEmail}`
                  : auth.isConfigured
                    ? "Sign in to sync workspace data with Supabase."
                    : "Supabase is not configured yet."}
              </p>
            </div>
            {auth.isAuthenticated ? (
              <button
                onClick={() => setShowSignOut(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => setShowSignIn(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/10 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>

          {/* Production */}
          <div>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground mb-3">Production</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground mb-4">Controls media rendering and autonomous generation</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (spark?.productionGenerationEnabled) spark?.toggleProductionGeneration?.();
                  }}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    !spark?.productionGenerationEnabled
                      ? "bg-accent/15 border-accent border-2 text-foreground shadow-sm"
                      : "border-border hover:bg-accent/10 text-muted-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">Off</p>
                  <p className="text-xs text-muted-foreground mt-1">no media generation</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!spark?.productionGenerationEnabled) spark?.toggleProductionGeneration?.();
                  }}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    spark?.productionGenerationEnabled
                      ? "bg-accent/15 border-accent border-2 text-foreground shadow-sm"
                      : "border-border hover:bg-accent/10 text-muted-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">On</p>
                  <p className="text-xs text-muted-foreground mt-1">production generation allowed</p>
                </button>
              </div>
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
                      onClick={() => {
                        setAutomationMode(mode);
                        spark?.updateAutomationMode?.(mode);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        isActive
                          ? `${itemCfg.bg} ${itemCfg.border} border-2`
                          : "border-border hover:bg-accent/10"
                      }`}
                    >
                      <p className={`text-sm font-semibold ${isActive ? itemCfg.color : ""}`}>{itemCfg.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{itemCfg.desc}</p>
                    </button>
                  );
                })}
              </div>
              <p className={`text-xs mt-3 ${cfg.color}`}>Active: {cfg.label}</p>
            </div>
          </div>

          {/* Sections */}
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground mb-3">{section.title}</h2>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-accent/5 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-muted/40 border border-border flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">{item.meta}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-5 h-5" /> Edit Profile
              </h3>
              <button onClick={() => setShowEditProfile(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Display name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Role</label>
                <input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEditProfile(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent">
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xl text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <h3 className="text-lg font-semibold">Sign out?</h3>
            <p className="text-sm text-muted-foreground">You can sign back in anytime to restore your workspace session.</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => setShowSignOut(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={async () => {
                  await auth.signOut();
                  setShowSignOut(false);
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl relative">
            <button
              onClick={() => setShowSignIn(false)}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <AuthPanel
              onSuccess={() => setShowSignIn(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
