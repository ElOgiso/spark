import { TrendingUp, TrendingDown, Target, Sparkles, ArrowRight } from "lucide-react";

interface BriefingSection {
  id: string;
  type: "opportunities" | "high_performing" | "underperforming" | "recommendations";
  items: string[];
}

const sectionConfig = {
  opportunities: {
    title: "Top Opportunities",
    icon: TrendingUp,
    color: "text-success",
  },
  high_performing: {
    title: "High Performing Content",
    icon: Target,
    color: "text-success",
  },
  underperforming: {
    title: "Underperforming Content",
    icon: TrendingDown,
    color: "text-warning",
  },
  recommendations: {
    title: "AI Strategic Recommendations",
    icon: Sparkles,
    color: "text-accent-foreground",
  },
};

interface DailyBriefingProps {
  sections: BriefingSection[];
  generatedAt?: string;
}

export function DailyBriefing({
  sections,
  generatedAt = "Today, 6:00 AM",
}: DailyBriefingProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-medium">Daily AI Briefing</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your executive summary for {generatedAt}
          </p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors text-sm font-medium">
          Regenerate
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sections.map((section) => {
          const config = sectionConfig[section.type];
          const Icon = config.icon;

          return (
            <div
              key={section.id}
              className="rounded-xl border border-border/50 bg-background/50 p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-medium">{config.title}</h3>
              </div>

              <div className="space-y-3">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4 mt-0.5 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    <p className="flex-1">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
