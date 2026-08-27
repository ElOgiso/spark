import React, { useState, useRef } from "react";
import { X, Sparkles, Upload, RefreshCw, CheckCircle2, AlertCircle, Trash2, Eye } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { useSpark } from "../../state/SparkContext";
import { isUuid } from "../../backend/mappers/workspaceMappers";
import { getBrandWorkspaceId } from "../../services/socialIntegrationService";
import { getEffectiveFormatSettings } from "../../domain/types";
import { buildLocationPlatePrompt } from "../../services/production/locationPlatePrompt";
import { getEffectiveContentFormat } from "../../services/production/characterSheetGate";
import { CharacterSheetLightbox } from "../onboarding/CharacterSheetLightbox";

interface LocationPlateStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocationPlateStudioModal: React.FC<LocationPlateStudioModalProps> = ({ isOpen, onClose }) => {
  const auth = useAuth();
  const { brand, updateBrand, formatSettings } = useSpark() as any;

  const currentPlateUrl = brand?.locationPlateUrl || (brand as any)?.settings?.locationPlateUrl || "";
  const [plateUrl, setPlateUrl] = useState<string>(currentPlateUrl);
  const [styleGenre, setStyleGenre] = useState("Cinematic / Realistic");
  const [envDescription, setEnvDescription] = useState(
    brand?.purpose || "High-end architectural executive studio set with volumetric warm lighting"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBrandId = auth.brand?.id || getBrandWorkspaceId();

  if (!isOpen) return null;

  const effectiveFormat = getEffectiveFormatSettings({ formatSettings, brand });
  const aspectRatio = effectiveFormat.aspectMode === "landscape" ? "16:9" : "9:16";
  const contentFormat = getEffectiveContentFormat({ brand, formatSettings: effectiveFormat });

  const handleGeneratePlate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const prompt = buildLocationPlatePrompt({
      brandName: brand?.name,
      niche: brand?.niche,
      genre: styleGenre,
      contentFormat,
      environmentDescription: envDescription,
    });

    try {
      const { ModelRouter } = await import("../../services/runtime/modelRouter");
      const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
        prompt,
        referenceImageUrl: plateUrl || undefined,
        referenceImageUrls: plateUrl ? [plateUrl] : undefined,
        aspectRatio,
        capability: "Image Generation",
      });

      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        setPlateUrl(imgUrl);
        setSuccessMsg("Establishing set plate generated! Review and click Save to lock this environment.");
      } else {
        setErrorMsg("Set plate generation returned no image. Please retry.");
      }
    } catch (err: any) {
      console.warn("[LocationPlateStudio] Generation notice:", err);
      setErrorMsg(err?.message || "Set plate generation failed. You can upload an image instead.");
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
        setPlateUrl(ev.target.result);
        setSuccessMsg("Image loaded. Click Save Set Plate to upload to Cloud Storage.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!activeBrandId || !isUuid(activeBrandId)) {
      setErrorMsg("Save failed: No valid UUID brand workspace ID found.");
      return;
    }

    if (!plateUrl) {
      setErrorMsg("Please generate or upload a set plate image before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const { uploadLocationPlateToStorage, persistBrandUpdate } = await import("../../backend/workspaceSync");
      let durableUrl = plateUrl;

      if (plateUrl.startsWith("data:") || plateUrl.startsWith("blob:")) {
        durableUrl = await uploadLocationPlateToStorage(activeBrandId, plateUrl);
      }

      if (updateBrand) {
        updateBrand({ locationPlateUrl: durableUrl });
      }

      await persistBrandUpdate(activeBrandId, {
        locationPlateUrl: durableUrl,
        settings: {
          locationPlateUrl: durableUrl,
          location_plate_url: durableUrl,
        },
      });

      setSuccessMsg("Locked set plate saved to workspace!");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("[LocationPlateStudio] Save error:", err);
      setErrorMsg(err?.message || "Failed to persist set plate to cloud storage.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!activeBrandId || !isUuid(activeBrandId)) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const { persistBrandUpdate } = await import("../../backend/workspaceSync");
      if (updateBrand) {
        updateBrand({ locationPlateUrl: null });
      }
      await persistBrandUpdate(activeBrandId, {
        locationPlateUrl: null,
        settings: {
          locationPlateUrl: null,
          location_plate_url: null,
        },
      });
      setPlateUrl("");
      setSuccessMsg("Set plate removed. Productions will use dynamic text prompts.");
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error("[LocationPlateStudio] Remove error:", err);
      setErrorMsg(err?.message || "Failed to remove set plate.");
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
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Locked Set & Location Plate</h2>
              <p className="text-xs text-muted-foreground">
                Establish an empty room/studio plate to enforce scene environment continuity across productions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
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
            {/* Left: Plate Preview & Upload */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Set Plate Preview ({aspectRatio})</span>
                {plateUrl && (
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                )}
              </label>

              <div
                className="relative aspect-video rounded-xl bg-background border border-border/70 overflow-hidden flex items-center justify-center group"
                style={{ aspectRatio: aspectRatio === "16:9" ? "16/9" : "9/16", maxHeight: "280px" }}
              >
                {plateUrl ? (
                  <>
                    <img src={plateUrl} alt="Location Plate" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setLightboxOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold flex items-center gap-1 hover:bg-black/80"
                      >
                        <Eye className="w-3.5 h-3.5" /> Full View
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-muted-foreground mb-1">No set plate locked</p>
                    <p className="text-[11px] text-muted-foreground/60">Generate or upload an empty establishing frame</p>
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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-foreground cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-400" /> Upload Image
                </button>
                {plateUrl && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={isSaving}
                    className="px-3 py-2.5 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-xs font-semibold text-destructive flex items-center justify-center gap-1 transition-all cursor-pointer"
                    title="Remove set plate"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Studio Prompt & Generator Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Visual Style / Genre</label>
                <select
                  value={styleGenre}
                  onChange={(e) => setStyleGenre(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:border-purple-500"
                >
                  <option value="Cinematic / Realistic">Cinematic / Realistic</option>
                  <option value="Anime / Cel-Shaded Studio">Anime / Cel-Shaded Studio</option>
                  <option value="Modern Tech Executive Loft">Modern Tech Executive Loft</option>
                  <option value="Minimalist Architectural Studio">Minimalist Architectural Studio</option>
                  <option value="Moody Film Noir Studio">Moody Film Noir Studio</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Environment & Lighting</label>
                <textarea
                  value={envDescription}
                  onChange={(e) => setEnvDescription(e.target.value)}
                  rows={3}
                  placeholder="Architectural studio details, backdrop, ambient lighting..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200/90 leading-relaxed">
                <p className="font-semibold text-purple-300 mb-0.5">Environment Lock Law</p>
                Set plates contain zero human characters. Stills with subject "set" reuse this plate directly; host beats use the plate as set reference while preserving identity from the character sheet.
              </div>

              <button
                type="button"
                onClick={handleGeneratePlate}
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating Set Plate…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Generate Establishing Set Plate
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
            className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !plateUrl || plateUrl === currentPlateUrl}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-purple-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save Set Plate"
            )}
          </button>
        </div>
      </div>

      <CharacterSheetLightbox
        isOpen={lightboxOpen}
        imageUrl={plateUrl}
        onClose={() => setLightboxOpen(false)}
        characterName="Locked Set Plate"
        brandName={brand?.name || "SPARK"}
      />
    </div>
  );
};
