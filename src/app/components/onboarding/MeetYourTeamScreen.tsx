import React from "react";
import { Sparkles, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { Button, GlassCard } from "../ds";
import { BrandGenesisData } from "./OnboardingWizard";

interface MeetYourTeamScreenProps {
  data: BrandGenesisData;
  onContinue: () => void;
}

export const MeetYourTeamScreen: React.FC<MeetYourTeamScreenProps> = ({ data, onContinue }) => {
  const directors = [
    { title: "Executive Director", desc: "Coordinates strategy, goals, and executive decisions.", icon: "👑" },
    { title: "Research Director", desc: "Monitors viral opportunities and market signals.", icon: "🔍" },
    { title: "Creative Director", desc: "Crafts script hooks, narrative angles, and visual style.", icon: "🎨" },
    { title: "Editor & Motion Director", desc: "Assembles video clips, graphics, and timing.", icon: "🎬" },
    { title: "Publishing Director", desc: "Manages multi-platform scheduling and metadata.", icon: "📡" },
    { title: "Analytics Director", desc: "Evaluates audience retention and updates brand memory.", icon: "📊" },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Team Assigned to {data.brandName || "Your Brand"}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Meet Your AI Executive Team
        </h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto font-light">
          Six specialized directors ready to build, manage, and grow your brand.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full mb-8">
        {directors.map((d) => (
          <GlassCard key={d.title} className="p-5 border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
            <div className="text-3xl mb-3">{d.icon}</div>
            <h3 className="font-semibold text-base mb-1">{d.title}</h3>
            <p className="text-xs text-muted-foreground font-light leading-relaxed">{d.desc}</p>
          </GlassCard>
        ))}
      </div>

      <div className="max-w-md w-full text-center">
        <Button variant="accent" size="xl" fullWidth icon={<ArrowRight className="w-5 h-5" />} onClick={onContinue}>
          Enter SPARK Dashboard →
        </Button>
      </div>
    </div>
  );
};
