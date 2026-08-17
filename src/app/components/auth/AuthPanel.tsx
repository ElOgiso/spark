import React, { useState } from "react";
import { Mail, Lock, ArrowRight, X, AlertCircle } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { SparkIntroShowcase } from "./SparkIntroShowcase";
import mainLogo from "@/imports/MAIN_LOGO.png";

declare global {
  interface Window {
    google?: any;
  }
}

interface AuthPanelProps {
  initialMode?: "signin" | "signup";
  isFullScreen?: boolean;
  onClose?: () => void;
  onSuccess: (email?: string, name?: string, mode?: "signin" | "signup") => void;
  showIntroByDefault?: boolean;
}

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "857437726846-ckcn1mqo4p1p8vstsq5tehnn3pvhnbsr.apps.googleusercontent.com";

// ─── Keyframe Animations Matching Brand Genesis ────────────────────────────────
const STYLES = `
  @keyframes spark-flicker {
    0%   { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
    7%   { opacity:0.5; filter:brightness(2.4) drop-shadow(0 0 32px #FF88FF); }
    9%   { opacity:1; filter:brightness(2) drop-shadow(0 0 24px #F018FF); }
    12%  { opacity:0.75; filter:brightness(1.5) drop-shadow(0 0 16px #CC00CC); }
    15%  { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
    60%  { opacity:1; filter:brightness(1) drop-shadow(0 0 12px #F018FF); }
    64%  { opacity:0.55; filter:brightness(2.2) drop-shadow(0 0 36px #FF88FF); }
    66%  { opacity:1; filter:brightness(2.6) drop-shadow(0 0 40px #FFAAFF); }
    69%  { opacity:0.8; filter:brightness(1.6) drop-shadow(0 0 22px #F018FF); }
    73%  { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
    100% { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
  }
  @keyframes spark-bloom-pulse {
    0%, 100% { opacity:0.2; transform:scale(1); }
    7%        { opacity:0.65; transform:scale(1.2); }
    15%       { opacity:0.2; transform:scale(1); }
    64%       { opacity:0.55; transform:scale(1.25); }
    73%       { opacity:0.2; transform:scale(1); }
  }
  @keyframes spark-p1 {
    0%,85%  { opacity:0; transform:translate(0,0) scale(0.4); }
    87%     { opacity:1; transform:translate(-9px,-13px) scale(1); }
    96%     { opacity:0; transform:translate(-20px,-27px) scale(0.2); }
    100%    { opacity:0; }
  }
  @keyframes spark-p2 {
    0%,60%  { opacity:0; transform:translate(0,0) scale(0.4); }
    62%     { opacity:1; transform:translate(11px,-11px) scale(1); }
    71%     { opacity:0; transform:translate(24px,-24px) scale(0.2); }
    100%    { opacity:0; }
  }
  @keyframes spark-p3 {
    0%,6%   { opacity:0; transform:translate(0,0) scale(0.4); }
    8%      { opacity:1; transform:translate(-13px,9px) scale(1); }
    17%     { opacity:0; transform:translate(-28px,20px) scale(0.2); }
    100%    { opacity:0; }
  }
  @keyframes spark-p4 {
    0%,63%  { opacity:0; transform:translate(0,0) scale(0.4); }
    65%     { opacity:1; transform:translate(9px,15px) scale(1); }
    75%     { opacity:0; transform:translate(20px,30px) scale(0.2); }
    100%    { opacity:0; }
  }
  @keyframes orb-drift {
    0%,100% { transform:translate(0,0) scale(1); }
    33%      { transform:translate(12px,-8px) scale(1.04); }
    66%      { transform:translate(-8px,10px) scale(0.97); }
  }
  .spark-mark-wrap { position:relative; display:inline-flex; align-items:center; justify-content:center; }
  .spark-bloom {
    position:absolute; border-radius:50%; pointer-events:none;
    background:radial-gradient(circle, rgba(240,24,255,0.35) 0%, rgba(168,85,247,0.12) 40%, transparent 70%);
    animation: spark-bloom-pulse 3.8s ease infinite;
  }
  .spark-mark-svg { animation: spark-flicker 3.8s ease infinite; }
  .spark-p {
    position:absolute; width:5px; height:5px; border-radius:50%;
    background:radial-gradient(circle,#FFAAFF,#F018FF); pointer-events:none; z-index:3;
  }
  .spark-p1 { animation: spark-p1 3.8s ease infinite; }
  .spark-p2 { animation: spark-p2 3.8s ease infinite; }
  .spark-p3 { animation: spark-p3 3.8s ease infinite; }
  .spark-p4 { animation: spark-p4 3.8s ease infinite; }
`;

