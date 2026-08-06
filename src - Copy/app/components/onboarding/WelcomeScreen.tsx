import React from "react";
import { Sparkles, ArrowRight, LayoutDashboard } from "lucide-react";
import { Button, GlassCard } from "../ds";
import { useAuth } from "../../state/AuthContext";

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const auth = useAuth();

  const handleSkipToDashboard = () => {
    auth.markOnboardingComplete();
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-6 text-center select-none">
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="w-[500px] h-[300px] bg-purple-600/20 rounded-full blur-[140px]" />
      </div>

      <GlassCard className="max-w-lg w-full p-10 border-purple-500/40 relative">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 p-[1px]">
          <div className="w-full h-full bg-[#0B0F17] rounded-[15px] flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Welcome to Spark Media OS
        </h1>

        <p className="text-muted-foreground text-base mb-8 font-light leading-relaxed">
          You are about to hire an AI executive team that builds, manages, and grows your brand.
        </p>

        <div className="space-y-3">
          <Button variant="accent" size="xl" fullWidth icon={<ArrowRight className="w-5 h-5" />} onClick={onContinue}>
            Begin Brand Genesis →
          </Button>

          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={handleSkipToDashboard}
            icon={<LayoutDashboard className="w-4 h-4 text-purple-300" />}
            className="text-xs text-muted-foreground hover:text-foreground border border-white/10 hover:border-white/20 bg-black/20"
          >
            I am a Returning User (Skip directly to Executive OS)
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};
