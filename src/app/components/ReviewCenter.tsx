import { useState } from "react";
import { Navigation } from "./Navigation";
import { TopBar } from "./TopBar";
import { GovernanceStatus } from "./GovernanceStatus";
import { ReviewQueueSummary } from "./ReviewQueueSummary";
import { PendingReviewsList } from "./PendingReviewsList";
import { ReviewCategories } from "./ReviewCategories";
import { AIDecisions } from "./AIDecisions";
import { ReviewAnalytics } from "./ReviewAnalytics";
import { List, Pencil, Video, Rocket, CheckCircle2, XCircle, Sparkles } from "lucide-react";

interface ReviewCenterProps {
  onNavigate?: (path: string) => void;
}

export function ReviewCenter({ onNavigate }: ReviewCenterProps = {}) {
  const [activeCategory, setActiveCategory] = useState<
    "all" | "creative" | "production" | "publishing" | "ai_approved" | "completed" | "rejected"
  >("all");

  const reviewGates = [
    { id: "gate1", name: "Creative Review", status: "required" as const },
    { id: "gate2", name: "Production Review", status: "required" as const },
    { id: "gate3", name: "Publishing Review", status: "optional" as const },
  ];

  const queueSummary = {
    creative: 5,
    production: 3,
    publishing: 2,
    needsAttention: 4,
    aiApproved: 12,
  };

  const categories = [
    { id: "all" as const, label: "All", icon: List, count: 22 },
    { id: "creative" as const, label: "Creative", icon: Pencil, count: 5 },
    { id: "production" as const, label: "Production", icon: Video, count: 3 },
    { id: "publishing" as const, label: "Publishing", icon: Rocket, count: 2 },
    { id: "ai_approved" as const, label: "AI Approved", icon: Sparkles, count: 12 },
    { id: "completed" as const, label: "Completed", icon: CheckCircle2, count: 45 },
    { id: "rejected" as const, label: "Rejected", icon: XCircle, count: 7 },
  ];

  const pendingReviews = [
    {
      id: "r1",
      title: "5 Viral Marketing Tactics That Actually Work in 2026",
      channel: "YouTube",
      series: "Marketing Masterclass",
      reviewType: "creative" as const,
      priority: "high" as const,
      status: "pending" as const,
      aiConfidence: 94,
      timeWaiting: "2m",
    },
    {
      id: "r2",
      title: "The Psychology Behind Viral Content",
      channel: "TikTok",
      series: "Content Science",
      reviewType: "production" as const,
      priority: "high" as const,
      status: "ai_approved" as const,
      aiConfidence: 88,
      timeWaiting: "15m",
    },
    {
      id: "r3",
      title: "How AI Creates Engaging Stories",
      channel: "Instagram",
      reviewType: "creative" as const,
      priority: "medium" as const,
      status: "in_review" as const,
      aiConfidence: 76,
      timeWaiting: "1h",
    },
    {
      id: "r4",
      title: "Building a Personal Brand in 2026",
      channel: "LinkedIn",
      series: "Career Growth",
      reviewType: "publishing" as const,
      priority: "low" as const,
      status: "ai_approved" as const,
      aiConfidence: 82,
      timeWaiting: "2h",
    },
    {
      id: "r5",
      title: "Content Creation Workflow Optimization",
      channel: "YouTube",
      reviewType: "production" as const,
      priority: "medium" as const,
      status: "pending" as const,
      aiConfidence: 91,
      timeWaiting: "3h",
    },
  ];

  const aiDecisions = [
    {
      id: "d1",
      decision: "Approved storyboard for 'AI Content Tips #47'",
      reason: "Matches successful narrative patterns from previous top performers",
      confidence: 94,
      outcome: "approved" as const,
      timestamp: "5m ago",
    },
    {
      id: "d2",
      decision: "Flagged 'Tech News Recap' for human review",
      reason: "Topic complexity requires strategic decision on narrative angle",
      confidence: 68,
      outcome: "flagged" as const,
      timestamp: "12m ago",
    },
    {
      id: "d3",
      decision: "Rejected thumbnail variant B",
      reason: "Visual contrast below brand guidelines threshold",
      confidence: 87,
      outcome: "rejected" as const,
      timestamp: "25m ago",
    },
    {
      id: "d4",
      decision: "Approved publishing schedule optimization",
      reason: "Audience engagement patterns indicate optimal timing window",
      confidence: 92,
      outcome: "approved" as const,
      timestamp: "1h ago",
    },
  ];

  const analyticsMetrics = {
    avgApprovalTime: "12m",
    approvalRate: 87,
    rejectionRate: 8,
    automationRate: 65,
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased">
      <Navigation currentPath="/review" onNavigate={onNavigate} />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-8 space-y-8">
            <div>
              <h1 className="text-3xl font-medium">Review Center</h1>
              <p className="text-muted-foreground mt-2">
                Mission control for your AI media company
              </p>
            </div>

            <section>
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                Review Summary
              </h2>
              <ReviewQueueSummary
                summary={queueSummary}
                onCardClick={(type) => console.log("Queue click:", type)}
              />
            </section>

            <section>
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                Review Queue
              </h2>
              <div className="space-y-4">
                <ReviewCategories
                  categories={categories}
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                />
                <PendingReviewsList
                  reviews={pendingReviews}
                  onReviewClick={(id) => {
                    const review = pendingReviews.find((r) => r.id === id);
                    if (review?.reviewType === "creative") {
                      onNavigate?.("/review/creative");
                    }
                  }}
                />
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <section>
                  <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                    Governance Overview
                  </h2>
                  <GovernanceStatus
                    automationMode="balanced"
                    reviewGates={reviewGates}
                    onGateClick={(gateId) => console.log("Gate click:", gateId)}
                  />
                </section>
              </div>

              <div className="lg:col-span-2">
                <section>
                  <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                    Review Performance
                  </h2>
                  <ReviewAnalytics metrics={analyticsMetrics} />
                </section>
              </div>
            </div>

            <section>
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                AI Decisions
              </h2>
              <AIDecisions decisions={aiDecisions} />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
