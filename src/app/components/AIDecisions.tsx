import { Brain, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type DecisionOutcome = "approved" | "rejected" | "flagged";

interface AIDecision {
  id: string;
  decision: string;
  reason: string;
  confidence: number;
  outcome: DecisionOutcome;
  timestamp: string;
}

interface AIDecisionsProps {
  decisions: AIDecision[];
}

const outcomeConfig = {
  approved: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    label: "Approved",
  },
  rejected: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    label: "Rejected",
  },
  flagged: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    label: "Flagged for Review",
  },
};

export function AIDecisions({ decisions }: AIDecisionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-5 h-5 text-accent-foreground" />
        <h2 className="text-lg font-medium">AI Decisions</h2>
        <span className="text-sm text-muted-foreground">
          Last 24 hours
        </span>
      </div>

      <div className="space-y-3">
        {decisions.map((decision) => {
          const config = outcomeConfig[decision.outcome];
          const Icon = config.icon;

          return (
            <div
              key={decision.id}
              className={`
                rounded-lg border p-4
                ${config.bg} ${config.border}
                hover:shadow-lg hover:shadow-black/5 transition-all duration-200
              `}
            >
              <div className="flex items-start gap-4">
                <div className={`${config.color} mt-1`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h4 className="text-sm font-medium">{decision.decision}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {decision.reason}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {decision.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Confidence:
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              decision.confidence >= 80
                                ? "bg-success"
                                : decision.confidence >= 60
                                ? "bg-warning"
                                : "bg-destructive"
                            }`}
                            style={{ width: `${decision.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {decision.confidence}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Outcome:
                      </span>
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
