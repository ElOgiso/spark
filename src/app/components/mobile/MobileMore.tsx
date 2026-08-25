import { useState, useEffect } from "react";
import { useSpark } from "../../state/SparkContext";
import { useAuth } from "../../state/AuthContext";
import { ModelRouter } from "../../services/runtime/modelRouter";
import { getModelsForProviderAndCapability, getModelLabel, CATALOG_VERSION } from "../../services/runtime/modelCatalog";
import type { AIRoutingCategory, AIProviderId } from "../../domain/types";
import { Button } from "../ds";
import {
  getBrandWorkspaceId,
  disconnectConnectedAccount,
  getOAuthAuthorizationUrl,
  listLiveConnectedAccounts,
  buildPlatformAccountMap,
  CanonicalPlatformAccount,
  normalizeHandle,
  socialConnectorFramework,
  ensureValidGoogleAccess,
} from "../../services/socialIntegrationService";
import { isUuid } from "../../backend/mappers/workspaceMappers";
import { fetchBrandStorageAssets, uploadBrandAssetFile } from "../../backend/workspaceSync";
import { AuthPanel } from "../auth/AuthPanel";
import { DeleteWorkspaceModal } from "../ui/DeleteWorkspaceModal";
import { getStoredTheme, applyTheme, THEME_OPTIONS, ThemeMode } from "../../theme";
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
  ShieldCheck,
  Palette,
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
  User,
  Sparkles,
  Tag
} from "lucide-react";
import { MarketerMobileView } from "../marketer/MarketerMobileView";
import { MobileAIPreferences } from "./MobileAIPreferences";

type AutomationMode = "manual" | "balanced" | "autonomous";

interface MobileMoreProps {
  onNavigate?: (path: string) => void;
}

