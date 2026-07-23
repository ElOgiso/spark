import { useState } from "react";
import { useAuth } from "../../state/AuthContext";
import { DesktopLandingPage } from "./DesktopLandingPage";
import { DesktopBrandGenesis } from "./DesktopBrandGenesis";
import { Sparkles, ArrowRight, ArrowLeft } from "lucide-react";

type DesktopAuthViewState = "landing" | "sign-in" | "sign-up" | "forgot-password" | "onboarding";

type DesktopAuthExperienceProps = {
  onComplete: () => void;
};

export function DesktopAuthExperience({ onComplete }: DesktopAuthExperienceProps) {
  const auth = useAuth();
  const [viewState, setViewState] = useState<DesktopAuthViewState>(() => {
    if (auth.isAuthenticated && !auth.isOnboardingComplete) {
      return "onboarding";
    }
    return "landing";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (auth.isAuthenticated && auth.isOnboardingComplete) {
    onComplete();
    return null;
  }

  if (viewState === "onboarding" || (auth.isAuthenticated && !auth.isOnboardingComplete)) {
    return <DesktopBrandGenesis onComplete={onComplete} />;
  }

  if (viewState === "landing") {
    return <DesktopLandingPage onEnterSpark={() => setViewState("sign-up")} />;
  }

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    await auth.signIn(email, password);
    if (!auth.error) {
      if (!auth.isOnboardingComplete) {
        setViewState("onboarding");
      } else {
        onComplete();
      }
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    await auth.signUp(email, password);
    if (!auth.error) {
      setViewState("onboarding");
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const res = await auth.sendPasswordResetEmail(email);
    if (res.error) {
      setLocalError(res.error);
    } else {
      setResetSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8 relative antialiased selection:bg-blue-600 selection:text-white">
      {/* Background Soft Mesh Glow */}
      <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full bg-card border border-border/80 p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Spark</span>
          </div>

          <button
            type="button"
            onClick={() => setViewState("landing")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Public Page
          </button>
        </div>

        {/* SIGN IN VIEW */}
        {viewState === "sign-in" && (
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Sign In to Spark</h2>
              <p className="text-xs text-muted-foreground pt-1">
                Access your Executive Creative Studio & Media OS.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-muted-foreground/50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground block">Password</label>
                  <button
                    type="button"
                    onClick={() => setViewState("forgot-password")}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {(localError || auth.error) && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
                {localError ?? auth.error}
              </div>
            )}

            <button
              type="submit"
              disabled={auth.loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2 text-xs text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setViewState("sign-up")}
                className="text-blue-400 font-medium hover:text-blue-300 transition-colors"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* SIGN UP VIEW */}
        {viewState === "sign-up" && (
          <form onSubmit={handleSignUpSubmit} className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Initialize Spark Studio</h2>
              <p className="text-xs text-muted-foreground pt-1">
                Create your Executive Spark Account.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-muted-foreground/50"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-muted-foreground/50"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {(localError || auth.error) && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
                {localError ?? auth.error}
              </div>
            )}

            <button
              type="submit"
              disabled={auth.loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
            >
              <span>Create Spark Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2 text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setViewState("sign-in")}
                className="text-blue-400 font-medium hover:text-blue-300 transition-colors"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD VIEW */}
        {viewState === "forgot-password" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setViewState("sign-in")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>

            <div>
              <h2 className="text-2xl font-bold tracking-tight">Reset Password</h2>
              <p className="text-xs text-muted-foreground pt-1">
                Enter your account email to dispatch recovery instructions.
              </p>
            </div>

            {resetSent ? (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 space-y-2 text-center">
                <p className="font-semibold">Reset Link Dispatched</p>
                <p className="text-muted-foreground">Check {email} for instructions.</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Registered Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>

                {localError && (
                  <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
                    {localError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all text-sm"
                >
                  Send Recovery Link
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
