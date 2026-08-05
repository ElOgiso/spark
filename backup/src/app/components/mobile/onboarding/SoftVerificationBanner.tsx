import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { CheckCircle2, RefreshCw } from "lucide-react";

export function SoftVerificationBanner() {
  const auth = useAuth();
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!auth.currentUser?.email) return;
    setResending(true);
    await auth.resendVerificationEmail(auth.currentUser.email);
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  };

  return (
    <div className="w-full bg-blue-950/40 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between text-xs text-blue-200/90 backdrop-blur-md">
      <div className="flex items-center space-x-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span>✓ We're verifying your account in the background.</span>
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || resent}
        className="text-[11px] underline text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1 shrink-0 ml-2"
      >
        {resending ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : resent ? (
          <span>Sent!</span>
        ) : (
          <span>Resend</span>
        )}
      </button>
    </div>
  );
}
