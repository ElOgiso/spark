import { useState, useEffect } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import { WhySparkRecommends } from "./ds";
import {
  CalendarAggregationService,
  CalendarWeekSummary,
  AggregatedCalendarEvent,
  CalendarItemStatus,
} from "../services/calendar/calendarAggregationService";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Package,
  ChevronLeft,
  ChevronRight,
  Youtube,
  Video,
  Instagram,
  Linkedin,
  X,
  Calendar as CalendarIcon,
  Zap,
} from "lucide-react";

interface CalendarProps {
  onNavigate: (path: string) => void;
}

export function Calendar({ onNavigate }: CalendarProps) {
  const { productions, publishJobs, reviewItems, researchSources, publishProduction } = useSpark() as any;
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedItem, setSelectedItem] = useState<AggregatedCalendarEvent | null>(null);

  const [summary, setSummary] = useState<CalendarWeekSummary>({
    weekDays: [],
    totalScheduled: 0,
    publishedCount: 0,
    reviewNeeded: 0,
    failedCount: 0,
    todayItems: [],
    meetingsCount: 0,
    automationCount: 0,
    productionsCount: 0,
  });

  // Re-aggregate real connected calendar feed whenever context state or weekOffset changes
  useEffect(() => {
    let isMounted = true;
    CalendarAggregationService.aggregateWeekFeed({
      weekOffset,
      productions: productions || [],
      publishJobs: publishJobs || [],
      reviewItems: reviewItems || [],
      researchSources: researchSources || [],
    }).then((feed) => {
      if (isMounted) {
        setSummary(feed);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [weekOffset, productions, publishJobs, reviewItems, researchSources]);

  const statusConfig: Record<CalendarItemStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }> = {
    scheduled: { label: "Scheduled", icon: Clock, color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border/50" },
    approved: { label: "Approved", icon: CheckCircle2, color: "text-accent-foreground", bg: "bg-accent/20", border: "border-accent/40" },
    published: { label: "Published", icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
    review: { label: "Review Needed", icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    failed: { label: "Failed", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
    export_ready: { label: "Export Ready", icon: Package, color: "text-accent-foreground", bg: "bg-accent/15", border: "border-accent/30" },
    draft: { label: "Draft", icon: Clock, color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border/40" },
  };

  const platformIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    YouTube: Youtube,
    TikTok: Video,
    Instagram: Instagram,
    LinkedIn: Linkedin,
    "Google Calendar": CalendarIcon,
    "SPARK System": Zap,
  };

  const platformColor: Record<string, string> = {
    YouTube: "text-destructive",
    TikTok: "text-muted-foreground",
    Instagram: "text-warning",
    LinkedIn: "text-accent-foreground",
    "Google Calendar": "text-blue-400",
    "SPARK System": "text-emerald-400",
  };

  // Compute Week Range Header String
  const monDate = summary.weekDays[0] ? new Date(summary.weekDays[0].dateStr) : new Date();
  const sunDate = summary.weekDays[6] ? new Date(summary.weekDays[6].dateStr) : new Date();
  const monthName = monDate.toLocaleString("default", { month: "short" });
  const sunMonthName = sunDate.toLocaleString("default", { month: "short" });
  const weekTitle =
    monthName === sunMonthName
      ? `Week of ${monthName} ${monDate.getDate()}–${sunDate.getDate()}`
      : `Week of ${monthName} ${monDate.getDate()}–${sunMonthName} ${sunDate.getDate()}`;

  return (
    <>
      <TopBar pageName="Calendar" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">

          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-medium">Calendar</h1>
              <p className="text-muted-foreground mt-1">Publish control — track every production from approval to live</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="p-2 rounded-lg border border-border hover:bg-accent/20 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium px-3">{weekTitle}</span>
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-2 rounded-lg border border-border hover:bg-accent/20 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Week Summary Strip */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total This Week", value: summary.totalScheduled, color: "text-foreground", bg: "bg-card border-border" },
              { label: "Published", value: summary.publishedCount, color: "text-success", bg: "bg-success/5 border-success/20" },
              { label: "Review Needed", value: summary.reviewNeeded, color: "text-warning", bg: "bg-warning/5 border-warning/20" },
              { label: "Failed", value: summary.failedCount, color: "text-destructive", bg: summary.failedCount > 0 ? "bg-destructive/5 border-destructive/20" : "bg-card border-border" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border p-5 ${s.bg}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{s.label}</p>
                <p className={`text-3xl font-medium ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Status Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            {(Object.entries(statusConfig) as [CalendarItemStatus, typeof statusConfig[CalendarItemStatus]][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
              );
            })}
          </div>

          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-3">
            {summary.weekDays.map((dayFeed) => (
              <div key={dayFeed.dateStr} className={`rounded-xl border ${dayFeed.isToday ? "border-accent/60 bg-accent/5" : "border-border bg-card"} min-h-[280px] flex flex-col`}>
                {/* Day Header */}
                <div className={`px-3 py-2.5 border-b ${dayFeed.isToday ? "border-accent/30" : "border-border/50"}`}>
                  <p className="text-xs text-muted-foreground">{dayFeed.day}</p>
                  <p className={`text-lg font-medium ${dayFeed.isToday ? "text-accent-foreground" : ""}`}>
                    {monthName} {dayFeed.date}
                  </p>
                  {dayFeed.isToday && (
                    <span className="text-xs text-accent-foreground font-medium">Today</span>
                  )}
                </div>

                {/* Day Items */}
                <div className="flex-1 p-2 space-y-1.5">
                  {dayFeed.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground/40 text-center mt-6">No items</p>
                  ) : (
                    dayFeed.items.map((item) => {
                      const cfg = statusConfig[item.status] || statusConfig.scheduled;
                      const Icon = cfg.icon;
                      const PIcon = platformIcon[item.platform] || Video;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all hover:shadow-md ${cfg.bg} ${cfg.border} cursor-pointer`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <PIcon className={`w-3 h-3 ${platformColor[item.platform] || "text-muted-foreground"}`} />
                            <span className="text-xs text-muted-foreground truncate">{item.platform}</span>
                            <Icon className={`w-3 h-3 ${cfg.color} ml-auto flex-shrink-0`} />
                          </div>
                          <p className="text-xs font-medium leading-snug line-clamp-2">{item.title}</p>
                          {item.time && <p className="text-xs text-muted-foreground mt-1">{item.time}</p>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Today's Schedule Detail */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Today's Schedule</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {summary.todayItems.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">Nothing scheduled for today</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-background/50">
                      {["Time", "Title", "Platform", "Format", "Status", "Action"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.todayItems.map((item) => {
                      const cfg = statusConfig[item.status] || statusConfig.scheduled;
                      const Icon = cfg.icon;
                      const PIcon = platformIcon[item.platform] || Video;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="border-b border-border/50 hover:bg-accent/5 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-4">
                            <p className="text-sm text-muted-foreground">{item.time || "All Day"}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium">{item.title}</p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <PIcon className={`w-4 h-4 ${platformColor[item.platform] || "text-muted-foreground"}`} />
                              <span className="text-sm text-muted-foreground">{item.platform}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm text-muted-foreground">{item.format}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                            {item.status === "review" && (
                              <button
                                onClick={() => onNavigate("/review")}
                                className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-colors"
                              >
                                Review Storyboard
                              </button>
                            )}
                            {item.status === "approved" && (
                              <button
                                onClick={() => publishProduction && publishProduction(item.productionId || item.id)}
                                className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                              >
                                Publish Production
                              </button>
                            )}
                            {item.status === "export_ready" && (
                              <button className="px-3 py-1.5 rounded-lg bg-accent/20 text-accent-foreground text-xs font-medium hover:bg-accent/30 transition-colors">
                                Download Master
                              </button>
                            )}
                            {item.status === "failed" && (
                              <button className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
                                Resolve & Re-Run
                              </button>
                            )}
                            {(item.status === "published" || item.status === "scheduled" || item.status === "draft") && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

        </div>
      </main>

      {/* Dynamic Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/50 bg-background/30">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Calendar Item Detail</span>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg hover:bg-accent/20 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium ${(statusConfig[selectedItem.status] || statusConfig.scheduled).bg} ${(statusConfig[selectedItem.status] || statusConfig.scheduled).border} ${(statusConfig[selectedItem.status] || statusConfig.scheduled).color}`}>
                    {selectedItem.status === "review" ? "Awaiting Review" : selectedItem.status}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{selectedItem.time || "All Day"}</span>
                </div>
                <h3 className="text-lg font-medium leading-snug">{selectedItem.title}</h3>
              </div>

              {/* Caption / Description Section */}
              <div className="p-3.5 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">Event Description</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedItem.description || selectedItem.title}
                </p>
              </div>

              {/* Format & Platform */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-background border border-border">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Format / Type</p>
                  <p className="text-xs font-semibold">{selectedItem.format}</p>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Platform / Source</p>
                  <p className="text-xs font-semibold">{selectedItem.platform}</p>
                </div>
              </div>

              {/* Why Spark Recommends */}
              <WhySparkRecommends
                details={{
                  reason: `Scheduled for ${selectedItem.time || "2:00 PM"} on ${selectedItem.platform}. Dynamic feed aggregated from real connected data layers.`,
                  evidence: [
                    `Source: ${selectedItem.sourceType.toUpperCase()} stream normalized by CalendarAggregationService.`,
                    `Sequence rule: Stream is sequenced to auto-distribute immediately after review is finalized.`,
                    selectedItem.status === "review"
                      ? "ALERT: Auto-publish is currently BLOCKED. You must approve the storyboard in Review first."
                      : "Auto-publish is fully authorized and integrated with connected master channels."
                  ],
                  confidence: (selectedItem.status === "failed" ? "Medium" : "Very High") as any,
                  confidencePercent: selectedItem.status === "failed" ? 74 : 95,
                  expectedOutcome: `Optimal release and audience reach on ${selectedItem.platform}.`,
                  risk: selectedItem.status === "failed" ? "Medium" : "Low",
                  nextBestAction: selectedItem.status === "review" ? "Approve Storyboard" : "Monitor Performance Logs",
                  brandRules: ["Publishing Rhythm Rule #1: Consistent Releases", "Timezone Optimization"]
                }}
                defaultExpanded={true}
              />
            </div>

            {/* Footer */}
            <div className="p-4 bg-background/30 border-t border-border/50 flex justify-end gap-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-accent/20 transition-colors"
              >
                Close
              </button>
              {selectedItem.status === "review" && (
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    onNavigate("/review");
                  }}
                  className="px-4 py-2 text-sm font-medium text-background bg-foreground rounded-lg hover:bg-foreground/90 transition-all"
                >
                  Review Storyboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
