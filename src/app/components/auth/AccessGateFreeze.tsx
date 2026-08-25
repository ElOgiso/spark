import React from "react";
import { MainLogoAnimated } from "../ui/SparkAnimatedLogo";
import { LogOut } from "lucide-react";

interface AccessGateFreezeProps {
  status?: "pending_approval" | "active" | "banned" | "rejected" | string | null;
  onSignOut?: () => void;
}

export function AccessGateFreeze({ status = "pending_approval", onSignOut }: AccessGateFreezeProps) {
  const isBanned = status === "banned";
  const isRejected = status === "rejected";

  return (
    <div className="fixed inset-0 z-[9999] h-screen w-screen bg-[#0B0F17] flex flex-col items-center justify-center p-6 select-none overflow-hidden antialiased">
      {/* Background ambient lighting */}
      <div className="absolute w-96 h-96 rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      {/* Center freeze content */}
      <div className="relative z-10 flex flex-col items-center text-center gap-6 max-w-sm animate-in fade-in duration-500">
        <MainLogoAnimated size={96} />

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-widest text-purple-200/90 uppercase animate-pulse">
            Looking for your spark…
          </p>

          <p className="text-xs text-muted-foreground/75 font-normal tracking-wide">
            {isBanned
              ? "This spark is unavailable."
              : isRejected
              ? "Workspace review declined."
              : "Your workspace is being reviewed."}
          </p>
        </div>
      </div>

      {/* Discreet sign out option */}
      {onSignOut && (
        <div className="absolute bottom-8 z-20 flex items-center justify-center">
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
