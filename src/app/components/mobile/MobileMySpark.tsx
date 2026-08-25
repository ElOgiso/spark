import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { CharacterSheetLightbox } from "../onboarding/CharacterSheetLightbox";
import { CharacterStudioModal } from "../ui/CharacterStudioModal";
import { VoiceStudioModal } from "../ui/VoiceStudioModal";
import { previewElevenLabsVoice } from "../../services/runtime/providers/elevenLabsTTS";
import {
  Brain,
  Mic,
  Target,
  Users,
  Zap,
  Shield,
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
  Award,
  Globe,
  X,
  Video,
  Cpu,
} from "lucide-react";
import { PROVIDER_VIDEO_CAPABILITIES, resolveActiveVideoProvider } from "../../services/runtime/providerCapabilities";

interface MobileMySparkProps {
  onNavigate?: (path: string) => void;
}

export function MobileMySpark({ onNavigate }: MobileMySparkProps = {}) {
  const {
    brand,
    character,
    accounts,
    automationMode,
    productionMode,
    formatSettings,
    memoryItems,
    researchSources = [],
    updateBrand,
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
    updateMemoryItem,
    toggleContentPillar,
    toggleTone,
  } = useSpark() as any;

  // Purpose Expand State
  const [isPurposeExpanded, setIsPurposeExpanded] = useState(false);
  const [showSheetLightbox, setShowSheetLightbox] = useState(false);
  const [showCharacterStudio, setShowCharacterStudio] = useState(false);
  const [showVoiceStudio, setShowVoiceStudio] = useState(false);

  // Content Pillar Add State
  const [showAddPillar, setShowAddPillar] = useState(false);
  const [newPillarText, setNewPillarText] = useState("");

  // Voice Preview State
  const [isPlayingVoicePreview, setIsPlayingVoicePreview] = useState(false);
  const [activeVoiceAudio, setActiveVoiceAudio] = useState<HTMLAudioElement | null>(null);

  // Memory Rules Operations State
  const [newRuleText, setNewRuleText] = useState("");
  const [showAddRule, setShowAddRule] = useState(false);
  const [expandedRuleIndex, setExpandedRuleIndex] = useState<number | null>(null);
  const [ruleSearchQuery, setRuleSearchQuery] = useState("");
  const [showArchivedRules, setShowArchivedRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleText, setEditingRuleText] = useState("");

  // Research Sources State
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [isSubmittingSource, setIsSubmittingSource] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [expandedWhyId, setExpandedWhyId] = useState<string | null>(null);

  // Edit Identity Full-Screen Mobile Sheet State
  const [showEditIdentity, setShowEditIdentity] = useState(false);
  const [editName, setEditName] = useState(brand?.name || "");
  const [editNiche, setEditNiche] = useState(brand?.niche || "");
  const [editArchetype, setEditArchetype] = useState(brand?.archetype || "");
  const [editPurpose, setEditPurpose] = useState(brand?.purpose || "");
  const [editWebsite, setEditWebsite] = useState(brand?.website || "");
  const [editCountry, setEditCountry] = useState(brand?.country || "Nigeria");
  const [editLanguage, setEditLanguage] = useState(brand?.language || "English (UK/NG)");
  const [editAudiencePrimary, setEditAudiencePrimary] = useState(brand?.audience?.primary || "");
  const [editPainPoints, setEditPainPoints] = useState(
    Array.isArray(brand?.audience?.painPoints) ? brand.audience.painPoints.join(", ") : ""
  );
  const [editDesires, setEditDesires] = useState(
    Array.isArray(brand?.audience?.desires) ? brand.audience.desires.join(", ") : ""
  );

  const handleEditIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateBrand) return;
    updateBrand({
      name: editName.trim() || brand?.name || "My Brand",
      niche: editNiche.trim() || brand?.niche || "Content & Media",
      archetype: editArchetype.trim() || brand?.archetype || "Visionary Creator",
      purpose: editPurpose.trim() || brand?.purpose || "Creating impactful digital content.",
      website: editWebsite.trim(),
      country: editCountry.trim(),
      language: editLanguage.trim(),
      audience: {
        ...brand?.audience,
        primary: editAudiencePrimary.trim(),
        painPoints: editPainPoints.split(",").map((s: string) => s.trim()).filter(Boolean),
        desires: editDesires.split(",").map((s: string) => s.trim()).filter(Boolean),
      },
    });
    setShowEditIdentity(false);
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
      console.warn("[MobileMySpark] Voice preview play error:", err);
      setIsPlayingVoicePreview(false);
      setActiveVoiceAudio(null);
    }
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    addMemoryItem(newRuleText.trim(), "rule");
    setNewRuleText("");
    setShowAddRule(false);
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
      console.warn("[MobileMySpark] Add research source error:", err);
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
      console.warn("[MobileMySpark] Sync source error:", err);
    } finally {
      setSyncingSourceId(null);
    }
  };

  const handleSavePatternToMemory = (source: any, patternTitle: string, patternDesc: string) => {
    if (addMemoryItem) {
      addMemoryItem(`[Saved Pattern - ${source.displayName}] ${patternTitle}: ${patternDesc}`, "rule");
    }
  };

  const getRuleMeta = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("nobody talks") || lower.includes("hook style")) {
      return {
        whyExists: "Derived from analyzing top-performing short tech clips where curiosity gaps drove the highest 3-second hook conversion.",
        affects: "Short-form hooks, script templates, and caption copy.",
        influences: "TikTok Reels and YouTube Shorts productions.",
        behavior: "Overrides standard templates to favor curiosity-first scripts."
      };
    }
    if (lower.includes("peak engagement") || lower.includes("engagement window")) {
      return {
        whyExists: "Aggregated activity analytics show creator audience peaks between 2:00 PM and 4:00 PM WAT on weekdays.",
        affects: "Publishing queue, automated calendar, and buffer timings.",
        influences: "All active scheduled multi-channel distribution pipelines.",
        behavior: "Automatically prioritizes and schedules posts within peak windows."
      };
    }
    if (lower.includes("call to action") || lower.includes("cta")) {
      return {
        whyExists: "Retention drops in final seconds; placing the CTA before the final 10 seconds increases subscriber conversion by 44%.",
        affects: "Ending scripts, outro screens, and caption guidelines.",
        influences: "All tutorial, narrative, and short-form video storyboards.",
        behavior: "Enforces a mandatory Call To Action segment at scene-end."
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

  return (
    <div className="w-full min-h-[100dvh] flex flex-col space-y-4 pt-3 pb-6 px-4 antialiased">
      {/* 1. Compact Header: Brand Name, Niche, Archetype, Active Badge, Edit Button */}
      <div className="flex items-center justify-between gap-3 pt-2 pb-1 border-b border-border/40">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate tracking-tight text-foreground">{brand?.name || "My Brand"}</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {brand?.niche || "Content Creation"} • <span className="font-mono text-[11px]">{brand?.archetype || "The Expert Guide"}</span>
          </p>
        </div>
        <button
          onClick={() => {
            setEditName(brand?.name || "");
            setEditNiche(brand?.niche || "");
            setEditArchetype(brand?.archetype || "");
            setEditPurpose(brand?.purpose || "");
            setEditWebsite(brand?.website || "");
            setEditCountry(brand?.country || "Nigeria");
            setEditLanguage(brand?.language || "English (UK/NG)");
            setEditAudiencePrimary(brand?.audience?.primary || "");
            setEditPainPoints(Array.isArray(brand?.audience?.painPoints) ? brand.audience.painPoints.join(", ") : "");
            setEditDesires(Array.isArray(brand?.audience?.desires) ? brand.audience.desires.join(", ") : "");
            setShowEditIdentity(true);
          }}
          className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent/15 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm min-h-[38px]"
        >
          <Edit3 className="w-3.5 h-3.5 text-accent-foreground" />
          Edit
        </button>
      </div>

      {/* 2. Purpose (Short + Expand) */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-accent-foreground" /> Brand Purpose
          </h2>
          <button
            onClick={() => setIsPurposeExpanded(!isPurposeExpanded)}
            className="text-[11px] text-accent-foreground font-medium flex items-center gap-0.5"
          >
            {isPurposeExpanded ? "Less" : "More"}
            {isPurposeExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className={`text-xs text-foreground leading-relaxed ${isPurposeExpanded ? "" : "line-clamp-2"}`}>
          {brand?.purpose || "Creating authoritative, engaging digital media content to scale audience trust."}
        </p>
      </section>

      {/* 3. Content Pillars */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-accent-foreground" /> Content Pillars
          </h2>
          <button
            onClick={() => setShowAddPillar(!showAddPillar)}
            className="text-[11px] text-accent-foreground font-medium flex items-center gap-1"
          >
            {showAddPillar ? "Cancel" : "+ Add"}
          </button>
        </div>

        {showAddPillar && (
          <form onSubmit={handleAddPillarSubmit} className="flex gap-2">
            <input
              type="text"
              value={newPillarText}
              onChange={(e) => setNewPillarText(e.target.value)}
              placeholder="New pillar name..."
              className="flex-1 bg-background text-foreground text-xs border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
              required
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 shrink-0"
            >
              Add
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {(brand?.contentPillars || []).map((pillar: any) => (
            <button
              key={pillar.label}
              onClick={() => toggleContentPillar && toggleContentPillar(pillar.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[34px] ${
                pillar.active
                  ? "bg-accent text-foreground border border-accent/60 shadow-sm"
                  : "bg-background border border-border text-muted-foreground"
              }`}
            >
              {pillar.label}
            </button>
          ))}
        </div>
      </section>

      {/* 4. Character & Voice */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-accent-foreground" /> Character & Voice
          </h2>
          <button
            type="button"
            onClick={() => setShowCharacterStudio(true)}
            className="text-[11px] text-accent-foreground font-medium flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Edit3 className="w-3 h-3" /> Edit Character
          </button>
        </div>

        <div className="space-y-3">
          {/* Host Profile */}
          <div className="flex items-start gap-3">
            {character?.imageUrl || character?.avatarUrl || character?.characterSheetUrl ? (
              <button
                type="button"
                onClick={() => setShowCharacterStudio(true)}
                className="relative group shrink-0 focus:outline-none cursor-pointer"
                title="Tap to edit / generate character sheet"
              >
                <img
                  src={character.imageUrl || character.avatarUrl || character.characterSheetUrl || ""}
                  alt={character.name}
                  className="w-11 h-11 rounded-xl object-cover border border-accent/40 group-hover:border-accent transition-colors"
                />
                <span className="absolute -bottom-1 -right-1 bg-accent/90 text-foreground text-[9px] px-1 rounded font-mono">
                  Edit
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCharacterStudio(true)}
                className="w-11 h-11 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-accent-foreground shrink-0 cursor-pointer"
                title="Tap to edit / generate character sheet"
              >
                {character?.name?.[0] || "S"}
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{character?.name || "Host"}</p>
              <p className="text-xs text-muted-foreground">{character?.role || "Lead Presenter"}</p>
              <p className="text-xs text-muted-foreground/90 mt-1">{character?.style || "Executive Digital Presenter"}</p>
            </div>
          </div>

          {character?.traits && character.traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {character.traits.map((trait: string) => (
                <span key={trait} className="px-2 py-0.5 rounded bg-accent/15 text-[11px] font-medium text-foreground">
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* Voice Card */}
          <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground font-mono">{character?.voice?.name || "Default Voice"}</p>
                <p className="text-[11px] text-muted-foreground">{character?.voice?.language || "English"}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceStudio(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-foreground text-[10px] font-semibold transition-colors cursor-pointer"
              >
                <Edit3 className="w-2.5 h-2.5" /> Edit Voice
              </button>
            </div>
            {character?.voice?.tone && (
              <p className="text-xs text-muted-foreground italic">"{character.voice.tone}"</p>
            )}
            <button
              onClick={handlePreviewVoice}
              className="w-full py-2 rounded-lg bg-background hover:bg-accent/20 text-xs font-semibold flex items-center justify-center gap-2 border border-border transition-colors min-h-[40px] cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isPlayingVoicePreview ? "animate-pulse text-accent-foreground" : ""}`} />
              {isPlayingVoicePreview ? "Playing Voice..." : "Preview Voice"}
            </button>
          </div>
        </div>
      </section>

      {/* 5. Audience Profile */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-accent-foreground" /> Audience Profile
        </h2>

        <div className="p-3 rounded-lg bg-background border border-border space-y-1">
          <p className="text-[10px] uppercase font-mono text-muted-foreground font-semibold">Primary Target</p>
          <p className="text-xs font-medium text-foreground">{brand?.audience?.primary || "Digital creators and tech professionals"}</p>
        </div>

        {/* Stacked Pain Points */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase font-mono text-muted-foreground font-semibold">Pain Points</p>
          {(brand?.audience?.painPoints || []).map((point: string, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/15 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-foreground/90">{point}</p>
            </div>
          ))}
        </div>

        {/* Stacked Desires */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase font-mono text-muted-foreground font-semibold">Desires</p>
          {(brand?.audience?.desires || []).map((desire: string, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-success/5 border border-success/15 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              <p className="text-foreground/90">{desire}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Tone & Style */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent-foreground" /> Tone Matrix
        </h2>
        <div className="flex flex-wrap gap-2">
          {(Array.isArray(brand?.tone)
            ? brand.tone
            : typeof brand?.tone === "string" && brand.tone.trim()
            ? brand.tone.split(",").map((t: string) => ({ label: t.trim(), active: true })).filter((t: any) => t.label)
            : [
                { label: "Direct", active: true },
                { label: "Analytical", active: true },
                { label: "Relatable", active: true },
                { label: "Authoritative", active: true },
              ]
          ).map((t: any) => (
            <button
              key={t.label}
              onClick={() => toggleTone && toggleTone(t.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[34px] ${
                t.active
                  ? "bg-foreground text-background font-semibold"
                  : "bg-background border border-border text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* 7. Production Mode (3 Full-Width Stacked Rows) */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-accent-foreground" /> Production Mode
        </h2>
        <div className="space-y-2">
          {(["express", "standard", "deep"] as const).map((mode) => {
            const cfg = productionConfig[mode];
            const isActive = productionMode === mode;
            return (
              <button
                key={mode}
                onClick={() => updateProductionMode && updateProductionMode(mode)}
                className={`w-full p-3.5 rounded-xl border text-left transition-all min-h-[52px] flex items-center justify-between gap-3 ${
                  isActive
                    ? "bg-accent/20 border-accent/60 shadow-sm"
                    : "bg-background border-border"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {cfg.label}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground">({cfg.time})</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{cfg.desc}</p>
                </div>
                {isActive && <Check className="w-4 h-4 text-accent-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* 8. Automation Mode (3 Full-Width Stacked Rows) */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-accent-foreground" /> Automation Mode
        </h2>
        <div className="space-y-2">
          {(["manual", "balanced", "autonomous"] as const).map((mode) => {
            const cfg = automationConfig[mode];
            const isActive = automationMode === mode;
            return (
              <button
                key={mode}
                onClick={() => updateAutomationMode && updateAutomationMode(mode)}
                className={`w-full p-3.5 rounded-xl border text-left transition-all min-h-[52px] flex items-center justify-between gap-3 ${
                  isActive ? `${cfg.bg} ${cfg.border} shadow-sm` : "bg-background border-border"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${isActive ? cfg.color : "text-muted-foreground"}`}>
                    {cfg.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{cfg.desc}</p>
                </div>
                {isActive && <Check className="w-4 h-4 text-accent-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Production Settings (Aspect Ratio + Target Video Length) */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent-foreground" /> Production Settings
        </h2>

        {/* Aspect Ratio Strategy */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Aspect Ratio Strategy</p>
          {[
            { id: "landscape" as const, label: "Landscape (16:9)", badge: "YouTube long" },
            { id: "portrait" as const, label: "Portrait (9:16)", badge: "Shorts / TikTok" },
            { id: "dynamic" as const, label: "Dynamic (Auto)", badge: "Best for content" },
          ].map((opt) => {
            const active = (formatSettings?.aspectMode || "portrait") === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => updateFormatSettings && updateFormatSettings({ aspectMode: opt.id })}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                  active ? "bg-purple-600/20 border-purple-500/50 shadow-sm" : "bg-background border-border"
                }`}
              >
                <span className={`text-xs font-semibold ${active ? "text-purple-200" : "text-muted-foreground"}`}>{opt.label}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${active ? "bg-purple-500/30 text-purple-200" : "bg-muted text-muted-foreground"}`}>{opt.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Target Video Length */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Target Video Length</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { sec: 60, label: "1m" },
              { sec: 180, label: "3m" },
              { sec: 300, label: "5m" },
              { sec: 600, label: "10m" },
              { sec: 900, label: "15m" },
              { sec: 1200, label: "20m" },
              { sec: 1800, label: "30m" },
              { sec: 2700, label: "45m" },
              { sec: 3600, label: "60m" },
            ].map((dur) => {
              const active = (formatSettings?.targetDurationSec || 60) === dur.sec;
              return (
                <button
                  key={dur.sec}
                  onClick={() => updateFormatSettings && updateFormatSettings({ targetDurationSec: dur.sec })}
                  className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                    active ? "bg-purple-600 text-white border-purple-400" : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  {dur.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clip Engine & Video Models */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Clip Engine</p>
            <span className="text-[10px] font-mono text-purple-400">Official Limits</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Native clip lengths. Multi-segment continuous scenes planned for long targets.
          </p>

          <div className="space-y-2">
            {(() => {
              const activeVideo = resolveActiveVideoProvider({
                preferredVideoProvider: formatSettings?.preferredVideoProvider,
              });
              const isAuto = !formatSettings?.preferredVideoProvider || formatSettings.preferredVideoProvider === "auto";

              const videoModels: Array<{ id: string; name: string; lengths: string; maxSec: number }> = [
                {
                  id: "gemini",
                  name: PROVIDER_VIDEO_CAPABILITIES.gemini.displayName,
                  lengths: "4s / 6s / 8s",
                  maxSec: PROVIDER_VIDEO_CAPABILITIES.gemini.maxNativeSec,
                },
                {
                  id: "grok",
                  name: PROVIDER_VIDEO_CAPABILITIES.grok.displayName,
                  lengths: "1–15s",
                  maxSec: PROVIDER_VIDEO_CAPABILITIES.grok.maxNativeSec,
                },
                {
                  id: "kling",
                  name: PROVIDER_VIDEO_CAPABILITIES.kling.displayName,
                  lengths: "5s / 10s",
                  maxSec: PROVIDER_VIDEO_CAPABILITIES.kling.maxNativeSec,
                },
                {
                  id: "runway",
                  name: PROVIDER_VIDEO_CAPABILITIES.runway.displayName,
                  lengths: "5s / 10s",
                  maxSec: PROVIDER_VIDEO_CAPABILITIES.runway.maxNativeSec,
                },
                {
                  id: "luma",
                  name: PROVIDER_VIDEO_CAPABILITIES.luma.displayName,
                  lengths: "5s / 9s",
                  maxSec: PROVIDER_VIDEO_CAPABILITIES.luma.maxNativeSec,
                },
                {
                  id: "higgsfield",
                  name: PROVIDER_VIDEO_CAPABILITIES.higgsfield.displayName,
                  lengths: "4s / 8s",
                  maxSec: PROVIDER_VIDEO_CAPABILITIES.higgsfield.maxNativeSec,
                },
              ];

              return (
                <>
                  <button
                    onClick={() => updateFormatSettings && updateFormatSettings({ preferredVideoProvider: "auto" })}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                      isAuto
                        ? "bg-purple-600/20 border-purple-500/60 shadow-sm"
                        : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-medium text-foreground">Auto / Best Available</span>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      {activeVideo.profile.displayName.split(" ")[0]}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    {videoModels.map((m) => {
                      const isSelected = formatSettings?.preferredVideoProvider === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => updateFormatSettings && updateFormatSettings({ preferredVideoProvider: m.id as any })}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            isSelected
                              ? "bg-purple-600/20 border-purple-500/60"
                              : "bg-background border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-foreground truncate">{m.name.split(" ")[0]}</span>
                            <span className="text-[9px] font-mono text-muted-foreground">{m.maxSec}s</span>
                          </div>
                          <p className="text-[10px] font-mono text-purple-300 truncate">{m.lengths}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </section>

      {/* 9. Connected Accounts */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-accent-foreground" /> Connected Accounts
        </h2>
        {(() => {
          const connected = accounts ? accounts.filter((a: any) => a.status?.toLowerCase() === "connected") : [];
          if (connected.length === 0) {
            return (
              <div className="rounded-lg border border-dashed border-border bg-background p-4 text-center space-y-2">
                <p className="text-xs text-muted-foreground">No channels connected yet.</p>
                <button
                  onClick={() => onNavigate?.("/more/accounts")}
                  className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-foreground text-xs font-semibold transition-colors"
                >
                  Connect YouTube or X
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-2">
              {connected.map((account: any) => (
                <div
                  key={account.platform}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-success shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{account.platform}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{account.handle}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-success font-semibold font-mono">Connected</span>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* 10. Memory & Brand Rules */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-accent-foreground" /> Memory & Brand Rules
          </h2>
          <button
            onClick={() => setShowAddRule(!showAddRule)}
            className="text-[11px] text-accent-foreground font-medium flex items-center gap-1"
          >
            {showAddRule ? "Cancel" : "+ Add Rule"}
          </button>
        </div>

        {/* Search & Archived Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={ruleSearchQuery}
              onChange={(e) => setRuleSearchQuery(e.target.value)}
              placeholder="Search rules..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-background text-foreground text-xs border border-border rounded-lg focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={() => setShowArchivedRules(!showArchivedRules)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 transition-colors ${
              showArchivedRules
                ? "bg-accent/20 border-accent/40 text-accent-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {showArchivedRules ? "Archived" : "Active"}
          </button>
        </div>

        {showAddRule && (
          <form onSubmit={handleAddRuleSubmit} className="space-y-2">
            <textarea
              rows={2}
              value={newRuleText}
              onChange={(e) => setNewRuleText(e.target.value)}
              placeholder="Enter brand guideline or style rule..."
              className="w-full bg-background text-foreground text-xs border border-border rounded-lg p-2.5 focus:outline-none focus:border-accent"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddRule(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold"
              >
                Save Rule
              </button>
            </div>
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

            const sorted = [...filtered].sort((a, b) => {
              const aPinned = a.pinned ? 1 : 0;
              const bPinned = b.pinned ? 1 : 0;
              return bPinned - aPinned;
            });

            if (sorted.length === 0) {
              return (
                <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                  {ruleSearchQuery ? "No matching rules." : showArchivedRules ? "No archived rules." : "No active rules."}
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
                  className={`p-3 rounded-lg border transition-all ${
                    isEditing
                      ? "bg-background border-accent"
                      : isPinned
                      ? "bg-accent/15 border-accent/40"
                      : "bg-background border-border"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {item.type === "learned" ? (
                      <Sparkles className="w-3.5 h-3.5 text-accent-foreground shrink-0 mt-0.5" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {item.category && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground font-semibold">
                            {item.category}
                          </span>
                        )}
                        {isPinned && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground font-bold">
                            <Pin className="w-2.5 h-2.5 fill-current" /> Pinned
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 mt-1" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            rows={2}
                            value={editingRuleText}
                            onChange={(e) => setEditingRuleText(e.target.value)}
                            className="w-full bg-background text-foreground text-xs border border-border rounded p-2 focus:outline-none focus:border-accent"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveRuleEdit(item.id)}
                              className="px-2.5 py-1 rounded bg-foreground text-background text-xs font-semibold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRuleId(null)}
                              className="px-2.5 py-1 rounded border border-border text-xs text-muted-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{item.text}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinRule(item.id, isPinned);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                        title="Pin rule"
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current text-accent-foreground" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRuleId(item.id);
                          setEditingRuleText(item.text);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                        title="Edit rule"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleArchiveRule(item.id, Boolean(item.archived));
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                        title="Archive rule"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (removeMemoryItem && item.id) removeMemoryItem(item.id);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-destructive"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && !isEditing && (
                    <div className="mt-3 pt-2.5 border-t border-border/50 space-y-2 text-[11px] text-muted-foreground">
                      <div>
                        <p className="font-semibold text-[10px] uppercase text-foreground">Why It Exists</p>
                        <p className="mt-0.5 leading-relaxed">{meta.whyExists}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[10px] uppercase text-foreground">What It Affects</p>
                        <p className="mt-0.5 leading-relaxed">{meta.affects}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[10px] uppercase text-foreground">Changes Spark Behavior</p>
                        <p className="mt-0.5 leading-relaxed">{meta.behavior}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </section>

      {/* 11. Research Sources (Inspiration Accounts) */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-accent-foreground" /> Research Sources
          </h2>
          <button
            onClick={() => setShowAddSource(!showAddSource)}
            className="text-[11px] text-accent-foreground font-medium flex items-center gap-1"
          >
            {showAddSource ? "Cancel" : "+ Add Source"}
          </button>
        </div>

        {showAddSource && (
          <form onSubmit={handleAddSourceSubmit} className="space-y-2">
            <input
              type="url"
              value={sourceUrlInput}
              onChange={(e) => setSourceUrlInput(e.target.value)}
              placeholder="Paste creator channel URL..."
              className="w-full bg-background text-foreground text-xs border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddSource(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingSource}
                className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold disabled:opacity-50"
              >
                {isSubmittingSource ? "Analyzing..." : "Add Source"}
              </button>
            </div>
          </form>
        )}

        {researchSources.length === 0 ? (
          <div className="p-4 text-center border border-dashed border-border rounded-lg space-y-1">
            <p className="text-xs text-muted-foreground">No inspiration accounts added yet.</p>
            <p className="text-[11px] text-muted-foreground/80">Paste a creator URL above for pattern extraction.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {researchSources.map((source: any) => {
              const isExpanded = expandedSourceId === source.id;
              const isSyncing = source.status === "syncing" || syncingSourceId === source.id;
              const isHealthy = source.status === "active";
              const isNeedsAttention = source.status === "error" || source.status === "unavailable";
              const confidenceText = source.researchConfidence
                ? `${Math.round(source.researchConfidence * 100)}% Confidence`
                : "Not enough data";

              return (
                <div
                  key={source.id}
                  className="p-3.5 rounded-xl border border-border bg-background space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={source.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(source.username || source.id)}`}
                      alt={source.displayName}
                      className="w-10 h-10 rounded-full bg-accent/10 border border-border object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-foreground truncate">{source.displayName}</h4>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-accent/10 text-accent-foreground font-semibold">
                          {source.platform}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{source.username}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                        {source.followers !== null && source.followers !== undefined && (
                          <span>{typeof source.followers === "number" ? source.followers.toLocaleString() : source.followers} Subs</span>
                        )}
                        {source.videoCount !== null && source.videoCount !== undefined && (
                          <span>• {source.videoCount} Vids</span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                      isSyncing
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : isHealthy
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {isSyncing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : null}
                      {isSyncing ? "Syncing" : isHealthy ? "Healthy" : "Attention"}
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono truncate">{confidenceText}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setExpandedSourceId(isExpanded ? null : source.id)}
                        className="px-2.5 py-1 rounded-lg bg-accent/20 text-accent-foreground text-[11px] font-semibold flex items-center gap-1"
                      >
                        {isExpanded ? "Hide" : "Research"}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleSyncSource(source.id)}
                        disabled={isSyncing}
                        className="p-1.5 rounded-lg bg-muted/40 text-foreground text-xs hover:bg-muted"
                        title="Sync now"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={() => removeResearchSource && removeResearchSource(source.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"
                        title="Remove source"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Mobile Research Intelligence */}
                  {isExpanded && (
                    <div className="mt-2 pt-3 border-t border-border/60 space-y-4 text-xs">
                      {/* Video Research */}
                      {source.videoResearch && (
                        <div className="p-3 rounded-lg bg-card border border-accent/30 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-foreground">AI Video Understanding</span>
                            <span className="px-2 py-0.5 rounded bg-accent/20 text-accent-foreground font-mono font-bold text-[10px]">
                              {source.videoResearch.sparkScore} Spark Score
                            </span>
                          </div>
                          <div className="space-y-2 text-[11px]">
                            <div>
                              <p className="font-semibold text-[10px] text-foreground">Hook Analysis</p>
                              <p className="text-muted-foreground leading-relaxed">{source.videoResearch.hookAnalysis}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[10px] text-foreground">Retention Pacing</p>
                              <p className="text-muted-foreground leading-relaxed">{source.videoResearch.retentionAnalysis}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Direct Production Actions */}
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-mono font-semibold text-muted-foreground">Production Actions</p>
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => {
                              if (createProductionFromSpark) {
                                createProductionFromSpark(`spk-${Date.now()}`);
                                onNavigate?.("/review");
                              }
                            }}
                            className="w-full py-2 px-3 rounded-lg bg-foreground text-background text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Wand2 className="w-3.5 h-3.5" /> Generate Similar Idea
                          </button>
                          <button
                            onClick={() => {
                              if (createProductionFromSpark) {
                                createProductionFromSpark(`spk-${Date.now()}`);
                                onNavigate?.("/review");
                              }
                            }}
                            className="w-full py-2 px-3 rounded-lg bg-accent/20 text-accent-foreground text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Generate Better Version
                          </button>
                          <button
                            onClick={() => handleSavePatternToMemory(source, "Research Pattern", `Observed pattern from ${source.displayName}`)}
                            className="w-full py-2 px-3 rounded-lg border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Shield className="w-3.5 h-3.5" /> Save Pattern to Memory
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
      </section>

      {/* 12. Edit Identity Full-Screen Mobile Sheet */}
      {showEditIdentity && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col p-4 overflow-y-auto antialiased">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60 sticky top-0 bg-background z-10">
            <div>
              <h3 className="text-base font-bold text-foreground">Edit Brand Identity</h3>
              <p className="text-xs text-muted-foreground">Update core profile & audience targets</p>
            </div>
            <button
              onClick={() => setShowEditIdentity(false)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleEditIdentitySubmit} className="space-y-4 pt-4 pb-12 flex-1">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Brand Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Niche</label>
                <input
                  type="text"
                  value={editNiche}
                  onChange={(e) => setEditNiche(e.target.value)}
                  className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Archetype</label>
                <input
                  type="text"
                  value={editArchetype}
                  onChange={(e) => setEditArchetype(e.target.value)}
                  className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Brand Purpose</label>
              <textarea
                rows={3}
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
                className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent"
                required
              />
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Primary Target Audience</label>
              <input
                type="text"
                value={editAudiencePrimary}
                onChange={(e) => setEditAudiencePrimary(e.target.value)}
                placeholder="e.g. Tech Founders & Product Creators"
                className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Pain Points (Comma Separated)</label>
              <input
                type="text"
                value={editPainPoints}
                onChange={(e) => setEditPainPoints(e.target.value)}
                placeholder="e.g. Low retention, high production time"
                className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Desires (Comma Separated)</label>
              <input
                type="text"
                value={editDesires}
                onChange={(e) => setEditDesires(e.target.value)}
                placeholder="e.g. Viral reach, high subscriber conversion"
                className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Country</label>
                <input
                  type="text"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground font-semibold">Language</label>
                <input
                  type="text"
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                  className="w-full mt-1 bg-card text-foreground text-sm border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-accent min-h-[44px]"
                />
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setShowEditIdentity(false)}
                className="flex-1 py-3 rounded-xl border border-border text-xs font-semibold text-muted-foreground min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 min-h-[44px]"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      <CharacterSheetLightbox
        isOpen={showSheetLightbox}
        onClose={() => setShowSheetLightbox(false)}
        imageUrl={character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl}
        characterName={character?.name || "Lead Host"}
        brandName={brand?.name || "SPARK"}
      />

      <CharacterStudioModal
        isOpen={showCharacterStudio}
        onClose={() => setShowCharacterStudio(false)}
      />

      <VoiceStudioModal
        isOpen={showVoiceStudio}
        onClose={() => setShowVoiceStudio(false)}
      />
    </div>
  );
}
