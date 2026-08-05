import { Shield, ChevronDown, CheckCircle2, AlertCircle, Zap } from "lucide-react";

type AutomationMode = "manual" | "balanced" | "autonomous";
type GateStatus = "required" | "optional" | "automated";

interface ReviewGate {
  id: string;
  name: string;
  status: GateStatus;
}

interface GovernanceStatusProps {
  automationMode: AutomationMode;
  reviewGates: ReviewGate[];
  onModeChange?: (mode: AutomationMode) => void;
  onGateClick?: (gateId: string) => void;
}

const modeConfig = {
  manual: {
    label: "Manual",
    description: "All decisions require human approval",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
  balanced: {
    label: "Balanced",
    description: "AI handles routine decisions, humans approve strategic ones",
    color: "text-accent-foreground",
    bg: "bg-accent/20",
    border: "border-accent/40",
  },
  autonomous: {
    label: "Autonomous",
    description: "AI makes most decisions, humans set strategy",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
  },
};

const gateStatusConfig = {
  required: {
    label: "Required",
    icon: AlertCircle,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
  optional: {
    label: "Optional",
    icon: CheckCircle2,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    border: "border-border/50",
  },
  automated: {
    label: "Automated",
    icon: Zap,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
  },
};

export function GovernanceStatus({
  automationMode,
  reviewGates,
  onModeChange,
  onGateClick,
}: GovernanceStatusProps) {
  const currentMode = modeConfig[automationMode];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-5 h-5 text-foreground" />
        <h2 className="text-lg font-medium">Governance Overview</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-sm text-muted-foreground mb-3 block">
            Automation Mode
          </label>
          <button
            className={`
              w-full rounded-lg border p-4
              ${currentMode.bg} ${currentMode.border}
              hover:shadow-lg transition-all duration-200
              flex items-center justify-between
            `}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-3 h-3 rounded-full ${currentMode.bg} ring-4 ${
                  automationMode === 'manual'
                    ? 'ring-warning/20'
                    : automationMode === 'autonomous'
                    ? 'ring-success/20'
                    : 'ring-accent/20'
                }`}
              />
              <div className="text-left">
                <p className={`text-sm font-medium ${currentMode.color}`}>
                  {currentMode.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentMode.description}
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-3 block">
            Review Gates
          </label>
          <div className="space-y-2">
            {reviewGates.map((gate) => {
              const statusConfig = gateStatusConfig[gate.status];
              const StatusIcon = statusConfig.icon;

              return (
                <button
                  key={gate.id}
                  onClick={() => onGateClick?.(gate.id)}
                  className={`
                    w-full flex items-center justify-between p-3 rounded-lg border
                    ${statusConfig.bg} ${statusConfig.border}
                    hover:shadow-md transition-all duration-200
                  `}
                >
                  <span className="text-sm font-medium">{gate.name}</span>
                  <div className={`flex items-center gap-2 ${statusConfig.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">{statusConfig.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
