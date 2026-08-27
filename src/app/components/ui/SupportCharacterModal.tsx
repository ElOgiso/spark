import React, { useState, useRef } from "react";
import { X, Sparkles, Upload, RefreshCw, CheckCircle2, AlertCircle, Eye, UserPlus } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { useSpark } from "../../state/SparkContext";
import { isUuid } from "../../backend/mappers/workspaceMappers";
import { getBrandWorkspaceId } from "../../services/socialIntegrationService";
import { getEffectiveFormatSettings, Character } from "../../domain/types";
import { buildProductionCharacterSheetPrompt } from "../../services/production/characterSheetPrompt";
import { getEffectiveContentFormat } from "../../services/production/characterSheetGate";
import { CharacterSheetLightbox } from "../onboarding/CharacterSheetLightbox";

interface SupportCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (character: Character) => void;
}

export const SupportCharacterModal: React.FC<SupportCharacterModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const auth = useAuth();
  const { brand, character: mainCharacter, addSupportCharacter, formatSettings } = useSpark() as any;

  const [name, setName] = useState("Companion / Rival");
  const [roleDesc, setRoleDesc] = useState("support");
  const [personality, setPersonality] = useState("Loyal, sharp-witted strategist with contrasting silhouette and dark palette");
  const [styleGenre, setStyleGenre] = useState("Cinematic / Anime");
  const [sheetUrl, setSheetUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBrandId = auth.brand?.id || getBrandWorkspaceId();

  if (!isOpen) return null;

  const effectiveFormat = getEffectiveFormatSettings({ formatSettings, brand });
  const contentFormat = getEffectiveContentFormat({ brand, formatSettings: effectiveFormat });

  const handleGenerateSheet = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const prompt = buildProductionCharacterSheetPrompt({
      creatorName: name,
      role: "support",
      brandName: brand?.name,
      niche: brand?.niche,
      genre: styleGenre || (contentFormat === "anime" ? "Anime" : "Cinematic"),
      personality,
    });

    try {
      const { ModelRouter } = await import("../../services/runtime/modelRouter");
      const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
        prompt,
        referenceImageUrl: sheetUrl || undefined,
        aspectRatio: "16:9",
        capability: "Image Generation",
      });

      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        setSheetUrl(imgUrl);
        setSuccessMsg("Support turnaround sheet generated! Review and click Save to add to cast.");
      } else {
        setErrorMsg("Character sheet generation returned no image. Please retry or upload an image.");
      }
    } catch (err: any) {
      console.warn("[SupportCharacterModal] Generation notice:", err);
      setErrorMsg(err?.message || "Generation failed. You can upload a reference image instead.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && typeof ev.target.result === "string") {
        setSheetUrl(ev.target.result);
        setSuccessMsg("Image loaded. Click Save Support Character to persist.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!activeBrandId || !isUuid(activeBrandId)) {
      setErrorMsg("Save failed: No valid UUID brand workspace ID found.");
      return;
    }

    if (!sheetUrl) {
      setErrorMsg("Please generate or upload a character sheet image before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const newCharPayload: Partial<Character> = {
        name: name.trim() || "Supporting Character",
        role: "support",
        style: `${styleGenre} — Supporting cast for ${brand?.name || "SPARK"}`,
        traits: [personality.slice(0, 30), "Supporting Role"],
        characterSheetUrl: sheetUrl,
        imageUrl: sheetUrl,
        avatarUrl: sheetUrl,
        voice: {
          name: `${name} Voice`,
          language: "English",
          tone: "Dynamic",
          locked: true,
        },
      };

      if (addSupportCharacter) {
        const created = await addSupportCharacter(newCharPayload);
        if (created) {
          onSuccess?.(created);
        }
      }

      setSuccessMsg("Supporting character added to production cast!");
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("[SupportCharacterModal] Save error:", err);
      setErrorMsg(err?.message || "Failed to persist supporting character.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0B0F17] border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-[#0E131F]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Add Supporting Character</h2>
              <p className="text-xs text-muted-foreground">
                Up to 2 supporting characters for story / anime. Distinct turnaround sheet enforces identity lock.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
          {/* Status Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Turnaround Sheet Preview */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Model Sheet (Turnaround)</span>
                {sheetUrl && (
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                )}
              </label>

              <div
                className="relative aspect-video rounded-xl bg-background border border-border/70 overflow-hidden flex items-center justify-center group"
                style={{ maxHeight: "240px" }}
              >
                {sheetUrl ? (
                  <>
                    <img src={sheetUrl} alt="Support Character Sheet" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setLightboxOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold flex items-center gap-1 hover:bg-black/80 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Full View
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-muted-foreground mb-1">No turnaround sheet yet</p>
                    <p className="text-[11px] text-muted-foreground/60">Generate or upload a model sheet</p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-foreground cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" /> Upload Model Sheet Image
              </button>
            </div>

            {/* Right: Character Details & Generator */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Character Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maya (Rival Analyst)"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Silhouette & Distinct Palette</label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={3}
                  placeholder="Distinct hair style, wardrobe colors, silhouette contrasting lead host..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200/90 leading-relaxed">
                <p className="font-semibold text-indigo-300 mb-0.5">Cast Identity Rule</p>
                Beats with <span className="font-mono text-white">subject: "support"</span> automatically use this turnaround sheet as IMAGE 1. If absent, production safely defaults to primary host.
              </div>

              <button
                type="button"
                onClick={handleGenerateSheet}
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating Support Model Sheet…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Generate Turnaround Sheet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 bg-[#0E131F] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !sheetUrl}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save Support Character"
            )}
          </button>
        </div>
      </div>

      <CharacterSheetLightbox
        isOpen={lightboxOpen}
        imageUrl={sheetUrl}
        onClose={() => setLightboxOpen(false)}
        characterName={name}
        brandName={brand?.name || "SPARK"}
      />
    </div>
  );
};
