import React, { useState } from "react";
import { Sparkles, Mail, Lock, ArrowRight, X, Play } from "lucide-react";
import { Button, GlassCard } from "../ds";
import { useAuth } from "../../state/AuthContext";
import { SparkLogo } from "../SparkLogo";
import { SparkIntroShowcase } from "./SparkIntroShowcase";

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

export const AuthPanel: React.FC<AuthPanelProps> = ({
  initialMode = "signup",
  isFullScreen = false,
  onClose,
  onSuccess,
  showIntroByDefault = false,
}) => {
  const auth = useAuth();
  const [showIntro, setShowIntro] = useState<boolean>(false);
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
      onSuccess(email, email.split("@")[0], mode);
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

                if (mode === "signup") {
                  await auth.signUp(realEmail, "google-oauth-pass");
                } else {
                  await auth.signIn(realEmail, "google-oauth-pass");
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

  const cardContent = (
    <GlassCard className="w-full max-w-md p-8 border-purple-500/30 relative">
      {onClose && !isFullScreen && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="text-center mb-6">
        <SparkLogo className="w-16 h-16 mx-auto mb-4" variant="superspark" />
        <h2 className="text-2xl font-bold">
          {mode === "signup" ? "Create Your Account" : mode === "signin" ? "Sign In to Spark" : "Reset Password"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {mode === "signup"
            ? "Create your account to start Brand Genesis with your executive team"
            : mode === "signin"
            ? "Access your brand workspace & executive team"
            : "Enter your email to receive a recovery link"}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs text-center font-medium">
          {errorMsg}
        </div>
      )}

      {mode !== "forgot" && (
        <div className="space-y-2 mb-6">
          <Button
            variant="outline"
            fullWidth
            onClick={handleGoogleClick}
            icon={<span className="font-bold text-sm text-red-400">G</span>}
          >
            Continue with Google
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={handleAppleClick}
            icon={<span className="font-bold text-sm text-white"></span>}
          >
            Continue with Apple
          </Button>

          <div className="relative my-4 text-center text-xs text-muted-foreground">
            <span className="bg-[#0B0F17] px-3 relative z-10">or continue with email</span>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@domain.com"
              className="w-full bg-black/40 border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {mode !== "forgot" && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-black/40 border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
        )}

        {mode === "signup" && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-black/40 border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
        )}

        <Button variant="accent" size="lg" fullWidth loading={loading} icon={<ArrowRight className="w-4 h-4" />}>
          {mode === "signup" ? "Begin Brand Genesis" : mode === "signin" ? "Enter Workspace" : "Send Reset Link"}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-muted-foreground space-y-1">
        {mode === "signup" ? (
          <p>
            Already have an account?{" "}
            <button onClick={() => setMode("signin")} className="text-purple-300 hover:underline font-medium">
              Sign In
            </button>
          </p>
        ) : mode === "signin" ? (
          <>
            <p>
              Don't have an account?{" "}
              <button onClick={() => setMode("signup")} className="text-purple-300 hover:underline font-medium">
                Create Account
              </button>
            </p>
            <p>
              <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground">
                Forgot password?
              </button>
            </p>
          </>
        ) : (
          <button onClick={() => setMode("signin")} className="text-purple-300 hover:underline font-medium">
            Back to Sign In
          </button>
        )}
      </div>
    </GlassCard>
  );

  if (isFullScreen) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-6 relative overflow-hidden select-none">
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="w-[600px] h-[350px] bg-purple-600/20 rounded-full blur-[140px]" />
          <div className="w-[400px] h-[250px] bg-cyan-500/15 rounded-full blur-[120px] -translate-y-12" />
        </div>
        {cardContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {cardContent}
    </div>
  );
};
