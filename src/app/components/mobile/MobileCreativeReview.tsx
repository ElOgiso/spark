import { useState } from "react";
import {
  ArrowLeft,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Edit,
  RotateCw,
  XCircle,
} from "lucide-react";

interface MobileCreativeReviewProps {
  onBack?: () => void;
}

export function MobileCreativeReview({ onBack }: MobileCreativeReviewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const proposal = {
    title: "5 Viral Marketing Tactics That Actually Work in 2026",
    opportunityScore: 94,
    aiConfidence: 94,
    concept: "Reveal proven marketing tactics that drive viral growth, backed by 2026 data",
    expectedReach: "2.4M - 3.8M views",
    platforms: ["YouTube", "TikTok", "Reels"],
    hook: "Stop wasting money on marketing that doesn't work",
    openingMoment: "Failed campaign burning money animation",
    thumbnails: [
      { id: "1", variant: "A" },
      { id: "2", variant: "B" },
      { id: "3", variant: "C" },
    ],
    narrative: {
      hook: "Failed marketing campaigns waste billions annually",
      buildUp: "But 5 specific tactics consistently drive viral growth",
      conflict: "Most marketers don't know these modern strategies",
      reveal: "Here's what actually works in 2026",
      payoff: "Implement these tactics to 10x your results",
    },
    storyboard: [
      { scene: 1, description: "Hook: Failed campaign montage", duration: "0-8s" },
      { scene: 2, description: "Intro: Speaker credibility", duration: "8-15s" },
      { scene: 3, description: "Tactic #1: Social proof", duration: "15-45s" },
      { scene: 4, description: "Tactic #2: Viral loops", duration: "45-75s" },
      { scene: 5, description: "Tactic #3: Community", duration: "75-105s" },
    ],
    platformStrategy: {
      youtube: "12-15 min deep dive, SEO optimized",
      tiktok: "60s version highlighting tactic #1",
      reels: "45s version with tactics #2 and #3",
    },
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-xl font-medium mb-3">{proposal.title}</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/20 text-success">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{proposal.opportunityScore}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{proposal.aiConfidence}% AI</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground mb-2">Concept</p>
          <p className="text-base mb-4">{proposal.concept}</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expected Reach</span>
            <span className="font-medium">{proposal.expectedReach}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-base font-medium mb-3">Hook</h3>
          <p className="text-lg font-medium mb-3">{proposal.hook}</p>
          <div className="p-3 rounded-lg bg-accent/10">
            <p className="text-sm text-muted-foreground">{proposal.openingMoment}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-base font-medium mb-4">Thumbnails</h3>
          <div className="grid grid-cols-3 gap-3">
            {proposal.thumbnails.map((thumbnail) => (
              <div key={thumbnail.id} className="space-y-2">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-border">
                  <span className="text-xs text-muted-foreground">{thumbnail.variant}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => toggleSection("narrative")}
          className="w-full rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Narrative</h3>
            {expandedSections.has("narrative") ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {expandedSections.has("narrative") && (
            <div className="mt-4 space-y-3">
              {Object.entries(proposal.narrative).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground mb-1 capitalize">{key}</p>
                  <p className="text-sm">{value}</p>
                </div>
              ))}
            </div>
          )}
        </button>

        <button
          onClick={() => toggleSection("storyboard")}
          className="w-full rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Storyboard</h3>
            {expandedSections.has("storyboard") ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {expandedSections.has("storyboard") && (
            <div className="mt-4 space-y-3">
              {proposal.storyboard.map((scene) => (
                <div key={scene.scene} className="p-3 rounded-lg bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-accent/30 text-xs font-medium">
                      Scene {scene.scene}
                    </span>
                    <span className="text-xs text-muted-foreground">{scene.duration}</span>
                  </div>
                  <p className="text-sm">{scene.description}</p>
                </div>
              ))}
            </div>
          )}
        </button>

        <button
          onClick={() => toggleSection("platform")}
          className="w-full rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Platform Strategy</h3>
            {expandedSections.has("platform") ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {expandedSections.has("platform") && (
            <div className="mt-4 space-y-3">
              {Object.entries(proposal.platformStrategy).map(([platform, strategy]) => (
                <div key={platform} className="p-3 rounded-lg bg-background">
                  <p className="text-sm font-medium mb-1 capitalize">{platform}</p>
                  <p className="text-sm text-muted-foreground">{strategy}</p>
                </div>
              ))}
            </div>
          )}
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-safe shadow-2xl">
        <button className="w-full py-5 bg-success hover:bg-success/90 active:bg-success/80 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-2 mb-3 shadow-lg transition-all active:scale-[0.98]">
          <CheckCircle2 className="w-6 h-6" />
          Approve
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button className="py-3 bg-accent hover:bg-accent/80 active:bg-accent/70 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
            <Edit className="w-3.5 h-3.5" />
            Changes
          </button>
          <button className="py-3 bg-accent hover:bg-accent/80 active:bg-accent/70 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
          <button className="py-3 bg-muted hover:bg-muted/80 active:bg-muted/70 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
