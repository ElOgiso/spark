import { useState } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import {
  Brain,
  Mic,
  Target,
  Users,
  Zap,
  Shield,
  Link,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Play,
  Lock,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface MySparkProps {
  onNavigate: (path: string) => void;
}

export function MySpark({ onNavigate }: MySparkProps) {
  const {
    brand,
    character,
    accounts,
    automationMode,
    productionMode,
    memoryItems,
    updateAutomationMode,
    updateProductionMode,
    addMemoryItem,
    toggleContentPillar,
    toggleTone
  } = useSpark();

  const [newRuleText, setNewRuleText] = useState("");
  const [showAddRule, setShowAddRule] = useState(false);

  const automationConfig = {
    manual: { label: "Manual", desc: "All decisions require your approval", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    balanced: { label: "Balanced", desc: "AI handles routine decisions, you approve strategy", color: "text-accent-foreground", bg: "bg-accent/20", border: "border-accent/40" },
    autonomous: { label: "Autonomous", desc: "AI operates independently, you set direction", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  };

  const productionConfig = {
    express: { label: "Express", desc: "Rapid — one format, minimal review gates", time: "2–4 hours" },
    standard: { label: "Standard", desc: "Balanced — multiple formats, standard review", time: "6–12 hours" },
    deep: { label: "Deep", desc: "Comprehensive — full series, all formats, all gates", time: "24–48 hours" },
  };

  const aMode = automationConfig[automationMode];
  const pMode = productionConfig[productionMode];

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    addMemoryItem(newRuleText.trim(), "rule");
    setNewRuleText("");
    setShowAddRule(false);
  };


  return (
    <>
      <TopBar workspaceName="My Spark" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-8">

          <div>
            <h1 className="text-3xl font-medium">My Spark</h1>
            <p className="text-muted-foreground mt-1">Your brand's intelligence profile — the brain behind every production</p>
          </div>

          {/* Brand Identity */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Brand Identity</h2>
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-medium">{brand.name}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">Active</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{brand.niche}</p>
                  <p className="text-xs text-muted-foreground">Archetype: <span className="text-foreground font-medium">{brand.archetype}</span></p>
                </div>
                <button className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 text-sm font-medium transition-colors">
                  Edit Identity
                </button>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Brand Purpose</p>
                <p className="text-base leading-relaxed">{brand.purpose}</p>
              </div>
            </div>
          </section>

          {/* Content Pillars */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Content Pillars</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">These pillars guide every production decision</p>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">+ Add pillar</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {brand.contentPillars.map((pillar) => (
                  <button
                    key={pillar.label}
                    onClick={() => toggleContentPillar(pillar.label)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      pillar.active
                        ? "bg-accent text-foreground border border-accent/60"
                        : "bg-background border border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {pillar.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Character & Voice */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Character & Voice</h2>
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Primary Character</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-medium">{character.name}</p>
                      <p className="text-sm text-muted-foreground">{character.role}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{character.style}</p>
                    <div className="flex flex-wrap gap-2">
                      {character.traits.map((trait) => (
                        <span key={trait} className="px-2.5 py-1 rounded-lg bg-accent/20 text-xs font-medium">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Voice Identity</p>
                  <div className="p-4 rounded-xl bg-accent/20 border border-accent/40">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium font-mono">{character.voice.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{character.voice.language}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {character.voice.locked && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-success/20 text-success text-xs font-medium">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{character.voice.tone}</p>
                    <button className="w-full py-2 rounded-lg bg-background/50 hover:bg-background text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-border/50">
                      <Play className="w-3.5 h-3.5" />
                      Preview Voice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Audience */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Audience Profile</h2>
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-5 p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground mb-1">Primary Audience</p>
                <p className="text-base font-medium">{brand.audience.primary}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Pain Points</p>
                  <div className="space-y-2">
                    {brand.audience.painPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                        <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Desires</p>
                  <div className="space-y-2">
                    {brand.audience.desires.map((desire, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/10">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{desire}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tone Matrix */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Tone & Style</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground mb-4">Active tones shape every script, caption, and hook</p>
              <div className="flex flex-wrap gap-2">
                {brand.tone.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => toggleTone(t.label)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      t.active
                        ? "bg-foreground text-background"
                        : "bg-background border border-border text-muted-foreground hover:border-border"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Connected Accounts */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Connected Accounts</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {accounts.map((account, i) => (
                <div
                  key={account.platform}
                  className={`flex items-center justify-between px-6 py-4 ${i < accounts.length - 1 ? "border-b border-border/50" : ""} hover:bg-accent/5 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${account.status === "connected" ? "bg-success" : "bg-muted-foreground/30"}`} />
                    <div>
                      <p className="text-sm font-medium">{account.platform}</p>
                      <p className="text-xs text-muted-foreground">{account.handle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {account.status === "connected" ? (
                      <p className="text-xs text-muted-foreground">{account.posts} posts</p>
                    ) : (
                      <button className="text-xs text-accent-foreground font-medium hover:underline">Connect</button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Production Mode */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Production Mode</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground mb-4">Controls the depth and time of each production run</p>
              <div className="grid grid-cols-3 gap-3">
                {(["express", "standard", "deep"] as const).map((mode) => {
                  const cfg = productionConfig[mode];
                  const isActive = productionMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => updateProductionMode(mode)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        isActive
                          ? "bg-accent/20 border-accent/40"
                          : "bg-background border-border hover:border-accent/30"
                      }`}
                    >
                      <p className={`text-sm font-medium mb-1 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {cfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{cfg.desc}</p>
                      <p className={`text-xs font-medium ${isActive ? "text-accent-foreground" : "text-muted-foreground"}`}>{cfg.time}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Automation Mode */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Automation Mode</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground mb-4">How much AI operates independently vs. awaiting your approval</p>
              <div className="grid grid-cols-3 gap-3">
                {(["manual", "balanced", "autonomous"] as const).map((mode) => {
                  const cfg = automationConfig[mode];
                  const isActive = automationMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => updateAutomationMode(mode)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        isActive ? `${cfg.bg} ${cfg.border}` : "bg-background border-border hover:border-accent/30"
                      }`}
                    >
                      <p className={`text-sm font-medium mb-1 ${isActive ? cfg.color : "text-muted-foreground"}`}>{cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Memory & Brand Rules */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Memory & Brand Rules</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-accent-foreground" />
                  <p className="text-sm font-medium">Learned patterns and hard rules applied to every production</p>
                </div>
                <button
                  onClick={() => setShowAddRule(!showAddRule)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAddRule ? "Cancel" : "+ Add rule"}
                </button>
              </div>

              {showAddRule && (
                <form onSubmit={handleAddRuleSubmit} className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    placeholder="Enter brand guideline or style rule..."
                    className="flex-1 bg-background text-foreground text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/95"
                  >
                    Add
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {memoryItems.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border ${
                      item.type === "learned"
                        ? "bg-accent/10 border-accent/20"
                        : "bg-background border-border"
                    }`}
                  >
                    {item.type === "learned" ? (
                      <Sparkles className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    )}
                    <p className="text-sm flex-1">{item.text}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.type === "learned" ? "bg-accent/20 text-accent-foreground" : "bg-muted/40 text-muted-foreground"
                    }`}>
                      {item.type === "learned" ? "Learned" : "Rule"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
