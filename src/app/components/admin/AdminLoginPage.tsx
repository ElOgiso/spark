import React, { useState } from "react";
import { ShieldCheck, Lock, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { MainLogoAnimated } from "../ui/SparkAnimatedLogo";

export function AdminLoginPage({ onSuccess }: { onSuccess: (user: any) => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.signIn(email, password);
      // Verify user permissions
      if (!auth.isAdmin && (auth.profile?.role || "").toLowerCase() !== "admin") {
        setError("Access Denied. This account does not possess administrator privileges.");
        await auth.signOut();
        return;
      }
      onSuccess(auth.currentUser);
    } catch (err: any) {
      setError(err?.message || "Invalid administrative credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#07090E] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background Security Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />

      <div className="relative z-10 w-full max-w-md bg-[#0D121F]/90 border border-purple-500/20 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <MainLogoAnimated size={56} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-semibold tracking-wider uppercase mt-4 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Spark Operations
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Admin Console Access</h1>
          <p className="text-xs text-white/40 mt-1">Authorized personnel and executive staff only</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-300 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAdminSignIn} className="space-y-4">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-1.5">
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@spark.ai"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white font-semibold text-sm transition-all shadow-[0_0_24px_rgba(168,85,247,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {loading ? "Authenticating..." : "Enter Admin Console"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Creator Studio
          </a>
        </div>
      </div>
    </div>
  );
}
