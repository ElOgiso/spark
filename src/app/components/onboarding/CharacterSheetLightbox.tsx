import React, { useEffect } from "react";
import { X, Download, Sparkles } from "lucide-react";

interface CharacterSheetLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  characterName?: string;
  brandName?: string;
  metadata?: {
    genre?: string;
    wardrobe?: string;
    personality?: string;
    skinTone?: string;
    hairStyle?: string;
    style?: string;
  };
}

export const CharacterSheetLightbox: React.FC<CharacterSheetLightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  characterName = "Lead Host",
  brandName = "SPARK",
  metadata,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!imageUrl) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in fade-in duration-200">
        <div className="max-w-sm w-full bg-[#0B0F17] border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Character sheet not available</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No character sheet image was found for {characterName}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `${characterName.toLowerCase().replace(/\s+/g, "_")}_model_sheet.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 bg-[#0B0F17]/80 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
              {characterName} • Character Design Bible
            </h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {brandName} Production Reference Sheet
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download Reference Sheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-muted-foreground hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Metadata Badges Bar */}
      {metadata && (
        <div className="flex items-center gap-2 px-4 py-2 sm:px-6 bg-white/[0.02] border-b border-white/5 overflow-x-auto text-[11px] flex-shrink-0 no-scrollbar">
          {metadata.genre && (
            <span className="px-2.5 py-0.5 rounded-full bg-purple-600/20 border border-purple-500/40 text-purple-300 font-medium whitespace-nowrap">
              Genre: {metadata.genre}
            </span>
          )}
          {metadata.personality && (
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 font-medium whitespace-nowrap">
              Vibe: {metadata.personality}
            </span>
          )}
          {metadata.wardrobe && (
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-medium whitespace-nowrap">
              Wardrobe: {metadata.wardrobe}
            </span>
          )}
          {metadata.hairStyle && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-medium whitespace-nowrap">
              Hair: {metadata.hairStyle}
            </span>
          )}
          {metadata.skinTone && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-300 font-medium whitespace-nowrap">
              Tone: {metadata.skinTone}
            </span>
          )}
        </div>
      )}

      {/* Main Image Viewport */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-3 sm:p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <img
            src={imageUrl}
            alt={`${characterName} Character Reference Sheet`}
            className="max-w-full max-h-[calc(100dvh-130px)] object-contain rounded-xl shadow-2xl border border-purple-500/30"
          />
        </div>
      </div>

      {/* Footer helper */}
      <div className="py-2 text-center text-[10px] text-muted-foreground/60 bg-[#0B0F17]/60 border-t border-white/5 flex-shrink-0">
        Tap outside or press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono text-[9px]">Esc</kbd> to return to setup
      </div>
    </div>
  );
};
