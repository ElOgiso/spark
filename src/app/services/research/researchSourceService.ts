import type {
  ResearchSource,
  ResearchPattern,
  ViralSpark,
  MemoryItem,
  Brand,
  VideoResearch,
  WatchLedgerEntry,
  RecentVideo,
} from "../../domain/types";
import { YouTubeResearchProvider, type ExtractedSourceResult } from "./providers/YouTubeResearchProvider";
import { VideoUnderstandingProvider } from "./providers/VideoUnderstandingProvider";
import { ResearchDepartmentService } from "./researchDepartmentService";
import { ResearchProviderStubs } from "./providers/ResearchProviderStubs";
import {
  persistResearchSourceCreate,
  persistResearchSourceDelete,
  persistResearchSourceUpdate,
} from "../../backend/workspaceSync";
import { generateUuid } from "../../backend/mappers/workspaceMappers";

export interface ResearchWatchContext {
  existingSparks?: ViralSpark[];
  existingMemories?: MemoryItem[];
  brand?: Brand;
}

export class ResearchSourceService {
  static detectPlatform(url: string): "youtube" | "tiktok" | "instagram" | "x" | "facebook" | "linkedin" {
    const lower = url.toLowerCase();
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
    if (lower.includes("tiktok.com")) return "tiktok";
    if (lower.includes("instagram.com")) return "instagram";
    if (lower.includes("x.com") || lower.includes("twitter.com")) return "x";
    if (lower.includes("facebook.com")) return "facebook";
    if (lower.includes("linkedin.com")) return "linkedin";
    return "youtube";
  }

  static normalizeUrl(url: string): string {
    return url.trim().toLowerCase().replace(/\/$/, "");
  }

  static isQuotaAllowedForSync(lastSyncedAt?: string, forceManual: boolean = false): boolean {
    if (forceManual || !lastSyncedAt) return true;
    const lastSyncTime = new Date(lastSyncedAt).getTime();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    return Date.now() - lastSyncTime >= fourHoursMs;
  }

  static getWatchLedger(source?: ResearchSource | null): WatchLedgerEntry[] {
    return Array.isArray(source?.watchLedger) ? [...source!.watchLedger] : [];
  }

  static ledgerEntry(ledger: WatchLedgerEntry[], key: string): WatchLedgerEntry | undefined {
    return ledger.find((e) => e.watchedVideoKey === key);
  }

  static upsertLedger(
    ledger: WatchLedgerEntry[],
    entry: WatchLedgerEntry
  ): WatchLedgerEntry[] {
    const next = ledger.filter((e) => e.watchedVideoKey !== entry.watchedVideoKey);
    next.push(entry);
    return next;
  }

  static watchCap(opts: { forceManual: boolean; isRegister: boolean; successCount: number }): number {
    if (opts.isRegister) return 5;
    if (opts.forceManual) return 3;
    if (opts.successCount >= 5) return 0;
    return Math.max(0, 5 - opts.successCount);
  }

  static async watchRankedWinners(params: {
    source: ResearchSource;
    videos: RecentVideo[];
    forceManual: boolean;
    isRegister: boolean;
  }): Promise<{ accepted: VideoResearch[]; ledger: WatchLedgerEntry[]; learnings: string[] }> {
    let ledger = this.getWatchLedger(params.source);
    const successCount = ledger.filter((e) => e.status === "watched").length;
    const cap = this.watchCap({
      forceManual: params.forceManual,
      isRegister: params.isRegister,
      successCount,
    });
    const ranked = YouTubeResearchProvider.rankWinningVideos(params.videos, 5);
    const accepted: VideoResearch[] = [];
    const learnings: string[] = ledger
      .filter((e) => e.status === "watched")
      .map((e) => e.fingerprint)
      .filter((s): s is string => Boolean(s));

    if (cap < 1) {
      return { accepted, ledger, learnings: params.source.learnings || [] };
    }

    let used = 0;
    for (const video of ranked) {
      if (used >= cap) break;
      const videoId = String(video.videoId || video.id || "").trim();
      const watchUrl = video.url || `https://www.youtube.com/watch?v=${videoId}`;
      const key = VideoUnderstandingProvider.watchedVideoKey("youtube", videoId);
      const prior = this.ledgerEntry(ledger, key);
      if (prior?.status === "watched") continue;
      if (prior?.status === "failed" && !params.forceManual) continue;

      used += 1;
      const result = await VideoUnderstandingProvider.analyzeVideo(watchUrl);
      if (VideoUnderstandingProvider.isAcceptedVideoResearch(result) && result.accepted !== false) {
        accepted.push(result);
        const fp = result.hook_formula || "";
        ledger = this.upsertLedger(ledger, {
          watchedVideoKey: key,
          status: "watched",
          fingerprint: fp,
          watchedAt: new Date().toISOString(),
        });
        if (fp && !learnings.includes(fp)) learnings.push(fp);
      } else {
        ledger = this.upsertLedger(ledger, {
          watchedVideoKey: key,
          status: "failed",
          watchedAt: new Date().toISOString(),
        });
      }
    }

    const ledgerOut = [...ledger];
    return { accepted, ledger: ledgerOut, learnings };
  }

