import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { useAuth } from "../../state/AuthContext";
import { ModelRouter } from "../../services/runtime/modelRouter";
import { getModelsForProviderAndCapability, getModelLabel, CATALOG_VERSION } from "../../services/runtime/modelCatalog";
import type { AIRoutingCategory, AIProviderId } from "../../domain/types";
import { Button } from "../ds";
import {
  disconnectConnectedAccount,
  getOAuthAuthorizationUrl,
  listLiveConnectedAccounts,
  socialConnectorFramework,
} from "../../services/socialIntegrationService";
import { AuthPanel } from "../auth/AuthPanel";
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

  // Modals inside details
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  // Production: no seed API keys / assets
  const [apiKeyList, setApiKeyList] = useState<{ id: string; name: string; key: string; created: string }[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [showAddKey, setShowAddKey] = useState(false);

  const [assets, setAssets] = useState<{ id: string; name: string; type: string; size: string }[]>([]);

  const [accounts, setAccounts] = useState(() => {
    const live = listLiveConnectedAccounts();
    if (live.length > 0) {
      return live.map((a, idx) => ({
        id: String(idx + 1),
        platform: a.platform,
        handle: a.handle,
        followers: "—",
        active: true as boolean,
      }));
    }
    if (contextAccounts && Array.isArray(contextAccounts)) {
      return contextAccounts
        .filter((a: any) => a.status === "connected")
        .map((a: any, idx: number) => ({
          id: String(idx + 1),
          platform: a.platform,
          handle: a.handle || "",
          followers: "—",
          active: true as boolean,
        }));
    }
    return [] as { id: string; platform: string; handle: string; followers: string; active: boolean }[];
  });
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);

  const refreshMobileAccounts = () => {
    const live = listLiveConnectedAccounts();
    setAccounts(
      live.map((a, idx) => ({
        id: String(idx + 1),
        platform: a.platform,
        handle: a.handle,
        followers: "—",
        active: true,
      }))
    );
  };

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
            accounts.filter((a) => a.active).length === 0
              ? "None"
              : `${accounts.filter((a) => a.active).length} active`,
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
          const currentRouting = aiSettings?.routing || ModelRouter.getUserRoutingConfig();
          const currentModels = aiSettings?.models || ModelRouter.getUserModelSelectionConfig();
          const customCount = Object.values(currentRouting).filter((p) => p && p !== "auto").length;

          const AI_TASK_GROUPS: {
            title: string;
            tasks: { id: AIRoutingCategory; name: string; desc: string }[];
          }[] = [
            {
              title: "Executive & Decisions",
              tasks: [
                { id: "superSpark", name: "Super Spark Chat", desc: "Executive conversational assistant & decision engine" },
                { id: "executive", name: "Executive Memory & Directives", desc: "Return briefings, offline summaries & directives" },
              ],
            },
            {
              title: "Discovery & Multimodal Vision",
              tasks: [
                { id: "research", name: "Research Department", desc: "Breakout trend discovery, radar & hook scoring" },
                { id: "videoUnderstanding", name: "Video Understanding", desc: "2-tier keyframe visual analysis & frame parsing" },
              ],
            },
            {
              title: "Production & Media Synthesis",
              tasks: [
                { id: "production", name: "Production Pipeline", desc: "Production Brief generation, storyboarding & scripting" },
                { id: "storyboardImages", name: "Storyboard Keyframes", desc: "9:16 vertical scene keyframe images" },
                { id: "videoGeneration", name: "Video Generation", desc: "9:16 vertical video preview clips" },
                { id: "voice", name: "Voiceover Narration", desc: "Audio voiceover narration synthesis" },
              ],
            },
            {
              title: "Operations & Analytics",
              tasks: [
                { id: "automation", name: "Autonomous Workflows", desc: "Background trend monitoring & queue scheduling" },
                { id: "analytics", name: "Analytics & Performance", desc: "Audience reach estimation & virality attribution" },
              ],
            },
          ];

          return (
            <div className="space-y-5 pb-10">
              {/* Summary Card */}
              <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-foreground">Task-Based AI Preferences</h3>
                  </div>
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    customCount === 0 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-purple-500/10 text-purple-300 border-purple-500/20"
                  }`}>
                    {customCount === 0 ? "All Best Available" : `${customCount} Custom Overrides`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {customCount === 0 
                    ? "All 10 tasks use Best Available. SPARK automatically routes each task to the optimal model dynamically."
                    : `${customCount} custom override${customCount > 1 ? "s" : ""} active. Other tasks use Best Available.`}
                </p>
              </div>

              {/* Grouped Section Lists */}
              <div className="space-y-5">
                {AI_TASK_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      {group.title}
                    </h4>
                    <div className="rounded-2xl border border-border/70 bg-card divide-y divide-border/40 overflow-hidden">
                      {group.tasks.map((task) => {
                        const configuredProvider = currentRouting[task.id] || "auto";
                        const configuredModel = currentModels[task.id] || "";
                        const capability = ModelRouter.mapCategoryToCapability(task.id);
                        const effectiveProvider = ModelRouter.resolveProvider(task.id, currentRouting);
                        const effectiveModelId = ModelRouter.resolveModel(task.id, effectiveProvider, capability, currentModels);
                        const effectiveLabel = getModelLabel(effectiveProvider, effectiveModelId);

                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => setSelectedCategoryKey(task.id)}
                            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-accent/5 active:bg-accent/10 transition-colors"
                          >
                            <div className="space-y-1 flex-1 min-w-0 pr-2">
                              <span className="text-xs font-semibold text-foreground block truncate">
                                {task.name}
                              </span>
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {task.desc}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                                configuredProvider === "auto"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-medium"
                                  : "bg-purple-500/10 text-purple-300 border-purple-500/30 font-mono font-semibold"
                              }`}>
                                {configuredProvider === "auto" 
                                  ? "Best Available" 
                                  : `${configuredProvider.toUpperCase()} · ${effectiveLabel}`}
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/70" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Sheet Modal */}
              {selectedCategoryKey && (() => {
                const activeTask = AI_TASK_GROUPS.flatMap((g) => g.tasks).find((t) => t.id === selectedCategoryKey);
                if (!activeTask) return null;

                const capability = ModelRouter.mapCategoryToCapability(selectedCategoryKey);
                const configuredProvider = currentRouting[selectedCategoryKey] || "auto";
                const configuredModel = currentModels[selectedCategoryKey] || "";
                const effectiveProvider = ModelRouter.resolveProvider(selectedCategoryKey, currentRouting);
                const effectiveModelId = ModelRouter.resolveModel(selectedCategoryKey, effectiveProvider, capability, currentModels);
                const effectiveLabel = getModelLabel(effectiveProvider, effectiveModelId);

                const availableModels = configuredProvider !== "auto"
                  ? getModelsForProviderAndCapability(configuredProvider as AIProviderId, capability)
                  : [];

                const providerOptions: { id: AIProviderId; label: string; desc: string }[] = [
                  { id: "auto", label: "Best Available (Auto)", desc: "SPARK dynamically selects the optimal provider & model" },
                  { id: "openai", label: "OpenAI", desc: "GPT-5.6, GPT-Image-1.5, DALL-E 3" },
                  { id: "claude", label: "Anthropic Claude", desc: "Claude Sonnet 5, Claude Opus 5" },
                  { id: "gemini", label: "Google Gemini", desc: "Gemini 2.5 Flash, Native Image, Veo 3.1" },
                  { id: "grok", label: "xAI Grok", desc: "Grok 4.5, Imagine Image & Video, Grok TTS" },
                  ...(selectedCategoryKey === "voice" ? [{ id: "elevenlabs" as AIProviderId, label: "ElevenLabs", desc: "Hyper-realistic voice synthesis & narration" }] : []),
                ];

                return (
                  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
                    {/* Backdrop */}
                    <div 
                      className="absolute inset-0" 
                      onClick={() => setSelectedCategoryKey(null)} 
                    />

                    {/* Bottom Sheet Content */}
                    <div className="relative w-full max-w-lg bg-card border-t border-border/80 rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl z-10 animate-slide-up">
                      {/* Pull Handle */}
                      <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto" />

                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 pt-1">
                        <div>
                          <h3 className="text-base font-bold text-foreground">{activeTask.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{activeTask.desc}</p>
                        </div>
                        <button
                          onClick={() => setSelectedCategoryKey(null)}
                          className="p-1.5 rounded-full bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Provider Selection */}
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block px-1">
                          Select Provider
                        </span>
                        <div className="space-y-1.5">
                          {providerOptions.map((prov) => {
                            const isSelected = configuredProvider === prov.id;
                            return (
                              <button
                                key={prov.id}
                                type="button"
                                onClick={() => {
                                  const newProv = prov.id;
                                  ModelRouter.setUserRoutingConfig({ [selectedCategoryKey]: newProv });
                                  if (newProv === "auto") {
                                    ModelRouter.setUserModelSelectionConfig({ [selectedCategoryKey]: "" });
                                  }
                                  if (updateAISettings) {
                                    updateAISettings({
                                      ...aiSettings,
                                      routing: {
                                        ...(aiSettings?.routing || {}),
                                        [selectedCategoryKey]: newProv,
                                      },
                                      models: {
                                        ...(aiSettings?.models || {}),
                                        ...(newProv === "auto" ? { [selectedCategoryKey]: "" } : {}),
                                      },
                                    });
                                  }
                                }}
                                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all ${
                                  isSelected
                                    ? "border-purple-500/80 bg-purple-500/10 shadow-sm"
                                    : "border-border/50 bg-background/50 hover:bg-background/80"
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <span className={`text-xs font-semibold block ${isSelected ? "text-purple-200" : "text-foreground"}`}>
                                    {prov.label}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    {prov.desc}
                                  </span>
                                </div>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "border-purple-500 bg-purple-500 text-white"
                                    : "border-muted-foreground/40"
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Specific Model Selection (Visible only when provider !== auto) */}
                      {configuredProvider !== "auto" && (
                        <div className="space-y-2 pt-1 border-t border-border/40">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Specific Model
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {availableModels.length} models
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {/* Recommended Default Option */}
                            <button
                              type="button"
                              onClick={() => {
                                ModelRouter.setUserModelSelectionConfig({ [selectedCategoryKey]: "" });
                                if (updateAISettings) {
                                  updateAISettings({
                                    ...aiSettings,
                                    models: {
                                      ...(aiSettings?.models || {}),
                                      [selectedCategoryKey]: "",
                                    },
                                  });
                                }
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all ${
                                configuredModel === ""
                                  ? "border-purple-500/80 bg-purple-500/10"
                                  : "border-border/50 bg-background/40 hover:bg-background/70"
                              }`}
                            >
                              <div>
                                <span className="text-xs font-semibold block text-foreground">Recommended default</span>
                                <span className="text-[10px] text-muted-foreground">Automatically use catalog recommended model for {configuredProvider.toUpperCase()}</span>
                              </div>
                              {configuredModel === "" && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                            </button>

                            {/* Catalog Models */}
                            {availableModels.map((m) => {
                              const isSelected = configuredModel === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    ModelRouter.setUserModelSelectionConfig({ [selectedCategoryKey]: m.id });
                                    if (updateAISettings) {
                                      updateAISettings({
                                        ...aiSettings,
                                        models: {
                                          ...(aiSettings?.models || {}),
                                          [selectedCategoryKey]: m.id,
                                        },
                                      });
                                    }
                                  }}
                                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all ${
                                    isSelected
                                      ? "border-purple-500/80 bg-purple-500/10"
                                      : "border-border/50 bg-background/40 hover:bg-background/70"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs ${isSelected ? "text-purple-200 font-semibold" : "text-foreground font-medium"}`}>
                                      {m.label}
                                    </span>
                                    {m.recommended && (
                                      <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-semibold">
                                        ★ Recommended
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Effective status line */}
                      <div className="p-3 rounded-xl bg-background/60 border border-border/50 text-[10px] text-muted-foreground flex items-center gap-2 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {configuredProvider === "auto" ? (
                          <span>Best Available chooses provider & model (currently {effectiveProvider.toUpperCase()} · {effectiveLabel})</span>
                        ) : (
                          <span>Uses {effectiveLabel || effectiveModelId}</span>
                        )}
                      </div>

                      {/* Done Button */}
                      <Button
                        onClick={() => setSelectedCategoryKey(null)}
                        variant="accent"
                        className="w-full py-3 rounded-xl text-xs font-semibold"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Quiet Footer */}
              <div className="p-2 text-center text-[10px] text-muted-foreground font-mono">
                Models maintained in modelCatalog · Catalog v{CATALOG_VERSION}
              </div>
            </div>
          );

        case "Accounts":
          const mobilePlatforms = [
            { key: "YouTube Shorts", displayName: "YouTube" },
            { key: "Twitter/X", displayName: "Twitter/X" },
            { key: "TikTok", displayName: "TikTok" },
            { key: "Instagram", displayName: "Instagram" },
            { key: "Facebook", displayName: "Facebook" },
            { key: "LinkedIn", displayName: "LinkedIn" }
          ];

          return (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground px-1">
                {accounts.filter((a) => a.active).length} connected · live OAuth only
              </p>
              <div className="rounded-xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
                {mobilePlatforms.map((plat) => {
                  const conn = accounts.find(
                    (a) =>
                      a.platform === plat.key ||
                      a.platform === plat.displayName ||
                      (plat.key.includes("YouTube") && String(a.platform).includes("YouTube")) ||
                      (plat.key.includes("Twitter") &&
                        (String(a.platform).includes("Twitter") || a.platform === "X"))
                  );
                  const isConnected = Boolean(conn?.active);

                  return (
                    <div key={plat.key} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{plat.displayName}</span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                            isConnected ? "bg-success/15 text-success" : "bg-muted/50 text-muted-foreground"
                          }`}>
                            {isConnected ? "CONNECTED" : "DISCONNECTED"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                          {isConnected ? conn!.handle || "Connected" : "Not Connected"}
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
                          className="py-1.5 px-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold text-center transition-colors shrink-0"
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
                          className="py-1.5 px-3 rounded-lg border border-border bg-background hover:bg-accent/10 text-xs font-semibold text-center transition-colors shrink-0"
                        >
                          Connect
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
              onClick={() => {
                const name = prompt("Enter workspace/brand name to switch to:", brand?.name || "Creative Studio");
                if (name && name.trim()) {
                  if (typeof updateBrand === "function") {
                    updateBrand({ ...brand, name: name.trim() });
                  }
                  alert(`Successfully switched active workspace to: ${name.trim()}`);
                }
              }}
              variant="outline"
              className="w-full text-xs flex items-center justify-center gap-1.5"
            >
              <Users className="w-4 h-4 text-muted-foreground" />
              Switch Workspace ({brand?.name || "Default"})
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
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
