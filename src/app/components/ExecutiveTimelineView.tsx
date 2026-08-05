import React from "react";
import { Sparkles, Calendar, Bookmark, ShieldCheck, ArrowRight } from "lucide-react";
import { Button, GlassCard, StatusChip } from "./ds";
import { useSpark } from "../state/SparkContext";

interface ExecutiveTimelineViewProps {
  onNavigate: (route: string) => void;
}

export const ExecutiveTimelineView: React.FC<ExecutiveTimelineViewProps> = ({ onNavigate }) => {
  const { timeline, memoryItems } = useSpark() as any;
  const safeMemoryItems = memoryItems || [];
  const safeTimeline = timeline || [];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Executive Timeline & Memory</h1>
          <p className="text-sm text-muted-foreground">
            Chronological log of creator milestones, strategic directives, and learned brand rules.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate("/more")}>
          ← Back to Settings
        </Button>
      </div>

      {/* Active Brand Rules */}
      <GlassCard className="p-6 border-purple-500/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-purple-400" />
            <h2 className="font-semibold text-base">Active Brand Rules & Learned Patterns</h2>
          </div>
          <StatusChip variant="ready" label={`${safeMemoryItems.length} Saved Rules`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {safeMemoryItems.map((item: any) => (
            <div key={item.id} className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold uppercase tracking-wider ${item.type === "rule" ? "text-purple-400" : "text-cyan-400"}`}>
                  {item.type}
                </span>
                <span className="text-muted-foreground font-mono">{item.dateAdded}</span>
              </div>
              <p className="text-xs text-foreground font-medium">{item.text}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Milestones Log */}
      <GlassCard className="p-6 border-white/10">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-4 h-4 text-purple-400" />
          <h2 className="font-semibold text-base">Executive Milestone Log</h2>
        </div>

        {safeTimeline.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No milestones recorded yet. Your Executive Director will record milestones as you direct productions.
          </p>
        ) : (
          <div className="space-y-4">
            {safeTimeline.map((item: any) => (
              <div key={item.id} className="flex gap-4 p-4 rounded-xl bg-black/30 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300">
                    <span>{item.type}</span>
                    <span className="text-muted-foreground font-normal font-mono">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-foreground mt-1 font-medium">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};
