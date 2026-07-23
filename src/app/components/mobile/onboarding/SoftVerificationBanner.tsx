import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";

export function SoftVerificationBanner() {
  const auth = useAuth();
  const [resending, setResending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  if (auth.isEmailVerified) {
    return null;
  }

  const handleResend = async () => {
    if (!auth.currentUser?.email) return;
    setResending(true);
    setSentMessage(null);
    const err = await auth.resendVerificationEmail(auth.currentUser.email);
    setResending(false);
    setSentMessage(err ? "Could not resend link." : "Verification link sent!");
    setTimeout(() => setSentMessage(null), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between text-xs text-blue-300 backdrop-blur-md"
    >
      <div className="flex items-center space-x-2 min-w-0">
        <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="truncate">
          {sentMessage ?? "✓ We're verifying your account in the background."}
        </span>
      </div>
      <button
        onClick={handleResend}
        disabled={resending}
        className="ml-2 px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-[10px] flex items-center gap-1 transition shrink-0"
      >
        <RefreshCw className={`w-3 h-3 ${resending ? "animate-spin" : ""}`} />
        Resend
      </button>
    </motion.div>
  );
}
