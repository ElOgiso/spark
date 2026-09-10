import React, { useState, useEffect } from "react";
import { ShieldCheck, Lock, AlertCircle, ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { MainLogoAnimated } from "../ui/SparkAnimatedLogo";

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AdminLoginPage({ onSuccess }: { onSuccess: (user: any) => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-verify permissions when session becomes active on /admin
  useEffect(() => {
    if (auth.isAuthenticated && !auth.loading) {
      if (auth.isAdmin || (auth.profile?.role || "").toLowerCase() === "admin" || auth.isSuperAdmin) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("spark_admin_login_intent");
        }
        onSuccess(auth.currentUser);
      } else {
        setError(
          `Access Denied: The account "${auth.currentUser?.email || "Signed In User"}" is not registered as a SPARK Administrator.`
        );
      }
    }
  }, [auth.isAuthenticated, auth.loading, auth.isAdmin, auth.profile?.role, auth.isSuperAdmin, onSuccess]);

  const handleGoogleAdminSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("spark_admin_login_intent", "true");
      }
      const adminRedirect = typeof window !== "undefined" ? `${window.location.origin}/admin` : undefined;
      await auth.signInWithOAuth("google", adminRedirect);
    } catch (err: any) {
      setError(err?.message || "Google authentication failed.");
      setGoogleLoading(false);
    }
  };

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
        <div className="flex flex-col items-center text-center mb-6">
          <MainLogoAnimated size={56} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-semibold tracking-wider uppercase mt-4 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Spark Operations
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Admin Console Access</h1>
          <p className="text-xs text-white/40 mt-1">Authorized personnel and executive staff only</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-300 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {auth.isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void auth.signOut();
                }}
                className="self-start mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white text-[11px] font-medium transition-colors"
              >
                <LogOut className="w-3 h-3" /> Sign Out to Switch Account
              </button>
            )}
          </div>
        )}

        {/* Primary Action: Google Single Sign-On */}
        <div className="space-y-4 mb-6">
          <button
            type="button"
            onClick={handleGoogleAdminSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-gray-100 active:scale-[0.98] text-gray-900 font-semibold text-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <GoogleIcon className="w-4 h-4" />
            <span>{googleLoading ? "Connecting to Google..." : "Sign in with Google / Gmail"}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-[1px] bg-white/10" />
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">or email & password</span>
            <div className="flex-1 h-[1px] bg-white/10" />
          </div>
        </div>

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
            disabled={loading || googleLoading}
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
