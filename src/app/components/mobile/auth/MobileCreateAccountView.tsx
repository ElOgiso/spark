import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

type MobileCreateAccountViewProps = {
  onSwitchToSignIn: () => void;
  onForgotPassword: () => void;
  onAccountCreated: () => void;
};

export function MobileCreateAccountView({
  onSwitchToSignIn,
  onForgotPassword,
  onAccountCreated,
}: MobileCreateAccountViewProps) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Please fill in email and password.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    if (!acceptedTerms) {
      setLocalError("Please accept the Terms of Service to continue.");
      return;
    }

    await auth.signUp(email, password);
    if (!auth.error) {
      onAccountCreated();
    }
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
        <h1 className="text-2xl font-bold tracking-tight pt-2">Create Spark Account</h1>
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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all placeholder:text-muted-foreground/50"
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
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Terms Checkbox */}
        <label className="flex items-start space-x-2.5 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 rounded border-border bg-card text-blue-600 focus:ring-blue-500/50"
          />
          <span className="text-xs text-muted-foreground leading-snug">
            I agree to Spark's Terms of Service and Privacy Policy.
          </span>
        </label>

        {(localError || auth.error) && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
            {localError ?? auth.error}
          </div>
        )}

        {/* Action Buttons */}
        <button
          type="submit"
          disabled={auth.loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
        >
          <span>Create Spark</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="hover:text-foreground transition-colors"
          >
            Already have an account? <span className="text-blue-400 font-medium">Sign In</span>
          </button>

          <button
            type="button"
            onClick={onForgotPassword}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot Password?
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
