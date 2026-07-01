import { useState } from "react";
import { Navigation } from "./Navigation";
import { TopBar } from "./TopBar";
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
  Youtube,
  Instagram,
  Video,
} from "lucide-react";

interface CreativeReviewProps {
  onNavigate?: (path: string) => void;
  onBack?: () => void;
}

export function CreativeReview({ onNavigate, onBack }: CreativeReviewProps) {
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
    contentType: "Educational Tutorial",
    series: "Marketing Masterclass",
    channel: "YouTube",
    opportunityScore: 94,
    aiConfidence: 94,
    concept: "Reveal proven marketing tactics that drive viral growth, backed by 2026 data and real examples",
    targetAudience: "Entrepreneurs, marketers, content creators aged 25-45",
    expectedReach: "2.4M - 3.8M views",
    platforms: ["YouTube", "TikTok", "Instagram Reels", "YouTube Shorts"],
    hook: "Stop wasting money on marketing that doesn't work",
    openingMoment: "Show failed marketing campaign burning money animation",
    hookReason: "Immediately addresses pain point and creates curiosity about the solution",
    thumbnails: [
      { id: "1", concept: "Split screen: Failed vs Successful campaign", variant: "A" },
      { id: "2", concept: "Bold text overlay: '5 TACTICS' with eye-catching visual", variant: "B" },
      { id: "3", concept: "Person reacting in shock to marketing results", variant: "C" },
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
      { scene: 2, description: "Intro: Speaker establishes credibility", duration: "8-15s" },
      { scene: 3, description: "Tactic #1: Social proof showcase", duration: "15-45s" },
      { scene: 4, description: "Tactic #2: Viral loop mechanism", duration: "45-75s" },
      { scene: 5, description: "Tactic #3: Community building", duration: "75-105s" },
      { scene: 6, description: "Tactic #4: Data-driven iteration", duration: "105-135s" },
      { scene: 7, description: "Tactic #5: Platform optimization", duration: "135-165s" },
      { scene: 8, description: "Outro: Call to action and recap", duration: "165-180s" },
    ],
    platformStrategy: {
      youtube: "12-15 min deep dive, SEO optimized for 'viral marketing tactics'",
      tiktok: "60s version highlighting tactic #1, driving to full video",
      shorts: "30s teaser showing failed campaign hook",
      reels: "45s version with tactic #2 and #3, Instagram-optimized",
    },
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased">
      <Navigation currentPath="/review" onNavigate={onNavigate} />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-5xl mx-auto p-8 space-y-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Review Queue
            </button>

            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-medium mb-3">{proposal.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{proposal.contentType}</span>
                      <span>•</span>
                      <span>{proposal.series}</span>
                      <span>•</span>
                      <span>{proposal.channel}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="px-4 py-2 rounded-lg bg-success/10 border border-success/20 text-center">
                      <div className="flex items-center gap-1.5 text-success mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">Opportunity</span>
                      </div>
                      <p className="text-xl font-medium">{proposal.opportunityScore}%</p>
                    </div>
                    <div className="px-4 py-2 rounded-lg bg-accent/20 border border-accent/40 text-center">
                      <div className="flex items-center gap-1.5 text-accent-foreground mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-medium">AI Confidence</span>
                      </div>
                      <p className="text-xl font-medium">{proposal.aiConfidence}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-lg font-medium mb-6">Executive Summary</h2>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Concept</p>
                    <p className="text-base">{proposal.concept}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Target Audience</p>
                      <p className="text-base">{proposal.targetAudience}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Expected Reach</p>
                      <p className="text-base font-medium">{proposal.expectedReach}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Recommended Platforms</p>
                    <div className="flex gap-2">
                      {proposal.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="px-3 py-1.5 rounded-lg bg-accent/20 text-sm font-medium"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-lg font-medium mb-6">Hook Preview</h2>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Primary Hook</p>
                    <p className="text-xl font-medium">{proposal.hook}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Opening Moment</p>
                    <p className="text-base">{proposal.openingMoment}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <p className="text-sm font-medium mb-2 text-accent-foreground">
                      Why It Will Capture Attention
                    </p>
                    <p className="text-sm text-muted-foreground">{proposal.hookReason}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-lg font-medium mb-6">Thumbnail Concepts</h2>
                <div className="grid grid-cols-3 gap-6">
                  {proposal.thumbnails.map((thumbnail) => (
                    <div key={thumbnail.id} className="space-y-3">
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-border">
                        <span className="text-sm text-muted-foreground">
                          Variant {thumbnail.variant}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{thumbnail.concept}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => toggleSection("narrative")}
                className="w-full rounded-xl border border-border bg-card p-6 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Narrative Blueprint</h2>
                  {expandedSections.has("narrative") ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                {expandedSections.has("narrative") && (
                  <div className="mt-6 space-y-4">
                    {Object.entries(proposal.narrative).map(([key, value]) => (
                      <div key={key} className="p-4 rounded-lg bg-background border border-border">
                        <p className="text-sm text-muted-foreground mb-2 capitalize">{key}</p>
                        <p className="text-base">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </button>

              <button
                onClick={() => toggleSection("storyboard")}
                className="w-full rounded-xl border border-border bg-card p-6 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Storyboard Preview</h2>
                  {expandedSections.has("storyboard") ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                {expandedSections.has("storyboard") && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {proposal.storyboard.map((scene) => (
                      <div
                        key={scene.scene}
                        className="p-4 rounded-lg bg-background border border-border"
                      >
                        <div className="flex items-center gap-2 mb-3">
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
                className="w-full rounded-xl border border-border bg-card p-6 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Platform Strategy</h2>
                  {expandedSections.has("platform") ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                {expandedSections.has("platform") && (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Youtube className="w-5 h-5 text-destructive" />
                        <p className="text-sm font-medium">YouTube</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{proposal.platformStrategy.youtube}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="w-5 h-5 text-muted-foreground" />
                        <p className="text-sm font-medium">TikTok</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{proposal.platformStrategy.tiktok}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Youtube className="w-5 h-5 text-destructive" />
                        <p className="text-sm font-medium">YouTube Shorts</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{proposal.platformStrategy.shorts}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Instagram className="w-5 h-5 text-warning" />
                        <p className="text-sm font-medium">Instagram Reels</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{proposal.platformStrategy.reels}</p>
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </main>

        <div className="fixed bottom-0 left-64 right-0 bg-card border-t border-border p-6 shadow-2xl">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <button className="flex-1 py-4 px-6 rounded-xl bg-success hover:bg-success/90 text-white font-medium text-lg flex items-center justify-center gap-2 transition-all shadow-lg">
              <CheckCircle2 className="w-5 h-5" />
              Approve Production
            </button>
            <button className="px-6 py-4 rounded-xl bg-accent hover:bg-accent/80 font-medium flex items-center gap-2 transition-colors">
              <Edit className="w-4 h-4" />
              Request Changes
            </button>
            <button className="px-6 py-4 rounded-xl bg-accent hover:bg-accent/80 font-medium flex items-center gap-2 transition-colors">
              <RotateCw className="w-4 h-4" />
              Regenerate
            </button>
            <button className="px-6 py-4 rounded-xl bg-muted hover:bg-muted/80 font-medium flex items-center gap-2 transition-colors">
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