export function MobileMore({ onNavigate }: MobileMoreProps = {}) {
  const {
    memoryItems,
    addMemoryItem,
    removeMemoryItem,
    brand,
    character,
    accounts: contextAccounts,
    offers = [],
    aiSettings,
    updateAISettings,
    updateBrand,
    productionGenerationEnabled,
    toggleProductionGeneration,
  } = useSpark() as any;
  const auth = useAuth();

  const userDisplayName = auth.profile?.display_name || auth.currentUser?.email?.split("@")[0] || character?.name || "Creator";
  const userEmail = auth.currentUser?.email || "";

  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [automationMode, setAutomationMode] = useState<AutomationMode>("balanced");
  const [profile, setProfile] = useState({
    name: userDisplayName,
    email: userEmail,
    role: auth.profile?.role || "Director"
  });

  // Current sub-panel state
  const [activeDetail, setActiveDetail] = useState<string | null>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<AIRoutingCategory | null>(null);
  const [deleteTargetBrand, setDeleteTargetBrand] = useState<{ id: string; name: string } | null>(null);

  // Modals inside details
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  // Production: no seed API keys / assets
  const [apiKeyList, setApiKeyList] = useState<{ id: string; name: string; key: string; created: string }[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [showAddKey, setShowAddKey] = useState(false);

  const [assets, setAssets] = useState<{ id: string; name: string; type: string; size: string; url?: string }[]>([]);

  const { productions, reviewItems } = useSpark() as any;

  useEffect(() => {
    let isMounted = true;
    const brandId = auth.brand?.id || getBrandWorkspaceId();

    async function loadMobileAssets() {
      const items: { id: string; name: string; type: string; size: string; url?: string }[] = [];

      if (character?.characterSheetUrl || character?.imageUrl) {
        items.push({
          id: "char-sheet-asset-m",
          name: `${character?.name || "Host"}_Character_Sheet.png`,
          type: "Character Image",
          size: "Cloud Persisted",
          url: character.characterSheetUrl || character.imageUrl,
        });
      }

      if (character?.voice?.previewUrl) {
        items.push({
          id: "voice-preview-asset-m",
          name: `${character?.voice?.name || "Host"}_Voice_Preview.mp3`,
          type: "Voice Audio (MP3)",
          size: "Cloud Persisted",
          url: character.voice.previewUrl,
        });
      }

      const prodList = Array.isArray(productions) && productions.length > 0 ? productions : reviewItems || [];
      if (Array.isArray(prodList)) {
        prodList.forEach((p: any) => {
          if (p.videoUrl || p.video_url) {
            items.push({
              id: `prod-vid-m-${p.id}`,
              name: `${p.title || "Production"}_Video.mp4`,
              type: "Production Video (MP4)",
              size: "Rendered Media",
              url: p.videoUrl || p.video_url,
            });
          }
          if (p.audioUrl || p.voice_url) {
            items.push({
              id: `prod-aud-m-${p.id}`,
              name: `${p.title || "Production"}_Voice.mp3`,
              type: "Production Audio (MP3)",
              size: "Rendered Voice",
              url: p.audioUrl || p.voice_url,
            });
          }
        });
      }

      if (brandId && isUuid(brandId)) {
        const storageItems = await fetchBrandStorageAssets(brandId);
        storageItems.forEach((st) => items.push(st));
      }

      if (isMounted) setAssets(items);
    }

    loadMobileAssets();
    return () => {
      isMounted = false;
    };
  }, [auth.brand?.id, character, productions, reviewItems]);

  const [platformAccountMap, setPlatformAccountMap] = useState<Map<string, CanonicalPlatformAccount>>(() =>
    buildPlatformAccountMap(contextAccounts)
  );
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);

  const refreshMobileAccounts = () => {
    const map = buildPlatformAccountMap(contextAccounts);
    setPlatformAccountMap(map);
  };

  useEffect(() => {
    refreshMobileAccounts();

    void ensureValidGoogleAccess("YouTube Shorts").then((validToken) => {
      if (validToken) {
        refreshMobileAccounts();
      }
    });

    const onAccountUpdate = () => refreshMobileAccounts();
    window.addEventListener("spark-account-connected", onAccountUpdate);
    window.addEventListener("spark-account-disconnected", onAccountUpdate);
    window.addEventListener("spark-account-needs-reconnect", onAccountUpdate);
    return () => {
      window.removeEventListener("spark-account-connected", onAccountUpdate);
      window.removeEventListener("spark-account-disconnected", onAccountUpdate);
      window.removeEventListener("spark-account-needs-reconnect", onAccountUpdate);
    };
  }, [contextAccounts]);

  const [team, setTeam] = useState(() =>
    auth.isAuthenticated
      ? [{ id: "1", name: userDisplayName, email: userEmail, role: "Director" }]
      : []
  );
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
    renderReady: true,
    scheduledPost: true,
    weeklyReport: false,
    anomalyAlerts: true,
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

  const defaultOffer = offers.find((o: any) => o.active && o.isDefault) || offers.find((o: any) => o.active);
  const marketerBadge = offers.length === 0 ? "None" : defaultOffer ? defaultOffer.title : `${offers.length} active`;

  const sections = [
    {
      title: "Brand",
      items: [
        { icon: Sparkles, label: "My Spark", badge: "Brand & Research", path: "/my-spark" },
        { icon: Archive, label: "Assets", badge: `${assets.length} files` },
        { icon: Brain, label: "Memory", badge: `${memoryItems.length} rules` },
        { icon: Tag, label: "Marketer", badge: marketerBadge },
        {
          icon: LinkIcon,
          label: "Accounts",
          badge:
            Array.from(platformAccountMap.values()).filter((a) => a.active).length === 0
              ? "None"
              : `${Array.from(platformAccountMap.values()).filter((a) => a.active).length} active`,
        },
      ],
    },
    {
      title: "Account & Team",
      items: [
        { icon: CreditCard, label: "Billing", badge: "Not set" },
        { icon: Code, label: "API", badge: `${apiKeyList.length} keys` },
        { 
          icon: Sparkles, 
          label: "AI Preferences", 
          badge: (() => {
            const r = aiSettings?.routing || ModelRouter.getUserRoutingConfig();
            const count = Object.values(r).filter((p) => p && p !== "auto").length;
            return count === 0 ? "Best Available" : `${count} custom`;
          })()
        },
        { icon: ShieldCheck, label: "Credit Control", badge: "Generation limits", path: "/more/credit-control" },
        { icon: Brain, label: "Integrations", badge: "Connected" },
        { icon: Users, label: "Team", badge: `${team.length} members` },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: Palette,
          label: "Appearance & Theme",
          badge: THEME_OPTIONS.find((t) => t.id === currentTheme)?.name || "Obsidian Violet",
        },
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
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e: any) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const brandId = auth.brand?.id || getBrandWorkspaceId();
        const uploaded = await uploadBrandAssetFile(brandId, file);
        if (uploaded) {
          setAssets((prev) => [uploaded, ...prev]);
        } else {
          alert("Upload failed. Please check Supabase credentials.");
        }
      }
    };
    input.click();
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

    if (activeDetail === "Marketer") {
      return (
        <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
          <MarketerMobileView onBack={() => setActiveDetail(null)} />
        </div>
      );
    }

    const renderPanelContent = () => {
      switch (activeDetail) {
        case "My Spark":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-foreground" />
                  <h3 className="text-base font-semibold text-foreground">{brand?.name || "My Brand"}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{brand?.niche || "AI & Technology"} · {brand?.archetype || "The Expert Guide"}</p>
                <p className="text-xs text-foreground/90 leading-relaxed bg-background/50 p-3 rounded-lg border border-border/50">
                  {brand?.purpose || "Creating authoritative, engaging digital media content."}
                </p>
                <Button
                  onClick={() => {
                    setActiveDetail(null);
                    onNavigate?.("/my-spark");
                  }}
                  variant="accent"
                  className="w-full text-xs py-2 mt-2"
                >
                  Open Full Brand Genesis & Research Studio
                </Button>
              </div>
            </div>
          );

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
                <Plus className="w-4 h-4 mr-1" /> Upload Asset File to Storage
              </Button>
              <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                {assets.length === 0 ? (
                  <p className="p-5 text-center text-xs text-muted-foreground">No assets found in workspace storage.</p>
                ) : (
                  assets.map((asset) => (
                    <div key={asset.id} className="p-3.5 flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-sm font-medium truncate">{asset.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{asset.type} · {asset.size}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {asset.url && (
                          <button
                            onClick={() => window.open(asset.url, "_blank")}
                            className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-foreground"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setAssets(assets.filter((a) => a.id !== asset.id))}
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
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
                  {memoryItems.map((item: any) => (
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
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{item.text}</p>
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

        case "AI Preferences":
        case "AI Model Routing":
          return <MobileAIPreferences onBack={() => setActiveDetail(null)} onNavigate={onNavigate} />;

        case "Accounts":
          const mobilePlatforms = [
            { key: "youtube", displayName: "YouTube" },
            { key: "x", displayName: "Twitter/X" },
            { key: "tiktok", displayName: "TikTok" },
            { key: "instagram", displayName: "Instagram" },
            { key: "facebook", displayName: "Facebook" },
            { key: "linkedin", displayName: "LinkedIn" }
          ];

          const connectedCount = mobilePlatforms.filter(
            (plat) => platformAccountMap.get(plat.key)?.status === "connected"
          ).length;

          // Dev log for drift detection
          if (process.env.NODE_ENV !== "production") {
            const rawAccounts = contextAccounts || [];
            if (rawAccounts.length > 0 && connectedCount === 0) {
              console.warn("[Mobile Accounts Debug] Raw accounts found in context but 0 connected:", rawAccounts);
            }
          }

          return (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground px-1">
                {connectedCount} connected · live OAuth only
              </p>
              <div className="rounded-xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
                {mobilePlatforms.map((plat) => {
                  const conn = platformAccountMap.get(plat.key);
                  const isConnected = conn?.status === "connected";
                  const needsReconnect = conn?.status === "needs_reconnect";

                  return (
                    <div key={plat.key} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{plat.displayName}</span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                            isConnected
                              ? "bg-success/15 text-success"
                              : needsReconnect
                              ? "bg-amber-500/15 text-amber-400 font-semibold"
                              : "bg-muted/50 text-muted-foreground"
                          }`}>
                            {isConnected ? "CONNECTED" : needsReconnect ? "RECONNECT REQUIRED" : "DISCONNECTED"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                          {isConnected || needsReconnect ? normalizeHandle(conn?.handle) || "Linked Account" : "Not Connected"}
                        </p>
                      </div>
                      
                      {isConnected ? (
                        <button
                          disabled={disconnectingPlatform === plat.key}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Disconnect ${plat.displayName}? You can reconnect anytime.`
                              )
                            ) {
                              return;
                            }
                            setDisconnectingPlatform(plat.key);
                            try {
                              await disconnectConnectedAccount(plat.key);
                              refreshMobileAccounts();
                            } catch (e: any) {
                              alert(e?.message || "Disconnect failed");
                            } finally {
                              setDisconnectingPlatform(null);
                            }
                          }}
                          className="py-1.5 px-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold text-center transition-colors shrink-0 cursor-pointer"
                        >
                          {disconnectingPlatform === plat.key ? "…" : "Disconnect"}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            try {
                              localStorage.setItem("spark_oauth_trigger_source", "accounts");
                            } catch {
                              /* ignore */
                            }
                            socialConnectorFramework.loadClientConfig().then(() => {
                              const url = getOAuthAuthorizationUrl(plat.key);
                              if (url && url !== "#") {
                                window.location.href = url;
                              } else {
                                alert(`Failed to connect ${plat.displayName}: Client credentials not configured on Vercel environment.`);
                              }
                            }).catch(() => {});
                          }}
                          className={`py-1.5 px-3 rounded-lg border text-xs font-semibold text-center transition-colors shrink-0 cursor-pointer ${
                            needsReconnect
                              ? "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                              : "border-border bg-background hover:bg-accent/10"
                          }`}
                        >
                          {needsReconnect ? "Reconnect" : "Connect"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );

        case "Billing":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Active Plan</p>
                <h4 className="text-lg font-bold text-accent-foreground">Not configured</h4>
                <p className="text-xs text-muted-foreground">Billing is not connected in this environment yet.</p>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Billing Receipts</p>
                </div>
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">No invoices yet.</div>
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

        case "Appearance & Theme":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Select Operating System Theme</h3>
                <p className="text-xs text-muted-foreground">Customizes canvas, cards, typography, navigation, and accents.</p>
                <div className="space-y-2.5 pt-2">
                  {THEME_OPTIONS.map((theme) => {
                    const isSelected = currentTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setCurrentTheme(theme.id);
                          applyTheme(theme.id);
                        }}
                        className={`w-full p-4 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                          isSelected
                            ? "border-accent bg-accent/10 text-foreground ring-1 ring-accent"
                            : "border-border bg-background text-muted-foreground hover:border-accent/40"
                        }`}
                      >
                        <div className={`h-2.5 w-full rounded-full ${theme.previewColor} shadow-inner`} />
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-foreground">{theme.name}</h4>
                          {isSelected && <Check className="w-4 h-4 text-accent-foreground shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{theme.desc}</p>
                      </button>
                    );
                  })}
                </div>
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

        case "Workspaces":
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Brand Workspaces</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Switch between brands or create a new workspace</p>
                  </div>
                  <Button
                    onClick={() => {
                      setActiveDetail(null);
                      auth.openCreateWorkspaceModal();
                    }}
                    variant="accent"
                    size="sm"
                    className="text-xs py-1 h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New
                  </Button>
                </div>
                <div className="space-y-2 pt-1">
                  {(auth.brands && auth.brands.length > 0 ? auth.brands : (auth.brand ? [auth.brand] : (brand ? [brand] : [{ id: "default", name: "Spark Workspace", niche: "Content Creation" }]))).map((b: any) => {
                    const isActive = b.id === (auth.brand?.id || brand?.id);
                    return (
                      <div
                        key={b.id}
                        onClick={async () => {
                          if (!isActive && b.id !== "default") {
                            await auth.switchBrand(b.id);
                            setActiveDetail(null);
                          }
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all group ${
                          isActive
                            ? "bg-accent/20 border border-accent/40 text-foreground"
                            : "bg-background border border-border hover:border-border/80 text-muted-foreground hover:text-foreground cursor-pointer"
                        }`}
                      >
                        <div className="min-w-0 pr-2 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{b.name || "Untitled Workspace"}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{b.niche || "Content Creation"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isActive && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                          {b.id !== "default" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetBrand(b);
                              }}
                              title="Delete workspace"
                              className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all opacity-80 group-hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
    <div className="w-full min-h-[100dvh] flex flex-col space-y-6 pt-3 pb-6 px-4">
      <div>
        <h1 className="text-2xl font-medium">More</h1>
        <p className="text-sm text-muted-foreground mt-1">Settings and management</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-medium text-accent-foreground">
            {profileName.split(" ").map((n: any) => n[0]).join("")}
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
      <div className="rounded-xl border border-border bg-card p-4">
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
      </div>

      {/* Production */}
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground mb-3 px-1">Production</h3>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (productionGenerationEnabled) toggleProductionGeneration?.();
              }}
              className={`py-3 px-3.5 rounded-lg text-left transition-all ${
                !productionGenerationEnabled
                  ? "bg-accent text-foreground border border-accent shadow-sm"
                  : "bg-background border border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="text-xs font-semibold">Off</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">no media generation</div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!productionGenerationEnabled) toggleProductionGeneration?.();
              }}
              className={`py-3 px-3.5 rounded-lg text-left transition-all ${
                productionGenerationEnabled
                  ? "bg-accent text-foreground border border-accent shadow-sm"
                  : "bg-background border border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="text-xs font-semibold">On</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">production generation allowed</div>
            </button>
          </div>
        </div>
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
                  onClick={() => {
                    if ((item as any).path && onNavigate) {
                      onNavigate((item as any).path);
                    } else {
                      setActiveDetail(item.label);
                    }
                  }}
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
          <div className="w-full flex flex-col gap-2 px-1">
            <Button
              onClick={() => setShowSignOut(true)}
              variant="outline"
              className="w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
            <Button
              onClick={() => setActiveDetail("Workspaces")}
              variant="outline"
              className="w-full text-xs flex items-center justify-center gap-1.5"
            >
              <Users className="w-4 h-4 text-muted-foreground" />
              Workspaces ({auth.brand?.name || brand?.name || "Default"})
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowSignIn(true)}
            variant="outline"
            className="w-full text-xs flex items-center justify-center gap-1.5"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
        )}
        <div className="text-center text-[10px] text-muted-foreground pb-4 uppercase tracking-wider font-mono">
          Spark · Media Operating System · v4.12
        </div>
      </div>

      {/* Detail Panel overlay */}
      {renderDetailPanel()}

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full shadow-lg relative">
            <button
              onClick={() => setShowSignIn(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <AuthPanel onSuccess={() => setShowSignIn(false)} />
          </div>
        </div>
      )}

      {/* Sign Out Modal */}
      {showSignOut && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
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

      {/* Delete Workspace Confirmation Modal */}
      <DeleteWorkspaceModal
        isOpen={!!deleteTargetBrand}
        brand={deleteTargetBrand}
        onClose={() => setDeleteTargetBrand(null)}
        onConfirm={async (id) => {
          await auth.deleteWorkspace(id);
        }}
      />
    </div>
  );
}
