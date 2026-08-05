import { ArrowRight, AlertCircle } from "lucide-react";

interface ReviewQueueSummary {
  creative: number;
  production: number;
  publishing: number;
}

interface ReviewQueueProps {
  summary: ReviewQueueSummary;
  onReviewClick?: (type: "creative" | "production" | "publishing") => void;
}

export function ReviewQueue({ summary, onReviewClick }: ReviewQueueProps) {
  const sections = [
    {
      type: "creative" as const,
      label: "Creative Reviews Pending",
      count: summary.creative,
      description: "Opportunities, narratives, and storyboards",
    },
    {
      type: "production" as const,
      label: "Production Reviews Pending",
      count: summary.production,
      description: "Rendered videos, voice, and captions",
    },
    {
      type: "publishing" as const,
      label: "Publishing Reviews Pending",
      count: summary.publishing,
      description: "Publishing queue and metadata",
    },
  ];

  const totalPending = summary.creative + summary.production + summary.publishing;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">Review Queue</h2>
          {totalPending > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 border border-warning/30">
              <AlertCircle className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs font-medium text-warning">
                {totalPending} pending
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.type}
            className={`
              rounded-lg border p-5
              ${
                section.count > 0
                  ? "border-warning/30 bg-warning/5"
                  : "border-border/50 bg-background/50"
              }
              transition-all duration-200
            `}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-medium">{section.label}</h3>
                  <span className="text-2xl font-medium">
                    {section.count}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>

              <button
                onClick={() => onReviewClick?.(section.type)}
                disabled={section.count === 0}
                className={`
                  px-6 py-2.5 rounded-lg font-medium text-sm
                  flex items-center gap-2 transition-all duration-200
                  ${
                    section.count > 0
                      ? "bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }
                `}
              >
                Review Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
