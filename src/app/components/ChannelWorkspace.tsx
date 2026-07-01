import { useState } from "react";
import { Navigation } from "./Navigation";
import { TopBar } from "./TopBar";
import {
  Sparkles,
  TrendingUp,
  Users,
  Palette,
  Mic,
  Brain,
  BarChart3,
  Plus,
  Play,
  FileText,
  Search,
  Lightbulb,
} from "lucide-react";

interface ChannelWorkspaceProps {
  onNavigate?: (path: string) => void;
}

export function ChannelWorkspace({ onNavigate }: ChannelWorkspaceProps) {
  const channel = {
    name: "Tech Insights Nigeria",
    purpose: "Demystifying technology for African creators and entrepreneurs",
    targetAudience: "Nigerian tech enthusiasts, entrepreneurs, creators aged 18-35",
    contentCategory: "Technology & Education",
    growthStatus: "Accelerating",
    aiHealthScore: 94,

    contentDNA: {
      coreTopics: [
        "AI & Automation",
        "Mobile Technology",
        "Digital Marketing",
        "Content Creation Tools",
        "Tech Entrepreneurship"
      ],
      contentThemes: [
        "How technology solves African problems",
        "Making tech accessible and practical",
        "Success stories from African tech ecosystem"
      ],
      styleDirection: "Educational but entertaining, practical over theoretical",
      emotionalTone: "Energetic, hopeful, empowering, relatable",
      audienceBehaviors: [
        "Watch on mobile during commute",
        "Share practical tips with friends",
        "Engage with local success stories"
      ],
      winningFormats: [
        "Quick tutorials (2-5 min)",
        "Success story interviews",
        "Tech trend breakdowns",
        "Tool comparisons"
      ]
    },

    brandBible: {
      visualStyle: "Bright, energetic, modern African aesthetic with tech elements",
      colorPalette: ["#00D9FF", "#FF6B00", "#FFD700", "#1A1A1A", "#FFFFFF"],
      typography: "Bold sans-serif for titles, clean sans for body",
      thumbnailRules: [
        "Bright background with tech element",
        "Face showing genuine emotion",
        "Bold text overlay (max 4 words)",
        "Nigerian flag or cultural element when relevant"
      ],
      editingStyle: [
        "Fast-paced with quick cuts",
        "Energetic music bed",
        "On-screen graphics for key points",
        "Mobile-first framing (vertical or square)"
      ]
    },

    characters: [
      {
        id: "1",
        name: "Tunde (Main Host)",
        role: "Tech Explainer",
        visualIdentity: "Young Nigerian male, casual tech-casual style",
        traits: ["Energetic", "Relatable", "Knowledgeable", "Humorous"],
        appearance: "Glasses, tech-themed t-shirts, friendly smile"
      },
      {
        id: "2",
        name: "Ada (Success Story Host)",
        role: "Interview Lead",
        visualIdentity: "Nigerian female, professional yet approachable",
        traits: ["Curious", "Empathetic", "Professional", "Inspiring"],
        appearance: "Professional casual, warm presence"
      }
    ],

    voiceSets: [
      {
        id: "v1",
        name: "Spark_Nigeria_English",
        accent: "Nigerian",
        language: "English",
        tone: "Energetic & Friendly",
        energy: "High",
        style: "Conversational with local expressions",
        range: "Enthusiastic to thoughtful",
        locked: true,
        primary: true
      },
      {
        id: "v2",
        name: "Spark_Pidgin",
        accent: "Nigerian",
        language: "Pidgin English",
        tone: "Casual & Relatable",
        energy: "Medium-High",
        style: "Street-smart, friendly",
        range: "Playful to serious",
        locked: false,
        primary: false
      },
      {
        id: "v3",
        name: "Spark_Yoruba",
        accent: "Yoruba",
        language: "Yoruba/English Mix",
        tone: "Warm & Cultural",
        energy: "Medium",
        style: "Cultural storytelling",
        range: "Warm to passionate",
        locked: false,
        primary: false
      }
    ],

    performanceMemory: {
      bestHooks: [
        "This changed everything for Nigerian creators...",
        "Nobody is talking about this, but...",
        "I spent 30 days testing this so you don't have to..."
      ],
      bestTitles: [
        "How Nigerian Creators are Using AI to 10x Output",
        "This Free Tool Changed My Content Game",
        "What Nobody Tells You About Tech in Lagos"
      ],
      bestThumbnails: [
        "Shocked face + bold 'FREE TOOL' text",
        "Before/After split screen",
        "Host pointing at screen with tech visual"
      ],
      failedPatterns: [
        "Too technical without context",
        "Western-focused examples without local relevance",
        "Long introductions over 15 seconds"
      ],
      retentionInsights: [
        "Peak engagement in first 8 seconds with hook",
        "Retention drops when using unfamiliar terms without explanation",
        "Mobile viewers prefer vertical or 1:1 format"
      ],
      viralTriggers: [
        "Local success stories",
        "Free tool discoveries",
        "Tech solving African problems",
        "Behind-the-scenes content creation"
      ]
    },

    health: {
      growthRate: "+42%",
      engagementRate: "8.2%",
      retentionScore: 72,
      postingConsistency: "92%",
      aiOptimizationScore: 94
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased">
      <Navigation currentPath="/channels" onNavigate={onNavigate} />

      <div className="flex-1 flex flex-col">
        <TopBar showChannelSwitcher channelName={channel.name} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-8 space-y-8">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Channel Workspace</p>
              <h1 className="text-3xl font-medium">{channel.name}</h1>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <p className="text-lg text-muted-foreground mb-4">{channel.purpose}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Target Audience</p>
                      <p className="text-sm">{channel.targetAudience}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Content Category</p>
                      <p className="text-sm">{channel.contentCategory}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="text-center px-4 py-3 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <p className="text-sm font-medium text-success">{channel.growthStatus}</p>
                  </div>
                  <div className="text-center px-4 py-3 rounded-lg bg-accent/20 border border-accent/40">
                    <p className="text-xs text-muted-foreground mb-1">AI Health</p>
                    <p className="text-xl font-medium">{channel.aiHealthScore}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
                <h2 className="text-lg font-medium">Content DNA</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Core Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {channel.contentDNA.coreTopics.map((topic, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-lg bg-accent/20 text-sm font-medium">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Content Themes</p>
                  <div className="space-y-2">
                    {channel.contentDNA.contentThemes.map((theme, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background border border-border">
                        <p className="text-sm">{theme}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Style Direction</p>
                    <p className="text-sm">{channel.contentDNA.styleDirection}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Emotional Tone</p>
                    <p className="text-sm">{channel.contentDNA.emotionalTone}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Winning Formats</p>
                  <div className="grid grid-cols-2 gap-3">
                    {channel.contentDNA.winningFormats.map((format, i) => (
                      <div key={i} className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm font-medium">{format}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="w-5 h-5" />
                <h2 className="text-lg font-medium">Brand Bible</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Visual Style</p>
                  <p className="text-sm">{channel.brandBible.visualStyle}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Color Palette</p>
                  <div className="flex gap-2">
                    {channel.brandBible.colorPalette.map((color, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div
                          className="w-16 h-16 rounded-lg border border-border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-mono text-muted-foreground">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Thumbnail Rules</p>
                  <div className="space-y-2">
                    {channel.brandBible.thumbnailRules.map((rule, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-background">
                        <span className="text-xs text-muted-foreground mt-0.5">{i + 1}.</span>
                        <p className="text-sm flex-1">{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-5 h-5" />
                <h2 className="text-lg font-medium">Character Bible</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {channel.characters.map((character) => (
                  <div key={character.id} className="p-6 rounded-xl bg-background border border-border">
                    <h3 className="text-base font-medium mb-1">{character.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{character.role}</p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Visual Identity</p>
                        <p className="text-sm">{character.visualIdentity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Traits</p>
                        <div className="flex flex-wrap gap-2">
                          {character.traits.map((trait, i) => (
                            <span key={i} className="px-2 py-1 rounded bg-accent/20 text-xs">
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Appearance</p>
                        <p className="text-sm">{character.appearance}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-accent/30 bg-accent/5 p-8">
              <div className="flex items-center gap-3 mb-6">
                <Mic className="w-5 h-5 text-accent-foreground" />
                <h2 className="text-lg font-medium">Voice Bible</h2>
                <span className="text-xs text-accent-foreground bg-accent/30 px-2 py-1 rounded">
                  CRITICAL
                </span>
              </div>
              <div className="space-y-4">
                {channel.voiceSets.map((voice) => (
                  <div
                    key={voice.id}
                    className={`p-6 rounded-xl border ${
                      voice.primary
                        ? "bg-accent/20 border-accent/40"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-medium font-mono">{voice.name}</h3>
                          {voice.primary && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent/30 text-accent-foreground">
                              PRIMARY
                            </span>
                          )}
                          {voice.locked && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-success/20 text-success">
                              LOCKED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{voice.language}</span>
                          <span>•</span>
                          <span>{voice.accent}</span>
                        </div>
                      </div>
                      <button className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 font-medium text-sm flex items-center gap-2 transition-colors">
                        <Play className="w-4 h-4" />
                        Preview
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Tone</p>
                        <p>{voice.tone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Energy</p>
                        <p>{voice.energy}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Style</p>
                        <p>{voice.style}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="w-5 h-5" />
                <h2 className="text-lg font-medium">Content Performance Memory</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Best Performing Hooks</p>
                    <div className="space-y-2">
                      {channel.performanceMemory.bestHooks.map((hook, i) => (
                        <div key={i} className="p-3 rounded-lg bg-success/10 border border-success/20">
                          <p className="text-sm">{hook}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Best Titles</p>
                    <div className="space-y-2">
                      {channel.performanceMemory.bestTitles.slice(0, 2).map((title, i) => (
                        <div key={i} className="p-3 rounded-lg bg-success/10 border border-success/20">
                          <p className="text-sm">{title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Viral Triggers</p>
                    <div className="space-y-2">
                      {channel.performanceMemory.viralTriggers.map((trigger, i) => (
                        <div key={i} className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                          <p className="text-sm">{trigger}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Failed Patterns</p>
                    <div className="space-y-2">
                      {channel.performanceMemory.failedPatterns.slice(0, 2).map((pattern, i) => (
                        <div key={i} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <p className="text-sm">{pattern}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-5 h-5" />
                <h2 className="text-lg font-medium">Channel Health</h2>
              </div>
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(channel.health).map(([key, value]) => (
                  <div key={key} className="p-4 rounded-lg bg-background border border-border text-center">
                    <p className="text-2xl font-medium mb-1">{value}{typeof value === 'number' ? '%' : ''}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <Lightbulb className="w-5 h-5" />
                <h2 className="text-lg font-medium">Quick Actions</h2>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 transition-colors flex flex-col items-center gap-3 text-center">
                  <Plus className="w-6 h-6" />
                  <span className="text-sm font-medium">Create Series</span>
                </button>
                <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 transition-colors flex flex-col items-center gap-3 text-center">
                  <Sparkles className="w-6 h-6" />
                  <span className="text-sm font-medium">Generate Idea</span>
                </button>
                <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 transition-colors flex flex-col items-center gap-3 text-center">
                  <FileText className="w-6 h-6" />
                  <span className="text-sm font-medium">Storyboard</span>
                </button>
                <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 transition-colors flex flex-col items-center gap-3 text-center">
                  <Search className="w-6 h-6" />
                  <span className="text-sm font-medium">Run Research</span>
                </button>
                <button className="p-4 rounded-xl bg-accent hover:bg-accent/80 transition-colors flex flex-col items-center gap-3 text-center">
                  <Mic className="w-6 h-6" />
                  <span className="text-sm font-medium">Voice Script</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
