import { ArrowUpCircle, Circle, CheckCircle2, Clock } from "lucide-react";

type ReviewType = "creative" | "production" | "publishing";
type Priority = "high" | "medium" | "low";
type Status = "pending" | "in_review" | "ai_approved";

interface ReviewItem {
  id: string;
  title: string;
  channel: string;
  series?: string;
  reviewType: ReviewType;
  priority: Priority;
  status: Status;
  aiConfidence: number;
  timeWaiting: string;
}

interface PendingReviewsListProps {
  reviews: ReviewItem[];
  onReviewClick?: (id: string) => void;
}

const priorityConfig = {
  high: {
    icon: ArrowUpCircle,
    color: "text-destructive",
    label: "High",
  },
  medium: {
    icon: Circle,
    color: "text-warning",
    label: "Medium",
  },
  low: {
    icon: Circle,
    color: "text-muted-foreground",
    label: "Low",
  },
};

const statusConfig = {
  pending: {
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    label: "Pending",
  },
  in_review: {
    icon: Circle,
    color: "text-accent-foreground",
    bg: "bg-accent/20",
    label: "In Review",
  },
  ai_approved: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10",
    label: "AI Approved",
  },
};

const reviewTypeLabels = {
  creative: "Creative Review",
  production: "Production Review",
  publishing: "Publishing Review",
};

export function PendingReviewsList({
  reviews,
  onReviewClick,
}: PendingReviewsListProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-background/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Title
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Account
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Series
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Review Type
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Priority
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                AI Confidence
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Waiting
              </th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => {
              const PriorityIcon = priorityConfig[review.priority].icon;
              const StatusIcon = statusConfig[review.status].icon;

              return (
                <tr
                  key={review.id}
                  onClick={() => onReviewClick?.(review.id)}
                  className="border-b border-border/50 hover:bg-accent/5 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium group-hover:text-foreground transition-colors">
                      {review.title}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-muted-foreground">
                      {review.channel}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-muted-foreground">
                      {review.series || "—"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-muted-foreground">
                      {reviewTypeLabels[review.reviewType]}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <PriorityIcon
                        className={`w-4 h-4 ${priorityConfig[review.priority].color}`}
                      />
                      <span
                        className={`text-sm ${priorityConfig[review.priority].color}`}
                      >
                        {priorityConfig[review.priority].label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        className={`w-4 h-4 ${statusConfig[review.status].color}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {statusConfig[review.status].label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
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
                      <span className="text-sm text-muted-foreground">
                        {review.aiConfidence}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-muted-foreground">
                      {review.timeWaiting}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
