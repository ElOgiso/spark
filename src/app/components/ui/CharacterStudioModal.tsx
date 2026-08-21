import React, { useState, useRef } from "react";
import { X, Sparkles, Upload, Download, RefreshCw, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { useSpark } from "../../state/SparkContext";
import { isUuid } from "../../backend/mappers/workspaceMappers";
import { getBrandWorkspaceId } from "../../services/socialIntegrationService";
import { CharacterSheetLightbox } from "../onboarding/CharacterSheetLightbox";

interface CharacterStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CharacterStudioModal: React.FC<CharacterStudioModalProps> = ({ isOpen, onClose }) => {
  const auth = useAuth();
  const { character, brand, setState } = useSpark() as any;

  const [creatorName, setCreatorName] = useState(character?.name || "Lead Host");
  const [styleGenre, setStyleGenre] = useState("Realistic Executive");
  const [wardrobe, setWardrobe] = useState("Executive Tailored Suit");
  const [personality, setPersonality] = useState(character?.traits?.[0] || "Authoritative & Visionary");
  const [directorNotes, setDirectorNotes] = useState(character?.style || "Executive digital presenter in modern high-contrast studio setting");

  const [sheetUrl, setSheetUrl] = useState<string>(
    character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl || ""
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeBrandId = auth.brand?.id || getBrandWorkspaceId();

  const handleGenerateSheet = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const prompt = `Production Character Design Bible Reference Sheet for "${creatorName}" representing brand "${brand?.name || "SPARK"}", niche: "${brand?.niche || "Executive Media"}".
Visual Style / Genre: ${styleGenre}.
Signature Wardrobe: ${wardrobe}.
Personality & Emotion: ${personality}.
Director Notes & Persona: ${directorNotes}.

LAYOUT & COMPOSITION (One unified master model sheet / production bible grid):
1. TOP TITLE BLOCK: "${creatorName}" - Production Model Bible, Style: ${styleGenre}.
2. FULL-BODY TURNAROUND MODEL ROW: 4 distinct full-body views (Full Front Standing Pose, 3/4 Dynamic Angle, Side Profile, and Back View) in matching signature wardrobe under neutral key studio lighting.
3. EXPRESSION PALETTE GRID: 4 to 6 facial emotion crops (${personality}).
4. COLOR PALETTE SWATCH STRIP: 5 exact hex color swatches defining wardrobe accents, skin tone, hair tint, and set tone.

AESTHETICS: Masterclass character turnaround sheet, ultra-crisp studio lighting, high consistency, professional animation and visual development standard, photorealistic 8k detail.`;

    try {
      const { ModelRouter } = await import("../../services/runtime/modelRouter");
      const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
        prompt,
        capability: "Image Generation",
      });

      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        setSheetUrl(imgUrl);
        setSuccessMsg("New character sheet generated! Review and click Save to update your profile.");
      } else {
        setErrorMsg("Character sheet generation returned no image. Please retry.");
      }
    } catch (err: any) {
      console.warn("[CharacterStudioModal] Generation notice:", err);
      setErrorMsg(err?.message || "Character sheet generation failed. Try uploading a reference image.");
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
        setSuccessMsg("Image loaded. Click Save Character Identity to store to Cloud Storage.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!activeBrandId || !isUuid(activeBrandId)) {
      setErrorMsg("Save failed: No valid UUID brand workspace ID found. Please log in or re-initialize brand.");
      return;
    }

    if (!sheetUrl) {
      setErrorMsg("Please generate or upload a character sheet image before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { uploadCharacterSheetToStorage, persistCharacterUpdate } = await import("../../backend/workspaceSync");
      const durableUrl = await uploadCharacterSheetToStorage(activeBrandId, sheetUrl);

      const traitsArr = personality
        .split(/[,&]/)
        .map((t: string) => t.trim())
        .filter(Boolean);

      const updatedCharacterObj = {
        name: creatorName,
        role: character?.role || "Lead Presenter",
        style: `${styleGenre} — ${creatorName}`,
        avatarUrl: durableUrl,
        imageUrl: durableUrl,
        characterSheetUrl: durableUrl,
        traits: traitsArr.length > 0 ? traitsArr : ["Authoritative", "Visionary"],
        voice: character?.voice || {
          name: "Spark_Executive_Female",
          language: "English",
          tone: "Authoritative",
          locked: true,
          voiceId: "21m00Tcm4TlvDq8ikWAM",
          description: "Clear executive narrator voice",
        },
      };

      await persistCharacterUpdate(activeBrandId, updatedCharacterObj);

      setState((prev: any) => ({
        ...prev,
        character: {
          ...prev.character,
          ...updatedCharacterObj,
        },
      }));

      setSuccessMsg("Character sheet saved & uploaded to Supabase Storage!");
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.warn("[CharacterStudioModal] Save error:", err);
      setErrorMsg(err?.message || "Failed to save character profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!sheetUrl) return;
    const a = document.createElement("a");
    a.href = sheetUrl;
    a.download = `${creatorName.toLowerCase().replace(/\s+/g, "_")}_character_sheet.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
        <div className="w-full max-w-2xl bg-[#0B0F17] border border-white/10 rounded-2xl p-5 sm:p-7 space-y-5 my-auto shadow-2xl animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">Character Studio</h2>
                <p className="text-xs text-muted-foreground">Customize & generate host visual identity</p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-success/15 border border-success/30 text-xs text-success flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Body content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Sheet Preview Box */}
            <div className="space-y-3">
              <div className="relative aspect-square w-full rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden flex items-center justify-center group">
                {sheetUrl ? (
                  <>
                    <img src={sheetUrl} alt="Character Model Sheet" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Full Zoom
                      </button>
                      <button
                        type="button"
                        onClick={handleExport}
                        className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Export
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 space-y-2">
                    <Sparkles className="w-8 h-8 text-purple-400/50 mx-auto" />
                    <p className="text-xs text-muted-foreground">No character sheet generated yet.</p>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateSheet}
                  disabled={isGenerating}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                  {isGenerating ? "Generating Sheet..." : "Regenerate Sheet"}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Upload image from disk"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Upload</span>
                </button>
              </div>
            </div>

            {/* Prompt Identity Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">Host / Character Name</label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  className="w-full mt-1 bg-white/[0.03] text-foreground border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">Visual Style & Genre</label>
                <input
                  type="text"
                  value={styleGenre}
                  onChange={(e) => setStyleGenre(e.target.value)}
                  className="w-full mt-1 bg-white/[0.03] text-foreground border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">Signature Wardrobe</label>
                <input
                  type="text"
                  value={wardrobe}
                  onChange={(e) => setWardrobe(e.target.value)}
                  className="w-full mt-1 bg-white/[0.03] text-foreground border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">Personality & Traits</label>
                <input
                  type="text"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  className="w-full mt-1 bg-white/[0.03] text-foreground border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">Director Notes</label>
                <textarea
                  rows={2}
                  value={directorNotes}
                  onChange={(e) => setDirectorNotes(e.target.value)}
                  className="w-full mt-1 bg-white/[0.03] text-foreground border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Save Controls */}
          <div className="pt-4 border-t border-white/10 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-semibold text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            >
              {isSaving ? "Saving to Cloud Storage..." : "Save Character Identity"}
            </button>
          </div>
        </div>
      </div>

      <CharacterSheetLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={sheetUrl}
        characterName={creatorName}
        brandName={brand?.name || "SPARK"}
      />
    </>
  );
};
