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
    <div className="space-y-6">
      {/* Media Activity Cards Grid (Spark Media Video Card DNA) */}
      {mediaActivities.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
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
                className="d-press relative rounded-2xl bg-white/[0.035] border border-white/10 hover:border-purple-500/40 p-4 flex flex-col justify-between overflow-hidden group shadow-lg transition-all duration-200 cursor-pointer"
              >
                {/* Media Image / Aspect Thumbnail Box */}
                <div className="relative w-full aspect-video rounded-xl bg-black/60 border border-white/10 overflow-hidden mb-3.5 flex items-center justify-center">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={activity.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <Tv className="w-8 h-8 text-white/30 mb-1.5" />
                      <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
                        Spark Production
                      </span>
                    </div>
                  )}

                  {/* Play Video Button on cards with playable videoUrl */}
                  {isPlayable ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFullscreenVideo({
                          videoUrl: activity.videoUrl!,
                          title: activity.title,
                        });
                      }}
                      className="m-press cursor-pointer"
                      title="Play Video Fullscreen"
                      style={{
                        position: "absolute",
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "rgba(168,85,247,0.9)",
                        backdropFilter: "blur(8px)",
                        border: "1.5px solid rgba(255,255,255,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 0 20px rgba(168,85,247,0.8)",
                        zIndex: 10,
                      }}
                    >
                      <Play
                        style={{
                          width: 18,
                          height: 18,
                          color: "white",
                          fill: "white",
                          marginLeft: 2,
                        }}
                      />
                    </button>
                  ) : null}

                  {/* Generating / Rendering overlay */}
                  {activity.isGenerating && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-20">
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                      <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest animate-pulse">
                        Rendering...
                      </span>
                    </div>
                  )}
                </div>

                {/* Info Text */}
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold leading-snug text-white line-clamp-2 group-hover:text-purple-300 transition-colors">
                    {activity.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-white/50 pt-0.5">
                    <span className="truncate max-w-[70%] font-medium text-white/70">
                      {activity.statusLabel || activity.metadata}
                    </span>
                    {activity.timestamp && activity.timestamp !== "—" && (
                      <span className="text-[11px] text-white/40 whitespace-nowrap">
                        {activity.timestamp}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Non-Media Timeline Activity Rows (Quiet, Honest System Signals) */}
      {nonMediaActivities.length > 0 && (
        <div className="space-y-1 pt-1">
          {mediaActivities.length > 0 && (
            <div className="text-[11px] uppercase tracking-wider font-semibold text-white/40 px-1 pt-2 pb-1">
              System Events & Signals
            </div>
          )}
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {nonMediaActivities.map((activity) => {
              const config = activityConfig[activity.type] || activityConfig.opportunity;
              const Icon = config.icon;

              return (
                <div
                  key={activity.id}
                  onClick={() => onNavigate?.(getRouteForActivity(activity))}
                  className="flex items-center justify-between gap-4 p-3 hover:bg-white/[0.04] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      <Icon className={`w-4 h-4 ${config.color}`} />
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
