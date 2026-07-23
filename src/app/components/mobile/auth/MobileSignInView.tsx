import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Lock, Mail } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";

type MobileSignInViewProps = {
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
  onSuccess: () => void;
};

export function MobileSignInView({
  onSwitchToSignUp,
  onForgotPassword,
  onSuccess,
}: MobileSignInViewProps) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await auth.signIn(email, password);
    if (!auth.error) {
      onSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6 antialiased">
      <div className="pt-10 space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Sign In to Spark</h1>
          <p className="text-xs text-muted-foreground">
            Welcome back. Access your media operating system.
          </p>
        </div>
      </div>

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
        </div>

        {auth.error && (
          <p className="text-xs text-red-400 font-medium text-center">{auth.error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={auth.loading}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
        >
          <span>{auth.loading ? "Authenticating..." : "Sign In"}</span>
          <ArrowRight className="w-4 h-4" />
        </motion.button>

        <div className="flex items-center justify-between text-xs pt-2 text-muted-foreground">
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="hover:text-foreground transition font-medium"
          >
            Need an account? <span className="text-blue-400">Create Spark</span>
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

      <div className="pb-4 text-center text-xs text-muted-foreground">
        Spark Media OS v1.0
      </div>
    </div>
  );
}
