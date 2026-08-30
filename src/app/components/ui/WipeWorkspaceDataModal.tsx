import React, { useState, useEffect } from "react";
import { SparkLogo } from "../SparkLogo";
import { X, RotateCcw } from "lucide-react";

interface WipeWorkspaceDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean | void>;
  brandName?: string;
}

export function WipeWorkspaceDataModal({
  isOpen,
  onClose,
  onConfirm,
  brandName,
}: WipeWorkspaceDataModalProps) {
  const [step, setStep] = useState<"confirm_input" | "final_match" | "wiping">("confirm_input");
  const [confirmInput, setConfirmInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setStep("confirm_input");
      setConfirmInput("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isWipeMatched = confirmInput.trim().toLowerCase() === "wipe";

  const handleWipe = async () => {
    setStep("wiping");
    try {
      await onConfirm();
      // Brief visual pause to show the superspark overlay feedback cleanly
      await new Promise((resolve) => setTimeout(resolve, 1400));
      onClose();
    } catch (err) {
      console.error("[WipeWorkspaceDataModal] Error wiping workspace learning data:", err);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Onboard sheet container */}
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0B0F17] text-white p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Step 3: Brief Superspark Overlay on Confirm */}
        {step === "wiping" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in fade-in duration-300">
            <style>{`
              @keyframes supersparkGlow {
                0% {
                  transform: scale(0.95);
                  opacity: 0.8;
                  filter: drop-shadow(0 0 15px rgba(245, 43, 255, 0.6));
                }
                50% {
                  transform: scale(1.08);
                  opacity: 1;
                  filter: drop-shadow(0 0 35px rgba(245, 43, 255, 0.95));
                }
                100% {
                  transform: scale(1);
                  opacity: 0.9;
                  filter: drop-shadow(0 0 20px rgba(245, 43, 255, 0.7));
                }
              }

              .animate-superspark-glow {
                animation: supersparkGlow 1.4s ease-in-out infinite;
              }
            `}</style>

            <div className="relative flex items-center justify-center w-24 h-24 my-2">
              <SparkLogo variant="superspark" className="w-16 h-16 animate-superspark-glow" />
            </div>

            <div className="space-y-2">
              <p className="text-base font-semibold text-white tracking-wide">Resetting research brain…</p>
              <p className="text-xs text-white/50">SPARK will learn again from new sources</p>
            </div>
          </div>
        )}

        {/* Step 1: Confirm Typed Input ("WIPE") */}
        {step === "confirm_input" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SparkLogo variant="superspark" className="w-7 h-7" />
                <span className="text-xs font-mono font-semibold tracking-wider text-white/70 uppercase">
                  Workspace Memory
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white tracking-tight">
                Wipe learned data for this workspace?
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Viral Sparks, sources, and memory reset. Character and videos are kept.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-white/60 block">
                Type <span className="text-[#F52BFF] font-bold">WIPE</span> to enable
              </label>
              <input
                type="text"
                autoFocus
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isWipeMatched) {
                    setStep("final_match");
                  }
                }}
                placeholder="WIPE"
                className="w-full px-4 py-2.5 rounded-xl bg-[#070A0F] border border-white/15 text-sm font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-[#F52BFF] focus:ring-1 focus:ring-[#F52BFF] transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-white/70 hover:text-white border border-white/15 hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isWipeMatched}
                onClick={() => setStep("final_match")}
                className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-[#F52BFF] hover:bg-[#F52BFF]/90 shadow-lg shadow-[#F52BFF]/25 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation After Match */}
        {step === "final_match" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[#F52BFF]">
                <RotateCcw className="w-5 h-5" />
                <span className="text-xs font-mono font-bold tracking-wider uppercase">Fresh Research Brain</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white tracking-tight">
                SPARK will learn again from new sources.
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Clears Viral Sparks, inspiration sources, and learned memory. {brandName ? `${brandName} brand` : "Brand"}, character profile, and finished productions stay.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F52BFF]/10 border border-[#F52BFF]/20 text-xs text-white/90 space-y-1">
              <p className="font-semibold text-white">Learning Reset</p>
              <p className="text-[11px] text-white/70">
                You can add fresh research links and inspirations anytime in My Spark to train new viral angles.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-full text-xs font-semibold text-white/90 hover:text-white border border-white/20 hover:bg-white/10 transition-all text-center cursor-pointer"
              >
                Keep data
              </button>
              <button
                type="button"
                onClick={handleWipe}
                className="flex-1 py-3 rounded-full text-xs font-semibold text-white bg-[#F52BFF] hover:bg-[#F52BFF]/90 shadow-xl shadow-[#F52BFF]/30 active:scale-[0.98] transition-all text-center cursor-pointer"
              >
                Wipe now
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
