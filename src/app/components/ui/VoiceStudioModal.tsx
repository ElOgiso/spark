import React, { useState, useEffect } from "react";
import { X, Mic, Play, Pause, Download, Check, Sparkles, CheckCircle2, AlertCircle, Volume2, Wand2 } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { useSpark } from "../../state/SparkContext";
import { isUuid } from "../../backend/mappers/workspaceMappers";
import { getBrandWorkspaceId } from "../../services/socialIntegrationService";
import {
  FALLBACK_CURATED_ELEVENLABS_VOICES,
  ElevenLabsVoiceSummary,
  getElevenLabsVoices,
  generateElevenLabsVoice,
  designElevenLabsVoice,
  createDesignedElevenLabsVoice,
} from "../../services/runtime/providers/elevenLabsTTS";

interface VoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceStudioModal: React.FC<VoiceStudioModalProps> = ({ isOpen, onClose }) => {
  const auth = useAuth();
  const { character, brand, setState } = useSpark() as any;

  const [voicesList, setVoicesList] = useState<ElevenLabsVoiceSummary[]>(FALLBACK_CURATED_ELEVENLABS_VOICES);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(
    character?.voice?.voiceId || "21m00Tcm4TlvDq8ikWAM"
  );
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(
    character?.voice?.name || "Rachel"
  );

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [customDescription, setCustomDescription] = useState("");
  const [isDesigningVoice, setIsDesigningVoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sampleAudioUrl, setSampleAudioUrl] = useState<string | null>(null);

  const activeBrandId = auth.brand?.id || getBrandWorkspaceId();

  const stopAudio = () => {
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {}
      setActiveAudio(null);
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setPlayingVoiceId(null);
  };

  useEffect(() => {
    if (isOpen) {
      void getElevenLabsVoices().then((res) => {
        const fetched = res?.voices || [];
        setVoicesList((prev) => {
          const list = fetched.length > 0 ? fetched : prev;
          const existingIds = new Set(list.map((v) => v.voiceId));
          // Inject active saved character voice if not present
          if (character?.voice?.voiceId && !existingIds.has(character.voice.voiceId)) {
            list.unshift({
              voiceId: character.voice.voiceId,
              name: character.voice.name || "Saved Custom Voice",
              category: "saved",
              accent: character.voice.tone || "Custom Brand Voice",
              previewUrl: character.voice.previewUrl,
            });
          }
          return list;
        });
      });
    } else {
      stopAudio();
    }
  }, [isOpen, character?.voice?.voiceId]);

  const handlePlayVoice = async (voiceObj: ElevenLabsVoiceSummary) => {
    if (playingVoiceId === voiceObj.voiceId) {
      stopAudio();
      return;
    }

    stopAudio();
    setPlayingVoiceId(voiceObj.voiceId);
    setErrorMsg(null);

    try {
      if (voiceObj.previewUrl) {
        const audio = new Audio(voiceObj.previewUrl);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
        setActiveAudio(audio);
        setSampleAudioUrl(voiceObj.previewUrl);
        await audio.play();
        return;
      }

      const text = `Welcome to ${brand?.name || "SPARK Media OS"}. This is ${voiceObj.name} presenting live voice synthesis.`;
      const synthesizedUrl = await generateElevenLabsVoice(text, voiceObj.voiceId);

      if (synthesizedUrl) {
        const audio = new Audio(synthesizedUrl);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
        setActiveAudio(audio);
        setSampleAudioUrl(synthesizedUrl);
        await audio.play();
      } else {
        setErrorMsg(`ElevenLabs voice preview failed for "${voiceObj.name}". Please check ElevenLabs API key or select a curated voice.`);
        setPlayingVoiceId(null);
      }
    } catch (err: any) {
      console.warn("[VoiceStudioModal] Play error:", err);
      setErrorMsg(`Voice preview error: ${err?.message || "Generation failed"}`);
      setPlayingVoiceId(null);
    }
  };

  const handleDesignVoice = async () => {
    if (!customDescription.trim()) {
      setErrorMsg("Please enter a description for your custom voice identity.");
      return;
    }

    setIsDesigningVoice(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const designRes = await designElevenLabsVoice({
        description: customDescription,
        sampleText: `Welcome to ${brand?.name || "SPARK"}. Here is your custom brand voice.`,
      });

      if (designRes && designRes.previews && designRes.previews.length > 0) {
        const first = designRes.previews[0];
        const newVoiceName = `Custom ${customDescription.slice(0, 16)}...`;

        const created = await createDesignedElevenLabsVoice({
          voiceName: newVoiceName,
          voiceDescription: customDescription,
          generatedVoiceId: first.generated_voice_id,
        });

        const finalVoiceId = created?.voice_id || first.generated_voice_id;

        const newVoiceObj: ElevenLabsVoiceSummary = {
          voiceId: finalVoiceId,
          name: newVoiceName,
          category: "custom",
          description: customDescription,
          accent: "Custom AI Designed",
          previewUrl: first.previewUrl,
        };

        setVoicesList((prev) => [newVoiceObj, ...prev]);
        setSelectedVoiceId(finalVoiceId);
        setSelectedVoiceName(newVoiceName);
        setSuccessMsg(`Custom voice designed and created successfully!`);
        setCustomDescription("");
      } else {
        setErrorMsg("Voice design returned no preview audio. Check ElevenLabs API key.");
      }
    } catch (err: any) {
      console.warn("[VoiceStudioModal] Design voice error:", err);
      setErrorMsg(err?.message || "Custom voice design failed.");
    } finally {
      setIsDesigningVoice(false);
    }
  };

