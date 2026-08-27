import { useState } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import { CharacterStudioModal } from "./ui/CharacterStudioModal";
import { VoiceStudioModal } from "./ui/VoiceStudioModal";
import { LocationPlateStudioModal } from "./ui/LocationPlateStudioModal";
import { SupportCharacterModal } from "./ui/SupportCharacterModal";
import { getEffectiveContentFormat } from "../services/production/characterSheetGate";
import { previewElevenLabsVoice } from "../services/runtime/providers/elevenLabsTTS";
import { getOAuthAuthorizationUrl, normalizeHandle } from "../services/socialIntegrationService";
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
  Compass,
  RefreshCw,
  Trash2,
  Plus,
  ExternalLink,
  Check,
  Pin,
  Archive,
  Edit3,
  Search,
  ChevronDown,
  ChevronUp,
  Wand2,
  Layers,
  Film,
  Globe,
  Award,
  Video,
  Cpu,
} from "lucide-react";
import { PROVIDER_VIDEO_CAPABILITIES, resolveActiveVideoProvider, deriveVideoProductionPlanMetrics } from "../services/runtime/providerCapabilities";
import { getProviderLogo } from "./ui/AIProviderLogos";
import { SearchableSelect } from "./ui/SearchableSelect";
import {
  BRAND_ARCHETYPES,
  BRAND_NICHES,
  BRAND_COUNTRIES,
  BRAND_LANGUAGES,
  BRAND_TONE_OPTIONS,
  BRAND_STYLE_OPTIONS,
  seedDefaultAudience,
} from "../domain/brandOptions";
import { VIDEO_LENGTH_OPTIONS, getEffectiveFormatSettings } from "../domain/types";

interface MySparkProps {
  onNavigate: (path: string) => void;
}

