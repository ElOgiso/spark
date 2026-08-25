import React, { useState } from "react";
import {
  Play,
  Tv,
  Loader2,
  Lightbulb,
  CheckCircle2,
  Video,
  Rocket,
  BarChart3,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { VideoFullscreenModal } from "./mobile/DonorSparkMediaHome";

export interface Activity {
  id: string;
  type:
    | "opportunity_discovered"
    | "storyboard_approved"
    | "production_completed"
    | "production_generating"
    | "publishing_completed"
    | "analytics_updated"
    | "memory_rule_added"
    | "opportunity"
    | "approved"
    | "completed"
    | "published"
    | "analytics";
  title: string;
  metadata: string;
  timestamp: string;

  // Optional media fields for production / review activities
  hasMedia?: boolean;
  thumbnailUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  isGenerating?: boolean;
  score?: number;
  statusLabel?: string;
  productionId?: string;
  targetPath?: string;
}

const activityConfig: Record<string, { icon: any; color: string; bg: string }> = {
  opportunity_discovered: {
    icon: Lightbulb,
    color: "text-accent-foreground",
    bg: "bg-accent/30",
  },
  opportunity: {
    icon: Lightbulb,
    color: "text-accent-foreground",
    bg: "bg-accent/30",
  },
  storyboard_approved: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/20",
  },
  approved: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/20",
  },
  production_completed: {
    icon: Video,
    color: "text-accent-foreground",
    bg: "bg-accent/30",
  },
  production_generating: {
    icon: Loader2,
    color: "text-purple-400",
    bg: "bg-purple-500/20",
  },
  completed: {
    icon: Video,
    color: "text-accent-foreground",
    bg: "bg-accent/30",
  },
  publishing_completed: {
    icon: Rocket,
    color: "text-success",
    bg: "bg-success/20",
  },
  published: {
    icon: Rocket,
    color: "text-success",
    bg: "bg-success/20",
  },
  analytics_updated: {
    icon: BarChart3,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
  },
  analytics: {
    icon: BarChart3,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
  },
  memory_rule_added: {
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/20",
  },
};

interface ActivityFeedProps {
  activities: Activity[];
  onNavigate?: (path: string) => void;
}

export function ActivityFeed({ activities, onNavigate }: ActivityFeedProps) {
  const [activeFullscreenVideo, setActiveFullscreenVideo] = useState<{
    videoUrl: string;
    title?: string;
  } | null>(null);

  const getRouteForActivity = (activity: Activity) => {
    if (activity.targetPath) return activity.targetPath;
    switch (activity.type) {
      case "opportunity_discovered":
      case "opportunity":
        return "/viral-sparks";
      case "storyboard_approved":
      case "approved":
        return "/calendar";
      case "production_completed":
      case "production_generating":
      case "completed":
        return "/review";
      case "publishing_completed":
      case "published":
      case "analytics_updated":
      case "analytics":
        return "/analytics";
      case "memory_rule_added":
        return "/my-spark";
      default:
        return "/";
    }
  };

  const mediaActivities = activities.filter(
    (a) =>
      a.hasMedia ||
      Boolean(a.thumbnailUrl || a.imageUrl || a.videoUrl || a.isGenerating) ||
      a.type === "production_completed" ||
      a.type === "production_generating"
  );

  const nonMediaActivities = activities.filter(
    (a) =>
      !a.hasMedia &&
      !a.thumbnailUrl &&
      !a.imageUrl &&
      !a.videoUrl &&
      !a.isGenerating &&
      a.type !== "production_completed" &&
      a.type !== "production_generating"
  );

  return (
    <div className="space-y-4">
      {/* Media Project Rows (CapCut-dense, native, sleek) */}
      {mediaActivities.length > 0 && (
        <div className="space-y-2">
          {mediaActivities.map((activity) => {
            const thumb = activity.thumbnailUrl || activity.imageUrl;
            const isPlayable = Boolean(
              activity.videoUrl &&
                !activity.isGenerating &&
                typeof activity.videoUrl === "string" &&
                activity.videoUrl.startsWith("http")
            );

            return (
              <div
                key={activity.id}
                onClick={() => onNavigate?.(getRouteForActivity(activity))}
                className="flex items-center justify-between gap-3.5 p-2.5 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.03] active:bg-white/[0.05] transition-all cursor-pointer group"
              >
                {/* Left: Compact thumbnail (w-20 sm:w-24, aspect 16:10 / 4:3) */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative w-20 h-13 sm:w-24 sm:h-14 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={activity.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full bg-white/[0.02]">
                        <Tv className="w-5 h-5 text-white/30" />
                      </div>
                    )}

                    {/* Tiny Play button overlay on thumb */}
                    {isPlayable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFullscreenVideo({
                            videoUrl: activity.videoUrl!,
                            title: activity.title,
                          });
                        }}
                        className="cursor-pointer active:scale-90 transition-transform"
                        title="Play Video"
                        style={{
                          position: "absolute",
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "rgba(168,85,247,0.9)",
                          backdropFilter: "blur(4px)",
                          border: "1px solid rgba(255,255,255,0.6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 0 10px rgba(168,85,247,0.6)",
                          zIndex: 10,
                        }}
                      >
                        <Play
                          style={{
                            width: 11,
                            height: 11,
                            color: "white",
                            fill: "white",
                            marginLeft: 1,
                          }}
                        />
                      </button>
                    )}

                    {/* Generating indicator */}
                    {activity.isGenerating && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] flex items-center justify-center z-20">
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Center: Title (1 line) + Status metadata */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold leading-snug text-white group-hover:text-purple-300 transition-colors truncate">
                      {activity.title}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-white/50 truncate mt-0.5 flex items-center gap-1.5">
                      <span className="text-white/75 font-medium">
                        {activity.statusLabel || activity.metadata}
                      </span>
                      {activity.timestamp && activity.timestamp !== "—" && (
                        <>
                          <span className="text-white/30">•</span>
                          <span>{activity.timestamp}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Quick action hint */}
                <div className="flex items-center gap-2 flex-shrink-0 text-white/30 group-hover:text-white/70 transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Non-Media Timeline Activity Rows (Quiet, Honest System Signals) */}
      {nonMediaActivities.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {mediaActivities.length > 0 && (
            <div className="text-[11px] uppercase tracking-wider font-semibold text-white/40 px-1 pt-1">
              System Events & Signals
            </div>
          )}
          <div className="space-y-1">
            {nonMediaActivities.map((activity) => {
              const config = activityConfig[activity.type] || activityConfig.opportunity;
              const Icon = config.icon;

              return (
                <div
                  key={activity.id}
                  onClick={() => onNavigate?.(getRouteForActivity(activity))}
                  className="flex items-center justify-between gap-3.5 p-2 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.03] active:bg-white/[0.05] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-semibold text-white/90 group-hover:text-purple-300 transition-colors truncate">
                        {activity.title}
                      </h5>
                      <p className="text-[11px] text-white/50 truncate">
                        {activity.metadata}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-white/40 whitespace-nowrap">
                      {activity.timestamp}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/80 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fullscreen Video Player Modal Reuse */}
      {activeFullscreenVideo && (
        <VideoFullscreenModal
          videoUrl={activeFullscreenVideo.videoUrl}
          title={activeFullscreenVideo.title}
          onClose={() => setActiveFullscreenVideo(null)}
        />
      )}
    </div>
  );
}
