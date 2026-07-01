import { useState } from "react";
import {
  Pencil,
  Video,
  Rocket,
  ArrowUpCircle,
  Circle,
  CheckCircle2,
  X,
  RotateCw,
  Check,
  Sparkles,
} from "lucide-react";
import { MobileCreativeReview } from "./MobileCreativeReview";

type ReviewType = "creative" | "production" | "publishing";
type Priority = "high" | "medium" | "low";

interface ReviewItem {
  id: string;
  title: string;
  type: ReviewType;
  priority: Priority;
  aiConfidence: number;
  timeWaiting: string;
  channel: string;
  thumbnail?: string;
}

export function MobileReview() {
  const [activeFilter, setActiveFilter] = useState<"all" | ReviewType | "ai_approved">("all");
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);

  const reviews: ReviewItem[] = [
    {
      id: "r1",
      title: "5 Viral Marketing Tactics That Actually Work in 2026",
      type: "creative",
      priority: "high",
      aiConfidence: 94,
      timeWaiting: "2m",
      channel: "YouTube",
    },
    {
      id: "r2",
      title: "The Psychology Behind Viral Content",
      type: "production",
      priority: "high",
      aiConfidence: 88,
      timeWaiting: "15m",
      channel: "TikTok",
    },
    {
      id: "r3",
      title: "How AI Creates Engaging Stories",
      type: "creative",
      priority: "medium",
      aiConfidence: 76,
      timeWaiting: "1h",
      channel: "Instagram",
    },
    {
      id: "r4",
      title: "Building a Personal Brand in 2026",
      type: "publishing",
      priority: "low",
      aiConfidence: 82,
      timeWaiting: "2h",
      channel: "LinkedIn",
    },
  ];

  const filters = [
    { id: "all" as const, label: "All", count: reviews.length },
    {
      id: "creative" as const,
      label: "Creative",
      count: reviews.filter((r) => r.type === "creative").length,
    },
    {
      id: "production" as const,
      label: "Production",
      count: reviews.filter((r) => r.type === "production").length,
    },
    {
      id: "publishing" as const,
      label: "Publishing",
      count: reviews.filter((r) => r.type === "publishing").length,
    },
    {
      id: "ai_approved" as const,
      label: "AI Approved",
      count: 12,
    },
  ];

  const filteredReviews =
    activeFilter === "all"
      ? reviews
      : activeFilter === "ai_approved"
      ? reviews.filter((r) => r.aiConfidence >= 80)
      : reviews.filter((r) => r.type === activeFilter);

  const priorityConfig = {
    high: { icon: ArrowUpCircle, color: "text-destructive", label: "High" },
    medium: { icon: Circle, color: "text-warning", label: "Medium" },
    low: { icon: Circle, color: "text-muted-foreground", label: "Low" },
  };

  const typeConfig = {
    creative: { icon: Pencil, label: "Creative Review" },
    production: { icon: Video, label: "Production Review" },
    publishing: { icon: Rocket, label: "Publishing Review" },
  };

  if (selectedReview) {
    // Show creative review detail for creative reviews
    if (selectedReview.type === "creative") {
      return <MobileCreativeReview onBack={() => setSelectedReview(null)} />;
    }

    // Generic review detail for other types
    const TypeIcon = typeConfig[selectedReview.type].icon;

    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 border-b border-border p-4 flex items-center gap-3 bg-background">
          <button
            onClick={() => setSelectedReview(null)}
            className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <TypeIcon className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {typeConfig[selectedReview.type].label}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 pb-32 space-y-6">
          <div>
            <h1 className="text-xl font-medium mb-2">{selectedReview.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
              <span>{selectedReview.channel}</span>
              <span>•</span>
              <span>Waiting {selectedReview.timeWaiting}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  selectedReview.aiConfidence >= 80
                    ? "bg-success/20 text-success"
                    : selectedReview.aiConfidence >= 60
                    ? "bg-warning/20 text-warning"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {selectedReview.aiConfidence}% AI Confidence
              </span>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  priorityConfig[selectedReview.priority].color
                } ${
                  selectedReview.priority === "high"
                    ? "bg-destructive/20"
                    : selectedReview.priority === "medium"
                    ? "bg-warning/20"
                    : "bg-muted/30"
                }`}
              >
                {priorityConfig[selectedReview.priority].label} Priority
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Preview</h3>
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <span className="text-sm text-muted-foreground">
                Content preview
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Reach</span>
                <span className="font-medium">2.4M - 3.8M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-medium">{selectedReview.channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span
                  className={`font-medium ${
                    priorityConfig[selectedReview.priority].color
                  }`}
                >
                  {priorityConfig[selectedReview.priority].label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-safe space-y-3 shadow-2xl">
          <button className="w-full py-5 bg-success hover:bg-success/90 active:bg-success/80 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]">
            <Check className="w-6 h-6" />
            Approve
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="py-3.5 bg-accent hover:bg-accent/80 active:bg-accent/70 rounded-xl font-medium text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4" />
              Regenerate
            </button>
            <button className="py-3.5 bg-muted hover:bg-muted/80 active:bg-muted/70 rounded-xl font-medium text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filteredReviews.length} reviews pending
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`
              px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium
              transition-all duration-200 flex items-center gap-2
              ${
                activeFilter === filter.id
                  ? "bg-accent text-foreground"
                  : "bg-background text-muted-foreground border border-border"
              }
            `}
          >
            {filter.label}
            <span
              className={`
                px-2 py-0.5 rounded-full text-xs
                ${
                  activeFilter === filter.id
                    ? "bg-background/50"
                    : "bg-muted"
                }
              `}
            >
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredReviews.map((review) => {
          const PriorityIcon = priorityConfig[review.priority].icon;
          const TypeIcon = typeConfig[review.type].icon;

          return (
            <button
              key={review.id}
              onClick={() => setSelectedReview(review)}
              className={`
                w-full rounded-xl border p-4 text-left
                transition-all duration-200 active:scale-[0.98]
                ${
                  review.priority === "high"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-card"
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/30 flex items-center justify-center flex-shrink-0">
                  <TypeIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium mb-1 line-clamp-2">
                    {review.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>{review.channel}</span>
                    <span>•</span>
                    <span>{typeConfig[review.type].label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <PriorityIcon
                        className={`w-3.5 h-3.5 ${
                          priorityConfig[review.priority].color
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          priorityConfig[review.priority].color
                        }`}
                      >
                        {priorityConfig[review.priority].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            review.aiConfidence >= 80
                              ? "bg-success"
                              : review.aiConfidence >= 60
                              ? "bg-warning"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${review.aiConfidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {review.aiConfidence}%
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.timeWaiting}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
