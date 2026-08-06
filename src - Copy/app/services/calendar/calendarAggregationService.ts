import type { Production, PublishJob, ReviewItem, ResearchSource } from "../../domain/types";
import { getStoredAccountTokens } from "../socialIntegrationService";

export type CalendarEventType =
  | "production"
  | "publishing"
  | "review"
  | "meeting"
  | "research"
  | "automation"
  | "reminder";

export type CalendarItemStatus =
  | "scheduled"
  | "approved"
  | "published"
  | "review"
  | "failed"
  | "export_ready"
  | "draft";

export interface AggregatedCalendarEvent {
  id: string;
  sourceType: CalendarEventType;
  productionId?: string;
  title: string;
  platform: string; // "YouTube" | "TikTok" | "Instagram" | "LinkedIn" | "Google Calendar" | "SPARK System" | etc.
  status: CalendarItemStatus;
  dateStr: string; // YYYY-MM-DD
  time?: string; // "2:00 PM"
  format: string; // "Long-form" | "Short" | "Article" | "Meeting" | "System Task" | etc.
  rawDate: Date;
  description?: string;
  whySelected?: string;
  externalUrl?: string;
}

export interface CalendarDayFeed {
  date: number;
  day: string; // "Mon", "Tue", etc.
  dateStr: string; // YYYY-MM-DD
  isToday: boolean;
  items: AggregatedCalendarEvent[];
}

export interface CalendarWeekSummary {
  weekDays: CalendarDayFeed[];
  totalScheduled: number;
  publishedCount: number;
  reviewNeeded: number;
  failedCount: number;
  todayItems: AggregatedCalendarEvent[];
  meetingsCount: number;
  automationCount: number;
  productionsCount: number;
}

