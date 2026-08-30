import type { ResearchSource, ResearchPattern, ResearchObservation, ViralSpark, MemoryItem } from "../../domain/types";
import { YouTubeResearchProvider, type ExtractedSourceResult } from "./providers/YouTubeResearchProvider";
import { VideoUnderstandingProvider } from "./providers/VideoUnderstandingProvider";
import { ResearchDepartmentService } from "./researchDepartmentService";
import { ResearchProviderStubs } from "./providers/ResearchProviderStubs";
import {
  persistResearchSourceCreate,
  persistResearchSourceDelete,
  persistResearchSourceUpdate,
  persistResearchPatternCreate,
} from "../../backend/workspaceSync";
import { generateUuid } from "../../backend/mappers/workspaceMappers";

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

  /**
   * Quota policy: prevents redundant full API syncs if refreshed within the last 4 hours
   */
  static isQuotaAllowedForSync(lastSyncedAt?: string, forceManual: boolean = false): boolean {
    if (forceManual || !lastSyncedAt) return true;
    const lastSyncTime = new Date(lastSyncedAt).getTime();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    return Date.now() - lastSyncTime >= fourHoursMs;
  }

  static async registerAndExtract(
    url: string,
    brandId?: string,
    existingSources: ResearchSource[] = []
  ): Promise<{ source: ResearchSource; patterns: ResearchPattern[]; isExisting?: boolean; videoSparks?: ViralSpark[]; videoMemories?: MemoryItem[] } | null> {
    const cleanUrl = url.trim();
    if (!cleanUrl) return null;

    const normalized = this.normalizeUrl(cleanUrl);
    const platform = this.detectPlatform(cleanUrl);
    const isSingleVideo = VideoUnderstandingProvider.isSingleVideoUrl(cleanUrl);

    // Duplicate detection by platform + normalized URL / handle
    const existing = existingSources.find(
      (s) => this.normalizeUrl(s.url) === normalized || (s.platform === platform && cleanUrl.includes(s.username.replace("@", "")))
    );

    if (existing) {
      // Re-sync existing source instead of creating duplicate
      const synced = await this.syncSource(existing, brandId, true);
      return { ...synced, isExisting: true };
    }

    // Use a real UUID: research_sources.id is a uuid column, so a "src-..." string id was rejected
    // by Postgres and the source never persisted across logout/login.
    const sourceId = generateUuid();
    const now = new Date().toISOString();

    // Branch A: Single Video Asset Ingestion via VideoUnderstandingProvider
    if (isSingleVideo) {
      const vRes = await VideoUnderstandingProvider.analyzeVideo(cleanUrl);

      const source: ResearchSource = {
        id: sourceId,
        platform,
        url: cleanUrl,
        username: vRes.creatorHandle || "@video",
        displayName: vRes.title,
        avatar: vRes.thumbnail,
        banner: undefined,
        followers: null,
        videoCount: 1,
        totalViews: vRes.viewCount || null,
        metricsAvailability: "available",
        verified: false,
        description: `Video Understanding Asset: "${vRes.title}" by ${vRes.creatorName || vRes.creatorHandle}`,
        status: "active",
        sourceType: "video",
        videoResearch: vRes,
        recentVideos: [
          {
            id: vRes.videoId,
            videoId: vRes.videoId,
            title: vRes.title,
            url: vRes.url,
            thumbnail: vRes.thumbnail,
            publishedAt: vRes.publishedAt,
            durationSec: vRes.durationSec,
            viewCount: vRes.viewCount,
            likeCount: vRes.likeCount,
            commentCount: vRes.commentCount,
            sparkScore: vRes.sparkScore,
            whySelected: vRes.hookAnalysis,
          },
        ],
        topContent: [
          {
            id: `top-${vRes.videoId}`,
            title: vRes.title,
            sparkScore: vRes.sparkScore,
            reason: vRes.hookAnalysis,
            why: [
              `Public Views: ${vRes.viewCount?.toLocaleString() || "Live Analysis"}`,
              `Hook: ${vRes.hookAnalysis.slice(0, 60)}...`,
              `Pacing: ${vRes.pacingAnalysis.slice(0, 60)}...`,
            ],
            url: vRes.url,
            views: vRes.viewCount ? vRes.viewCount.toLocaleString() : "Live Analysis",
          },
        ],
        learnings: [vRes.hookAnalysis, vRes.retentionAnalysis, vRes.editingStyle],
        researchConfidence: vRes.confidence,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      // Process video research into Executive Memory & Viral Sparks (REAL multimodal analysis).
      let videoSparks: ViralSpark[] = [];
      let videoMemories: MemoryItem[] = [];
      if (brandId) {
        const vr = ResearchDepartmentService.processVideoResearch(brandId, source, vRes);
        videoSparks = vr.viralSparks;
        videoMemories = vr.memoryItems;
        persistResearchSourceCreate(brandId, source).catch((err) =>
          console.warn("[ResearchSourceService] Single video source persist notice:", err)
        );
      }

      return { source, patterns: [], isExisting: false, videoSparks, videoMemories };
    }

    // Branch B: Channel / Profile Ingestion via Platform Provider
    let extracted: ExtractedSourceResult;
    if (platform === "youtube") {
      extracted = await YouTubeResearchProvider.extract(cleanUrl, sourceId);
    } else {
      extracted = ResearchProviderStubs.extractStub(platform, cleanUrl, sourceId);
    }

    // AI Multimodal Breakdown on Creator's Top Video Asset (if available)
    let videoResearch: any = undefined;
    const topVideo = extracted.source.recentVideos?.[0];
    if (topVideo?.url) {
      try {
        videoResearch = await VideoUnderstandingProvider.analyzeVideo(topVideo.url);
      } catch (err) {
        console.warn("[ResearchSourceService] Profile top video AI analysis notice:", err);
      }
    }

    const aiLearnings = videoResearch
      ? [videoResearch.hookAnalysis, videoResearch.retentionAnalysis, videoResearch.pacingAnalysis, ...(extracted.source.learnings || [])]
      : extracted.source.learnings || [];

    const source: ResearchSource = {
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
      videoResearch,
      recentVideos: extracted.source.recentVideos || [],
      topContent: extracted.source.topContent || [],
      learnings: aiLearnings,
      researchConfidence: videoResearch?.confidence || extracted.source.researchConfidence || 88,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
      observations: [
        {
          id: `obs-${sourceId}-1`,
          sourceId,
          contentTitle: `${extracted.source.displayName || "Channel"} AI Hook Analysis`,
          videoLengthSec: videoResearch?.durationSec || 30,
          hookText: videoResearch?.hookAnalysis || "Opener poses a high-curiosity question",
          publishedAt: now,
          createdAt: now,
        },
      ],
    };

    const patterns = extracted.patterns;

    // Process profile video research into Executive Memory & Viral Sparks (REAL multimodal analysis
    // of the creator's top video when the configured vision model + data are available).
    let videoSparks: ViralSpark[] = [];
    let videoMemories: MemoryItem[] = [];
    if (brandId) {
      if (videoResearch) {
        const vr = ResearchDepartmentService.processVideoResearch(brandId, source, videoResearch);
        videoSparks = vr.viralSparks;
        videoMemories = vr.memoryItems;
      }
      persistResearchSourceCreate(brandId, source).catch((err) =>
        console.warn("[ResearchSourceService] Source persist notice:", err)
      );
      for (const pat of patterns) {
        persistResearchPatternCreate(brandId, pat).catch((err) =>
          console.warn("[ResearchSourceService] Pattern persist notice:", err)
        );
      }
    }

    return { source, patterns, isExisting: false, videoSparks, videoMemories };
  }

  static async syncSource(
    source: ResearchSource,
    brandId?: string,
    forceManual: boolean = false
  ): Promise<{ source: ResearchSource; patterns: ResearchPattern[] }> {
    if (!this.isQuotaAllowedForSync(source.lastSyncedAt, forceManual)) {
      console.log(`[ResearchSourceService] Quota policy: skipping full sync for ${source.username} (synced < 4h ago)`);
      return { source, patterns: [] };
    }

    const now = new Date().toISOString();

    // Branch A: Single Video Asset Resync
    if (source.sourceType === "video" || VideoUnderstandingProvider.isSingleVideoUrl(source.url)) {
      const vRes = await VideoUnderstandingProvider.analyzeVideo(source.url);
      const updatedSource: ResearchSource = {
        ...source,
        displayName: vRes.title,
        avatar: vRes.thumbnail,
        videoResearch: vRes,
        learnings: [vRes.hookAnalysis, vRes.retentionAnalysis, vRes.editingStyle],
        researchConfidence: vRes.confidence,
        lastSyncedAt: now,
        updatedAt: now,
      };

      if (brandId) {
        ResearchDepartmentService.processVideoResearch(brandId, updatedSource, vRes);
        persistResearchSourceUpdate(source.id, { lastSyncedAt: now, updatedAt: now }).catch((err) =>
          console.warn("[ResearchSourceService] Video source sync persist notice:", err)
        );
      }
      return { source: updatedSource, patterns: [] };
    }

    // Branch B: Profile / Account Resync
    let extracted: ExtractedSourceResult;
    if (source.platform === "youtube") {
      extracted = await YouTubeResearchProvider.extract(source.url, source.id);
    } else {
      extracted = ResearchProviderStubs.extractStub(source.platform, source.url, source.id);
    }

    // AI Multimodal Re-analysis on Top Video
    let videoResearch = source.videoResearch;
    const topVideo = extracted.source.recentVideos?.[0] || source.recentVideos?.[0];
    if (topVideo?.url) {
      try {
        videoResearch = await VideoUnderstandingProvider.analyzeVideo(topVideo.url);
      } catch (err) {
        console.warn("[ResearchSourceService] Resync top video AI analysis notice:", err);
      }
    }

    const updatedSource: ResearchSource = {
      ...source,
      ...extracted.source,
      videoResearch,
      learnings: videoResearch
        ? [videoResearch.hookAnalysis, videoResearch.retentionAnalysis, videoResearch.pacingAnalysis, ...(extracted.source.learnings || [])]
        : extracted.source.learnings || source.learnings,
      lastSyncedAt: now,
      updatedAt: now,
    };

    if (brandId) {
      if (videoResearch) {
        ResearchDepartmentService.processVideoResearch(brandId, updatedSource, videoResearch);
      }
      persistResearchSourceUpdate(source.id, { lastSyncedAt: now, updatedAt: now }).catch((err) =>
        console.warn("[ResearchSourceService] Source sync persist notice:", err)
      );
      for (const pat of extracted.patterns) {
        persistResearchPatternCreate(brandId, pat).catch((err) =>
          console.warn("[ResearchSourceService] Sync pattern persist notice:", err)
        );
      }
    }

    return { source: updatedSource, patterns: extracted.patterns };
  }

  static async deleteSource(id: string): Promise<void> {
    persistResearchSourceDelete(id).catch((err) =>
      console.warn("[ResearchSourceService] Source delete persist notice:", err)
    );
  }
}
