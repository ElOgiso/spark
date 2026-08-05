import type { ResearchSource, ResearchPattern } from "../../../domain/types";
import type { ExtractedSourceResult } from "./YouTubeResearchProvider";

export class ResearchProviderStubs {
  static extractStub(
    platform: "tiktok" | "instagram" | "x" | "facebook" | "linkedin",
    url: string,
    sourceId: string
  ): ExtractedSourceResult {
    const cleanUrl = url.trim();
    let handle = "@creator";
    try {
      const parts = cleanUrl.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) handle = last.startsWith("@") ? last : `@${last}`;
    } catch {
      // fallback
    }

    const displayName = handle.startsWith("@")
      ? handle.substring(1).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : handle;

    const now = new Date().toISOString();

    const source: Partial<ResearchSource> = {
      id: sourceId,
      platform,
      url,
      username: handle,
      displayName,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(handle)}`,
      followers: null,
      metricsAvailability: "unavailable",
      verified: false,
      description: `Public ${platform.toUpperCase()} Inspiration Account`,
      status: "unavailable",
      lastSyncedAt: now,
      updatedAt: now,
      recentVideos: [],
      topContent: [],
      learnings: [],
    };

    const patterns: ResearchPattern[] = [];

    return { source, patterns };
  }
}
