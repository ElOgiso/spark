import { useState } from "react";
import { useSpark } from "../state/SparkContext";
import { TopBar } from "./TopBar";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  Youtube,
  Video,
  Instagram,
  Linkedin,
} from "lucide-react";

interface CalendarProps {
  onNavigate: (path: string) => void;
}

type ItemStatus = "scheduled" | "approved" | "published" | "review" | "failed" | "export_ready";

interface CalendarItem {
  id: string;
  title: string;
  platform: string;
  status: ItemStatus;
  time?: string;
  format: string;
}

interface CalendarDay {
  date: number;
  day: string;
  isToday: boolean;
  items: CalendarItem[];
}

export function Calendar({ onNavigate }: CalendarProps) {
  const { publishJobs, reviewItems } = useSpark();
  const [weekOffset, setWeekOffset] = useState(0);

  const statusConfig: Record<ItemStatus, { label: string; icon: React.ComponentType<{className?: string}>; color: string; bg: string; border: string }> = {
    scheduled: { label: "Scheduled", icon: Clock, color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border/50" },
    approved: { label: "Approved", icon: CheckCircle2, color: "text-accent-foreground", bg: "bg-accent/20", border: "border-accent/40" },
    published: { label: "Published", icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
    review: { label: "Review Needed", icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    failed: { label: "Failed", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
    export_ready: { label: "Export Ready", icon: Package, color: "text-accent-foreground", bg: "bg-accent/15", border: "border-accent/30" },
  };

  const platformIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    YouTube: Youtube,
    TikTok: Video,
    Instagram: Instagram,
    LinkedIn: Linkedin,
  };

  const platformColor: Record<string, string> = {
    YouTube: "text-destructive",
    TikTok: "text-muted-foreground",
    Instagram: "text-warning",
    LinkedIn: "text-accent-foreground",
  };

  // Compute dynamic items for Wednesday (Jul 3)
  const dynamicWedItems: CalendarItem[] = [];

  // 1. Add any items from reviewItems that are Pending Review (Review Needed) or Needs Edit (Failed / Revise)
  reviewItems.forEach((r) => {
    if (r.status === "Pending Review") {
      dynamicWedItems.push({
        id: r.id,
        title: r.title,
        platform: r.account,
        status: "review",
        time: "2:00 PM",
        format: r.title.includes("Tactics") ? "Long-form" : "Short"
      });
    } else if (r.status === "Needs Edit") {
      dynamicWedItems.push({
        id: r.id,
        title: r.title,
        platform: r.account,
        status: "failed",
        time: "7:00 PM",
        format: r.title.includes("Tactics") ? "Long-form" : "Short"
      });
    }
  });

  // 2. Add any items from publishJobs that are Scheduled or Export Ready
  publishJobs.forEach((pj) => {
    const isPjAlreadyAdded = dynamicWedItems.some((item) => item.title === pj.title);
    if (!isPjAlreadyAdded) {
      dynamicWedItems.push({
        id: pj.id,
        title: pj.title,
        platform: pj.platform,
        status: pj.status === "Export Ready" ? "export_ready" : "scheduled",
        time: pj.scheduledTime || "4:00 PM",
        format: pj.title.includes("Tactics") ? "Long-form" : "Short"
      });
    }
  });

  // Fallback to defaults if list ends up empty
  if (dynamicWedItems.length === 0) {
    dynamicWedItems.push(
      { id: "w1", title: "5 Viral Marketing Tactics", platform: "YouTube", status: "review", time: "2:00 PM", format: "Long-form" },
      { id: "w2", title: "Psychology of Viral Content", platform: "TikTok", status: "approved", time: "6:00 PM", format: "Short" },
      { id: "w3", title: "AI Content Creation", platform: "Instagram", status: "export_ready", time: "8:00 PM", format: "Reel" }
    );
  }

  const weekDays: CalendarDay[] = [
    {
      date: 1, day: "Mon", isToday: false,
      items: [
        { id: "m1", title: "AI Tool Comparison 2026", platform: "YouTube", status: "published", time: "2:00 PM", format: "Long-form" },
        { id: "m2", title: "Quick Edit Tutorial", platform: "TikTok", status: "published", time: "6:00 PM", format: "Short" },
      ],
    },
    {
      date: 2, day: "Tue", isToday: false,
      items: [
        { id: "t1", title: "Creator Economy Stats", platform: "LinkedIn", status: "published", time: "9:00 AM", format: "Article" },
        { id: "t2", title: "Behind the Algorithm", platform: "YouTube", status: "scheduled", time: "3:00 PM", format: "Long-form" },
      ],
    },
    {
      date: 3, day: "Wed", isToday: true,
      items: dynamicWedItems,
    },
    {
      date: 4, day: "Thu", isToday: false,
      items: [
        { id: "th1", title: "Building Personal Brand", platform: "LinkedIn", status: "approved", time: "9:00 AM", format: "Article" },
        { id: "th2", title: "Free Tools Roundup", platform: "YouTube", status: "scheduled", time: "2:00 PM", format: "Tutorial" },
        { id: "th3", title: "Tech News Nigeria", platform: "TikTok", status: "failed", time: "7:00 PM", format: "Short" },
      ],
    },
    {
      date: 5, day: "Fri", isToday: false,
      items: [
        { id: "f1", title: "Content Workflow Optimization", platform: "YouTube", status: "scheduled", time: "1:00 PM", format: "Tutorial" },
        { id: "f2", title: "Nigerian Creator Story", platform: "Instagram", status: "review", time: "5:00 PM", format: "Carousel" },
      ],
    },
    {
      date: 6, day: "Sat", isToday: false,
      items: [
        { id: "s1", title: "Weekend Tech Roundup", platform: "YouTube", status: "scheduled", time: "11:00 AM", format: "Short" },
      ],
    },
    {
      date: 7, day: "Sun", isToday: false,
      items: [],
    },
  ];

  const todayItems = weekDays.find((d) => d.isToday)?.items ?? [];
  const totalScheduled = weekDays.flatMap((d) => d.items).length;
  const publishedCount = weekDays.flatMap((d) => d.items).filter((i) => i.status === "published").length;
  const reviewNeeded = weekDays.flatMap((d) => d.items).filter((i) => i.status === "review").length;
  const failedCount = weekDays.flatMap((d) => d.items).filter((i) => i.status === "failed").length;

  return (
    <>
      <TopBar workspaceName="Calendar" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">

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
              <span className="text-sm font-medium px-3">Week of Jul {1 + weekOffset * 7}–{7 + weekOffset * 7}</span>
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
              { label: "Total This Week", value: totalScheduled, color: "text-foreground", bg: "bg-card border-border" },
              { label: "Published", value: publishedCount, color: "text-success", bg: "bg-success/5 border-success/20" },
              { label: "Review Needed", value: reviewNeeded, color: "text-warning", bg: "bg-warning/5 border-warning/20" },
              { label: "Failed", value: failedCount, color: "text-destructive", bg: failedCount > 0 ? "bg-destructive/5 border-destructive/20" : "bg-card border-border" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border p-5 ${s.bg}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{s.label}</p>
                <p className={`text-3xl font-medium ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Status Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            {(Object.entries(statusConfig) as [ItemStatus, typeof statusConfig[ItemStatus]][]).map(([key, cfg]) => {
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
            {weekDays.map((day) => (
              <div key={day.date} className={`rounded-xl border ${day.isToday ? "border-accent/60 bg-accent/5" : "border-border bg-card"} min-h-[280px] flex flex-col`}>
                {/* Day Header */}
                <div className={`px-3 py-2.5 border-b ${day.isToday ? "border-accent/30" : "border-border/50"}`}>
                  <p className="text-xs text-muted-foreground">{day.day}</p>
                  <p className={`text-lg font-medium ${day.isToday ? "text-accent-foreground" : ""}`}>
                    Jul {day.date}
                  </p>
                  {day.isToday && (
                    <span className="text-xs text-accent-foreground font-medium">Today</span>
                  )}
                </div>

                {/* Day Items */}
                <div className="flex-1 p-2 space-y-1.5">
                  {day.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground/40 text-center mt-6">No productions</p>
                  ) : (
                    day.items.map((item) => {
                      const cfg = statusConfig[item.status];
                      const Icon = cfg.icon;
                      const PIcon = platformIcon[item.platform] || Video;
                      return (
                        <button
                          key={item.id}
                          onClick={() => item.status === "review" && onNavigate("/review")}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all hover:shadow-md ${cfg.bg} ${cfg.border} ${item.status === "review" ? "cursor-pointer hover:opacity-90" : ""}`}
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
              {todayItems.length === 0 ? (
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
                    {todayItems.map((item) => {
                      const cfg = statusConfig[item.status];
                      const Icon = cfg.icon;
                      const PIcon = platformIcon[item.platform] || Video;
                      return (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-accent/5 transition-colors">
                          <td className="px-5 py-4">
                            <p className="text-sm text-muted-foreground">{item.time}</p>
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
                          <td className="px-5 py-4">
                            {item.status === "review" && (
                              <button
                                onClick={() => onNavigate("/review")}
                                className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-colors"
                              >
                                Review Now
                              </button>
                            )}
                            {item.status === "approved" && (
                              <button className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors">
                                Confirm Publish
                              </button>
                            )}
                            {item.status === "export_ready" && (
                              <button className="px-3 py-1.5 rounded-lg bg-accent/20 text-accent-foreground text-xs font-medium hover:bg-accent/30 transition-colors">
                                Export Package
                              </button>
                            )}
                            {item.status === "failed" && (
                              <button className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
                                Retry
                              </button>
                            )}
                            {(item.status === "published" || item.status === "scheduled") && (
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
    </>
  );
}
