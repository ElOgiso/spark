import React from "react";
import { Sparkles, Loader2, CheckCircle2, ShieldAlert, ChevronRight, ArrowRight, Brain } from "lucide-react";
import { WhySparkRecommends } from "./ds";

export interface DepartmentStep {
  department: string;
  status: "idle" | "running" | "completed" | "failed";
  action: string;
  subActions?: string[];
  progress?: number;
}

const PIPELINE_STAGES = [
  "Research",
  "Creative Decision",
  "Planning",
  "Storyboard",
  "Generation",
  "Editing",
  "Review",
  "Publishing",
  "Learning"
];

interface DepartmentActivityProps {
  steps?: DepartmentStep[];
  activeDepartment?: string;
  currentStageIndex?: number;
  rationale?: {
    reason: string;
    evidence: string[];
    confidence: "Low" | "Medium" | "High" | "Very High";
    confidencePercent?: number;
    expectedOutcome: string;
    risk: "Low" | "Medium" | "High";
    nextBestAction?: string;
    brandRules?: string[];
  };
}

export const DepartmentActivity: React.FC<DepartmentActivityProps> = ({
  steps = [],
  activeDepartment = "Executive Director",
  currentStageIndex = 3,
  rationale,
}) => {
  return (
    <div className="space-y-4 my-3">
      {/* ── 9-Stage Donor Pipeline Visualization ── */}
      <div className="rounded-xl border border-border bg-card/80 p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-foreground animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Production Pipeline
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground border border-accent/20 font-semibold">
            Stage {Math.min(currentStageIndex + 1, PIPELINE_STAGES.length)} of {PIPELINE_STAGES.length}
          </span>
        </div>

        {/* Horizontal Pipeline Steps */}
        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 pt-1">
          {PIPELINE_STAGES.map((stageName, idx) => {
            const isDone = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;

            return (
              <div
                key={stageName}
                className={`p-2 rounded-lg border text-[10px] flex flex-col items-center justify-center text-center transition-all ${
                  isCurrent
                    ? "bg-accent/20 border-accent text-accent-foreground font-bold shadow-sm animate-pulse"
                    : isDone
                    ? "bg-success/10 border-success/30 text-success font-medium"
                    : "bg-background/40 border-border/40 text-muted-foreground/50"
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  {isDone && <CheckCircle2 className="w-3 h-3 text-success shrink-0" />}
                  {isCurrent && <Loader2 className="w-3 h-3 text-accent-foreground animate-spin shrink-0" />}
                  {!isDone && !isCurrent && <div className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                </div>
                <span className="truncate w-full font-sans leading-tight">{stageName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Active Department Swarm Activity Cards ── */}
      {steps.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-accent-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Agent Swarm: {activeDepartment}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded border border-border/40">
              Live Swarm Engine
            </span>
          </div>

          <div className="space-y-2">
            {steps.map((step) => {
              const isRunning = step.status === "running";
              const isCompleted = step.status === "completed";
              const isFailed = step.status === "failed";
              const progressVal = isCompleted ? 100 : step.progress || (isRunning ? 65 : 0);

              return (
                <div
                  key={step.department}
                  className={`flex flex-col p-3 rounded-xl border text-xs transition-all ${
                    isRunning
                      ? "bg-accent/15 border-accent/40 text-foreground shadow-md"
                      : isCompleted
                      ? "bg-background/40 text-muted-foreground border-border/40"
                      : isFailed
                      ? "bg-destructive/10 text-destructive border-destructive/25"
                      : "text-muted-foreground/40 border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isRunning && <Loader2 className="w-3.5 h-3.5 text-accent-foreground animate-spin" />}
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                      {isFailed && <ShieldAlert className="w-3.5 h-3.5 text-destructive" />}
                      {!isRunning && !isCompleted && !isFailed && (
                        <div className="w-3.5 h-3.5 rounded-full border border-border" />
                      )}
                      <span className="font-semibold text-foreground">[{step.department}]</span>
                    </div>

                    <span className="text-[11px] font-mono text-muted-foreground">
                      {step.action}
                    </span>
                  </div>

                  {(isRunning || isCompleted) && (
                    <div className="mt-2 space-y-1.5">
                      <div className="w-full bg-border/40 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${isCompleted ? "bg-success" : "bg-accent animate-pulse"}`}
                          style={{ width: `${progressVal}%` }}
                        />
                      </div>

                      {isRunning && step.subActions && step.subActions.length > 0 && (
                        <div className="pt-1.5 border-t border-border/30 space-y-1 pl-2">
                          {step.subActions.map((sub, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                              <ChevronRight className="w-3 h-3 text-accent-foreground shrink-0" />
                              <span>{sub}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Creative Director Rationale Panel ── */}
      {rationale && (
        <WhySparkRecommends details={rationale} defaultExpanded={true} />
      )}
    </div>
  );
};
