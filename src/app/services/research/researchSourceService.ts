import type { ResearchSource, ResearchPattern, ResearchObservation } from "../../domain/types";
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
  ): Promise<{ source: ResearchSource; patterns: ResearchPattern[]; isExisting?: boolean } | null> {
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

    const sourceId = `src-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

      // Process video research into Executive Memory & Viral Sparks
      if (brandId) {
        ResearchDepartmentService.processVideoResearch(brandId, source, vRes);
        persistResearchSourceCreate(brandId, source).catch((err) =>
          console.warn("[ResearchSourceService] Single video source persist notice:", err)
        );
      }

      return { source, patterns: [], isExisting: false };
    }

    // Branch B: Channel / Profile Ingestion via Platform Provider
    let extracted: ExtractedSourceResult;
    if (platform === "youtube") {
      extracted = await YouTubeResearchProvider.extract(cleanUrl, sourceId);
    } else {
      extracted = ResearchProviderStubs.extractStub(platform, cleanUrl, sourceId);
    }

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
      recentVideos: extracted.source.recentVideos || [],
      topContent: extracted.source.topContent || [],
      learnings: extracted.source.learnings || [],
      researchConfidence: extracted.source.researchConfidence ?? null,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
      observations: [
        {
          id: `obs-${sourceId}-1`,
          sourceId,
          contentTitle: `${extracted.source.displayName || "Channel"} Public Baseline`,
          videoLengthSec: 27,
          hookText: "Opener poses a direct curiosity question",
          publishedAt: now,
          createdAt: now,
        },
      ],
    };

    const patterns = extracted.patterns;

    // Persist source & patterns silently
    if (brandId) {
      persistResearchSourceCreate(brandId, source).catch((err) =>
        console.warn("[ResearchSourceService] Source persist notice:", err)
      );
      for (const pat of patterns) {
        persistResearchPatternCreate(brandId, pat).catch((err) =>
          console.warn("[ResearchSourceService] Pattern persist notice:", err)
        );
      }
    }

    return { source, patterns, isExisting: false };
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

    let extracted: ExtractedSourceResult;
    if (source.platform === "youtube") {
      extracted = await YouTubeResearchProvider.extract(source.url, source.id);
    } else {
      extracted = ResearchProviderStubs.extractStub(source.platform, source.url, source.id);
    }

    const now = new Date().toISOString();
    const updatedSource: ResearchSource = {
      ...source,
      ...extracted.source,
      lastSyncedAt: now,
      updatedAt: now,
    };

    if (brandId) {
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
