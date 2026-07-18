import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { useAuth } from "../../state/AuthContext";
import { Button } from "../ds";
import { AuthPanel } from "../auth/AuthPanel";
import {
  Zap,
  Archive,
  Brain,
  Link as LinkIcon,
  CreditCard,
  Code,
  Users,
  FileText,
  HelpCircle,
  Bell,
  Shield,
  ChevronRight,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Download,
  Terminal,
  LogOut,
  LogIn,
  X,
  Mail,
  User
} from "lucide-react";

type AutomationMode = "manual" | "balanced" | "autonomous";

interface MobileMoreProps {
  onNavigate?: (path: string) => void;
}

export function MobileMore({ onNavigate }: MobileMoreProps = {}) {
  const { memoryItems, addMemoryItem, removeMemoryItem } = useSpark();
  const auth = useAuth();

  const [automationMode, setAutomationMode] = useState<AutomationMode>("balanced");
  const [profile, setProfile] = useState({
    name: "Alex Rivera",
    email: "alex@techinsightsng.com",
    role: "Director"
  });

  // Current sub-panel state
  const [activeDetail, setActiveDetail] = useState<string | null>(null);

  // Modals inside details
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  // Mock states for mobile detail interactions
  const [apiKeyList, setApiKeyList] = useState([
    { id: "1", name: "Production API Key", key: "sk_live_spark_7f15405a8b29", created: "2026-05-10" },
    { id: "2", name: "Development Adapter", key: "sk_dev_spark_07f15405257f", created: "2026-06-01" }
  ]);
  const [newKeyName, setNewKeyName] = useState("");
  const [showAddKey, setShowAddKey] = useState(false);

  const [assets, setAssets] = useState([
    { id: "1", name: "brand_logo_violet.png", type: "Image", size: "2.4 MB" },
    { id: "2", name: "synth_ambient_outro.wav", type: "Audio", size: "14.8 MB" },
    { id: "3", name: "overlay_lower_third.mov", type: "Video", size: "38.1 MB" }
  ]);

  const [accounts, setAccounts] = useState([
    { id: "1", platform: "YouTube", handle: "@techinsightsng", followers: "142K", active: true },
    { id: "2", platform: "TikTok", handle: "@techinsights_ng", followers: "385K", active: true },
    { id: "3", platform: "Instagram", handle: "techinsights.ng", followers: "89K", active: true },
    { id: "4", platform: "Twitter/X", handle: "techinsights_ng", followers: "45K", active: false }
  ]);

  const [team, setTeam] = useState([
    { id: "1", name: "Alex Rivera", email: "alex@techinsightsng.com", role: "Director" },
    { id: "2", name: "Chidi Okafor", email: "chidi@techinsightsng.com", role: "Editor" }
  ]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSent, setSupportSent] = useState(false);

  const [memoryText, setMemoryText] = useState("");
  const [memoryType, setMemoryType] = useState<"learned" | "rule">("learned");
  const [memoryCategory, setMemoryCategory] = useState("Character");

  // Edit Profile form state
  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editRole, setEditRole] = useState(profile.role);

  // Preference Settings
  const [notifSettings, setNotifSettings] = useState({
    dailyBrief: true,
    reviewAlerts: true,
    weeklyGrowth: true,
    publishConfirm: false
  });

  const [privacySettings, setPrivacySettings] = useState({
    retentionMonths: 12,
    shareTelemetry: false,
    restrictAITraining: true
  });

  const modeConfig = {
    manual: { label: "Manual", description: "All decisions require approval", color: "text-warning" },
    balanced: { label: "Balanced", description: "AI handles routine, you approve strategic", color: "text-accent-foreground" },
    autonomous: { label: "Autonomous", description: "AI makes most decisions", color: "text-success" },
  };

  const sections = [
    {
      title: "Brand",
      items: [
        { icon: Archive, label: "Assets", badge: `${assets.length} files` },
        { icon: Brain, label: "Memory", badge: `${memoryItems.length} rules` },
        { icon: LinkIcon, label: "Accounts", badge: `${accounts.filter(a => a.active).length} active` },
      ],
    },
    {
      title: "Account & Team",
      items: [
        { icon: CreditCard, label: "Billing", badge: "Pro Plan" },
        { icon: Code, label: "API", badge: `${apiKeyList.length} keys` },
        { icon: Brain, label: "Integrations", badge: "Connected" },
        { icon: Users, label: "Team", badge: `${team.length} members` },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: Bell, label: "Notifications", badge: "Active" },
        { icon: Shield, label: "Privacy", badge: "Secure" },
      ],
    },
    {
      title: "Legal & Support",
      items: [
        { icon: HelpCircle, label: "Support", badge: "Nominal" },
        { icon: FileText, label: "Legal", badge: "2 documents" },
      ],
    },
  ];

  const currentMode = modeConfig[automationMode];
  const profileEmail = auth.currentUser?.email ?? profile.email;
  const profileName = auth.profile?.display_name ?? profile.name;
  const profileRole = auth.profile?.role ?? profile.role;

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUploadAsset = () => {
    const name = prompt("Enter asset name:", "stinger_intro.mp3");
    if (name) {
      setAssets([...assets, { id: Date.now().toString(), name, type: "Audio", size: "4.5 MB" }]);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setTeam([...team, { id: Date.now().toString(), name: inviteName, email: inviteEmail, role: "Editor" }]);
    setInviteName("");
    setInviteEmail("");
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
  };

  const handleSupport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    setSupportSent(true);
    setSupportSubject("");
    setSupportMessage("");
    setTimeout(() => setSupportSent(false), 3000);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryText.trim()) return;
    addMemoryItem(memoryText, memoryType, memoryCategory);
    setMemoryText("");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile({ name: editName, email: editEmail, role: editRole });
    setActiveDetail(null);
  };

  // Renders the fullscreen detail views on Mobile
  const renderDetailPanel = () => {
    if (!activeDetail) return null;

    const renderPanelContent = () => {
      switch (activeDetail) {
        case "Edit Profile":
          return (
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
              <Button type="submit" variant="accent" className="w-full mt-4">
                Save Changes
              </Button>
            </form>
          );

        case "Assets":
          return (
            <div className="space-y-4">
              <Button onClick={handleUploadAsset} variant="accent" className="w-full text-xs py-2">
                <Plus className="w-4 h-4 mr-1" /> Add Asset File
              </Button>
              <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                {assets.map((asset) => (
                  <div key={asset.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{asset.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{asset.type} · {asset.size}</p>
                    </div>
                    <button
                      onClick={() => setAssets(assets.filter(a => a.id !== asset.id))}
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );

        case "Memory":
          return (
            <div className="space-y-5">
              <form onSubmit={handleAddMemory} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Commit Memory</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMemoryType("learned")}
                    className={`py-1 rounded border text-xs font-medium ${
                      memoryType === "learned" ? "bg-accent/20 border-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    Learned
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemoryType("rule")}
                    className={`py-1 rounded border text-xs font-medium ${
                      memoryType === "rule" ? "bg-accent/20 border-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    Rule
                  </button>
                </div>
                <select
                  value={memoryCategory}
                  onChange={(e) => setMemoryCategory(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground"
                >
                  {["Character", "Voice", "Brand", "Niche", "Audio", "Winning hooks", "Winning thumbnails", "Audience preferences", "Failures", "Publishing behavior"].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <textarea
                  value={memoryText}
                  onChange={(e) => setMemoryText(e.target.value)}
                  placeholder="e.g. Keep presentational pacing relaxed..."
                  rows={3}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
                  required
                />
                <Button type="submit" variant="accent" className="w-full text-xs py-1.5">
                  Save Memory Item
                </Button>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Active Memory Pools</h4>
                <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                  {memoryItems.map((item) => (
                    <div key={item.id} className="p-3 flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {item.category && (
                            <span className="text-[8px] font-mono bg-accent/20 text-accent-foreground px-1 py-0.5 rounded uppercase font-semibold">
                              {item.category}
                            </span>
                          )}
                          <span className="text-[8px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded uppercase">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{item.text}</p>
                      </div>
                      <button
                        onClick={() => removeMemoryItem(item.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );

        case "Accounts":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                {accounts.map((acc) => (
                  <div key={acc.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{acc.platform}</span>
                        <span className="text-[10px] text-muted-foreground">{acc.handle}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5 inline-block">{acc.followers} followers</span>
                    </div>
                    <button
                      onClick={() => setAccounts(accounts.map(a => a.id === acc.id ? { ...a, active: !a.active } : a))}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                        acc.active ? "bg-accent" : "bg-muted"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${acc.active ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );

        case "Billing":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Active Plan</p>
                <h4 className="text-lg font-bold text-accent-foreground">Spark Pro Licence</h4>
                <p className="text-xs text-muted-foreground">Unlimited automated pipelines · $120/month</p>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Billing Receipts</p>
                </div>
                <div className="divide-y divide-border/50">
                  {[
                    { id: "INV-2026-03", date: "June 28", amount: "$120" },
                    { id: "INV-2026-02", date: "May 28", amount: "$120" }
                  ].map(inv => (
                    <div key={inv.id} className="p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold">{inv.id}</p>
                        <p className="text-muted-foreground mt-0.5">{inv.date}, 2026</p>
                      </div>
                      <span className="font-medium">{inv.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );

        case "API":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <Terminal className="w-4 h-4 text-accent-foreground flex-shrink-0" />
                  <span>Utilize bear keys to connect custom pipeline triggers with external webhooks securely.</span>
                </p>
              </div>

              {showAddKey && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newKeyName.trim()) return;
                    setApiKeyList([...apiKeyList, { id: Date.now().toString(), name: newKeyName, key: "sk_live_spark_new", created: "Today" }]);
                    setNewKeyName("");
                    setShowAddKey(false);
                  }}
                  className="p-3 border border-border bg-card rounded-xl space-y-2.5"
                >
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">New Credential Name</p>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Webhook Adapter"
                    className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                    required
                  />
                  <div className="flex gap-1 justify-end">
                    <Button type="submit" variant="accent" size="sm" className="text-xs h-7">Create</Button>
                    <Button type="button" onClick={() => setShowAddKey(false)} variant="outline" size="sm" className="text-xs h-7">Cancel</Button>
                  </div>
                </form>
              )}

              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Keys</h4>
                <Button onClick={() => setShowAddKey(true)} variant="outline" size="sm" className="text-xs h-7">
                  Generate Key
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                {apiKeyList.map((key) => (
                  <div key={key.id} className="p-3.5 flex justify-between items-center">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold truncate">{key.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5 bg-background px-1.5 py-0.5 rounded border border-border inline-block truncate max-w-[200px]">
                        {key.key}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button onClick={() => handleCopy(key.key)} variant="outline" size="sm" className="text-[10px] h-7 px-2">
                        {copiedKey === key.key ? "Copied" : "Copy"}
                      </Button>
                      <button onClick={() => setApiKeyList(apiKeyList.filter(k => k.id !== key.id))} className="text-muted-foreground p-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );

        case "Team":
          return (
            <div className="space-y-4">
              <form onSubmit={handleInvite} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Invite Collaborator</p>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  required
                />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  required
                />
                {inviteSent && (
                  <p className="text-xs text-success">Invitation dispatched!</p>
                )}
                <Button type="submit" variant="accent" className="w-full text-xs py-1.5">
                  Send Invite Link
                </Button>
              </form>

              <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                {team.map((m) => (
                  <div key={m.id} className="p-3.5 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.email}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          );

        case "Notifications":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                {[
                  { id: "dailyBrief", label: "Daily Briefings", desc: "6:00 AM summary emails" },
                  { id: "reviewAlerts", label: "Review Notifications", desc: "Immediate review alerts" },
                  { id: "weeklyGrowth", label: "Weekly Growth Alerts", desc: "Automated opportunity updates" },
                  { id: "publishConfirm", label: "Publish Confirmations", desc: "Notification upon publication" }
                ].map((item) => {
                  const active = (notifSettings as any)[item.id];
                  return (
                    <div key={item.id} className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifSettings({ ...notifSettings, [item.id]: !active })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none flex-shrink-0 mt-0.5 ${
                          active ? "bg-accent" : "bg-muted"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : ""}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );

        case "Privacy":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1 text-xs font-semibold">
                    <span>Draft Retention</span>
                    <span className="text-accent-foreground">{privacySettings.retentionMonths}m</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={privacySettings.retentionMonths}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, retentionMonths: parseInt(e.target.value) })}
                    className="w-full accent-accent bg-muted h-1 rounded"
                  />
                </div>

                <hr className="border-border/50" />

                {[
                  { id: "shareTelemetry", label: "Anonymized Diagnostics", desc: "Error logs and payload telemetry" },
                  { id: "restrictAITraining", label: "Restrict Content Models", desc: "Do not train generic LLMs with transcripts" }
                ].map((item) => {
                  const active = (privacySettings as any)[item.id];
                  return (
                    <div key={item.id} className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setPrivacySettings({ ...privacySettings, [item.id]: !active })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none flex-shrink-0 mt-0.5 ${
                          active ? "bg-accent" : "bg-muted"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : ""}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );

        case "Support":
          return (
            <div className="space-y-4">
              <form onSubmit={handleSupport} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Create Support Ticket</p>
                <input
                  type="text"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="Topic / Subject"
                  className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  required
                />
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Elaborate on the issue or bug details..."
                  rows={4}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2.5 text-foreground focus:outline-none focus:border-accent"
                  required
                />
                {supportSent && (
                  <p className="text-xs text-success">Ticket submitted successfully!</p>
                )}
                <Button type="submit" variant="accent" className="w-full text-xs py-1.5">
                  Send Support Ticket
                </Button>
              </form>
            </div>
          );

        case "Legal":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4 text-xs leading-relaxed">
                <div>
                  <h4 className="font-bold text-foreground mb-1">Terms of Service</h4>
                  <p className="text-muted-foreground">Welcome to Spark. By utilizing our platform and system adapters, you agree to copyright boundaries and delegated pipeline decisions in active automation channels.</p>
                </div>
                <hr className="border-border/50" />
                <div>
                  <h4 className="font-bold text-foreground mb-1">Privacy Policy</h4>
                  <p className="text-muted-foreground">We prioritize secure storage of credential tokens and telemetry logs. Rendered scripts and files are strictly private and never combined with generic public LLM datasets.</p>
                </div>
              </div>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div className="fixed inset-0 bg-background z-40 overflow-y-auto pb-24 pt-4 px-4">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setActiveDetail(null)}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold">{activeDetail}</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Spark Configuration Control</p>
          </div>
        </div>
        <div className="mt-4">
          {renderPanelContent()}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">More</h1>
        <p className="text-sm text-muted-foreground mt-1">Settings and management</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-medium text-accent-foreground">
            {profileName.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-medium">{profileName}</h2>
            <p className="text-sm text-muted-foreground">{profileRole}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <span className="text-xs text-success">{auth.isAuthenticated ? "Authenticated" : "Demo mode"}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setEditName(profileName);
            setEditEmail(profileEmail);
            setEditRole(profileRole);
            setActiveDetail("Edit Profile");
          }}
          className="w-full py-2.5 px-4 rounded-lg border border-border hover:bg-accent/10 transition-colors text-sm font-medium"
        >
          Edit Profile
        </button>
      </div>

      {/* Auth Status */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Spark Account</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {auth.isAuthenticated
              ? `Signed in as ${profileEmail}`
              : auth.isConfigured
                ? "Demo/local mode. Sign in when backend data is needed."
                : "Local demo mode. Supabase is not configured yet."}
          </p>
        </div>
        {auth.isAuthenticated ? (
          <Button onClick={() => setShowSignOut(true)} variant="outline" className="w-full text-xs">
            <LogOut className="w-4 h-4 mr-1" />
            Sign Out
          </Button>
        ) : (
          <Button onClick={() => setShowSignIn(true)} variant="outline" className="w-full text-xs">
            <LogIn className="w-4 h-4 mr-1" />
            Sign In
          </Button>
        )}
      </div>

      {/* Automation Mode */}
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground mb-3 px-1">Automation Mode</h3>
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
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground mb-3 px-1">
            {section.title}
          </h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {section.items.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === section.items.length - 1;
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveDetail(item.label)}
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

      {/* Sign Out Trigger */}
      <div className="pt-4 border-t border-border/50 flex flex-col items-center gap-3">
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
        <div className="text-center text-[10px] text-muted-foreground pb-4 uppercase tracking-wider font-mono">
          Spark · Media Operating System · v4.12
        </div>
      </div>

      {/* Detail Panel overlay */}
      {renderDetailPanel()}

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full shadow-lg relative">
            <button
              onClick={() => setShowSignIn(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <AuthPanel />
          </div>
        </div>
      )}

      {/* Sign Out Modal */}
      {showSignOut && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
              <Button
                onClick={async () => {
                  if (auth.isAuthenticated) {
                    await auth.signOut();
                    onNavigate?.("/");
                  }
                  setShowSignOut(false);
                }}
                variant="accent"
                className="w-full"
              >
                {auth.isAuthenticated ? "Sign Out" : "Dismiss"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
