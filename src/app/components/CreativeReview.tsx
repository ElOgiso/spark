import { useState } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import { NotificationService } from "../notifications/notificationService";
import { Button, WhySparkRecommends } from "./ds";
import { InteractiveVideoPlayer, ThumbnailVariantCard } from "./MediaPreviewHelper";
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
  Shield,
  AlertTriangle,
  Brain,
  Target,
  Calendar,
  Clock,
  Download,
} from "lucide-react";

interface CreativeReviewProps {
  onNavigate?: (path: string) => void;
  onBack?: () => void;
}

export function CreativeReview({ onNavigate, onBack }: CreativeReviewProps) {
  const { reviewItems, approveReviewItem, rejectOrRequestEditReviewItem } = useSpark();
  
  // Find the first item that is pending review, or default to the first item
  const activeReview = reviewItems.find(r => r.status === "Pending Review") || reviewItems[0];
  const reviewId = activeReview?.id || "r1";

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["why-this-works"])
  );

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    next.has(section) ? next.delete(section) : next.add(section);
    setExpandedSections(next);
  };

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<"A" | "B" | "C">("B");

  const handleApprove = () => {
    approveReviewItem(reviewId);
    setActionSuccess("Approved");
    NotificationService.addNotification({
      title: "Production Approved",
      description: `"${proposal.title}" has been approved and moved to the calendar.`,
      type: "publishing_complete",
      priority: "medium",
      actionLabel: "View Calendar",
      relatedRoute: "/calendar"
    });
    setTimeout(() => {
      onBack?.();
    }, 1500);
  };

  const handleRequestEdit = () => {
    rejectOrRequestEditReviewItem(reviewId);
    setActionSuccess("Needs Edit");
    NotificationService.addNotification({
      title: "Revision Requested",
      description: `"${proposal.title}" moved back to drafting with requested revisions.`,
      type: "brand_rule_conflict",
      priority: "high",
      actionLabel: "View Review Center",
      relatedRoute: "/review"
    });
    setTimeout(() => {
      onBack?.();
    }, 1500);
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    setActionSuccess("Regenerating...");
    setTimeout(() => {
      setRegenerating(false);
      setActionSuccess("Regenerated");
      setTimeout(() => setActionSuccess(null), 3000);
    }, 2000);
  };

  const handleExport = () => {
    setExporting(true);
    setActionSuccess("Exporting...");
    setTimeout(() => {
      setExporting(false);
      setActionSuccess("Exported");
      setTimeout(() => setActionSuccess(null), 3500);
    }, 1800);
  };

  const proposal = {
    title: activeReview?.title || "5 Viral Marketing Tactics That Actually Work in 2026",
    contentType: "Educational Tutorial",
    series: activeReview?.series || "Marketing Masterclass",
    account: activeReview?.account || "YouTube",
    opportunityScore: 94,
    aiConfidence: 94,
    concept: activeReview?.conceptText || "Reveal proven marketing tactics that drive viral growth, backed by 2026 data and real examples from Nigerian creators",
    targetAudience: "Entrepreneurs, marketers, content creators aged 25–45",
    expectedReach: "2.4M – 3.8M views",
    format: "Long-form (12–15 min) + Short clips",
    platforms: ["YouTube", "TikTok", "Instagram Reels", "YouTube Shorts"],
    hook: activeReview?.scriptSnippet || "Stop wasting money on marketing that doesn't work",
    hookType: "Pain-point direct challenge",
    openingMoment: activeReview?.openingMoment || "Show failed marketing campaign burning money animation (0–3s)",
    captionDirection: "Lead with stat. Use em-dash rhythm. End with open loop question. No hashtag stuffing. 3-line max mobile preview.",
    thumbnails: [
      { id: "1", concept: "Split screen: Failed vs Successful campaign with contrast lighting", variant: "A" },
      { id: "2", concept: "Bold '5 TACTICS' text overlay, high contrast, face reaction", variant: "B" },
      { id: "3", concept: "Person pointing at glowing screen, text reads 'This Changed Everything'", variant: "C" },
    ],
    narrative: {
      hook: activeReview?.scriptSnippet || "Failed marketing campaigns waste billions annually",
      buildUp: "But 5 specific tactics consistently drive viral growth across Nigerian market",
      conflict: "Most creators don't know these modern strategies exist",
      reveal: "Here's exactly what works in 2026",
      payoff: "Implement these and 10× your organic reach",
    },
    storyboard: [
      { scene: 1, description: `Hook: ${activeReview?.openingMoment || "Failed campaign montage with burning money graphic"}`, duration: "0–8s" },
      { scene: 2, description: "Credibility intro: Show real channel metrics and results", duration: "8–20s" },
      { scene: 3, description: "Tactic #1: Social proof cascade — how to build it fast", duration: "20–55s" },
      { scene: 4, description: "Tactic #2: Viral loop mechanism explained with example", duration: "55–90s" },
      { scene: 5, description: "Tactic #3: Community-first publishing strategy", duration: "90–120s" },
      { scene: 6, description: "Tactic #4: Data-driven iteration — what to measure", duration: "120–155s" },
      { scene: 7, description: "Tactic #5: Platform algorithm leverage technique", duration: "155–185s" },
      { scene: 8, description: "Outro: Summary card + CTA subscribe + next video teaser", duration: "185–200s" },
    ],
    platformStrategy: {
      youtube: "12–15 min deep dive, SEO optimized for 'viral marketing tactics Nigeria' — chaptered",
      tiktok: "60s cut highlighting tactic #1 with hard CTA to full video in bio",
      shorts: "30s teaser — first 8s hook only, cliffhanger ending",
      reels: "45s cut focusing on tactics #2 and #3 with native text overlays",
    },
    whyThisWorks: [
      "Hook directly addresses most-searched pain point in your audience segment",
      "Numbered list format averages 2.3× completion vs single-topic videos for this niche",
      "'Actually works' framing triggers skepticism-then-proof engagement loop",
      "2026 recency signal creates urgency and reduces click-through hesitation",
    ],
    brandConsistency: {
      score: 92,
      checks: [
        { label: "Tone matches brand voice", pass: true },
        { label: "Hook style consistent with top performers", pass: true },
        { label: "Nigerian context included", pass: true },
        { label: "Tutorial format aligns with content pillars", pass: true },
        { label: "Long intro avoided (< 15s)", pass: true },
      ],
    },
    riskFlags: [
      { level: "low", text: "Claims are general — not platform-specific, which limits direct testing" },
      { level: "medium", text: "Tactic #4 references tool pricing that may change — verify before publish" },
    ],
    qualityChecks: [
      { label: "Hook clarity", pass: true },
      { label: "Narrative arc complete", pass: true },
      { label: "CTA present", pass: true },
      { label: "Platform-specific versions planned", pass: true },
      { label: "Thumbnail concepts reviewed", pass: false, note: "Awaiting your selection" },
      { label: "Caption direction complete", pass: true },
    ],
  };


  const SectionToggle = ({ id, title }: { id: string; title: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-6 hover:bg-accent/5 transition-colors rounded-t-xl"
    >
      <h2 className="text-base font-medium">{title}</h2>
      {expandedSections.has(id) ? (
        <ChevronUp className="w-5 h-5 text-muted-foreground" />
      ) : (
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );

  return (
    <>
      <TopBar pageName="Review" />
      <main className="flex-1 overflow-y-auto scrollbar-none pb-28">
        <div className="max-w-5xl mx-auto p-8 space-y-6">

          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Review Queue
          </button>

          {/* Header */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-muted-foreground">{proposal.contentType}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-muted-foreground">{proposal.series}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-muted-foreground">{proposal.account}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-muted-foreground">{proposal.format}</span>
              </div>
              <h1 className="text-2xl font-medium leading-snug">{proposal.title}</h1>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <div className="px-4 py-3 rounded-xl bg-success/10 border border-success/20 text-center min-w-[80px]">
                <div className="flex items-center gap-1 text-success mb-1 justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Opportunity</span>
                </div>
                <p className="text-2xl font-medium">{proposal.opportunityScore}%</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-accent/20 border border-accent/40 text-center min-w-[80px]">
                <div className="flex items-center gap-1 text-accent-foreground mb-1 justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">AI Score</span>
                </div>
                <p className="text-2xl font-medium">{proposal.aiConfidence}%</p>
              </div>
            </div>
          </div>

          {/* Interactive Media Preview Section */}
          <div className="space-y-6">
            <div className="p-1 rounded-2xl bg-gradient-to-r from-accent/30 via-success/20 to-warning/20 border border-border">
              <InteractiveVideoPlayer 
                id={activeReview?.id || "p1"} 
                title={proposal.title} 
                scenes={proposal.storyboard} 
                durationText="3:20"
                onApprove={handleApprove}
              />
            </div>
            
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Proposed Thumbnail Variants</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {proposal.thumbnails.map((t) => (
                  <ThumbnailVariantCard 
                    key={t.id}
                    id={activeReview?.id || "p1"}
                    variant={t.variant as "A" | "B" | "C"}
                    concept={t.concept}
                    isSelected={selectedVariant === t.variant}
                    onClick={() => setSelectedVariant(t.variant as "A" | "B" | "C")}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-medium mb-4">Executive Summary</h2>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Concept</p>
              <p className="text-sm leading-relaxed">{proposal.concept}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Target Audience</p>
                <p className="text-sm">{proposal.targetAudience}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Expected Reach</p>
                <p className="text-sm font-medium">{proposal.expectedReach}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Platforms</p>
              <div className="flex gap-2 flex-wrap">
                {proposal.platforms.map((p) => (
                  <span key={p} className="px-3 py-1 rounded-lg bg-accent/20 text-sm font-medium">{p}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Hook Preview */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-medium mb-4">Hook & Opening</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-foreground/5 border border-border">
                <p className="text-xs text-muted-foreground mb-2">Primary Hook</p>
                <p className="text-lg font-medium">"{proposal.hook}"</p>
                <p className="text-xs text-muted-foreground mt-1.5">Type: {proposal.hookType}</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground mb-2">Opening Moment (0–3s)</p>
                <p className="text-sm">{proposal.openingMoment}</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground mb-2">Caption Direction</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{proposal.captionDirection}</p>
              </div>
            </div>
          </div>

          {/* Strategic Decision & Recommendations */}
          <div className="space-y-3">
            <WhySparkRecommends
              details={{
                reason: "This storyboard bridges the gap between raw data and audience aspiration. Numbered tactics keep watch-time high while cultural triggers spark high community engagement.",
                evidence: [
                  "Matches your brand rule 'Actionable value for tech founders'.",
                  "Numbered tactics average 2.3x higher completion rates in your niche.",
                  "Opening challenged pain point reduces immediate drop-off by 37%.",
                  "Tactic #4 incorporates real historical data from Nigerian creators."
                ],
                confidence: "Very High",
                confidencePercent: proposal.aiConfidence,
                expectedOutcome: "High reach (2.4M – 3.8M views) with 60%+ average audience retention across connected channels.",
                risk: "Low",
                nextBestAction: "Approve and Publish Production",
                brandRules: ["Brand Voice Pillar 2: Professional", "Creator Authority Rules"]
              }}
              defaultExpanded={true}
            />
          </div>

          {/* Brand Consistency */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="brand" title="Brand Consistency" />
            {expandedSections.has("brand") && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-success" style={{ width: `${proposal.brandConsistency.score}%` }} />
                  </div>
                  <span className="text-sm font-medium text-success">{proposal.brandConsistency.score}% consistent</span>
                </div>
                <div className="space-y-2">
                  {proposal.brandConsistency.checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 className={`w-4 h-4 ${check.pass ? "text-success" : "text-muted-foreground/30"}`} />
                      <span className={`text-sm ${check.pass ? "" : "text-muted-foreground"}`}>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Risk Flags */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="risk" title="Risk Flags" />
            {expandedSections.has("risk") && (
              <div className="px-6 pb-6 space-y-2.5">
                {proposal.riskFlags.map((flag, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                    flag.level === "medium" ? "bg-warning/10 border-warning/20" : "bg-muted/20 border-border/50"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${flag.level === "medium" ? "text-warning" : "text-muted-foreground"}`} />
                    <p className="text-sm">{flag.text}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ml-auto flex-shrink-0 ${
                      flag.level === "medium" ? "bg-warning/20 text-warning" : "bg-muted/40 text-muted-foreground"
                    }`}>{flag.level}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quality Checks */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="quality" title="Quality Checks" />
            {expandedSections.has("quality") && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-2">
                  {proposal.qualityChecks.map((check, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${check.pass ? "bg-success/5 border border-success/10" : "bg-warning/5 border border-warning/20"}`}>
                      {check.pass
                        ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                      }
                      <div>
                        <p className="text-sm">{check.label}</p>
                        {check.note && <p className="text-xs text-muted-foreground">{check.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Narrative Blueprint */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="narrative" title="Narrative Blueprint" />
            {expandedSections.has("narrative") && (
              <div className="px-6 pb-6 space-y-3">
                {Object.entries(proposal.narrative).map(([key, value]) => (
                  <div key={key} className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 capitalize">{key}</p>
                    <p className="text-sm">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Storyboard */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="storyboard" title="Storyboard Preview" />
            {expandedSections.has("storyboard") && (
              <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                {proposal.storyboard.map((scene) => (
                  <div key={scene.scene} className="p-4 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="px-2 py-0.5 rounded bg-accent/30 text-xs font-medium">Scene {scene.scene}</span>
                      <span className="text-xs text-muted-foreground">{scene.duration}</span>
                    </div>
                    <p className="text-sm">{scene.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform Strategy */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionToggle id="platform" title="Platform Strategy" />
            {expandedSections.has("platform") && (
              <div className="px-6 pb-6 space-y-3">
                {[
                  { key: "youtube", label: "YouTube", icon: Youtube, color: "text-destructive" },
                  { key: "tiktok", label: "TikTok", icon: Video, color: "text-muted-foreground" },
                  { key: "shorts", label: "YouTube Shorts", icon: Youtube, color: "text-destructive" },
                  { key: "reels", label: "Instagram Reels", icon: Instagram, color: "text-warning" },
                ].map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="p-4 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <p className="text-sm font-medium">{label}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{proposal.platformStrategy[key as keyof typeof proposal.platformStrategy]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Fixed Action Bar */}
      <div className="fixed bottom-0 left-56 right-0 bg-card/95 backdrop-blur-sm border-t border-border p-5 shadow-2xl">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          {actionSuccess && (
            <div
              className={`p-2 rounded-lg text-xs font-medium text-center border ${
                actionSuccess === "Approved" || actionSuccess === "Regenerated" || actionSuccess === "Exported"
                  ? "bg-success/10 text-success border-success/25"
                  : actionSuccess.includes("...")
                  ? "bg-accent/20 text-accent-foreground border-accent/30 animate-pulse"
                  : "bg-warning/10 text-warning border-warning/25"
              }`}
            >
              {actionSuccess === "Approved"
                ? "Production approved! Publishing job & export packages created."
                : actionSuccess === "Needs Edit"
                ? "Review flagged for Edit. Status updated."
                : actionSuccess === "Regenerating..."
                ? "Spark Intelligence is drafting a fresh creative blueprint..."
                : actionSuccess === "Regenerated"
                ? "Storyboard regenerated with a fresh Nigerian cultural hook & alternative thumbnails!"
                : actionSuccess === "Exporting..."
                ? "Compiling production sequence, voice narrative, and subtitles to 4K Master Zip..."
                : actionSuccess === "Exported"
                ? "Success! Export package compiled and downloaded (45.0 MB Zip Archive)."
                : actionSuccess}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="approve"
              size="lg"
              className="flex-1"
              icon={<CheckCircle2 className="w-5 h-5" />}
              onClick={handleApprove}
              disabled={regenerating || exporting}
            >
              Approve Production
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Edit className="w-4 h-4" />}
              onClick={handleRequestEdit}
              disabled={regenerating || exporting}
            >
              Request Revision
            </Button>
            <Button
              variant="regenerate"
              size="lg"
              icon={<RotateCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />}
              onClick={handleRegenerate}
              disabled={regenerating || exporting}
            >
              {regenerating ? "Improving Format..." : "Improve Brand Format"}
            </Button>
            <Button
              variant="schedule"
              size="lg"
              icon={<Calendar className="w-4 h-4" />}
              onClick={() => onNavigate?.("/calendar")}
              disabled={regenerating || exporting}
            >
              Publish Later
            </Button>
            <Button
              variant="schedule"
              size="lg"
              icon={<Download className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />}
              onClick={handleExport}
              disabled={regenerating || exporting}
            >
              {exporting ? "Compiling..." : "Export Assets"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              icon={<XCircle className="w-4 h-4" />}
              onClick={handleRequestEdit}
              disabled={regenerating || exporting}
            >
              Reject
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
