import React from "react";
import { ShieldCheck, Inbox, ArrowRight, LogOut, Sparkles, LayoutDashboard } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { SparkLogo } from "../SparkLogo";

interface AdminPlaceholderPageProps {
  onNavigate?: (path: string) => void;
}

export function AdminPlaceholderPage({ onNavigate }: AdminPlaceholderPageProps) {
  const auth = useAuth();

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] text-white flex flex-col antialiased selection:bg-purple-500/30">
      {/* Admin Top Header */}
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <SparkLogo className="w-8 h-8" variant="superspark" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">SPARK</span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
              Admin Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white/80 font-medium">{auth.profile?.display_name || auth.currentUser?.email}</span>
            <span className="text-[10px] font-mono text-purple-300">({auth.role})</span>
          </div>
          <button
            onClick={() => onNavigate ? onNavigate("/") : (window.location.pathname = "/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Executive App</span>
          </button>
          <button
            onClick={() => void auth.signOut()}
            title="Sign out"
            className="p-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Admin Canvas */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 shadow-lg shadow-purple-900/30">
            <Inbox className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[11px] font-mono text-purple-300">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Identity Verified • Role: {auth.role}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Admin Operations</h1>
            <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto">
              Inbox coming next. Central moderation, multi-brand operations, system intelligence & executive support portal.
            </p>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
            <button
              onClick={() => onNavigate ? onNavigate("/") : (window.location.pathname = "/")}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
            >
              <span>Switch to Executive Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
