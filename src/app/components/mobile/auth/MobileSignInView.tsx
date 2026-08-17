import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { SparkLogo } from "../../SparkLogo";

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
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await auth.signIn(email, password);
  };

  const handleSocialClick = async (provider: "google" | "apple") => {
    try {
      await auth.signInWithOAuth(provider);
    } catch (err: any) {
      console.error(`[MobileSignInView] ${provider} OAuth error:`, err);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#090613] text-white flex flex-col justify-between px-6 py-8 z-50 overflow-y-auto select-none antialiased">
      {/* Background Subtle Soft Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/15 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col justify-between min-h-full">
        {/* Header Section */}
        <div className="text-center pt-4 space-y-3">
          <div className="flex justify-center">
            <div className="relative">
              <SparkLogo className="w-12 h-12 text-[#a855f7] filter drop-shadow-[0_0_20px_rgba(168,85,247,0.7)]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Welcome Back</h1>
            <p className="text-xs text-purple-200/60 mt-1.5 max-w-[260px] mx-auto leading-relaxed">
              Sign in to continue Brand Genesis with your executive team
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="my-auto py-6 space-y-4">
          {/* Social Sign-In Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleSocialClick("google")}
              className="w-full bg-[#130d25]/90 hover:bg-[#1c1438] active:scale-[0.99] border border-[#2b204e] rounded-2xl py-3.5 px-4 flex items-center justify-center space-x-3 text-sm font-medium text-white transition-all shadow-sm"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialClick("apple")}
              className="w-full bg-[#130d25]/90 hover:bg-[#1c1438] active:scale-[0.99] border border-[#2b204e] rounded-2xl py-3.5 px-4 flex items-center justify-center space-x-3 text-sm font-medium text-white transition-all shadow-sm"
            >
              <svg className="w-5 h-5 flex-shrink-0 fill-current text-white" viewBox="0 0 170 170">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.14-1.9-14.4-6.08-3.18-2.64-7.05-7.23-11.62-13.78-6.19-8.88-11.1-18.73-14.73-29.56-3.63-10.83-5.45-21.2-5.45-31.11 0-14.83 3.82-27.26 11.45-37.3 7.63-10.04 17.55-15.17 29.76-15.39 4.34 0 9.29 1.13 14.85 3.39 5.57 2.26 9.4 3.39 11.5 3.39 1.7 0 5.62-1.2 11.75-3.61 6.13-2.4 11.22-3.5 15.28-3.3 11.38.64 20.73 4.88 28.05 12.72-10.19 6.19-15.19 14.97-15.01 26.34.18 8.88 3.53 16.29 10.05 22.23 6.53 5.94 14.4 9.24 23.6 9.9-2.22 6.53-5.22 13.06-9.01 19.59zM119.22 31.81c0-7.3 2.65-14.28 7.95-20.94 5.3-6.66 11.89-10.52 19.77-11.58.13.9.19 1.8.19 2.7 0 7.17-2.73 14.22-8.19 21.16-5.46 6.94-12.12 10.86-19.98 11.76-.13-.9-.19-1.93-.19-3.1z"/>
              </svg>
              <span>Continue with Apple</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center space-x-3 py-1">
            <div className="h-px bg-[#2b204e] flex-1" />
            <span className="text-xs text-purple-200/40 font-normal">or continue with email</span>
            <div className="h-px bg-[#2b204e] flex-1" />
          </div>

          {/* Input Fields */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-xs font-medium text-purple-200/70 mb-1.5 block">Email Address</label>
              <div className="relative flex items-center bg-[#130d25]/80 border border-[#2b204e] focus-within:border-[#9333ea] rounded-2xl px-4 py-3.5 transition-all shadow-inner">
                <Mail className="w-5 h-5 text-[#a855f7] mr-3 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@domain.com"
                  required
                  className="bg-transparent text-sm text-white placeholder:text-purple-300/30 w-full focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-purple-200/70 block">Password</label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs text-[#c084fc] hover:underline focus:outline-none"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative flex items-center bg-[#130d25]/80 border border-[#2b204e] focus-within:border-[#9333ea] rounded-2xl px-4 py-3.5 transition-all shadow-inner">
                <Lock className="w-5 h-5 text-[#a855f7] mr-3 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  className="bg-transparent text-sm text-white placeholder:text-purple-300/30 w-full focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-purple-300/50 hover:text-white transition-colors ml-2 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {auth.error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                {auth.error}
              </div>
            )}

            {/* Primary Action CTA */}
            <button
              type="submit"
              disabled={auth.loading}
              className="w-full bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#8b5cf6] hover:opacity-95 text-white font-semibold py-4 px-4 rounded-2xl shadow-lg shadow-purple-900/40 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 text-sm mt-5 disabled:opacity-50"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </form>
        </div>

        {/* Footer Navigation Link */}
        <div className="pb-4 text-center">
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-xs text-purple-200/60 hover:text-white transition-colors"
          >
            Don't have an account? <span className="text-[#c084fc] font-semibold hover:underline">Create Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
