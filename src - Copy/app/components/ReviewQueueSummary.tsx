import { Pencil, Video, Rocket, AlertCircle, CheckCircle2 } from "lucide-react";

interface QueueSummary {
  creative: number;
  production: number;
  publishing: number;
  needsAttention: number;
  aiApproved: number;
}

interface ReviewQueueSummaryProps {
  summary: QueueSummary;
  onCardClick?: (type: string) => void;
}

export function ReviewQueueSummary({
  summary,
  onCardClick,
}: ReviewQueueSummaryProps) {
  const cards = [
    {
      id: "creative",
      label: "Creative Reviews Pending",
      count: summary.creative,
      icon: Pencil,
      color: "text-accent-foreground",
      bg: "bg-accent/20",
      border: "border-accent/40",
    },
    {
      id: "production",
      label: "Production Reviews Pending",
      count: summary.production,
      icon: Video,
      color: "text-accent-foreground",
      bg: "bg-accent/20",
      border: "border-accent/40",
    },
    {
      id: "publishing",
      label: "Publishing Reviews Pending",
      count: summary.publishing,
      icon: Rocket,
      color: "text-accent-foreground",
      bg: "bg-accent/20",
      border: "border-accent/40",
    },
    {
      id: "needs_attention",
      label: "Needs Attention",
      count: summary.needsAttention,
      icon: AlertCircle,
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/30",
    },
    {
      id: "ai_approved",
      label: "AI Approved",
      count: summary.aiApproved,
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <button
            key={card.id}
            onClick={() => onCardClick?.(card.id)}
            className={`
              rounded-xl border p-6
              ${card.bg} ${card.border}
              hover:shadow-xl hover:shadow-black/10 transition-all duration-200
              text-left
            `}
          >
            <div className={`${card.color} mb-4`}>
              <Icon className="w-6 h-6" />
            </div>
            <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wide">
              {card.label}
            </p>
            <p className="text-4xl font-medium tracking-tight">{card.count}</p>
          </button>
        );
      })}
    </div>
  );
}