  static applyWatchTickets(params: {
    brandId?: string;
    source: ResearchSource;
    watches: VideoResearch[];
    ctx?: ResearchWatchContext;
  }): { videoSparks: ViralSpark[]; videoMemories: MemoryItem[] } {
    const videoSparks: ViralSpark[] = [];
    const videoMemories: MemoryItem[] = [];
    const seenSparkFp = new Set(
      (params.ctx?.existingSparks || []).map((s) => s.fingerprint).filter(Boolean) as string[]
    );
    const memories = [...(params.ctx?.existingMemories || [])];

    for (const watch of params.watches) {
      const vr = ResearchDepartmentService.processVideoResearch(
        params.brandId || "",
        params.source,
        watch,
        memories,
        params.ctx?.brand,
        params.ctx?.existingSparks || []
      );
      for (const spark of vr.viralSparks) {
        if (spark.fingerprint && seenSparkFp.has(spark.fingerprint)) continue;
        if (spark.fingerprint) seenSparkFp.add(spark.fingerprint);
        videoSparks.push(spark);
      }
      for (const mem of vr.memoryItems) {
        memories.push(mem);
        videoMemories.push(mem);
      }
    }
    return { videoSparks, videoMemories };
  }

  static async registerAndExtract(
    url: string,
    brandId?: string,
    existingSources: ResearchSource[] = [],
    ctx?: ResearchWatchContext
  ): Promise<{
    source: ResearchSource;
    patterns: ResearchPattern[];
    isExisting?: boolean;
    videoSparks?: ViralSpark[];
    videoMemories?: MemoryItem[];
  } | null> {
    const cleanUrl = url.trim();
    if (!cleanUrl) return null;

    const normalized = this.normalizeUrl(cleanUrl);
    const platform = this.detectPlatform(cleanUrl);
    const isSingleVideo = VideoUnderstandingProvider.isSingleVideoUrl(cleanUrl);

    const existing = existingSources.find(
      (s) =>
        this.normalizeUrl(s.url) === normalized ||
        (s.platform === platform && cleanUrl.includes(String(s.username || "").replace("@", "")))
    );

    if (existing) {
      const synced = await this.syncSource(existing, brandId, true, ctx);
      return { ...synced, isExisting: true };
    }

    const sourceId = generateUuid();
    const now = new Date().toISOString();

    if (isSingleVideo) {
      const vRes = await VideoUnderstandingProvider.analyzeVideo(cleanUrl);
      const accepted = VideoUnderstandingProvider.isAcceptedVideoResearch(vRes) && vRes.accepted !== false;
      const key = VideoUnderstandingProvider.watchedVideoKey(vRes.platform || platform, vRes.videoId);
      const ledger: WatchLedgerEntry[] = [
        {
          watchedVideoKey: key,
          status: accepted ? "watched" : "failed",
          fingerprint: accepted ? vRes.hook_formula : undefined,
          watchedAt: now,
        },
      ];

      const source: ResearchSource = {
        id: sourceId,
        platform,
        url: cleanUrl,
        username: vRes.creatorHandle || "@video",
        displayName: vRes.title || "Video watch",
        avatar: vRes.thumbnail,
        banner: undefined,
        followers: null,
        videoCount: 1,
        totalViews: vRes.viewCount || null,
        metricsAvailability: accepted ? "available" : "unavailable",
        verified: false,
        description: accepted
          ? `Watched once: "${vRes.title}"`
          : `Watch failed for ${cleanUrl} — no Memory or Spark.`,
        status: accepted ? "active" : "error",
        sourceType: "video",
        videoResearch: accepted ? vRes : undefined,
        watchLedger: ledger,
        recentVideos: accepted
          ? [
              {
                id: vRes.videoId,
                videoId: vRes.videoId,
                title: vRes.title,
                url: vRes.url,
                thumbnail: vRes.thumbnail,
                publishedAt: vRes.publishedAt,
                durationSec: vRes.duration_sec || vRes.durationSec,
                viewCount: vRes.viewCount,
                likeCount: vRes.likeCount,
                commentCount: vRes.commentCount,
                sparkScore: vRes.sparkScore,
                whySelected: vRes.hook_formula,
              },
            ]
          : [],
        topContent: accepted
          ? [
              {
                id: `top-${vRes.videoId}`,
                title: vRes.title,
                sparkScore: vRes.sparkScore,
                reason: vRes.hook_formula || "Accepted watch",
                why: [`Public Views: ${vRes.viewCount?.toLocaleString() || "n/a"}`],
                url: vRes.url,
                views: vRes.viewCount ? vRes.viewCount.toLocaleString() : null,
              },
            ]
          : [],
        learnings: accepted && vRes.hook_formula ? [vRes.hook_formula] : [],
        researchConfidence: accepted ? vRes.confidence : 0,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      let videoSparks: ViralSpark[] = [];
      let videoMemories: MemoryItem[] = [];
      if (accepted) {
        const tickets = this.applyWatchTickets({ brandId, source, watches: [vRes], ctx });
        videoSparks = tickets.videoSparks;
        videoMemories = tickets.videoMemories;
      }
      if (brandId) {
        persistResearchSourceCreate(brandId, source).catch((err) =>
          console.warn("[ResearchSourceService] Single video source persist notice:", err)
        );
      }

      return { source, patterns: [], isExisting: false, videoSparks, videoMemories };
    }

    let extracted: ExtractedSourceResult;
    if (platform === "youtube") {
      extracted = await YouTubeResearchProvider.extract(cleanUrl, sourceId);
    } else {
      extracted = ResearchProviderStubs.extractStub(platform, cleanUrl, sourceId);
    }

    const draftSource: ResearchSource = {
      id: sourceId,
      platform,
      url: cleanUrl,
      username: extracted.source.username || "@creator",
      displayName: extracted.source.displayName || "Inspiration Account",
      avatar: extracted.source.avatar,
      banner: extracted.source.banner,
      followers: extracted.source.followers ?? null,
      videoCount: extracted.source.videoCount ?? null,
      totalViews: extracted.source.totalViews ?? null,
      country: extracted.source.country,
      creationDate: extracted.source.creationDate,
      metricsAvailability: extracted.source.metricsAvailability || "unavailable",
      verified: extracted.source.verified || false,
      description: extracted.source.description || "",
      status: extracted.source.status || "active",
      sourceType: "channel",
      recentVideos: extracted.source.recentVideos || [],
      topContent: extracted.source.topContent || [],
      learnings: [],
      watchLedger: [],
      researchConfidence: extracted.source.researchConfidence ?? null,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const watchResult =
      platform === "youtube"
        ? await this.watchRankedWinners({
            source: draftSource,
            videos: draftSource.recentVideos || [],
            forceManual: true,
            isRegister: true,
          })
        : { accepted: [] as VideoResearch[], ledger: [] as WatchLedgerEntry[], learnings: [] as string[] };

    const source: ResearchSource = {
      ...draftSource,
      watchLedger: watchResult.ledger,
      learnings: watchResult.learnings,
      videoResearch: watchResult.accepted[0],
    };

    const tickets = this.applyWatchTickets({
      brandId,
      source,
      watches: watchResult.accepted,
      ctx,
    });

    if (brandId) {
      persistResearchSourceCreate(brandId, source).catch((err) =>
        console.warn("[ResearchSourceService] Source persist notice:", err)
      );
    }

    return {
      source,
      patterns: [],
      isExisting: false,
      videoSparks: tickets.videoSparks,
      videoMemories: tickets.videoMemories,
    };
  }

  static async syncSource(
    source: ResearchSource,
    brandId?: string,
    forceManual: boolean = false,
    ctx?: ResearchWatchContext
  ): Promise<{
    source: ResearchSource;
    patterns: ResearchPattern[];
    videoSparks?: ViralSpark[];
    videoMemories?: MemoryItem[];
  }> {
    if (!this.isQuotaAllowedForSync(source.lastSyncedAt, forceManual)) {
      console.log(`[ResearchSourceService] Quota policy: skipping full sync for ${source.username} (synced < 4h ago)`);
      return { source, patterns: [], videoSparks: [], videoMemories: [] };
    }

    const now = new Date().toISOString();

    if (source.sourceType === "video" || VideoUnderstandingProvider.isSingleVideoUrl(source.url)) {
      const { platform, videoId } = VideoUnderstandingProvider.extractVideoId(source.url);
      const key = VideoUnderstandingProvider.watchedVideoKey(platform, videoId || source.videoResearch?.videoId || "");
      const prior = this.ledgerEntry(this.getWatchLedger(source), key);
      let vRes = source.videoResearch;
      let ledger = this.getWatchLedger(source);

      if (prior?.status === "watched" && VideoUnderstandingProvider.isAcceptedVideoResearch(vRes)) {
        // already watched — do not re-analyze
      } else if (prior?.status === "failed" && !forceManual) {
        // background does not retry failed
      } else {
        vRes = await VideoUnderstandingProvider.analyzeVideo(source.url);
        const accepted = VideoUnderstandingProvider.isAcceptedVideoResearch(vRes) && vRes.accepted !== false;
        ledger = this.upsertLedger(ledger, {
          watchedVideoKey: key,
          status: accepted ? "watched" : "failed",
          fingerprint: accepted ? vRes.hook_formula : undefined,
          watchedAt: now,
        });
        if (!accepted) vRes = undefined;
      }

      const updatedSource: ResearchSource = {
        ...source,
        displayName: vRes?.title || source.displayName,
        avatar: vRes?.thumbnail || source.avatar,
        videoResearch: vRes,
        watchLedger: ledger,
        learnings: vRes?.hook_formula ? [vRes.hook_formula] : source.learnings || [],
        lastSyncedAt: now,
        updatedAt: now,
      };

      let videoSparks: ViralSpark[] = [];
      let videoMemories: MemoryItem[] = [];
      if (vRes && VideoUnderstandingProvider.isAcceptedVideoResearch(vRes)) {
        const tickets = this.applyWatchTickets({ brandId, source: updatedSource, watches: [vRes], ctx });
        videoSparks = tickets.videoSparks;
        videoMemories = tickets.videoMemories;
      }
      if (brandId) {
        persistResearchSourceUpdate(source.id, {
          lastSyncedAt: now,
          updatedAt: now,
          watchLedger: ledger,
          learnings: updatedSource.learnings,
          videoResearch: vRes,
        }).catch((err) => console.warn("[ResearchSourceService] Video source sync persist notice:", err));
      }
      return { source: updatedSource, patterns: [], videoSparks, videoMemories };
    }

    let extracted: ExtractedSourceResult;
    if (source.platform === "youtube") {
      extracted = await YouTubeResearchProvider.extract(source.url, source.id);
    } else {
      extracted = ResearchProviderStubs.extractStub(source.platform, source.url, source.id);
    }

    const rankedVideos = extracted.source.recentVideos || source.recentVideos || [];
    const watchResult =
      source.platform === "youtube"
        ? await this.watchRankedWinners({
            source,
            videos: rankedVideos,
            forceManual,
            isRegister: false,
          })
        : { accepted: [] as VideoResearch[], ledger: this.getWatchLedger(source), learnings: source.learnings || [] };

    const updatedSource: ResearchSource = {
      ...source,
      ...extracted.source,
      recentVideos: rankedVideos,
      topContent: extracted.source.topContent || source.topContent,
      watchLedger: watchResult.ledger,
      learnings: watchResult.learnings,
      videoResearch: watchResult.accepted[0] || source.videoResearch,
      lastSyncedAt: now,
      updatedAt: now,
    };

    const tickets = this.applyWatchTickets({
      brandId,
      source: updatedSource,
      watches: watchResult.accepted,
      ctx,
    });

    if (brandId) {
      persistResearchSourceUpdate(source.id, {
        lastSyncedAt: now,
        updatedAt: now,
        watchLedger: watchResult.ledger,
        learnings: watchResult.learnings,
        recentVideos: rankedVideos,
        topContent: updatedSource.topContent,
        videoResearch: updatedSource.videoResearch,
      }).catch((err) => console.warn("[ResearchSourceService] Source sync persist notice:", err));
    }

    return {
      source: updatedSource,
      patterns: [],
      videoSparks: tickets.videoSparks,
      videoMemories: tickets.videoMemories,
    };
  }

  static async deleteSource(id: string): Promise<void> {
    persistResearchSourceDelete(id).catch((err) =>
      console.warn("[ResearchSourceService] Source delete persist notice:", err)
    );
  }
}
