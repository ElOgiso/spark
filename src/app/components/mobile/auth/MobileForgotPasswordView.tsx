import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";

type MobileForgotPasswordViewProps = {
  onBack: () => void;
};

export function MobileForgotPasswordView({ onBack }: MobileForgotPasswordViewProps) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await auth.sendPasswordResetEmail(email);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6 antialiased">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="pt-6 pb-2 text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sign In</span>
        </button>

        <h1 className="text-2xl font-bold tracking-tight pt-4">Reset Password</h1>
        <p className="text-xs text-muted-foreground pt-1">
          Enter your registered email address to receive password recovery instructions.
        </p>
      </div>

      {sent ? (
        <div className="my-auto py-8 text-center space-y-4 bg-card border border-border p-6 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Reset Link Dispatched</h3>
            <p className="text-xs text-muted-foreground">
              We have dispatched a password recovery email to <span className="text-foreground font-medium">{email}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-full bg-card border border-border hover:bg-card/80 text-foreground text-xs py-3 rounded-xl font-medium transition-all"
          >
            Return to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 my-auto py-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Registered Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              required
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all placeholder:text-muted-foreground/50"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
          >
            <span>Send Reset Instructions</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      <div className="pb-4 text-center text-[11px] text-muted-foreground/60">
        Spark Security & Authentication
      </div>
    </div>
  );
}