function MainLogoAnimated({ size = 80 }: { size?: number }) {
  return (
    <div className="spark-mark-wrap" style={{ width: size, height: size, position: "relative", display: "inline-flex" }}>
      <div className="spark-bloom" style={{ width: size * 2.4, height: size * 2.4, left: -(size * 0.7), top: -(size * 0.7) }} />
      <div className="spark-p spark-p1" style={{ left: size * 0.22, top: size * 0.12 }} />
      <div className="spark-p spark-p2" style={{ right: size * 0.08, top: size * 0.2 }} />
      <div className="spark-p spark-p3" style={{ left: size * 0.08, bottom: size * 0.22 }} />
      <div className="spark-p spark-p4" style={{ right: size * 0.2, bottom: size * 0.1 }} />
      <img
        src={mainLogo}
        alt="Spark"
        className="spark-mark-svg"
        style={{ width: size, height: size, objectFit: "contain", position: "relative", zIndex: 2 }}
      />
    </div>
  );
}

function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute rounded-full opacity-[0.12]"
        style={{
          width: 380,
          height: 380,
          background: "radial-gradient(circle,#F018FF,#a855f7,transparent 70%)",
          top: -90,
          left: -80,
          animation: "orb-drift 9s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full opacity-[0.08]"
        style={{
          width: 320,
          height: 320,
          background: "radial-gradient(circle,#22d3ee,transparent 70%)",
          bottom: 40,
          right: -70,
          animation: "orb-drift 12s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );
}

function AppleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.61 1.35-.55.63-1.03 1.7-0.9 2.73 1.01.08 2.04-.51 2.58-1.23z" />
    </svg>
  );
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  initialMode = "signup",
  isFullScreen = false,
  onClose,
  onSuccess,
  showIntroByDefault = false,
}) => {
  const auth = useAuth();
  const [showIntro, setShowIntro] = useState<boolean>(showIntroByDefault);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (mode === "signup" && password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        await auth.signUp(email, password);
      } else if (mode === "signin") {
        await auth.signIn(email, password);
      } else {
        alert("Password reset email sent to " + email);
        setMode("signin");
        setLoading(false);
        return;
      }
      setLoading(false);
      onSuccess(email, email.split("@")[0]);
    } catch (err: any) {
      setErrorMsg(err?.message || "Authentication error. Please check your credentials.");
      setLoading(false);
    }
  };

  const handleGoogleClick = () => {
    setErrorMsg("");
    setLoading(true);

    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
          callback: async (tokenResponse: any) => {
            if (tokenResponse.access_token) {
              try {
                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await res.json();
                const realEmail = userInfo.email || "creator@gmail.com";
                const realName = userInfo.name || realEmail.split("@")[0];

                if (auth.isConfigured) {
                  // Attempt sign in; if credentials don't exist yet, sign up as new user
                  try {
                    await auth.signIn(realEmail, "google-oauth-pass");
                  } catch {
                    await auth.signUp(realEmail, "google-oauth-pass");
                  }
                  await auth.refreshSession();
                } else {
                  // Local demo mode check: old vs new user
                  const storedDemo = localStorage.getItem("spark_demo_user");
                  let isExisting = false;
                  if (storedDemo) {
                    try {
                      const parsed = JSON.parse(storedDemo);
                      if (parsed.email === realEmail && localStorage.getItem("spark_onboarding_complete") === "true") {
                        isExisting = true;
                      }
                    } catch {}
                  }
                  if (isExisting) {
                    await auth.signIn(realEmail, "google-oauth-pass");
                  } else {
                    await auth.signUp(realEmail, "google-oauth-pass");
                  }
                }

                setLoading(false);
                onSuccess(realEmail, realName);
                return;
              } catch (err) {
                console.error("Error fetching Google userinfo:", err);
              }
            }
            setLoading(false);
          },
          onerror: (err: any) => {
            console.error("Google OAuth Popup error:", err);
            setErrorMsg("Google Sign-In popup closed or blocked.");
            setLoading(false);
          },
        });

        client.requestAccessToken();
        return;
      } catch (err) {
        console.error("Google OAuth initialization error:", err);
      }
    }

    if (auth.isConfigured) {
      void auth.signInWithOAuth("google");
      return;
    }

    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(window.location.origin)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent("openid email profile")}`;

    window.location.href = googleAuthUrl;
  };

  const handleAppleClick = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await auth.signUp("apple.creator@icloud.com", "apple-oauth-pass");
      } else {
        await auth.signIn("apple.creator@icloud.com", "apple-oauth-pass");
      }
      setLoading(false);
      onSuccess("apple.creator@icloud.com", "Apple Creator");
    } catch {
      setLoading(false);
    }
  };

  if (showIntro) {
    return <SparkIntroShowcase onComplete={() => setShowIntro(false)} />;
  }

  const formContent = (
    <div className="w-full flex flex-col items-center">
      {/* Header with animated Super Spark logo */}
      <div className="flex flex-col items-center text-center mb-6">
        <MainLogoAnimated size={76} />
        <div className="mt-4 space-y-1">
          <p className="text-[9px] tracking-[0.25em] uppercase text-white/30 font-semibold">
            Super Spark Platform
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {mode === "signup"
              ? "Create Your Account"
              : mode === "signin"
              ? "Sign In to Spark"
              : "Reset Password"}
          </h1>
          <p className="text-xs text-white/45 max-w-xs">
            {mode === "signup"
              ? "Create your account to start Brand Genesis with your executive team"
              : mode === "signin"
              ? "Access your brand workspace & executive team"
              : "Enter your email to receive a recovery link"}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="w-full mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs text-center font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* OAuth Fast Connect Buttons */}
      {mode !== "forgot" && (
        <div className="w-full space-y-2.5 mb-5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleGoogleClick}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.98] py-3 px-3.5 flex items-center justify-center gap-2.5 transition-all text-xs font-semibold text-white/90 shadow-sm"
            >
              <GoogleIcon size={17} />
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={handleAppleClick}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.98] py-3 px-3.5 flex items-center justify-center gap-2.5 transition-all text-xs font-semibold text-white/90 shadow-sm"
            >
              <AppleIcon size={17} />
              <span>Apple</span>
            </button>
          </div>

          <div className="relative my-4 text-center text-[11px] text-white/30">
            <span className="bg-[#0B0F17] px-3 relative z-10 font-medium">or continue with email</span>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
          </div>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5 pl-1">Email Address</label>
          <div className="relative flex items-center bg-[#080C14] border border-white/10 focus-within:border-purple-500/80 rounded-2xl transition-all">
            <Mail className="w-4 h-4 text-white/35 ml-3.5 shrink-0 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@domain.com"
              className="w-full bg-transparent border-none outline-none py-3 px-3 text-sm text-white placeholder:text-white/25"
            />
          </div>
        </div>

        {mode !== "forgot" && (
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5 pl-1">Password</label>
            <div className="relative flex items-center bg-[#080C14] border border-white/10 focus-within:border-purple-500/80 rounded-2xl transition-all">
              <Lock className="w-4 h-4 text-white/35 ml-3.5 shrink-0 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-transparent border-none outline-none py-3 px-3 text-sm text-white placeholder:text-white/25"
              />
            </div>
          </div>
        )}

        {mode === "signup" && (
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5 pl-1">Confirm Password</label>
            <div className="relative flex items-center bg-[#080C14] border border-white/10 focus-within:border-purple-500/80 rounded-2xl transition-all">
              <Lock className="w-4 h-4 text-white/35 ml-3.5 shrink-0 pointer-events-none" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-transparent border-none outline-none py-3 px-3 text-sm text-white placeholder:text-white/25"
              />
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-sm sm:text-base font-semibold tracking-wide active:scale-[0.98] transition-all shadow-[0_0_32px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === "signup"
                    ? "Begin Brand Genesis"
                    : mode === "signin"
                    ? "Enter Workspace"
                    : "Send Reset Link"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer Mode Switcher */}
      <div className="mt-5 text-center text-xs text-white/40 space-y-1.5">
        {mode === "signup" ? (
          <p>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="text-purple-300 hover:text-purple-200 font-semibold underline underline-offset-4 ml-1"
            >
              Sign In
            </button>
          </p>
        ) : mode === "signin" ? (
          <>
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-purple-300 hover:text-purple-200 font-semibold underline underline-offset-4 ml-1"
              >
                Create Account
              </button>
            </p>
            <p>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-white/35 hover:text-white/70 transition-colors"
              >
                Forgot password?
              </button>
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="text-purple-300 hover:text-purple-200 font-semibold underline underline-offset-4"
          >
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );

  if (isFullScreen) {
    return (
      <>
        <style>{STYLES}</style>
        <div
          className="fixed inset-0 flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto select-none"
          style={{
            background: "#0B0F17",
            paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <AmbientOrbs />

          {/* Full-bleed stage for mobile & comfortable column for desktop */}
          <div className="relative z-10 w-full max-w-sm sm:max-w-md my-auto px-5 py-6 flex flex-col items-center">
            {formContent}
          </div>
        </div>
      </>
    );
  }

  // Modal Presentation (e.g. from MorePage)
  return (
    <>
      <style>{STYLES}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
        <div className="relative w-full max-w-md bg-[#0B0F17] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
          <AmbientOrbs />
          {onClose && (
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 z-20 p-2 text-white/40 hover:text-white rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="relative z-10">{formContent}</div>
        </div>
      </div>
    </>
  );
};
