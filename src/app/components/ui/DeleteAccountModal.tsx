import React, { useState, useEffect } from "react";
import { SparkLogo } from "../SparkLogo";
import { useAuth } from "../../state/AuthContext";
import { deleteUserAccount } from "../../backend/workspaceSync";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const auth = useAuth();
  const [step, setStep] = useState<"confirm_input" | "final_warning" | "disintegrating">("confirm_input");
  const [confirmInput, setConfirmInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("confirm_input");
      setConfirmInput("");
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDeleteMatched = confirmInput.trim().toLowerCase() === "delete";

  const handleDeleteForever = async () => {
    setStep("disintegrating");
    setStatusMessage("Closing your SPARK…");

    const targetUserId = auth.currentUser?.id || auth.profile?.id;

    try {
      if (targetUserId) {
        const result = await deleteUserAccount(targetUserId);
        if (result.message && !result.message.includes("permanently deleted")) {
          console.log("[DeleteAccountModal] Delete result:", result.message);
        }
      }

      // Allow the particle disintegration animation to play smoothly
      await new Promise((resolve) => setTimeout(resolve, 2400));

      // Sign out and hard reset
      await auth.signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (err) {
      console.error("[DeleteAccountModal] Error during account destruction:", err);
      try {
        await auth.signOut();
      } catch {}
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Onboard sheet container */}
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0B0F17] text-white p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Step 3: Disintegration Overlay */}
        {step === "disintegrating" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in fade-in duration-300">
            <style>{`
              @keyframes sparkDisintegrate {
                0% {
                  transform: scale(1) rotate(0deg);
                  opacity: 1;
                  filter: drop-shadow(0 0 15px rgba(245, 43, 255, 0.9)) blur(0px);
                }
                40% {
                  transform: scale(1.18) rotate(12deg);
                  opacity: 0.9;
                  filter: drop-shadow(0 0 35px rgba(245, 43, 255, 1)) blur(1px);
                }
                75% {
                  transform: scale(0.65) rotate(35deg);
                  opacity: 0.45;
                  filter: drop-shadow(0 0 45px rgba(245, 43, 255, 0.6)) blur(6px);
                }
                100% {
                  transform: scale(0.1) rotate(60deg);
                  opacity: 0;
                  filter: drop-shadow(0 0 0px rgba(245, 43, 255, 0)) blur(16px);
                }
              }

              @keyframes particleOutward {
                0% {
                  transform: translate(0, 0) scale(1);
                  opacity: 0.9;
                }
                100% {
                  transform: translate(var(--tx), var(--ty)) scale(0);
                  opacity: 0;
                }
              }

              .animate-disintegrate {
                animation: sparkDisintegrate 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
              }

              .particle-dot {
                position: absolute;
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: #F52BFF;
                box-shadow: 0 0 8px #FFA6FF;
                animation: particleOutward 1.8s ease-out forwards;
              }
            `}</style>

            <div className="relative flex items-center justify-center w-24 h-24 my-4">
              <SparkLogo variant="superspark" className="w-16 h-16 animate-disintegrate" />
              {/* Particle dust */}
              {[...Array(12)].map((_, i) => {
                const angle = (i * 360) / 12;
                const distance = 40 + (i % 3) * 20;
                const tx = `${Math.cos((angle * Math.PI) / 180) * distance}px`;
                const ty = `${Math.sin((angle * Math.PI) / 180) * distance}px`;
                return (
                  <span
                    key={i}
                    className="particle-dot"
                    style={
                      {
                        "--tx": tx,
                        "--ty": ty,
                        animationDelay: `${0.2 + (i % 4) * 0.15}s`,
                      } as React.CSSProperties
                    }
                  />
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-base font-semibold text-white tracking-wide">{statusMessage || "Closing your SPARK…"}</p>
              <p className="text-xs text-white/50">Wiping secure cloud data & credentials</p>
            </div>
          </div>
        )}

        {/* Step 1: Confirm Typed Input */}
        {step === "confirm_input" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SparkLogo variant="superspark" className="w-7 h-7" />
                <span className="text-xs font-mono font-semibold tracking-wider text-white/70 uppercase">
                  Account Management
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
              <h2 className="text-xl font-semibold text-white tracking-tight">Delete this SPARK account?</h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Removes this login and all associated SPARK workspace data, productions, characters, and memory.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-white/60 block">
                Type <span className="text-destructive font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                autoFocus
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isDeleteMatched) {
                    setStep("final_warning");
                  }
                }}
                placeholder="DELETE"
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
                disabled={!isDeleteMatched}
                onClick={() => setStep("final_warning")}
                className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Final Warning Beat */}
        {step === "final_warning" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-xs font-mono font-bold tracking-wider uppercase">Permanent Action</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white tracking-tight">This cannot be undone.</h2>
              <p className="text-xs text-white/70 leading-relaxed">
                All productions, generated video masters, voice profiles, connected accounts, and executive memory will be permanently removed.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive-foreground/90 space-y-1">
              <p className="font-semibold text-white">Your access will be immediately terminated.</p>
              <p className="text-[11px] text-white/70">You will be signed out and returned to the SPARK login screen.</p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-full text-xs font-semibold text-white/90 hover:text-white border border-white/20 hover:bg-white/10 transition-all text-center cursor-pointer"
              >
                Keep account
              </button>
              <button
                type="button"
                onClick={handleDeleteForever}
                className="flex-1 py-3 rounded-full text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/30 active:scale-[0.98] transition-all text-center cursor-pointer"
              >
                Delete forever
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
