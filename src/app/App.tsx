import { useState } from "react";
import { Navigation } from "./components/Navigation";
import { TopBar } from "./components/TopBar";
import { StatusCard } from "./components/StatusCard";
import { ActivityFeed } from "./components/ActivityFeed";
import { ReviewQueue } from "./components/ReviewQueue";
import { DailyBriefing } from "./components/DailyBriefing";
import { ProductionStatus } from "./components/ProductionStatus";
import { PublishingStatus } from "./components/PublishingStatus";
import { ReviewCenter } from "./components/ReviewCenter";
import { CreativeReview } from "./components/CreativeReview";
import { ChannelWorkspace } from "./components/ChannelWorkspace";
import { MobileApp } from "./components/mobile/MobileApp";
import { useDeviceType } from "./hooks/useDeviceType";
import {
  Eye,
  DollarSign,
  TrendingUp,
  Video,
  Tv,
  Clapperboard,
} from "lucide-react";

export default function App() {
  const [currentPage, setCurrentPage] = useState("/");
  const deviceType = useDeviceType();

  // Mobile experience - completely separate from desktop
  if (deviceType === "mobile") {
    return <MobileApp />;
  }

  // Desktop experience - Review Center
  if (currentPage === "/review") {
    return <ReviewCenter onNavigate={setCurrentPage} />;
  }

  // Desktop experience - Creative Review (Review Gate #1)
  if (currentPage === "/review/creative") {
    return (
      <CreativeReview
        onNavigate={setCurrentPage}
        onBack={() => setCurrentPage("/review")}
      />
    );
  }

  // Desktop experience - Channel Workspace
  if (currentPage === "/channels") {
    return <ChannelWorkspace onNavigate={setCurrentPage} />;
  }
  const briefingSections = [
    {
      id: "opportunities",
      type: "opportunities" as const,
      items: [
        "AI content creation trending +340% this week across YouTube and TikTok",
        "Viral storytelling techniques gaining traction in your niche",
        "3 high-potential topics identified from audience feedback analysis",
      ],
    },
    {
      id: "high_performing",
      type: "high_performing" as const,
      items: [
        '"How AI Creates Viral Content" - 2.4M views, 8.2% engagement rate',
        '"Behind the Scenes: AI Media Production" - 1.8M views, trending #3',
        '"Future of Content Creation" - 890K views, 12.5% engagement',
      ],
    },
    {
      id: "underperforming",
      type: "underperforming" as const,
      items: [
        '"Technical Tutorial Series" - Below average engagement by 35%',
        '"Industry News Recap" - Low completion rate (22% avg)',
        "Instagram Reels format needs optimization for retention",
      ],
    },
    {
      id: "recommendations",
      type: "recommendations" as const,
      items: [
        "Increase publishing frequency during peak engagement windows (2-4 PM weekdays)",
        "Expand successful tutorial format to TikTok and Instagram for broader reach",
        "Consider collaboration opportunities with 3 identified creators in your niche",
      ],
    },
  ];

  const activities = [
    {
      id: "a1",
      type: "opportunity_discovered" as const,
      title: "Opportunity Discovered",
      metadata: "AI-powered video editing trends • Confidence: 94%",
      timestamp: "5m ago",
    },
    {
      id: "a2",
      type: "storyboard_approved" as const,
      title: "Storyboard Approved",
      metadata: '"5 Viral Marketing Tactics" • Ready for production',
      timestamp: "12m ago",
    },
    {
      id: "a3",
      type: "production_completed" as const,
      title: "Production Completed",
      metadata: '"The Psychology of Viral Content" • Ready for review',
      timestamp: "45m ago",
    },
    {
      id: "a4",
      type: "publishing_completed" as const,
      title: "Publishing Completed",
      metadata: '"How to Build a Media Empire" • Published to YouTube',
      timestamp: "1h ago",
    },
    {
      id: "a5",
      type: "analytics_updated" as const,
      title: "Analytics Updated",
      metadata: "Weekly performance report generated • +42% growth",
      timestamp: "2h ago",
    },
  ];

  const productionStatuses = [
    { stage: "planning" as const, count: 4 },
    { stage: "production" as const, count: 7 },
    { stage: "rendering" as const, count: 3 },
    { stage: "ready" as const, count: 5 },
    { stage: "publishing" as const, count: 2 },
  ];

  const publishingStatuses = [
    { stage: "scheduled" as const, count: 12, details: "Next: Tomorrow 2:00 PM" },
    { stage: "publishing" as const, count: 2 },
    { stage: "published" as const, count: 8, details: "Today" },
    { stage: "failed" as const, count: 0 },
  ];

  const reviewQueueSummary = {
    creative: 5,
    production: 3,
    publishing: 2,
  };

  // Desktop experience - Home Dashboard
  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased">
      <Navigation currentPath={currentPage} onNavigate={setCurrentPage} />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-8 space-y-8">
            <div>
              <h1 className="text-3xl font-medium">Command Center</h1>
              <p className="text-muted-foreground mt-2">
                Your AI media company at a glance
              </p>
            </div>

            <section>
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                Executive Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <StatusCard
                  title="Monthly Views"
                  value="24.8M"
                  icon={Eye}
                  trend={{ value: "+18.2%", positive: true }}
                  subtitle="Across all channels"
                />
                <StatusCard
                  title="Revenue"
                  value="$142K"
                  icon={DollarSign}
                  trend={{ value: "+24.5%", positive: true }}
                  subtitle="This month"
                  variant="success"
                />
                <StatusCard
                  title="Growth Rate"
                  value="+42%"
                  icon={TrendingUp}
                  trend={{ value: "+8.2%", positive: true }}
                  subtitle="Month over month"
                />
                <StatusCard
                  title="Published Assets"
                  value="187"
                  icon={Video}
                  subtitle="This month"
                />
                <StatusCard
                  title="Active Channels"
                  value="8"
                  icon={Tv}
                  subtitle="YouTube, TikTok, IG..."
                />
                <StatusCard
                  title="Active Productions"
                  value="21"
                  icon={Clapperboard}
                  subtitle="In various stages"
                />
              </div>
            </section>

            <section>
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                Daily AI Briefing
              </h2>
              <DailyBriefing sections={briefingSections} />
            </section>

            <section>
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                Review Queue
              </h2>
              <ReviewQueue
                summary={reviewQueueSummary}
                onReviewClick={() => setCurrentPage("/review")}
              />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section>
                <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                  Production Status
                </h2>
                <ProductionStatus statuses={productionStatuses} />
              </section>

              <section>
                <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                  Publishing Status
                </h2>
                <PublishingStatus statuses={publishingStatuses} />
              </section>
            </div>

            <section>
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
                Activity Feed
              </h2>
              <div className="rounded-xl border border-border bg-card p-6">
                <ActivityFeed activities={activities} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}