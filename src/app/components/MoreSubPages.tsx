import { useState } from "react";
import { TopBar } from "./TopBar";
import { Button } from "./ds";
import { useSpark } from "../state/SparkContext";
import {
  ArrowLeft,
  FileText,
  Shield,
  CreditCard,
  Code,
  Users,
  Bell,
  Archive,
  Brain,
  Link as LinkIcon,
  HelpCircle,
  Plus,
  Trash2,
  Check,
  CheckCircle,
  AlertCircle,
  Play,
  Share2,
  Lock,
  Download,
  Terminal,
  UserPlus,
  Mail,
  Smartphone,
  Info,
  ExternalLink
} from "lucide-react";

interface SubPageProps {
  onNavigate: (path: string) => void;
}

export function MoreSubPages({ onNavigate, subPath }: SubPageProps & { subPath: string }) {
  const { state, addMemoryItem, removeMemoryItem } = useSpark();

  // Sub-pages states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiKeyList, setApiKeyList] = useState([
    { id: "1", name: "Production API Key", key: "sk_live_spark_7f15405a8b29", created: "2026-05-10" },
    { id: "2", name: "Development Adapter", key: "sk_dev_spark_07f15405257f", created: "2026-06-01" }
  ]);
  const [newKeyName, setNewKeyName] = useState("");
  const [showAddKey, setShowAddKey] = useState(false);

  // Assets states
  const [assets, setAssets] = useState([
    { id: "1", name: "brand_logo_violet.png", type: "Image", size: "2.4 MB", date: "2026-06-12" },
    { id: "2", name: "synth_ambient_outro.wav", type: "Audio", size: "14.8 MB", date: "2026-06-18" },
    { id: "3", name: "overlay_lower_third.mov", type: "Video", size: "38.1 MB", date: "2026-06-25" },
    { id: "4", name: "nigerian_pidgin_glossary.pdf", type: "Document", size: "1.2 MB", date: "2026-06-28" }
  ]);
  const [dragActive, setDragActive] = useState(false);

  // Accounts states
  const [accounts, setAccounts] = useState([
    { id: "1", platform: "YouTube", handle: "@techinsightsng", status: "Connected", followers: "142K", active: true },
    { id: "2", platform: "TikTok", handle: "@techinsights_ng", status: "Connected", followers: "385K", active: true },
    { id: "3", platform: "Instagram", handle: "techinsights.ng", status: "Connected", followers: "89K", active: true },
    { id: "4", platform: "Twitter/X", handle: "techinsights_ng", status: "Connected", followers: "45K", active: false }
  ]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Team states
  const [team, setTeam] = useState([
    { id: "1", name: "Alex Rivera", email: "alex@techinsightsng.com", role: "Director", status: "Active" },
    { id: "2", name: "Chidi Okafor", email: "chidi@techinsightsng.com", role: "Editor", status: "Pending Invitation" }
  ]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Editor");
  const [inviteSent, setInviteSent] = useState(false);

  // Support states
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSent, setSupportSent] = useState(false);

  // New Memory Item Form state
  const [memoryText, setMemoryText] = useState("");
  const [memoryType, setMemoryType] = useState<"learned" | "rule">("learned");
  const [memoryCategory, setMemoryCategory] = useState("Character");

  // Notifications preferences
  const [notifSettings, setNotifSettings] = useState({
    emailDailyBrief: true,
    pushReviewAlerts: true,
    emailWeeklyGrowth: true,
    pushPublishConfirm: false,
    slackIntegration: true
  });

  // Privacy preferences
  const [privacySettings, setPrivacySettings] = useState({
    dataRetentionMonths: 12,
    shareTelemetry: false,
    anonymizeAudienceData: true,
    restrictAITraining: true
  });

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const randomHex = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const newKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key: `sk_live_spark_${randomHex}`,
      created: new Date().toISOString().split("T")[0]
    };
    setApiKeyList([...apiKeyList, newKey]);
    setNewKeyName("");
    setShowAddKey(false);
  };

  const handleDeleteKey = (id: string) => {
    setApiKeyList(apiKeyList.filter(k => k.id !== id));
  };

  // Drag and drop asset actions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const newAsset = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type.split("/")[0].toUpperCase() || "Document",
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        date: new Date().toISOString().split("T")[0]
      };
      setAssets([newAsset, ...assets]);
    }
  };

  const handleUploadClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e: any) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const newAsset = {
          id: Date.now().toString(),
          name: file.name,
          type: file.type.split("/")[0].toUpperCase() || "Document",
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          date: new Date().toISOString().split("T")[0]
        };
        setAssets([newAsset, ...assets]);
      }
    };
    input.click();
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const newMember = {
      id: Date.now().toString(),
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: "Pending Invitation"
    };
    setTeam([...team, newMember]);
    setInviteName("");
    setInviteEmail("");
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    setSupportSent(true);
    setSupportSubject("");
    setSupportMessage("");
    setTimeout(() => setSupportSent(false), 5000);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryText.trim()) return;
    addMemoryItem(memoryText, memoryType, memoryCategory);
    setMemoryText("");
  };

  // Map subPath to titles and components
  const getSubPageDetails = () => {
    switch (subPath) {
      case "/more/assets":
        return {
          title: "Assets",
          icon: Archive,
          description: "Manage your brand files, audio stingers, overlays, and document guidelines.",
          content: (
            <div className="space-y-6">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={handleUploadClick}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragActive ? "border-accent bg-accent/10" : "border-border hover:bg-accent/5 bg-card/20"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Archive className="w-6 h-6 text-accent-foreground" />
                </div>
                <p className="text-sm font-medium">Drag & drop files here, or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">Supports images, video clips, audio tracks, and documents</p>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand Assets ({assets.length})</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/5 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground">
                          {asset.type[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{asset.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{asset.type} · {asset.size} · Uploaded {asset.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setAssets(assets.filter(a => a.id !== asset.id))}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        };

      case "/more/memory":
        return {
          title: "Memory Engine",
          icon: Brain,
          description: "Train Spark's knowledge base. Add core characteristics, rules, or failures for continuous alignment.",
          content: (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-medium mb-3">Add Brand Memory</h3>
                  <form onSubmit={handleAddMemory} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Memory Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMemoryType("learned")}
                          className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            memoryType === "learned" ? "bg-accent/20 border-accent text-accent-foreground" : "border-border hover:bg-accent/5"
                          }`}
                        >
                          Learned Insight
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemoryType("rule")}
                          className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            memoryType === "rule" ? "bg-accent/20 border-accent text-accent-foreground" : "border-border hover:bg-accent/5"
                          }`}
                        >
                          Hard Rule
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
                      <select
                        value={memoryCategory}
                        onChange={(e) => setMemoryCategory(e.target.value)}
                        className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                      >
                        {["Character", "Voice", "Brand", "Niche", "Audio", "Winning hooks", "Winning thumbnails", "Audience preferences", "Failures", "Publishing behavior"].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Memory Text</label>
                      <textarea
                        value={memoryText}
                        onChange={(e) => setMemoryText(e.target.value)}
                        placeholder="e.g. Keep presentational pacing relaxed with local humor..."
                        rows={4}
                        className="w-full text-xs bg-background border border-border rounded-lg p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent resize-none leading-relaxed"
                      />
                    </div>

                    <Button type="submit" variant="accent" className="w-full text-xs py-2">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Commit to Memory
                    </Button>
                  </form>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Active Memory Pool ({state.memoryItems.length})</h3>
                  <Button onClick={() => onNavigate("/my-spark")} variant="outline" size="sm" className="text-xs">
                    View in My Spark
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                  {state.memoryItems.map((item) => (
                    <div key={item.id} className="p-4 flex items-start gap-3 hover:bg-accent/5 transition-colors">
                      <div className={`p-1.5 rounded-lg mt-0.5 ${item.type === "learned" ? "bg-accent/10" : "bg-muted/60"}`}>
                        <Brain className={`w-4 h-4 ${item.type === "learned" ? "text-accent-foreground" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {item.category && (
                            <span className="text-[10px] font-mono uppercase bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded font-semibold">
                              {item.category}
                            </span>
                          )}
                          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                            item.type === "learned" ? "bg-accent/10 text-accent-foreground" : "bg-muted/40 text-muted-foreground"
                          }`}>
                            {item.type}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Learned on {item.dateAdded}</p>
                      </div>
                      <button
                        onClick={() => removeMemoryItem(item.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        };

      case "/more/accounts":
        return {
          title: "Connected Accounts",
          icon: LinkIcon,
          description: "Establish and authorize secure API publication endpoints to major social platforms.",
          content: (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Connected Outlets ({accounts.filter(a => a.active).length} Active)</h3>
                <Button onClick={() => setShowConnectModal(true)} variant="accent" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Add Account Connection
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((acc) => (
                  <div key={acc.id} className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{acc.platform}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            acc.active ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                          }`}>
                            {acc.active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{acc.handle}</p>
                      </div>
                      <div className="flex items-center h-5">
                        <button
                          onClick={() => setAccounts(accounts.map(a => a.id === acc.id ? { ...a, active: !a.active } : a))}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                            acc.active ? "bg-accent" : "bg-muted"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${acc.active ? "translate-x-4" : ""}`} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">Followers: <strong className="text-foreground">{acc.followers}</strong></span>
                      <Button variant="outline" size="sm" className="text-xs h-8">
                        Configure Settings
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {showConnectModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-lg">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <LinkIcon className="w-5 h-5 text-accent-foreground" />
                      Add Account
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Direct publishing APIs require secure platform handshakes. Select a network to authenticate:
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {["YouTube", "TikTok", "Instagram", "Facebook", "LinkedIn", "Pinterest"].map(p => (
                        <button
                          key={p}
                          onClick={() => {
                            setConnectingPlatform(p);
                            setTimeout(() => {
                              const newAcc = {
                                id: Date.now().toString(),
                                platform: p,
                                handle: `@new_spark_${p.toLowerCase()}`,
                                status: "Connected",
                                followers: "0",
                                active: true
                              };
                              setAccounts([...accounts, newAcc]);
                              setConnectingPlatform(null);
                              setShowConnectModal(false);
                            }, 1500);
                          }}
                          disabled={connectingPlatform !== null}
                          className="py-2.5 rounded-lg border border-border bg-background hover:bg-accent/10 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {connectingPlatform === p ? "Authenticating..." : p}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => setShowConnectModal(false)} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        };

      case "/more/billing":
        return {
          title: "Billing & Subscriptions",
          icon: CreditCard,
          description: "Overview of your enterprise Spark licence, usage parameters, and billing details.",
          content: (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Plan</p>
                  <h3 className="text-2xl font-bold text-accent-foreground">Spark Pro</h3>
                  <p className="text-xs text-muted-foreground">Enables 3 active brands and autonomous pipelines.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Billing Frequency</p>
                  <h3 className="text-2xl font-medium">$120 <span className="text-sm text-muted-foreground">/ month</span></h3>
                  <p className="text-xs text-muted-foreground">Next payment due July 28, 2026.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Payment Method</p>
                  <h3 className="text-2xl font-medium flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                    •••• 4821
                  </h3>
                  <p className="text-xs text-muted-foreground">Visa card expires 09/29.</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Platform Usage Limits</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span>Monthly Video Rendering</span>
                      <span>87 / 200 hours</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-accent h-full rounded-full" style={{ width: "43.5%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span>Connected Brand Profiles</span>
                      <span>3 / 3 active slots</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-accent h-full rounded-full animate-pulse" style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Invoice History</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {[
                    { date: "June 28, 2026", amount: "$120.00", id: "INV-2026-03", status: "Paid" },
                    { date: "May 28, 2026", amount: "$120.00", id: "INV-2026-02", status: "Paid" },
                    { date: "April 28, 2026", amount: "$120.00", id: "INV-2026-01", status: "Paid" }
                  ].map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/5 transition-colors">
                      <div className="flex items-center gap-6">
                        <span className="text-sm font-medium">{inv.id}</span>
                        <span className="text-xs text-muted-foreground">{inv.date}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-success/10 text-success">{inv.status}</span>
                        <span className="text-sm font-medium">{inv.amount}</span>
                        <Button variant="outline" size="sm" className="h-8 py-0.5 text-xs">
                          <Download className="w-3.5 h-3.5" /> PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        };

      case "/more/api":
        return {
          title: "Developer Credentials & APIs",
          icon: Code,
          description: "Access keys and configure outgoing endpoints to hook up custom workflows with external software adapters.",
          content: (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
                    <Terminal className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">REST API Access</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Integrate Spark's Memory and Intelligence outputs into external applications. All requests must utilize Bearer authentication with a secure API key.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Active Credentials</h3>
                  <Button onClick={() => setShowAddKey(true)} variant="accent" size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Generate API Key
                  </Button>
                </div>

                {showAddKey && (
                  <form onSubmit={handleCreateKey} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Key Details</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. Analytics Webhook Adapter"
                        className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                        required
                      />
                      <Button type="submit" variant="accent" size="sm">
                        Create
                      </Button>
                      <Button type="button" onClick={() => setShowAddKey(false)} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                  {apiKeyList.map((key) => (
                    <div key={key.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{key.name}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1 bg-background px-2 py-1 rounded border border-border inline-block">
                          {key.key}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">Created {key.created}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          onClick={() => handleCopy(key.key)}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                        >
                          {copiedKey === key.key ? <Check className="w-3.5 h-3.5 text-success" /> : "Copy"}
                        </Button>
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        };

      case "/more/team":
        return {
          title: "Team Members & Access Control",
          icon: Users,
          description: "Invite directors, curators, or content adapters to view and manage your creative pipeline.",
          content: (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-sm font-medium mb-3">Invite Team Member</h3>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name</label>
                        <input
                          type="text"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="e.g. Chidi Okafor"
                          className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="e.g. chidi@brand.com"
                          className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">System Role</label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                        >
                          <option value="Director">Director (Full access)</option>
                          <option value="Editor">Editor (Reviews only)</option>
                          <option value="Viewer">Viewer (Read only)</option>
                        </select>
                      </div>
                      {inviteSent && (
                        <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-success text-xs flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Invitation queued and sent!
                        </div>
                      )}
                      <Button type="submit" variant="accent" className="w-full text-xs py-2">
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Send Invitation
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <h3 className="text-sm font-medium">Active Team Members ({team.length})</h3>
                  <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                    {team.map((member) => (
                      <div key={member.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center font-medium text-sm">
                            {member.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                            member.status === "Active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          }`}>
                            {member.status}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">{member.role}</span>
                          {member.name !== "Alex Rivera" && (
                            <button
                              onClick={() => setTeam(team.filter(t => t.id !== member.id))}
                              className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        };

      case "/more/legal":
        return {
          title: "Legal Information",
          icon: FileText,
          description: "Read Terms of Service and Privacy compliance rules associated with operating Spark.",
          content: (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-accent-foreground" />
                      Terms of Service
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Review Spark's core service usage agreement, service level terms, and content copyright boundaries.
                    </p>
                  </div>
                  <Button onClick={() => onNavigate("/terms")} variant="outline" className="w-full">
                    Open Terms of Service
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-accent-foreground" />
                      Privacy Policy
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Review how user credentials, analytics exports, and audience telemetry are processed securely.
                    </p>
                  </div>
                  <Button onClick={() => onNavigate("/privacy")} variant="outline" className="w-full">
                    Open Privacy Policy
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 bg-accent/5">
                <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
                  <span>
                    Note: Complete legal text will be compiled in production dynamically based on localized compliance legislation in connected markets. Keep terms reviewed and up-to-date.
                  </span>
                </p>
              </div>
            </div>
          )
        };

      case "/more/support":
        return {
          title: "Support Desk",
          icon: HelpCircle,
          description: "Get assistance, report platform bugs, and check operational system status metrics.",
          content: (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Operational Status</h3>
                  <div className="space-y-3">
                    {[
                      { name: "Spark Generation", status: "Operational", color: "text-success" },
                      { name: "Video Synthesizer", status: "Operational", color: "text-success" },
                      { name: "Review Pipeline", status: "Operational", color: "text-success" },
                      { name: "Publishing Queue", status: "Operational", color: "text-success" },
                      { name: "Analytics Adapter", status: "Operational", color: "text-success" }
                    ].map((s) => (
                      <div key={s.name} className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className={`font-semibold ${s.color}`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-border/50 text-center">
                    <p className="text-[10px] text-muted-foreground font-mono">ALL SYSTEMS NOMINAL · 99.98% UPTIME</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-base font-semibold mb-2">Contact Spark Engineers</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Send a direct dispatch to our engineering team. Average response time is under 15 minutes.
                  </p>

                  <form onSubmit={handleSupportSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Issue Subject</label>
                      <input
                        type="text"
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        placeholder="e.g. Issue connecting TikTok API account"
                        className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description / Steps to Reproduce</label>
                      <textarea
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder="Provide details of the bug, errors, or feedback..."
                        rows={5}
                        className="w-full text-xs bg-background border border-border rounded-lg p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent resize-none leading-relaxed"
                        required
                      />
                    </div>

                    {supportSent && (
                      <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-success text-xs flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Support ticket submitted successfully! Check email for updates.
                      </div>
                    )}

                    <Button type="submit" variant="accent" className="w-full text-xs py-2">
                      <Mail className="w-3.5 h-3.5 mr-1" /> Send Support Request
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          )
        };

      case "/more/notifications":
        return {
          title: "Notification Settings",
          icon: Bell,
          description: "Manage how and when you receive critical alerts, creative briefings, and status reports.",
          content: (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alert Subscriptions</h3>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { id: "emailDailyBrief", title: "Daily Briefings", desc: "Receive summary reports at 6:00 AM every morning with content performance." },
                    { id: "pushReviewAlerts", title: "Review Notifications", desc: "Push alerts when a critical creative stinger or storyboard is ready for review." },
                    { id: "emailWeeklyGrowth", title: "Weekly Growth Alerts", desc: "Receive automated brand growth and opportunity briefings every Sunday." },
                    { id: "pushPublishConfirm", title: "Publish Confirmations", desc: "Confirmations and status reports for published items." },
                    { id: "slackIntegration", title: "Slack Channel Push", desc: "Push approvals and pipeline activities to the workspace Slack channel." }
                  ].map((item) => {
                    const active = (notifSettings as any)[item.id];
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-4 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
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
            </div>
          )
        };

      case "/more/privacy":
        return {
          title: "Privacy Preferences",
          icon: Shield,
          description: "Configure how telemetry, data retention timers, and data usage permissions are held.",
          content: (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Management</h3>
                </div>
                <div className="p-5 space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium">Rendered Video Retention Duration</span>
                      <span className="text-xs font-semibold text-accent-foreground font-mono">{privacySettings.dataRetentionMonths} months</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Retain high-quality exported draft packages in system archives.</p>
                    <input
                      type="range"
                      min="1"
                      max="36"
                      value={privacySettings.dataRetentionMonths}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, dataRetentionMonths: parseInt(e.target.value) })}
                      className="w-full accent-accent bg-muted h-1 rounded-lg cursor-pointer"
                    />
                  </div>

                  <hr className="border-border/50" />

                  {[
                    { id: "shareTelemetry", title: "Anonymized Diagnostics", desc: "Share error, load times, and performance telemetry to improve the platform." },
                    { id: "anonymizeAudienceData", title: "Anonymize Audience Performance Logs", desc: "Strip all subscriber handles and names from internal performance databases." },
                    { id: "restrictAITraining", title: "Restrict Content to Personal Models", desc: "Ensure your approved transcripts are never utilized to train generic LLMs." }
                  ].map((item) => {
                    const active = (privacySettings as any)[item.id];
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-4 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
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
            </div>
          )
        };

      default:
        return {
          title: "System Node",
          icon: Info,
          description: "Details on operational system configuration",
          content: <div className="p-4 text-sm text-muted-foreground">Unknown endpoint. Use standard sidebar links.</div>
        };
    }
  };

  const page = getSubPageDetails();
  const Icon = page.icon;

  return (
    <>
      <TopBar pageName={`More / ${page.title}`} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-6">
          <button
            onClick={() => onNavigate("/more")}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to More
          </button>

          <div className="flex items-start justify-between border-b border-border/50 pb-5 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{page.title}</h1>
                <p className="text-xs text-muted-foreground mt-1">{page.description}</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {page.content}
          </div>
        </div>
      </main>
    </>
  );
}

// Separate component for Full Legal, Terms and Privacy pages
export function FullLegalPage({ onNavigate, type }: SubPageProps & { type: "terms" | "privacy" }) {
  return (
    <>
      <TopBar pageName={type === "terms" ? "Terms of Service" : "Privacy Policy"} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          <button
            onClick={() => onNavigate("/more")}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to More
          </button>

          <div className="rounded-xl border border-border bg-card p-8 space-y-6 leading-relaxed text-sm">
            <h1 className="text-3xl font-bold text-foreground">
              {type === "terms" ? "Terms of Service" : "Privacy Policy"}
            </h1>
            <p className="text-xs text-muted-foreground">Last updated: July 2, 2026</p>

            <hr className="border-border/50" />

            {type === "terms" ? (
              <div className="space-y-4">
                <p>Welcome to Spark. By utilizing our platform, services, or system adapters, you agree to these comprehensive Terms of Service. Please read them thoroughly before initializing automation modes.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">1. System Licensing</h2>
                <p>Spark operates as a customized, server-side media operating system designed to analyze market opportunities, draft promotional packages, and manage publishing pipelines. Licenses are granted on an individual brand basis.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">2. Autonomous Pipelines & Approvals</h2>
                <p>When selecting the Balanced or Autonomous "Automation Mode", you delegate authority to the Spark model engine to pre-schedule review items and dispatch content packages to connected channels. It is the licensee's responsibility to set strict brand criteria inside the Memory engine.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">3. Content Copyright</h2>
                <p>All content packages generated through Spark, including storyboard timelines, lower-third overlays, and synthesised speech outputs remain the intellectual property of the account creator.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">4. Disclaimers</h2>
                <p>Spark connects to public third-party APIs. We are not liable for account suspensions or distribution penalties resulting from high publishing frequencies or rules violations set inside individual target networks.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p>At Spark, we prioritize the protection and security of your digital footprint, intellectual property transcripts, and authorized access credentials. This policy outlines our telemetry methods.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">1. Access Tokens & API Credentials</h2>
                <p>We store encrypted API handshakes for connected channels securely. These credentials are strictly utilized to fetch public distribution telemetry or push approved creative packages from the Calendar pipeline.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">2. Training Restrictions & Intellectual Capital</h2>
                <p>Any rules, character voice parameters, learned patterns, or failures loaded into the Spark Memory engine are private to your organization. They are never exported or combined with global models without explicit opt-in confirmation.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">3. Retention</h2>
                <p>Rendered videos, audio files, and scripts are retained for active periods as configured in your Privacy Preferences (ranging from 1 to 36 months) before being purged permanently from secure caches.</p>
                <h2 className="text-base font-semibold text-foreground pt-2">4. Security Infrastructure</h2>
                <p>All pipeline exchanges utilize end-to-end encryption. Security parameters are audited continuously to safeguard active creator assets.</p>
              </div>
            )}

            <div className="pt-4 flex justify-between items-center border-t border-border/50 text-xs text-muted-foreground">
              <span>Spark Operating System License</span>
              <span className="flex items-center gap-1">
                Version 4.12 <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