  const handleSave = async () => {
    if (!activeBrandId || !isUuid(activeBrandId)) {
      setErrorMsg("Save failed: No valid UUID brand workspace ID found. Please log in or re-initialize brand.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { persistCharacterUpdate, uploadVoicePreviewToStorage } = await import("../../backend/workspaceSync");

      let finalPreviewUrl: string | null = selectedVoiceObj?.previewUrl || character?.voice?.previewUrl || null;
      if (sampleAudioUrl) {
        try {
          finalPreviewUrl = await uploadVoicePreviewToStorage(activeBrandId, sampleAudioUrl);
        } catch (upErr) {
          console.warn("[VoiceStudioModal] Preview upload notice:", upErr);
        }
      }

      const voiceData = {
        voiceId: selectedVoiceId,
        name: selectedVoiceName,
        language: "English",
        tone: selectedVoiceObj?.accent || "Authoritative & Clear",
        description: selectedVoiceObj?.description || "Production narrator voice",
        locked: true,
        previewUrl: finalPreviewUrl,
      };

      const updatedCharacterObj = {
        name: character?.name || "Lead Host",
        role: character?.role || "Lead Presenter",
        style: character?.style || "Executive Digital Host",
        avatarUrl: character?.avatarUrl || null,
        imageUrl: character?.imageUrl || null,
        characterSheetUrl: character?.characterSheetUrl || null,
        traits: character?.traits || ["Authoritative", "Visionary"],
        voice: voiceData,
      };

      await persistCharacterUpdate(activeBrandId, updatedCharacterObj);

      setState((prev: any) => ({
        ...prev,
        character: {
          ...prev.character,
          voice: voiceData,
        },
      }));

      setSuccessMsg("Voice identity saved & persisted to Supabase!");
      setTimeout(() => {
        stopAudio();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.warn("[VoiceStudioModal] Save error:", err);
      setErrorMsg(err?.message || "Failed to save voice identity.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAudio = () => {
    if (!sampleAudioUrl) {
      setErrorMsg("Please preview a voice first to generate audio export.");
      return;
    }
    const a = document.createElement("a");
    a.href = sampleAudioUrl;
    a.download = `${selectedVoiceName.toLowerCase().replace(/\s+/g, "_")}_voice_preview.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
      <div className="w-full max-w-xl bg-[#0B0F17] border border-white/10 rounded-2xl p-5 sm:p-7 space-y-5 my-auto shadow-2xl animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Voice Studio</h2>
              <p className="text-xs text-muted-foreground">Select or design brand narrator voice</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
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

        {/* Voice Selection List */}
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 no-scrollbar">
          {voicesList.map((v) => {
            const isSelected = selectedVoiceId === v.voiceId;
            const isPlaying = playingVoiceId === v.voiceId;

            return (
              <div
                key={v.voiceId}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  isSelected ? "bg-purple-600/20 border-purple-500/50" : "bg-white/[0.03] border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handlePlayVoice(v)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
                  title="Preview Voice"
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-purple-300 animate-pulse" /> : <Play className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold truncate ${isSelected ? "text-purple-200" : "text-foreground"}`}>
                      {v.name}
                    </p>
                    {v.accent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground truncate">
                        {v.accent}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {v.description || "Production narrator voice"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedVoiceId(v.voiceId);
                    setSelectedVoiceName(v.name);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                    isSelected ? "bg-purple-600 text-white" : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                  }`}
                >
                  {isSelected ? <Check className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isSelected ? "Selected" : "Select"}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Custom Voice Generator Section */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Wand2 className="w-4 h-4 text-purple-400" />
            <span>Design Custom ElevenLabs Voice</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="e.g. Deep male tech presenter with warm authority..."
              className="flex-1 bg-white/[0.03] text-foreground border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleDesignVoice}
              disabled={isDesigningVoice}
              className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isDesigningVoice ? "animate-spin" : ""}`} />
              <span>{isDesigningVoice ? "Designing..." : "Design"}</span>
            </button>
          </div>
        </div>

        {/* Export & Footer Controls */}
        <div className="pt-3 border-t border-white/10 flex items-center gap-3">
          {sampleAudioUrl && (
            <button
              type="button"
              onClick={handleExportAudio}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              title="Export preview audio MP3"
            >
              <Download className="w-3.5 h-3.5 text-purple-300" />
              <span>Export MP3</span>
            </button>
          )}

          <div className="flex-1 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                stopAudio();
                onClose();
              }}
              className="px-4 py-3 rounded-xl border border-white/10 text-xs font-semibold text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            >
              {isSaving ? "Saving to Cloud..." : "Save Voice Identity"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