export class CalendarAggregationService {
  /** Format a Date object as YYYY-MM-DD in local time */
  static formatDateStr(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Format a Date object as "2:00 PM" */
  static formatTimeString(d: Date): string {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  }

  /** Get Monday of the week corresponding to weekOffset (0 = current week) */
  static getMondayOfWeek(weekOffset: number = 0): Date {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Main aggregation method: collects real data from all connected providers
   */
  static async aggregateWeekFeed(params: {
    weekOffset: number;
    productions: Production[];
    publishJobs: PublishJob[];
    reviewItems: ReviewItem[];
    researchSources?: ResearchSource[];
  }): Promise<CalendarWeekSummary> {
    const monday = this.getMondayOfWeek(params.weekOffset);
    const todayStr = this.formatDateStr(new Date());

    // Generate 7 days (Monday through Sunday)
    const days: CalendarDayFeed[] = [];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = this.formatDateStr(d);
      days.push({
        date: d.getDate(),
        day: dayNames[i],
        dateStr,
        isToday: dateStr === todayStr,
        items: [],
      });
    }

    const events: AggregatedCalendarEvent[] = [];

    // 1. Ingest SPARK Productions
    if (Array.isArray(params.productions)) {
      params.productions.forEach((p, idx) => {
        const dateObj = p.dateCreated ? new Date(p.dateCreated) : new Date();
        const dateStr = this.formatDateStr(dateObj);
        let status: CalendarItemStatus = "scheduled";
        if (p.status === "Ready for Review") status = "review";
        else if (p.status === "Published") status = "published";
        else if (p.status === "Needs Edit" || p.status === "Failed") status = "failed";
        else if (p.status === "Approved") status = "approved";
        else if (p.status === "Drafting") status = "draft";

        events.push({
          id: `cal-prod-${p.id || idx}`,
          sourceType: "production",
          productionId: p.id,
          title: p.title || "Untitled Production",
          platform: "YouTube",
          status,
          dateStr,
          time: this.formatTimeString(dateObj),
          format: p.mode === "standard" || p.mode === "deep" ? "Long-form" : "Short",
          rawDate: dateObj,
          description: `SPARK Production: ${p.title}`,
        });
      });
    }

    // 2. Ingest Publishing Queue
    if (Array.isArray(params.publishJobs)) {
      params.publishJobs.forEach((pj, idx) => {
        const dateObj = pj.scheduledTime ? new Date(pj.scheduledTime) : new Date();
        const dateStr = this.formatDateStr(dateObj);
        let status: CalendarItemStatus = "scheduled";
        if (pj.status === "Export Ready") status = "export_ready";
        else if (pj.status === "Published") status = "published";
        else if (pj.status === "Failed") status = "failed";

        events.push({
          id: `cal-pj-${pj.id || idx}`,
          sourceType: "publishing",
          productionId: pj.productionId,
          title: pj.title || "Publish Job",
          platform: pj.platform || "YouTube",
          status,
          dateStr,
          time: pj.scheduledTime ? this.formatTimeString(new Date(pj.scheduledTime)) : "4:00 PM",
          format: pj.title.toLowerCase().includes("article") ? "Article" : "Short",
          rawDate: dateObj,
          description: `Publishing Queue Item: ${pj.title}`,
        });
      });
    }

    // 3. Ingest Review Queue Items
    if (Array.isArray(params.reviewItems)) {
      params.reviewItems.forEach((r, idx) => {
        const dateObj = r.dateCreated ? new Date(r.dateCreated) : new Date();
        const dateStr = this.formatDateStr(dateObj);
        const status: CalendarItemStatus = r.status === "Needs Edit" ? "failed" : "review";

        events.push({
          id: `cal-rev-${r.id || idx}`,
          sourceType: "review",
          productionId: r.productionId,
          title: r.title || "Review Item",
          platform: r.account || "YouTube",
          status,
          dateStr,
          time: this.formatTimeString(dateObj),
          format: "Short",
          rawDate: dateObj,
          description: `Review Queue: ${r.title}`,
        });
      });
    }

    // 4. Ingest Research Sync Events
    if (Array.isArray(params.researchSources)) {
      params.researchSources.forEach((src, idx) => {
        if (src.lastSyncedAt) {
          const dateObj = new Date(src.lastSyncedAt);
          const dateStr = this.formatDateStr(dateObj);
          events.push({
            id: `cal-res-${src.id || idx}`,
            sourceType: "research",
            title: `Research Sync: ${src.displayName}`,
            platform: src.platform === "youtube" ? "YouTube" : src.platform.toUpperCase(),
            status: "approved",
            dateStr,
            time: this.formatTimeString(dateObj),
            format: "Research Sync",
            rawDate: dateObj,
            description: `Auto-synced research intelligence from ${src.displayName}.`,
          });
        }
      });
    }

    // 5. Ingest Real Connected Google Calendar Events (if OAuth token available)
    try {
      const storedTokens = getStoredAccountTokens() as Record<string, any>;
      const googleToken = storedTokens?.google?.accessToken || storedTokens?.google?.access_token;
      if (googleToken) {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 7);
        const timeMin = monday.toISOString();
        const timeMax = sunday.toISOString();

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${googleToken}` } }
        );
        if (res.ok) {
          const gData = await res.json();
          const items = gData.items || [];
          for (const item of items) {
            const startISO = item.start?.dateTime || item.start?.date;
            if (startISO) {
              const d = new Date(startISO);
              const dateStr = this.formatDateStr(d);
              events.push({
                id: `cal-gcal-${item.id}`,
                sourceType: "meeting",
                title: item.summary || "Google Calendar Event",
                platform: "Google Calendar",
                status: "scheduled",
                dateStr,
                time: item.start?.dateTime ? this.formatTimeString(d) : "All Day",
                format: "Meeting",
                rawDate: d,
                description: item.description || "Google Calendar event",
                externalUrl: item.htmlLink,
              });
            }
          }
        }
      }
    } catch (gErr) {
      console.warn("[CalendarAggregationService] Google Calendar API notice:", gErr);
    }

    // 6. Ingest System Automation Recurring Tasks
    const mondayObj = new Date(monday);
    const wedObj = new Date(monday); wedObj.setDate(monday.getDate() + 2);
    const friObj = new Date(monday); friObj.setDate(monday.getDate() + 4);

    events.push({
      id: `cal-auto-analytics`,
      sourceType: "automation",
      title: "Weekly Analytics Intelligence Briefing",
      platform: "SPARK System",
      status: "scheduled",
      dateStr: this.formatDateStr(mondayObj),
      time: "9:00 AM",
      format: "Automation Job",
      rawDate: mondayObj,
      description: "SPARK autonomous engine analyzes weekly audience reach and engagement metrics.",
    });

    events.push({
      id: `cal-auto-research`,
      sourceType: "automation",
      title: "Viral Sparks Trend Refresh",
      platform: "SPARK System",
      status: "approved",
      dateStr: this.formatDateStr(wedObj),
      time: "12:00 PM",
      format: "Automation Job",
      rawDate: wedObj,
      description: "SPARK scans connected inspiration channels for rising viral spark patterns.",
    });

    events.push({
      id: `cal-auto-memory`,
      sourceType: "automation",
      title: "Memory Pool & Brand Rule Optimization",
      platform: "SPARK System",
      status: "scheduled",
      dateStr: this.formatDateStr(friObj),
      time: "6:00 PM",
      format: "Automation Job",
      rawDate: friObj,
      description: "Consolidates learned patterns and updates brand executive guidelines.",
    });

    // Deduplicate events by title + dateStr + platform
    const seenMap = new Map<string, AggregatedCalendarEvent>();
    for (const evt of events) {
      const key = `${evt.title.toLowerCase().trim()}_${evt.dateStr}_${evt.platform}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, evt);
      }
    }

    const uniqueEvents = Array.from(seenMap.values());

    // Map unique events into weekDays
    days.forEach((dayFeed) => {
      dayFeed.items = uniqueEvents
        .filter((e) => e.dateStr === dayFeed.dateStr)
        .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    });

    const weekEvents = days.flatMap((d) => d.items);
    const todayItems = days.find((d) => d.isToday)?.items ?? [];

    const totalScheduled = weekEvents.length;
    const publishedCount = weekEvents.filter((i) => i.status === "published").length;
    const reviewNeeded = weekEvents.filter((i) => i.status === "review").length;
    const failedCount = weekEvents.filter((i) => i.status === "failed").length;
    const meetingsCount = weekEvents.filter((i) => i.sourceType === "meeting").length;
    const automationCount = weekEvents.filter((i) => i.sourceType === "automation" || i.sourceType === "research").length;
    const productionsCount = weekEvents.filter((i) => i.sourceType === "production" || i.sourceType === "publishing").length;

    return {
      weekDays: days,
      totalScheduled,
      publishedCount,
      reviewNeeded,
      failedCount,
      todayItems,
      meetingsCount,
      automationCount,
      productionsCount,
    };
  }
}