export function MySpark({ onNavigate }: MySparkProps) {
  const {
    brand,
    character,
    characters = [],
    accounts,
    automationMode,
    productionMode,
    formatSettings,
    memoryItems,
    researchSources = [],
    updateBrand,
    updateCharacter,
    addSupportCharacter,
    deleteSupportCharacter,
    updateAutomationMode,
    updateProductionMode,
    updateFormatSettings,
    addMemoryItem,
    removeMemoryItem,
    pinMemoryItem,
    archiveMemoryItem,
    addResearchSource,
    removeResearchSource,
    syncResearchSource,
    createProductionFromSpark,
    viralSparks = [],
    updateMemoryItem,
    toggleContentPillar,
    toggleTone,
    toggleStyle,
  } = useSpark() as any;

  const [showCharacterStudio, setShowCharacterStudio] = useState(false);
  const [showVoiceStudio, setShowVoiceStudio] = useState(false);
  const [showLocationPlateStudio, setShowLocationPlateStudio] = useState(false);
  const [showSupportCharacterModal, setShowSupportCharacterModal] = useState(false);

  const [newRuleText, setNewRuleText] = useState("");
  const [showAddRule, setShowAddRule] = useState(false);
  const [expandedRuleIndex, setExpandedRuleIndex] = useState<number | null>(null);
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [isSubmittingSource, setIsSubmittingSource] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [expandedWhyId, setExpandedWhyId] = useState<string | null>(null);

  // Memory Rules Operations State
  const [ruleSearchQuery, setRuleSearchQuery] = useState("");
  const [showArchivedRules, setShowArchivedRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleText, setEditingRuleText] = useState("");

  // Profile & Brand Extended Edit State
  const [showEditIdentity, setShowEditIdentity] = useState(false);
  const [editName, setEditName] = useState(brand?.name || "");
  const [editNiche, setEditNiche] = useState(brand?.niche || "AI & Automation");
  const [editArchetype, setEditArchetype] = useState(brand?.archetype || "Visionary Creator");
  const [editPurpose, setEditPurpose] = useState(brand?.purpose || "");
  const [editWebsite, setEditWebsite] = useState(brand?.website || "");
  const [editCountry, setEditCountry] = useState(brand?.country || "United States");
  const [editLanguage, setEditLanguage] = useState(brand?.language || "English (US)");
  const [editAudiencePrimary, setEditAudiencePrimary] = useState(brand?.audience?.primary || "");
  const [editPainPoints, setEditPainPoints] = useState(
    Array.isArray(brand?.audience?.painPoints) ? brand.audience.painPoints.join(", ") : ""
  );
  const [editDesires, setEditDesires] = useState(
    Array.isArray(brand?.audience?.desires) ? brand.audience.desires.join(", ") : ""
  );

  const openEditIdentity = () => {
    setEditName(brand?.name || "");
    setEditNiche(brand?.niche || "AI & Automation");
    setEditArchetype(brand?.archetype || "Visionary Creator");
    setEditPurpose(brand?.purpose || "");
    setEditWebsite(brand?.website || "");
    setEditCountry(brand?.country || "United States");
    setEditLanguage(brand?.language || "English (US)");

    const currentAud = brand?.audience;
    const isAudEmpty = !currentAud?.primary && (!currentAud?.painPoints || currentAud.painPoints.length === 0);
    if (isAudEmpty) {
      const seeded = seedDefaultAudience({
        niche: brand?.niche || "AI & Automation",
        archetype: brand?.archetype || "Visionary Creator",
        country: brand?.country || "United States",
        characterName: character?.name,
      });
      setEditAudiencePrimary(seeded.primary);
      setEditPainPoints(seeded.painPoints.join(", "));
      setEditDesires(seeded.desires.join(", "));
    } else {
      setEditAudiencePrimary(currentAud?.primary || "");
      setEditPainPoints(
        Array.isArray(currentAud?.painPoints) ? currentAud.painPoints.join(", ") : ""
      );
      setEditDesires(
        Array.isArray(currentAud?.desires) ? currentAud.desires.join(", ") : ""
      );
    }
    setShowEditIdentity(true);
  };

  const [showAddPillar, setShowAddPillar] = useState(false);
  const [newPillarText, setNewPillarText] = useState("");
  const [isPlayingVoicePreview, setIsPlayingVoicePreview] = useState(false);
  const [activeVoiceAudio, setActiveVoiceAudio] = useState<HTMLAudioElement | null>(null);

  const handleEditIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateBrand) return;
    updateBrand({
      name: editName.trim() || brand?.name || "My Brand",
      niche: editNiche.trim() || brand?.niche || "AI & Automation",
      archetype: editArchetype.trim() || brand?.archetype || "Visionary Creator",
      purpose: editPurpose.trim() || brand?.purpose || "",
      website: editWebsite.trim(),
      country: editCountry.trim() || "United States",
      language: editLanguage.trim() || "English (US)",
      audience: {
        ...brand?.audience,
        primary: editAudiencePrimary.trim(),
        painPoints: editPainPoints.split(",").map((s: string) => s.trim()).filter(Boolean),
        desires: editDesires.split(",").map((s: string) => s.trim()).filter(Boolean),
      },
    });
    setShowEditIdentity(false);
  };

  const togglePinRule = (id: string, currentPinned: boolean) => {
    if (pinMemoryItem) {
      pinMemoryItem(id, !currentPinned);
    }
  };

  const toggleArchiveRule = (id: string, currentArchived: boolean) => {
    if (archiveMemoryItem) {
      archiveMemoryItem(id, !currentArchived);
    }
  };

  const handleSaveRuleEdit = (id: string) => {
    if (!editingRuleText.trim()) return;
    if (updateMemoryItem) {
      updateMemoryItem(id, editingRuleText.trim(), "rule");
    }
    setEditingRuleId(null);
    setEditingRuleText("");
  };

  const handleSavePatternToMemory = (source: any, patternTitle: string, patternDesc: string) => {
    if (addMemoryItem) {
      addMemoryItem(`[Saved Pattern - ${source.displayName}] ${patternTitle}: ${patternDesc}`, "rule");
    }
  };

  const handleAddPillarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPillarText.trim() || !updateBrand) return;
    const existing = brand?.contentPillars || [];
    const newPillars = [...existing, { label: newPillarText.trim(), active: true }];
    updateBrand({ contentPillars: newPillars });
    setNewPillarText("");
    setShowAddPillar(false);
  };

  const handlePreviewVoice = async () => {
    if (isPlayingVoicePreview && activeVoiceAudio) {
      try {
        activeVoiceAudio.pause();
        activeVoiceAudio.currentTime = 0;
      } catch {}
      setActiveVoiceAudio(null);
      setIsPlayingVoicePreview(false);
      return;
    }

    const voiceObj = character?.voice;
    const voiceId = voiceObj?.voiceId || "21m00Tcm4TlvDq8ikWAM";
    const savedPreviewUrl = voiceObj?.previewUrl;

    setIsPlayingVoicePreview(true);

    try {
      let audioSrc: string | null = null;
      if (savedPreviewUrl) {
        audioSrc = savedPreviewUrl;
      } else {
        const text = `Hello! I am ${character?.name || "Spark"}, lead AI host for ${brand?.name || "your brand"}. ${voiceObj?.tone || ""}`;
        audioSrc = await previewElevenLabsVoice(voiceId, text);
      }

      if (!audioSrc) {
        alert(`ElevenLabs voice preview unavailable for voice "${voiceObj?.name || "Rachel"}" (${voiceId}). Please check ElevenLabs API key or select another voice in Voice Studio.`);
        setIsPlayingVoicePreview(false);
        return;
      }

      const audio = new Audio(audioSrc);
      audio.onended = () => {
        setIsPlayingVoicePreview(false);
        setActiveVoiceAudio(null);
      };
      audio.onerror = () => {
        alert(`Error playing ElevenLabs voice sample for ${voiceObj?.name || "Rachel"}.`);
        setIsPlayingVoicePreview(false);
        setActiveVoiceAudio(null);
      };
      setActiveVoiceAudio(audio);
      await audio.play();
    } catch (err) {
      console.warn("[MySpark] Voice preview play error:", err);
      setIsPlayingVoicePreview(false);
      setActiveVoiceAudio(null);
    }
  };

  const getRuleMeta = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("nobody talks") || lower.includes("hook style")) {
      return {
        whyExists: "Derived from analyzing 34 top-performing TikTok tech clips where curiosity gaps drove the highest 3-second hook conversion.",
        affects: "Short-form hooks, script templates, and caption copy.",
        influences: "TikTok Reels and YouTube Shorts productions.",
        behavior: "Overrides standard educational hook templates to favor 'Curiosity-first direct challenge' scripts."
      };
    }
    if (lower.includes("peak engagement") || lower.includes("engagement window")) {
      return {
        whyExists: "Aggregated activity analytics show Nigerian creator segment peaks between 2:00 PM and 4:00 PM West Africa Time on weekdays.",
        affects: "Publishing queue, automated calendar, and buffer timings.",
        influences: "All active scheduled multi-channel distribution pipelines.",
        behavior: "Automatically prioritizes and schedules posts within Tuesday–Thursday 2–4 PM GMT+1."
      };
    }
    if (lower.includes("long-form youtube") || lower.includes("outperforms short-form")) {
      return {
        whyExists: "Viewer analysis indicates deep tutorials convert 2.4x more subscribers than short previews on educational channels.",
        affects: "Format suggestions, storyboarding depth, and content sequencing.",
        influences: "YouTube Masterclass Series and long tutorial runs.",
        behavior: "Configures default template generation to favor 12–15 minute detailed guides."
      };
    }
    if (lower.includes("call to action") || lower.includes("cta")) {
      return {
        whyExists: "Historical retention drops in final seconds; placing the CTA before the final 10 seconds increases subscriber conversion by 44%.",
        affects: "Ending scripts, outro screens, and caption guidelines.",
        influences: "All tutorial, narrative, and short-form video storyboards.",
        behavior: "Hardlocks a mandatory Call To Action segment at scene-end, blocking generation if omitted."
      };
    }
    if (lower.includes("thumbnail") || lower.includes("human face")) {
      return {
        whyExists: "Thumbnail CTR audits prove designs with prominent, high-emotion faces average 4.1% higher click-through-rates.",
        affects: "Thumbnail composition drafts, generative image prompt triggers.",
        influences: "YouTube, Instagram Reels, and tutorial preview assets.",
        behavior: "Adds descriptive emotion parameters (e.g., 'surprised, high-intensity expression') to all asset drafts."
      };
    }
    if (lower.includes("western") || lower.includes("nigerian context")) {
      return {
        whyExists: "Audience sentiment analysis indicates 84% higher connection and sharing when case studies reflect Nigerian economic reality.",
        affects: "Script illustrations, comparative pricing tables, and cultural references.",
        influences: "All active video productions, storyboards, and copy.",
        behavior: "Scans script outputs and dynamically replaces dollar pricing (e.g. $10) with local naira values (₦15K) and Nigerian contexts."
      };
    }
    return {
      whyExists: "Added to align Spark behavior with custom brand values and creator guidelines.",
      affects: "Storyboarding, tone of voice, and script generation filters.",
      influences: "All subsequent active productions.",
      behavior: "Guides AI synthesis constraints to strictly prioritize this rule."
    };
  };

  const automationConfig = {
    manual: { label: "Manual", desc: "All decisions require your approval", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    balanced: { label: "Balanced", desc: "AI handles routine decisions, you approve strategy", color: "text-accent-foreground", bg: "bg-accent/20", border: "border-accent/40" },
    autonomous: { label: "Autonomous", desc: "AI operates independently, you set direction", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  };

  const productionConfig = {
    express: { label: "Narrator", desc: "Images + voice + music/SFX + captions + motion", time: "2–4 hours" },
    standard: { label: "Hybrid", desc: "Animated hook + narrator pipeline", time: "6–12 hours" },
    deep: { label: "Cinematic", desc: "Storyboard + video generation + consistency + voice + audio", time: "24–48 hours" },
  };

  const aMode = automationConfig[automationMode as keyof typeof automationConfig] || automationConfig.balanced;
  const pMode = productionConfig[productionMode as keyof typeof productionConfig] || productionConfig.standard;

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    addMemoryItem(newRuleText.trim(), "rule");
    setNewRuleText("");
    setShowAddRule(false);
  };

  const handleAddSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrlInput.trim() || isSubmittingSource) return;
    setIsSubmittingSource(true);
    try {
      if (addResearchSource) {
        await addResearchSource(sourceUrlInput.trim());
      }
      setSourceUrlInput("");
      setShowAddSource(false);
    } catch (err) {
      console.warn("[MySpark] Add research source error:", err);
    } finally {
      setIsSubmittingSource(false);
    }
  };

  const handleSyncSource = async (sourceId: string) => {
    if (!syncResearchSource || syncingSourceId) return;
    setSyncingSourceId(sourceId);
    try {
      await syncResearchSource(sourceId);
    } catch (err) {
      console.warn("[MySpark] Sync source error:", err);
    } finally {
      setSyncingSourceId(null);
    }
  };


  return (
    <>
      <TopBar pageName="My Spark" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-8">

          <div>
            <h1 className="text-3xl font-medium">My Spark</h1>
            <p className="text-muted-foreground mt-1">Your brand's intelligence profile — the brain behind every production</p>
          </div>

          {/* Brand Identity */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Brand Identity</h2>
            <div className="rounded-xl border border-border bg-card p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-medium">{brand?.name || "My Brand"}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">Active</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="px-2 py-0.5 rounded bg-muted font-medium text-foreground">{brand?.niche || "AI & Automation"}</span>
                    <span>•</span>
                    <span>Archetype: <strong className="text-foreground">{brand?.archetype || "Visionary Creator"}</strong></span>
                    <span>•</span>
                    <span>{brand?.country || "United States"}</span>
                    <span>•</span>
                    <span>{brand?.language || "English (US)"}</span>
                    {brand?.website && (
                      <>
                        <span>•</span>
                        <a href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`} target="_blank" rel="noreferrer" className="text-accent hover:underline flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {brand.website.replace(/^https?:\/\//, "")}
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openEditIdentity}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 text-sm font-medium transition-colors cursor-pointer shrink-0"
                >
                  Edit Identity
                </button>
              </div>

              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-mono">Brand Purpose</p>
                <p className="text-sm leading-relaxed text-foreground">{brand?.purpose || "Creating impactful, high-converting digital productions with compounding distribution."}</p>
              </div>

              {showEditIdentity && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <h3 className="text-lg font-medium text-foreground">Edit Brand Identity</h3>
                      <button
                        type="button"
                        onClick={() => setShowEditIdentity(false)}
                        className="text-muted-foreground hover:text-foreground text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleEditIdentitySubmit} className="space-y-4">
                      <div>
                        <label className="text-xs text-muted-foreground uppercase font-mono">Brand Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full mt-1 bg-background text-foreground text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                          placeholder="e.g. Acme Media"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <SearchableSelect
                          label="Industry Niche"
                          value={editNiche}
                          onChange={setEditNiche}
                          options={BRAND_NICHES}
                          allowCustom={true}
                          placeholder="Select niche..."
                        />
                        <SearchableSelect
                          label="Archetype"
                          value={editArchetype}
                          onChange={setEditArchetype}
                          options={BRAND_ARCHETYPES}
                          allowCustom={true}
                          placeholder="Select archetype..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <SearchableSelect
                          label="Country Focus"
                          value={editCountry}
                          onChange={setEditCountry}
                          options={BRAND_COUNTRIES}
                          placeholder="Select country..."
                        />
                        <SearchableSelect
                          label="Primary Language"
                          value={editLanguage}
                          onChange={setEditLanguage}
                          options={BRAND_LANGUAGES}
                          placeholder="Select language..."
                        />
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground uppercase font-mono">Website / URL</label>
                        <input
                          type="text"
                          value={editWebsite}
                          onChange={(e) => setEditWebsite(e.target.value)}
                          placeholder="https://yourbrand.com"
                          className="w-full mt-1 bg-background text-foreground text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground uppercase font-mono">Brand Purpose</label>
                        <textarea
                          rows={2}
                          value={editPurpose}
                          onChange={(e) => setEditPurpose(e.target.value)}
                          placeholder="What high-level impact and transformation does your brand produce?"
                          className="w-full mt-1 bg-background text-foreground text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                          required
                        />
                      </div>

                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Audience Profile</p>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Primary Target Audience</label>
                            <input
                              type="text"
                              value={editAudiencePrimary}
                              onChange={(e) => setEditAudiencePrimary(e.target.value)}
                              placeholder="e.g. Growth Founders & Technical Operators"
                              className="w-full mt-1 bg-background text-foreground text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Pain Points (Comma-separated)</label>
                              <textarea
                                rows={2}
                                value={editPainPoints}
                                onChange={(e) => setEditPainPoints(e.target.value)}
                                placeholder="Low retention, fragmented research"
                                className="w-full mt-1 bg-background text-foreground text-xs border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Desires (Comma-separated)</label>
                              <textarea
                                rows={2}
                                value={editDesires}
                                onChange={(e) => setEditDesires(e.target.value)}
                                placeholder="High viral reach, category authority"
                                className="w-full mt-1 bg-background text-foreground text-xs border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-border">
                        <button
                          type="button"
                          onClick={() => setShowEditIdentity(false)}
                          className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/95 cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Content Pillars */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Content Pillars</h2>
              <span className="text-xs text-muted-foreground font-mono">
                {((Array.isArray(brand?.contentPillars) ? brand.contentPillars : []).filter((p: any) => p.active !== false).length)} active (3–5 recommended)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Pillars are the 3–5 repeatable themes your channel owns (not vague one-word categories).
            </p>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Active Production Pillars</p>
                <button
                  type="button"
                  onClick={() => setShowAddPillar(!showAddPillar)}
                  className="text-xs text-accent font-medium hover:underline transition-colors cursor-pointer"
                >
                  {showAddPillar ? "Cancel" : "+ Add pillar"}
                </button>
              </div>

              {showAddPillar && (
                <form onSubmit={handleAddPillarSubmit} className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newPillarText}
                    onChange={(e) => setNewPillarText(e.target.value)}
                    placeholder="e.g. AI Workflow Breakdowns..."
                    className="flex-1 bg-background text-foreground text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                    required
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/95 cursor-pointer"
                  >
                    Add Pillar
                  </button>
                </form>
              )}

              <div className="flex flex-wrap gap-2">
                {(Array.isArray(brand?.contentPillars) ? brand.contentPillars : [
                  { label: "AI & Automation", active: true },
                  { label: "Digital Strategy", active: true },
                  { label: "Content Creation", active: true },
                ]).map((pillar: any) => (
                  <button
                    key={pillar.label}
                    type="button"
                    onClick={() => toggleContentPillar && toggleContentPillar(pillar.label)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      pillar.active
                        ? "bg-accent text-accent-foreground border border-accent/60 shadow-sm"
                        : "bg-background border border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    <span>{pillar.label}</span>
                    {pillar.active && <Check className="w-3 h-3" />}
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
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Primary Character</p>
                    <button
                      type="button"
                      onClick={() => setShowCharacterStudio(true)}
                      className="px-2.5 py-1 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-foreground text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Character
                    </button>
                  </div>
                  <div className="flex gap-4 items-start">
                    {character?.imageUrl || character?.avatarUrl || character?.characterSheetUrl ? (
                      <button
                        type="button"
                        onClick={() => setShowCharacterStudio(true)}
                        className="relative group shrink-0 focus:outline-none cursor-pointer"
                        title="Click to edit / generate character sheet"
                      >
                        <img
                          src={character.imageUrl || character.avatarUrl || character.characterSheetUrl || ""}
                          alt={character?.name || "Host"}
                          className="w-16 h-16 rounded-xl object-cover border border-accent/40 group-hover:border-accent transition-colors shadow-md"
                        />
                        <span className="absolute -bottom-1 -right-1 bg-accent/90 text-foreground text-[9px] px-1 rounded font-mono">
                          Edit
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCharacterStudio(true)}
                        className="w-16 h-16 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-lg text-accent-foreground shrink-0 shadow-md cursor-pointer"
                        title="Click to edit / generate character sheet"
                      >
                        {character?.name?.[0] || "S"}
                      </button>
                    )}
                    <div className="space-y-2 flex-1">
                      <div>
                        <p className="text-lg font-medium">{character?.name || "Spark Host"}</p>
                        <p className="text-sm text-muted-foreground">{character?.role || "Lead Presenter"}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{character?.style || "Executive Digital Host"}</p>
                      <div className="flex flex-wrap gap-2">
                        {(character?.traits || ["Sharp", "Confident", "Engaging"]).map((trait: any) => (
                          <span key={trait} className="px-2.5 py-1 rounded-lg bg-accent/20 text-xs font-medium">
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Voice Identity</p>
                    <button
                      type="button"
                      onClick={() => setShowVoiceStudio(true)}
                      className="px-2.5 py-1 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-foreground text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Voice
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-accent/20 border border-accent/40">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium font-mono">{character?.voice?.name || "Super Spark (Natural Female)"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{character?.voice?.language || "English (UK/NG)"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {character?.voice?.locked && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-success/20 text-success text-xs font-medium">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{character?.voice?.tone || "Warm, conversational, and direct"}</p>
                    <button
                      onClick={handlePreviewVoice}
                      className="w-full py-2 rounded-lg bg-background/50 hover:bg-background text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-border/50 cursor-pointer"
                    >
                      <Play className={`w-3.5 h-3.5 ${isPlayingVoicePreview ? "animate-pulse text-accent-foreground" : ""}`} />
                      {isPlayingVoicePreview ? "Playing Voice..." : "Preview Voice"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Supporting Cast (Story & Anime Only - Max 2) */}
          {(() => {
            const effectiveFmt = getEffectiveFormatSettings({ formatSettings, brand });
            const contentFormat = getEffectiveContentFormat({ brand, formatSettings: effectiveFmt });
            const isStoryOrAnime = contentFormat === "story" || contentFormat === "anime";
            if (!isStoryOrAnime) return null;

            const supportCharacters = (characters || []).filter((c: any) => c.role === "support");

            return (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Supporting Cast</h2>
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                      Story & Anime (Max 2)
                    </span>
                  </div>
                  {supportCharacters.length < 2 && (
                    <button
                      type="button"
                      onClick={() => setShowSupportCharacterModal(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Supporting Character
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supportCharacters.map((sc: any) => (
                    <div key={sc.id} className="p-4 rounded-xl border border-border/80 bg-card/60 flex items-start gap-3 relative group">
                      {sc.characterSheetUrl || sc.imageUrl || sc.avatarUrl ? (
                        <img
                          src={sc.characterSheetUrl || sc.imageUrl || sc.avatarUrl}
                          alt={sc.name}
                          className="w-14 h-14 rounded-lg object-cover border border-border/60 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-300 shrink-0">
                          {sc.name?.[0] || "S"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{sc.name}</p>
                          <span className="text-[9px] font-mono bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded">
                            Support
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{sc.style || "Supporting Role"}</p>
                        <div className="flex flex-wrap gap-1">
                          {(sc.traits || []).slice(0, 2).map((t: string) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSupportCharacter && deleteSupportCharacter(sc.id)}
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Remove supporting character"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {supportCharacters.length === 0 && (
                    <div className="col-span-full p-6 rounded-xl border border-dashed border-border/70 text-center bg-card/20">
                      <p className="text-xs text-muted-foreground mb-2">No supporting characters added yet.</p>
                      <button
                        type="button"
                        onClick={() => setShowSupportCharacterModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-semibold inline-flex items-center gap-1.5 border border-indigo-500/30 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Supporting Character (Turnaround Sheet)
                      </button>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Locked Set & Location Plate (Optional) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Locked Set & Location Plate</h2>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                  Optional
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationPlateStudio(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" /> {brand?.locationPlateUrl ? "Edit Set Plate" : "Add Set Plate"}
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => setShowLocationPlateStudio(true)}
                    className="w-24 h-16 rounded-xl bg-background border border-border/80 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:border-purple-500/50 transition-all group relative"
                  >
                    {brand?.locationPlateUrl ? (
                      <img
                        src={brand.locationPlateUrl}
                        alt="Locked Set Plate"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <Sparkles className="w-4 h-4 text-muted-foreground/50 mx-auto mb-1" />
                        <span className="text-[9px] text-muted-foreground">No Plate</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {brand?.locationPlateUrl ? "Locked Architectural Environment" : "Dynamic Text Environment"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      {brand?.locationPlateUrl
                        ? "Movies, stories, and anime productions reuse this empty establishing plate for background set continuity."
                        : "No locked plate set. Productions generate ambient backdrops from text prompts."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationPlateStudio(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer self-stretch sm:self-auto justify-center"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{brand?.locationPlateUrl ? "Open Set Studio" : "Generate / Upload Set Plate"}</span>
                </button>
              </div>
            </div>
          </section>

          {/* Audience */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audience Profile</h2>
              <button
                type="button"
                onClick={openEditIdentity}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" /> Edit Profile
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card p-8 space-y-6">
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground mb-1 font-mono uppercase">Primary Audience</p>
                <p className="text-base font-medium">{brand?.audience?.primary || "Modern digital creators, founders & operators"}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-mono">Core Pain Points</p>
                  <div className="space-y-2">
                    {(Array.isArray(brand?.audience?.painPoints) && brand.audience.painPoints.length > 0
                      ? brand.audience.painPoints
                      : ["Time constraints in content creation", "Inconsistent engagement and low retention"]
                    ).map((point: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                        <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-foreground">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-mono">Core Desires</p>
                  <div className="space-y-2">
                    {(Array.isArray(brand?.audience?.desires) && brand.audience.desires.length > 0
                      ? brand.audience.desires
                      : ["High retention and compounding viral reach", "Scalable, automated media operations"]
                    ).map((desire: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/10">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-foreground">{desire}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tone & Style Matrix */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tone & Style</h2>
              <span className="text-xs text-muted-foreground font-mono">
                {((Array.isArray(brand?.tone) ? brand.tone : []).filter((t: any) => t.active !== false).length)} tones active (2–4 recommended)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Select 2–4 tones to avoid contradiction. Active tones and delivery styles shape every script and hook.
            </p>
            
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              {/* Tone of Voice */}
              <div>
                <p className="text-xs font-mono uppercase text-muted-foreground mb-3">Tone of Voice</p>
                <div className="flex flex-wrap gap-2">
                  {BRAND_TONE_OPTIONS.map((opt) => {
                    const currentTones = Array.isArray(brand?.tone) ? brand.tone : [];
                    const match = currentTones.find((t: any) => t.label?.toLowerCase() === opt.toLowerCase());
                    const isActive = match ? match.active : false;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleTone && toggleTone(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? "bg-foreground text-background border border-foreground shadow-sm"
                            : "bg-background border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        <span>{opt}</span>
                        {isActive && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delivery & Narrative Style */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs font-mono uppercase text-muted-foreground mb-3">Delivery & Narrative Style</p>
                <div className="flex flex-wrap gap-2">
                  {BRAND_STYLE_OPTIONS.map((opt) => {
                    const currentStyles = Array.isArray(brand?.style) ? brand.style : [];
                    const match = currentStyles.find((s: any) => s.label?.toLowerCase() === opt.toLowerCase());
                    const isActive = match ? match.active : false;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleStyle && toggleStyle(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? "bg-accent text-accent-foreground border border-accent shadow-sm"
                            : "bg-background border border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                        }`}
                      >
                        <span>{opt}</span>
                        {isActive && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Connected Accounts */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Connected Accounts</h2>
            {(() => {
              const connected = accounts ? accounts.filter((a: any) => a.status?.toLowerCase() === "connected" || a.status?.toLowerCase() === "needs_reconnect") : [];
              if (connected.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
                    <p className="text-sm font-medium">Connect your first social platform.</p>
                    <button
                      onClick={() => onNavigate("/more/accounts")}
                      className="mt-2.5 text-xs text-accent-foreground font-semibold hover:underline"
                    >
                      Go to Accounts Settings
                    </button>
                  </div>
                );
              }

              return (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {connected.map((account: any, i: number) => {
                    const isConn = account.status?.toLowerCase() === "connected";
                    return (
                      <div
                        key={account.platform}
                        className={`flex items-center justify-between px-6 py-4 ${i < connected.length - 1 ? "border-b border-border/50" : ""} hover:bg-accent/5 transition-colors`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isConn ? "bg-success" : "bg-amber-500"}`} />
                          <div>
                            <p className="text-sm font-medium">{account.platform}</p>
                            <p className="text-xs text-muted-foreground font-mono">{normalizeHandle(account.handle)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {isConn ? (
                            <span className="text-xs text-success font-semibold">Connected</span>
                          ) : (
                            <button
                              onClick={() => {
                                const url = getOAuthAuthorizationUrl(account.platform);
                                if (url && url !== "#") window.location.href = url;
                              }}
                              className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 font-semibold hover:bg-amber-500/30 transition-colors"
                            >
                              Reconnect
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>

          {/* Production Mode */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Production Mode</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground mb-4">Controls the depth and time of each production run</p>
              <div className="grid grid-cols-3 gap-3">
                {(["express", "standard", "deep"] as const).map((mode) => {
                  const cfg = productionConfig[mode];
                  const isActive = productionMode === mode || (mode === "express" && productionMode === "narrator") || (mode === "standard" && productionMode === "hybrid") || (mode === "deep" && productionMode === "cinematic");
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

          {/* Production Format Settings */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Production settings</h2>
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              {/* Aspect Strategy */}
              <div>
                <p className="text-sm font-medium mb-1">Aspect Ratio Strategy</p>
                <p className="text-sm text-muted-foreground mb-4">Controls video frame dimensions for target platforms</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      id: "landscape" as const,
                      label: "Landscape",
                      badge: "YouTube long",
                      desc: "16:9 widescreen format",
                      icon: (
                        <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      )
                    },
                    {
                      id: "portrait" as const,
                      label: "Portrait",
                      badge: "Shorts / TikTok",
                      desc: "9:16 vertical short-form",
                      icon: (
                        <svg className="w-5 h-5 text-purple-400 fill-current" viewBox="0 0 24 24">
                          <path d="M17.77 10.32c-.77-.32-1.2-.5-1.2-.5s.43-.2.77-.32a3.86 3.86 0 0 0 2.16-3.48A3.88 3.88 0 0 0 15.62 2h-.12a3.86 3.86 0 0 0-3.38 2.02L11 6.27 9.88 4.02A3.86 3.86 0 0 0 6.5 2H6.38A3.88 3.88 0 0 0 2.5 5.88a3.86 3.86 0 0 0 2.16 3.48c.34.12.77.32.77.32s-.43.2-.77.32a3.86 3.86 0 0 0-2.16 3.48A3.88 3.88 0 0 0 6.38 19.5h.12a3.86 3.86 0 0 0 3.38-2.02L11 15.23l1.12 2.25A3.86 3.86 0 0 0 15.5 19.5h.12a3.88 3.88 0 0 0 3.88-3.88 3.86 3.86 0 0 0-2.16-3.48z"/>
                        </svg>
                      )
                    },
                    {
                      id: "dynamic" as const,
                      label: "Dynamic",
                      badge: "Best for content",
                      desc: "Auto 16:9 or 9:16 recommendation",
                      icon: <Sparkles className="w-5 h-5 text-amber-400" />
                    }
                  ].map((opt) => {
                    const active = (formatSettings?.aspectMode || "portrait") === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => updateFormatSettings && updateFormatSettings({ aspectMode: opt.id })}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                          active ? "bg-purple-600/20 border-purple-500/50 shadow-lg shadow-purple-500/10" : "bg-background border-border hover:border-accent/30"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            {opt.icon}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${active ? "bg-purple-500/30 text-purple-200" : "bg-muted text-muted-foreground"}`}>
                              {opt.badge}
                            </span>
                          </div>
                          <p className={`text-sm font-semibold mb-1 ${active ? "text-foreground" : "text-muted-foreground"}`}>{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Unified Control Block: Video Length & Clip Engine */}
              <div className="pt-6 border-t border-border space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-foreground">Video Length & Clip Engine</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Single control system for total episode runtime and clip generation physics.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20 self-start sm:self-auto">
                    Unified Scene Physics
                  </span>
                </div>

                {/* Sub-row 1: Target Video Length */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Target Runtime
                    </p>
                    <span className="text-xs font-medium text-foreground">
                      {(formatSettings?.targetDurationSec || 60) >= 60
                        ? `${Math.round((formatSettings?.targetDurationSec || 60) / 60)}m Episode`
                        : `${formatSettings?.targetDurationSec || 60}s Short`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_LENGTH_OPTIONS.map((dur) => {
                      const active = (formatSettings?.targetDurationSec || 60) === dur.sec;
                      return (
                        <button
                          key={dur.sec}
                          onClick={() => updateFormatSettings && updateFormatSettings({ targetDurationSec: dur.sec })}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            active
                              ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30 ring-1 ring-purple-400/50"
                              : "bg-background border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                          }`}
                        >
                          {dur.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-row 2: Clip Engine & Video Models */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Clip Engine & Native Durations
                    </p>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Provider Clip Physics
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(() => {
                      const activeVideo = resolveActiveVideoProvider({
                        preferredVideoProvider: formatSettings?.preferredVideoProvider,
                      });
                      const isAuto = !formatSettings?.preferredVideoProvider || formatSettings.preferredVideoProvider === "auto";

                      const videoModels: Array<{ id: string; name: string; lengths: string; maxSec: number; tag: string }> = [
                        {
                          id: "gemini",
                          name: PROVIDER_VIDEO_CAPABILITIES.gemini.displayName,
                          lengths: "4s / 6s / 8s",
                          maxSec: PROVIDER_VIDEO_CAPABILITIES.gemini.maxNativeSec,
                          tag: "Native Audio + Refs",
                        },
                        {
                          id: "grok",
                          name: PROVIDER_VIDEO_CAPABILITIES.grok.displayName,
                          lengths: "1–15s",
                          maxSec: PROVIDER_VIDEO_CAPABILITIES.grok.maxNativeSec,
                          tag: "High Motion Speed",
                        },
                        {
                          id: "kling",
                          name: PROVIDER_VIDEO_CAPABILITIES.kling.displayName,
                          lengths: "5s / 10s",
                          maxSec: PROVIDER_VIDEO_CAPABILITIES.kling.maxNativeSec,
                          tag: "Portrait Coherence",
                        },
                        {
                          id: "runway",
                          name: PROVIDER_VIDEO_CAPABILITIES.runway.displayName,
                          lengths: "5s / 10s",
                          maxSec: PROVIDER_VIDEO_CAPABILITIES.runway.maxNativeSec,
                          tag: "Cinematic Motion",
                        },
                        {
                          id: "luma",
                          name: PROVIDER_VIDEO_CAPABILITIES.luma.displayName,
                          lengths: "5s / 9s",
                          maxSec: PROVIDER_VIDEO_CAPABILITIES.luma.maxNativeSec,
                          tag: "Keyframe Ray 2",
                        },
                        {
                          id: "higgsfield",
                          name: PROVIDER_VIDEO_CAPABILITIES.higgsfield.displayName,
                          lengths: "4s / 8s",
                          maxSec: PROVIDER_VIDEO_CAPABILITIES.higgsfield.maxNativeSec,
                          tag: "Vertical Pop",
                        },
                      ];

                      return (
                        <>
                          <button
                            onClick={() => updateFormatSettings && updateFormatSettings({ preferredVideoProvider: "auto" })}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isAuto
                                ? "bg-purple-600/20 border-purple-500/60 shadow-md shadow-purple-600/20 ring-1 ring-purple-500/40"
                                : "bg-background border-border hover:border-accent/40"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2.5">
                                {getProviderLogo("auto", 22)}
                                <span className="text-xs font-semibold text-foreground">Auto / Best Available</span>
                              </div>
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                Active: {activeVideo.profile.displayName.split(" ")[0]}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Automatically routes to highest-quality available video model with valid API key.
                            </p>
                          </button>

                          {videoModels.map((m) => {
                            const isSelected = formatSettings?.preferredVideoProvider === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => updateFormatSettings && updateFormatSettings({ preferredVideoProvider: m.id as any })}
                                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? "bg-purple-600/20 border-purple-500/60 shadow-md shadow-purple-600/20 ring-1 ring-purple-500/40"
                                    : "bg-background border-border hover:border-accent/40"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2.5">
                                    {getProviderLogo(m.id, 22)}
                                    <span className="text-xs font-semibold text-foreground">{m.name}</span>
                                  </div>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    Max: {m.maxSec}s
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-border/40">
                                  <span className="font-mono text-purple-300">Native: {m.lengths}</span>
                                  <span className="text-muted-foreground text-[10px]">{m.tag}</span>
                                </div>
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Sub-row 3: Real-Time Scene Segmentation & Physics Box */}
                {(() => {
                  const planMetrics = deriveVideoProductionPlanMetrics({
                    targetDurationSec: formatSettings?.targetDurationSec,
                    preferredVideoProvider: formatSettings?.preferredVideoProvider,
                  });

                  return (
                    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <p className="text-xs font-semibold text-foreground">
                            {planMetrics.isMultiScene
                              ? `Estimated Scene Segmentation: ~${planMetrics.estimatedSceneCount} Scenes`
                              : `Estimated Scene Segmentation: 1 Scene (Single Take)`}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full font-medium">
                          {planMetrics.displayName} (Max {planMetrics.maxNativeClipSec}s/clip)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        🎯 {planMetrics.summaryText}
                      </p>
                      <p className="text-[11px] text-white/40 italic">
                        {planMetrics.helperText}
                      </p>
                    </div>
                  );
                })()}
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

              {/* Search & Filter bar for Rules */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={ruleSearchQuery}
                    onChange={(e) => setRuleSearchQuery(e.target.value)}
                    placeholder="Search rules, learned patterns, or categories..."
                    className="w-full pl-8 pr-3 py-1.5 bg-background text-foreground text-xs border border-border rounded-lg focus:outline-none focus:border-accent/50"
                  />
                </div>
                <button
                  onClick={() => setShowArchivedRules(!showArchivedRules)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    showArchivedRules ? "bg-accent/20 border-accent/40 text-accent-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {showArchivedRules ? "Showing Archived" : "View Archived"}
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
                {(() => {
                  const filtered = (memoryItems || []).filter((item: any) => {
                    const isArchived = Boolean(item.archived);
                    if (showArchivedRules ? !isArchived : isArchived) return false;
                    if (!ruleSearchQuery.trim()) return true;
                    const q = ruleSearchQuery.toLowerCase();
                    return (
                      item.text?.toLowerCase().includes(q) ||
                      item.category?.toLowerCase().includes(q) ||
                      item.type?.toLowerCase().includes(q)
                    );
                  });

                  // Sort pinned rules to the top
                  const sorted = [...filtered].sort((a, b) => {
                    const aPinned = a.pinned ? 1 : 0;
                    const bPinned = b.pinned ? 1 : 0;
                    return bPinned - aPinned;
                  });

                  if (sorted.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border/50 rounded-lg">
                        {ruleSearchQuery ? "No matching rules found." : showArchivedRules ? "No archived rules." : "No active rules."}
                      </p>
                    );
                  }

                  return sorted.map((item: any, i: number) => {
                    const isExpanded = expandedRuleIndex === i;
                    const isPinned = Boolean(item.pinned);
                    const isEditing = editingRuleId === item.id;
                    const meta = getRuleMeta(item.text);

                    return (
                      <div
                        key={item.id || i}
                        onClick={() => !isEditing && setExpandedRuleIndex(isExpanded ? null : i)}
                        className={`flex flex-col gap-3 p-4 rounded-lg border transition-all ${
                          isEditing
                            ? "bg-background border-accent/50"
                            : isPinned
                            ? "bg-accent/15 border-accent/40 shadow-sm"
                            : item.type === "learned"
                            ? "bg-accent/10 hover:bg-accent/15 border-accent/20 cursor-pointer"
                            : "bg-background hover:bg-accent/5 border-border cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          {item.type === "learned" ? (
                            <Sparkles className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                          ) : (
                            <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {item.category && (
                                <div className="inline-block px-1.5 py-0.5 mb-1 rounded text-[10px] font-mono uppercase tracking-wider bg-accent/20 text-accent-foreground font-semibold">
                                  {item.category}
                                </div>
                              )}
                              {isPinned && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground font-bold">
                                  <Pin className="w-2.5 h-2.5 fill-current" /> Pinned
                                </span>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="mt-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editingRuleText}
                                  onChange={(e) => setEditingRuleText(e.target.value)}
                                  className="flex-1 bg-background text-foreground text-xs border border-border rounded px-2.5 py-1.5 focus:outline-none focus:border-accent"
                                />
                                <button
                                  onClick={() => handleSaveRuleEdit(item.id)}
                                  className="px-3 py-1.5 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/95"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingRuleId(null)}
                                  className="px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <p className="text-sm text-foreground font-medium leading-relaxed whitespace-pre-line">{item.text}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded ${
                              item.type === "learned" ? "bg-accent/20 text-accent-foreground" : "bg-muted/40 text-muted-foreground"
                            }`}>
                              {item.type === "learned" ? "Learned" : "Rule"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinRule(item.id, isPinned);
                              }}
                              className={`p-1 rounded hover:bg-accent/20 transition-colors ${
                                isPinned ? "text-accent-foreground font-bold" : "text-muted-foreground"
                              }`}
                              title={isPinned ? "Unpin rule" : "Pin rule to top"}
                            >
                              <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingRuleId(item.id);
                                setEditingRuleText(item.text);
                              }}
                              className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit rule"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleArchiveRule(item.id, Boolean(item.archived));
                              }}
                              className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                              title={item.archived ? "Unarchive rule" : "Archive rule"}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (removeMemoryItem && item.id) {
                                  removeMemoryItem(item.id);
                                }
                              }}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete memory rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded progressive disclosure explaining the rule */}
                        {isExpanded && !isEditing && (
                          <div className="mt-2 border-t border-border/50 pt-3 space-y-2 text-xs text-muted-foreground">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="font-semibold text-[10px] uppercase tracking-wide text-foreground">Why It Exists</p>
                                <p className="mt-1 leading-relaxed">{meta.whyExists}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-[10px] uppercase tracking-wide text-foreground">What It Affects</p>
                                <p className="mt-1 leading-relaxed">{meta.affects}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div>
                                <p className="font-semibold text-[10px] uppercase tracking-wide text-foreground">Influenced Productions</p>
                                <p className="mt-1 leading-relaxed">{meta.influences}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-[10px] uppercase tracking-wide text-foreground">Changes Spark Behavior</p>
                                <p className="mt-1 leading-relaxed">{meta.behavior}</p>
                              </div>
                            </div>
                            <p className="text-[10px] text-accent-foreground pt-1.5 border-t border-border/20 text-right">
                              Click to collapse
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </section>

          {/* Research Sources / Inspiration Accounts */}
          <section className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Research Sources (Inspiration Accounts)</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-accent-foreground" />
                  <p className="text-sm font-medium">Curated creator accounts analyzed for pattern extraction and spark synthesis</p>
                </div>
                <button
                  onClick={() => setShowAddSource(!showAddSource)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {showAddSource ? "Cancel" : "+ Add Source"}
                </button>
              </div>

              {showAddSource && (
                <form onSubmit={handleAddSourceSubmit} className="mb-6 flex gap-2">
                  <input
                    type="url"
                    value={sourceUrlInput}
                    onChange={(e) => setSourceUrlInput(e.target.value)}
                    placeholder="Paste YouTube, TikTok, Instagram, X, Facebook, or LinkedIn URL..."
                    className="flex-1 bg-background text-foreground text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingSource}
                    className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/95 disabled:opacity-50"
                  >
                    {isSubmittingSource ? "Analyzing..." : "Add Source"}
                  </button>
                </form>
              )}

              {researchSources.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border/60 rounded-lg">
                  <p className="text-xs text-muted-foreground">No inspiration accounts added yet.</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Paste a public creator channel URL above to start automatic pattern research.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {researchSources.map((source: any) => {
                    const isExpanded = expandedSourceId === source.id;
                    const recentVids: any[] = source.recentVideos || [];
                    const topItems: any[] = source.topContent || [];
                    const breakdown = source.patternBreakdown;
                    const learnings: string[] = source.learnings || [];
                    const confidenceText = source.researchConfidence
                      ? `${Math.round(source.researchConfidence * 100)}% Confidence`
                      : "Not enough data";

                    const isSyncing = source.status === "syncing" || syncingSourceId === source.id;
                    const isHealthy = source.status === "active";
                    const isNeedsAttention = source.status === "error" || source.status === "unavailable";

                    const statusLabel = isSyncing ? "Syncing" : isHealthy ? "Healthy" : "Needs attention";
                    const statusBadgeStyle = isSyncing
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : isHealthy
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20";

                    return (
                      <div
                        key={source.id}
                        className="p-5 rounded-xl border border-border bg-background hover:border-accent/30 transition-all flex flex-col justify-between gap-4"
                      >
                        {/* Profile Header */}
                        <div className="flex flex-col gap-3">
                          {source.banner && (
                            <div className="w-full h-20 rounded-lg overflow-hidden border border-border bg-muted/20">
                              <img src={source.banner} alt="Channel Banner" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <img
                                src={source.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(source.username || source.id)}`}
                                alt={source.displayName}
                                className="w-12 h-12 rounded-full bg-accent/10 border border-border object-cover shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-semibold text-foreground">{source.displayName}</h4>
                                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-accent/10 text-accent-foreground border border-accent/20 font-semibold">
                                    {source.platform}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{source.username}</p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/80 mt-1 font-mono">
                                  <span>
                                    {source.metricsAvailability === "available" && source.followers !== null && source.followers !== undefined
                                      ? `${typeof source.followers === "number" ? source.followers.toLocaleString() : source.followers} Subscribers`
                                      : "Unavailable from Platform"}
                                  </span>
                                  {source.videoCount !== null && source.videoCount !== undefined && (
                                    <span>• {source.videoCount.toLocaleString()} Videos</span>
                                  )}
                                  {source.totalViews !== null && source.totalViews !== undefined && (
                                    <span>• {source.totalViews.toLocaleString()} Views</span>
                                  )}
                                  {source.country && (
                                    <span>• {source.country}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border ${statusBadgeStyle}`}>
                                {isSyncing ? (
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                ) : isHealthy ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                ) : (
                                  <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                                )}
                                {statusLabel}
                              </span>
                            </div>
                          </div>

                          {/* Honest Needs Attention Warning Banner */}
                          {isNeedsAttention && (
                            <div className="mt-1 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                              <div>
                                <p className="font-semibold text-rose-200">Needs Attention</p>
                                <p className="text-[11px] text-rose-300/90 mt-0.5">{source.description || "Source data currently unavailable. Verify handle or check API settings."}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Synced {source.lastSyncedAt ? new Date(source.lastSyncedAt).toLocaleDateString() : "Just now"}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/40 text-muted-foreground">
                              {confidenceText}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedSourceId(isExpanded ? null : source.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-foreground text-xs font-medium transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  Hide Research <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  View Research <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleSyncSource(source.id)}
                              disabled={syncingSourceId === source.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-foreground text-xs font-medium transition-colors"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingSourceId === source.id ? "animate-spin" : ""}`} />
                              Sync Now
                            </button>
                            <button
                              onClick={() => removeResearchSource && removeResearchSource(source.id)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Remove source"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Research Intelligence Drawer */}
                        {isExpanded && (
                          <div className="mt-2 pt-4 border-t border-border/60 space-y-5 text-xs">

                            {/* Phase 19: Deep AI Video Understanding Drawer View for Video & Profile Assets */}
                            {source.videoResearch && (
                              <div className="p-4 rounded-xl bg-card border border-accent/30 space-y-4">
                                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-accent-foreground" />
                                    <h5 className="font-semibold text-xs text-foreground uppercase tracking-wide">
                                      AI Video Understanding & Hook Analysis
                                    </h5>
                                  </div>
                                  <span className="px-2.5 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-mono font-bold text-xs">
                                    {source.videoResearch.sparkScore} Spark Score
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                  <div className="p-3 rounded-lg bg-background border border-border/60 space-y-1">
                                    <p className="font-semibold text-[10px] text-accent-foreground uppercase tracking-wide">Hook & Opening (0-3s)</p>
                                    <p className="text-muted-foreground leading-relaxed">{source.videoResearch.hookAnalysis}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-background border border-border/60 space-y-1">
                                    <p className="font-semibold text-[10px] text-accent-foreground uppercase tracking-wide">Storytelling & Narrative</p>
                                    <p className="text-muted-foreground leading-relaxed">{source.videoResearch.storytelling}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-background border border-border/60 space-y-1">
                                    <p className="font-semibold text-[10px] text-accent-foreground uppercase tracking-wide">Retention & Pacing</p>
                                    <p className="text-muted-foreground leading-relaxed">{source.videoResearch.retentionAnalysis}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-background border border-border/60 space-y-1">
                                    <p className="font-semibold text-[10px] text-accent-foreground uppercase tracking-wide">Editing & Visual Style</p>
                                    <p className="text-muted-foreground leading-relaxed">{source.videoResearch.editingStyle}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-background border border-border/60 space-y-1">
                                    <p className="font-semibold text-[10px] text-accent-foreground uppercase tracking-wide">Emotional Trigger</p>
                                    <p className="text-muted-foreground leading-relaxed">{source.videoResearch.emotionalPattern}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-background border border-border/60 space-y-1">
                                    <p className="font-semibold text-[10px] text-accent-foreground uppercase tracking-wide">Call To Action (CTA)</p>
                                    <p className="text-muted-foreground leading-relaxed">{source.videoResearch.CTAAnalysis}</p>
                                  </div>
                                </div>

                                {source.videoResearch.viralReasons && source.videoResearch.viralReasons.length > 0 && (
                                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                                    <p className="font-semibold text-[10px] text-emerald-400 uppercase tracking-wide">Why This Video Performs</p>
                                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground text-[11px]">
                                      {source.videoResearch.viralReasons.map((reason: string, rIdx: number) => (
                                        <li key={rIdx}>{reason}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 1. Recent Videos Section */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-semibold text-xs text-foreground uppercase tracking-wide flex items-center gap-1.5">
                                  <Film className="w-3.5 h-3.5 text-accent-foreground" />
                                  Recent Videos ({recentVids.length})
                                </h5>
                                <span className="text-[10px] text-muted-foreground font-mono">Public Channel Feed</span>
                              </div>

                              {recentVids.length === 0 ? (
                                <div className="p-4 text-center border border-dashed border-border/50 rounded-lg">
                                  <p className="text-xs text-muted-foreground">Unavailable from Platform</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {recentVids.map((vid: any) => {
                                    const isVidExpanded = expandedWhyId === vid.id;
                                    const cats = vid.observationsCategorized;
                                    return (
                                      <div key={vid.id} className="p-3.5 rounded-lg bg-card border border-border/70 space-y-3">
                                        <div className="flex items-start gap-3">
                                          {vid.thumbnail ? (
                                            <img
                                              src={vid.thumbnail}
                                              alt={vid.title}
                                              className="w-24 h-14 rounded-md object-cover border border-border/60 shrink-0"
                                            />
                                          ) : (
                                            <div className="w-24 h-14 rounded-md bg-muted/30 border border-border/60 flex items-center justify-center text-muted-foreground shrink-0">
                                              <Film className="w-5 h-5" />
                                            </div>
                                          )}
                                          <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2">
                                              <p className="font-medium text-foreground text-xs leading-snug">{vid.title}</p>
                                              {vid.url && (
                                                <a
                                                  href={vid.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="text-muted-foreground hover:text-accent-foreground"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <ExternalLink className="w-3 h-3" />
                                                </a>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                                              {vid.publishedAt && (
                                                <span>{new Date(vid.publishedAt).toLocaleDateString()}</span>
                                              )}
                                              {vid.durationSec !== undefined && (
                                                <span>{Math.floor(vid.durationSec / 60)}m {vid.durationSec % 60}s</span>
                                              )}
                                              <span>
                                                {vid.viewCount !== null && vid.viewCount !== undefined
                                                  ? `${vid.viewCount.toLocaleString()} views`
                                                  : "Unavailable from Platform"}
                                              </span>
                                              {vid.likeCount !== null && vid.likeCount !== undefined && (
                                                <span>{vid.likeCount.toLocaleString()} likes</span>
                                              )}
                                              {vid.commentCount !== null && vid.commentCount !== undefined && (
                                                <span>{vid.commentCount.toLocaleString()} comments</span>
                                              )}
                                            </div>
                                          </div>
                                          {vid.sparkScore !== null && vid.sparkScore !== undefined ? (
                                            <div className="px-2 py-0.5 rounded bg-accent/20 text-accent-foreground font-mono font-bold text-[11px] shrink-0">
                                              {vid.sparkScore} Spark Score
                                            </div>
                                          ) : (
                                            <div className="px-2 py-0.5 rounded bg-muted/30 text-muted-foreground font-mono text-[10px] shrink-0">
                                              Not enough data
                                            </div>
                                          )}
                                        </div>

                                        {/* Expandable Details & SPARK Observations */}
                                        <div className="pt-1">
                                          <button
                                            onClick={() => setExpandedWhyId(isVidExpanded ? null : vid.id)}
                                            className="text-[10px] text-accent-foreground font-medium hover:underline flex items-center gap-1"
                                          >
                                            {isVidExpanded ? "Hide Details" : "View Details & SPARK Observations"}
                                            {isVidExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                          </button>

                                          {isVidExpanded && (
                                            <div className="mt-3 pl-3 space-y-2 border-l-2 border-accent/40 text-[11px] text-muted-foreground">
                                              {vid.description && (
                                                <p><strong className="text-foreground">Description:</strong> {vid.description.slice(0, 200)}{vid.description.length > 200 ? '...' : ''}</p>
                                              )}
                                              {vid.tags && vid.tags.length > 0 && (
                                                <p><strong className="text-foreground">Tags:</strong> {vid.tags.join(", ")}</p>
                                              )}

                                              {/* Categorized SPARK Observations */}
                                              {cats && (
                                                <div className="pt-1 space-y-1 bg-accent/5 p-2.5 rounded-lg border border-accent/15">
                                                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent-foreground mb-1">SPARK Analysis Observations</p>
                                                  {cats.hook && <p><strong className="text-foreground">Hook:</strong> {cats.hook}</p>}
                                                  {cats.format && <p><strong className="text-foreground">Format:</strong> {cats.format}</p>}
                                                  {cats.story && <p><strong className="text-foreground">Story:</strong> {cats.story}</p>}
                                                  {cats.thumbnail && <p><strong className="text-foreground">Thumbnail:</strong> {cats.thumbnail}</p>}
                                                  {cats.cta && <p><strong className="text-foreground">CTA:</strong> {cats.cta}</p>}
                                                  {cats.editing && <p><strong className="text-foreground">Editing:</strong> {cats.editing}</p>}
                                                </div>
                                              )}

                                              {vid.sparkScoreBreakdown && vid.sparkScoreBreakdown.explanation && (
                                                <div>
                                                  <strong className="text-foreground">Why This Score:</strong>
                                                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                                                    {vid.sparkScoreBreakdown.explanation.map((exp: string, idx: number) => (
                                                      <li key={idx}>{exp}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* 2. Top Performing Videos Section (Top 3 by Views) */}
                            {topItems.length > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="font-semibold text-xs text-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-accent-foreground" />
                                    Top Performing Videos (Top 3 by Views)
                                  </h5>
                                  <span className="text-[10px] text-muted-foreground font-mono">Real Public Metrics</span>
                                </div>
                                <div className="space-y-2.5">
                                  {topItems.map((item: any, idx: number) => (
                                    <div key={item.id || idx} className="p-3.5 rounded-lg bg-card border border-border/70 space-y-2">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="font-medium text-foreground text-xs leading-snug">{item.title}</p>
                                          <p className="text-[11px] text-muted-foreground mt-0.5">{item.reason}</p>
                                        </div>
                                        {item.sparkScore !== null && item.sparkScore !== undefined ? (
                                          <div className="px-2 py-0.5 rounded bg-accent/20 text-accent-foreground font-mono font-bold text-[11px] shrink-0">
                                            {item.sparkScore} Spark Score
                                          </div>
                                        ) : (
                                          <div className="px-2 py-0.5 rounded bg-muted/30 text-muted-foreground font-mono text-[10px] shrink-0">
                                            Not enough data
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 3. Pattern Breakdown (only if available) */}
                            {breakdown && (
                              <div>
                                <h5 className="font-semibold text-xs text-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-accent-foreground" />
                                  Pattern Breakdown
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-card border border-border/70">
                                  {[
                                    { label: "Hooks", score: breakdown.hooks },
                                    { label: "Storytelling", score: breakdown.storytelling },
                                    { label: "Editing", score: breakdown.editing },
                                    { label: "Retention", score: breakdown.retention },
                                    { label: "Posting Consistency", score: breakdown.postingConsistency },
                                  ].map((stat) => (
                                    <div key={stat.label} className="space-y-1">
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-muted-foreground">{stat.label}</span>
                                        <span className="font-mono font-semibold text-foreground">{stat.score}</span>
                                      </div>
                                      <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                        <div
                                          className="h-full bg-accent-foreground rounded-full transition-all duration-300"
                                          style={{ width: `${stat.score}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 4. Research Notes & Learnings (only if available) */}
                            {learnings.length > 0 && (
                              <div>
                                <h5 className="font-semibold text-xs text-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                  <Brain className="w-3.5 h-3.5 text-accent-foreground" />
                                  Why SPARK learned this
                                </h5>
                                <ul className="space-y-1.5 p-3.5 rounded-lg bg-card border border-border/70 text-[11px] text-muted-foreground">
                                  {learnings.map((learning: string, lIdx: number) => (
                                    <li key={lIdx} className="flex items-start gap-2">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                      <span>{learning}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 5. Production Actions Toolbar */}
                            <div className="pt-2 border-t border-border/40">
                              <p className="text-[11px] font-semibold text-foreground mb-2.5 uppercase tracking-wide">
                                Direct Production Actions
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    if (createProductionFromSpark) {
                                      const targetSpark = viralSparks.find((s: any) => s.title === source.displayName) || viralSparks[0];
                                      if (targetSpark) {
                                        createProductionFromSpark(targetSpark);
                                        onNavigate("/production");
                                      }
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/95 transition-colors flex items-center gap-1.5"
                                >
                                  <Wand2 className="w-3.5 h-3.5" />
                                  Generate Similar Idea
                                </button>
                                <button
                                  onClick={() => {
                                    if (createProductionFromSpark) {
                                      const targetSpark = viralSparks.find((s: any) => s.title === source.displayName) || viralSparks[0];
                                      if (targetSpark) {
                                        createProductionFromSpark(targetSpark);
                                        onNavigate("/production");
                                      }
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-foreground text-xs font-medium transition-colors flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Generate Better Version
                                </button>
                                <button
                                  onClick={() => {
                                    if (createProductionFromSpark) {
                                      const targetSpark = viralSparks.find((s: any) => s.title === source.displayName) || viralSparks[0];
                                      if (targetSpark) {
                                        createProductionFromSpark(targetSpark);
                                        onNavigate("/production");
                                      }
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-background border border-border hover:bg-accent/10 text-foreground text-xs font-medium transition-colors flex items-center gap-1.5"
                                >
                                  <Compass className="w-3.5 h-3.5" />
                                  Generate Opposite Angle
                                </button>
                                <button
                                  onClick={() => {
                                    if (createProductionFromSpark) {
                                      const targetSpark = viralSparks.find((s: any) => s.title === source.displayName) || viralSparks[0];
                                      if (targetSpark) {
                                        createProductionFromSpark(targetSpark);
                                        onNavigate("/production");
                                      }
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-background border border-border hover:bg-accent/10 text-foreground text-xs font-medium transition-colors flex items-center gap-1.5"
                                >
                                  <Film className="w-3.5 h-3.5" />
                                  Adapt To My Brand
                                </button>
                                <button
                                  onClick={() => handleSavePatternToMemory(source, "Research Pattern", `Observed pattern from ${source.displayName}`)}
                                  className="px-3.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground text-xs font-medium transition-colors flex items-center gap-1.5"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  Save Pattern
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <CharacterStudioModal
            isOpen={showCharacterStudio}
            onClose={() => setShowCharacterStudio(false)}
          />

          <VoiceStudioModal
            isOpen={showVoiceStudio}
            onClose={() => setShowVoiceStudio(false)}
          />

          <LocationPlateStudioModal
            isOpen={showLocationPlateStudio}
            onClose={() => setShowLocationPlateStudio(false)}
          />

          <SupportCharacterModal
            isOpen={showSupportCharacterModal}
            onClose={() => setShowSupportCharacterModal(false)}
          />
        </div>
      </main>
    </>
  );
}
