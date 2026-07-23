import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { Sparkles, ArrowRight } from "lucide-react";

type MobileSignInViewProps = {
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
};

export function MobileSignInView({
  onSwitchToSignUp,
  onForgotPassword,
}: MobileSignInViewProps) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await auth.signIn(email, password);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6 antialiased">
      {/* Header Branding */}
      <div className="pt-8 space-y-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Spark</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight pt-2">Sign In</h1>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-4 my-auto py-4">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              required
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all placeholder:text-muted-foreground/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground block">Password</label>
              <button
                type="button"
                onClick={onForgotPassword}
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
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {auth.error && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
            {auth.error}
          </div>
        )}

        {/* Action Buttons */}
        <button
          type="submit"
          disabled={auth.loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
        >
          <span>Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Don't have an account? <span className="text-blue-400 font-medium">Create Account</span>
          </button>
        </div>
      </form>

      {/* Footer Legal Links */}
      <div className="pb-4 text-center text-[11px] text-muted-foreground/60 flex justify-center space-x-4">
        <span>Privacy</span>
        <span>•</span>
        <span>Terms</span>
        <span>•</span>
        <span>Support</span>
      </div>
    </div>
  );
}
