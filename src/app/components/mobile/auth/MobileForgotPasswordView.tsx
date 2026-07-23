import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";

type MobileForgotPasswordViewProps = {
  onBack: () => void;
};

export function MobileForgotPasswordView({ onBack }: MobileForgotPasswordViewProps) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email) return;

    setLoading(true);
    const err = await auth.sendPasswordResetEmail(email);
    setLoading(false);

    if (err) {
      setErrorMsg(err);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6 antialiased">
      <div className="pt-8 space-y-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-card border border-border/60 text-muted-foreground hover:text-foreground transition inline-flex items-center space-x-2 text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sign In</span>
        </button>

        <div className="text-center space-y-2 pt-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-500 mx-auto flex items-center justify-center shadow-lg shadow-purple-500/20">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Enter your account email to receive password reset instructions.
          </p>
        </div>
      </div>

      {!sent ? (
        <form onSubmit={handleSubmit} className="space-y-4 my-auto max-w-sm w-full mx-auto">
          <div className="relative">
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your registered email"
              className="w-full bg-card border border-border/60 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 font-medium text-center">{errorMsg}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
          >
            <span>{loading ? "Sending link..." : "Send Reset Link"}</span>
          </motion.button>
        </form>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="my-auto text-center space-y-4 max-w-xs mx-auto p-6 rounded-2xl bg-card border border-border/60"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Reset Link Sent</h2>
            <p className="text-xs text-muted-foreground">
              We sent a password reset link to <span className="text-foreground">{email}</span>.
            </p>
          </div>
          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-xl bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition"
          >
            Return to Sign In
          </button>
        </motion.div>
      )}

      <div className="pb-4 text-center text-xs text-muted-foreground">
        Spark Identity Security
      </div>
    </div>
  );
}
