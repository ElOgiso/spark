import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Mail } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";

type MobileCreateAccountViewProps = {
  onSwitchToSignIn: () => void;
  onForgotPassword: () => void;
  onSuccess: () => void;
};

export function MobileCreateAccountView({
  onSwitchToSignIn,
  onForgotPassword,
  onSuccess,
}: MobileCreateAccountViewProps) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!email || !password) {
      setValidationError("Please fill out all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setValidationError("Please accept the terms to continue.");
      return;
    }

    await auth.signUp(email, password);
    if (!auth.error) {
      onSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6 antialiased">
      {/* Top Header */}
      <div className="pt-8 space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Create Spark Account</h1>
          <p className="text-xs text-muted-foreground">
            Enter your details to create your secure identity.
          </p>
        </div>
      </div>

      {/* Identity Form */}
      <form onSubmit={handleSubmit} className="space-y-4 my-auto max-w-sm w-full mx-auto">
        <div className="space-y-3">
          <div className="relative">
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-card border border-border/60 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-card border border-border/60 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-card border border-border/60 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>
        </div>

        {/* Terms Checkbox */}
        <label className="flex items-start space-x-2.5 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 rounded border-border bg-card text-blue-600 focus:ring-0"
          />
          <span className="text-xs text-muted-foreground leading-snug">
            I agree to the Terms of Service & Privacy Policy.
          </span>
        </label>

        {(validationError || auth.error) && (
          <p className="text-xs text-red-400 font-medium text-center">
            {validationError ?? auth.error}
          </p>
        )}

        {/* Primary CTA */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={auth.loading}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
        >
          <span>{auth.loading ? "Creating account..." : "Create Spark"}</span>
          <ArrowRight className="w-4 h-4" />
        </motion.button>

        {/* Secondary Options */}
        <div className="flex items-center justify-between text-xs pt-2 text-muted-foreground">
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="hover:text-foreground transition font-medium"
          >
            Already have an account? <span className="text-blue-400">Sign In</span>
          </button>
          <button
            type="button"
            onClick={onForgotPassword}
            className="hover:text-foreground transition"
          >
            Forgot Password?
          </button>
        </div>
      </form>

      {/* Footer Legal */}
      <div className="pb-4 text-center space-y-2">
        <div className="flex items-center justify-center space-x-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Protected by Spark Enterprise Security</span>
        </div>
      </div>
    </div>
  );
}
