import type { ResearchSource, ResearchPattern, MemoryItem, ViralSpark, RecentVideo, Brand, VideoResearch } from "../../domain/types";
import { persistMemoryCreate, persistViralSparkCreate } from "../../backend/workspaceSync";
import { ensureViralSparkProductionReady } from "../production/viralSparkGate";
import { VideoUnderstandingProvider } from "./providers/VideoUnderstandingProvider";

export function computeFingerprint(raw: string): string {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, " ");
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `fp-${Math.abs(hash).toString(36)}`;
}

export function sparkFingerprintForWatch(platform: string, videoId: string, hookFormula?: string): string {
  const key = VideoUnderstandingProvider.watchedVideoKey(platform, videoId);
  return computeFingerprint(`${key}:${String(hookFormula || "").trim()}`);
}

export class ResearchDepartmentService {
  /**
   * Title / duration / tags are not a watch. Do not invent hook, format, or CTA.
   */
  static analyzeRecentVideos(_videos: RecentVideo[]): void {
    return;
  }

  /**
   * Title-only patterns are not sparks. Accepted watches persist via processVideoResearch.
   */
  static processPatterns(
    _brandId: string,
    _source: ResearchSource,
    patterns: ResearchPattern[],
    existingSparks: ViralSpark[] = [],
    existingMemories: MemoryItem[] = [],
    _brand?: Brand
  ): {
    memoryItems: MemoryItem[];
    viralSparks: ViralSpark[];
    updatedSparks: ViralSpark[];
    updatedMemories: MemoryItem[];
  } {
    const now = new Date().toISOString();
    const updatedSparks: ViralSpark[] = [];
    const updatedMemories: MemoryItem[] = [];

    for (const p of patterns || []) {
      if (!p || /viral format:/i.test(String(p.title || ""))) continue;
      const watchedKey =
        (p.metrics && typeof p.metrics === "object" && p.metrics.watchedVideoKey) ||
        undefined;
      if (!watchedKey) continue;
      const fp = computeFingerprint(String(watchedKey));
      const existingSpark = existingSparks.find((s) => s.fingerprint === fp);
      if (existingSpark) {
        existingSpark.lastSeenAt = now;
        existingSpark.syncCount = (existingSpark.syncCount || 1) + 1;
        updatedSparks.push(existingSpark);
      }
      const existingMem = existingMemories.find((m) => m.fingerprint === fp);
      if (existingMem) {
        existingMem.lastSeenAt = now;
        existingMem.syncCount = (existingMem.syncCount || 1) + 1;
        updatedMemories.push(existingMem);
      }
    }

    return { memoryItems: [], viralSparks: [], updatedSparks, updatedMemories };
  }

  static isDuplicateMemory(existingMemories: MemoryItem[] = [], newText: string): boolean {
    const normNew = newText.toLowerCase().replace(/[^a-z0-9]/g, "");
    return existingMemories.some((m) => {
      const normExisting = m.text.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normExisting === normNew || (normNew.length > 30 && normExisting.includes(normNew));
    });
  }

  /**
   * One production ticket per accepted watch. Failed watch → no Memory, no Spark.
   */
  static processVideoResearch(
    brandId: string,
    source: ResearchSource,
    videoResearch: VideoResearch,
    existingMemories: MemoryItem[] = [],
    brand?: Brand,
    existingSparks: ViralSpark[] = []
  ): { memoryItems: MemoryItem[]; viralSparks: ViralSpark[]; updatedSparks: ViralSpark[] } {
    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10);
    const memoryItems: MemoryItem[] = [];
    const viralSparks: ViralSpark[] = [];
    const updatedSparks: ViralSpark[] = [];

    if (!VideoUnderstandingProvider.isAcceptedVideoResearch(videoResearch) || videoResearch.accepted === false) {
      return { memoryItems, viralSparks, updatedSparks };
    }

    const watchedVideoKey = VideoUnderstandingProvider.watchedVideoKey(
      videoResearch.platform,
      videoResearch.videoId
    );
    const sparkFingerprint = sparkFingerprintForWatch(
      videoResearch.platform,
      videoResearch.videoId,
      videoResearch.hook_formula
    );
    const hookFormula = String(videoResearch.hook_formula || "").trim();
    const openingLine = String(videoResearch.opening_line || hookFormula).trim();
    const ctaLine = String(videoResearch.cta_line || "").trim();
    const format = String(videoResearch.format || "").trim();
    const spokenBeats = (videoResearch.spoken_beats || []).map((b) => String(b).trim()).filter(Boolean);
    const visualActions = (videoResearch.visual_actions || []).map((a) => String(a).trim()).filter(Boolean);

    const existingSpark = existingSparks.find(
      (s) =>
        s.fingerprint === sparkFingerprint ||
        s.researchContext?.watchedVideoKey === watchedVideoKey
    );
    if (existingSpark) {
      existingSpark.lastSeenAt = now;
      existingSpark.lastSyncedAt = now;
      existingSpark.syncCount = (existingSpark.syncCount || 1) + 1;
      existingSpark.fingerprint = sparkFingerprint;
      updatedSparks.push(existingSpark);
    } else {
      const shortTitle = videoResearch.title.length > 72
        ? `Adapt: ${videoResearch.title.slice(0, 69)}…`
        : `Adapt: ${videoResearch.title}`;
      const sparkDraft: ViralSpark = {
        id: `spk-vid-${videoResearch.videoId}`,
        title: shortTitle,
        hook: openingLine,
        views: videoResearch.viewCount ? videoResearch.viewCount.toLocaleString() : "Unavailable from Platform",
        velocity: "Unavailable",
        platformFit: videoResearch.platform === "youtube" ? "YouTube Shorts" : videoResearch.platform.toUpperCase(),
        brandFitScore: typeof videoResearch.sparkScore === "number" ? videoResearch.sparkScore : 0,
        category: "rising",
        timeWindow: "Immediate Opportunity",
        productionTime: (videoResearch.duration_sec || videoResearch.durationSec || 0) <= 60 ? "10 mins" : "30 mins",
        whyNow: hookFormula,
        angle: hookFormula,
        audienceEmotion: videoResearch.emotionalPattern || "Curiosity",
        expectedRetention: videoResearch.retentionAnalysis || "",
        difficulty: "Medium",
        riskLevel: "Low",
        suggestedFormat: format,
        suggestedProductionMode: /9:16|short/i.test(format) ? "express" : "standard",
        origin: "SOURCE",
        sourceId: source.id,
        fingerprint: sparkFingerprint,
        firstSeenAt: now,
        lastSeenAt: now,
        lastSyncedAt: now,
        syncCount: 1,
        status: "draft",
        researchContext: {
          sourceName: source.displayName || source.username,
          platform: videoResearch.platform,
          hookPattern: hookFormula,
          format,
          ctaStyle: ctaLine,
          ctaLine,
          watchedVideoKey,
          openingLine,
          spokenBeats,
          visualActions,
          provenStructure: spokenBeats.join(" → "),
        },
      };
      const ensured = ensureViralSparkProductionReady(sparkDraft, brand);
      if (ensured.ok) {
        viralSparks.push(ensured.spark);
        if (brandId) {
          persistViralSparkCreate(brandId, ensured.spark).catch((err) =>
            console.warn("[ResearchDepartmentService] Video spark persist notice:", err)
          );
        }
      }
    }

    const lawText = `[Inspiration — ${source.displayName || videoResearch.creatorName || "watch"}] ${hookFormula} | CTA: ${ctaLine} | ${format}`;
    const lawFp = computeFingerprint(`mem:${watchedVideoKey}:law`);
    const existingLaw = existingMemories.find((m) => m.fingerprint === lawFp);
    if (existingLaw) {
      existingLaw.lastSeenAt = now;
      existingLaw.syncCount = (existingLaw.syncCount || 1) + 1;
    } else if (!this.isDuplicateMemory(existingMemories, lawText)) {
      const mem: MemoryItem = {
        id: `m-vid-${videoResearch.videoId}-law`,
        type: "learned",
        text: lawText,
        dateAdded: dateStr,
        category: "Winning hooks",
        fingerprint: lawFp,
        firstSeenAt: now,
        lastSeenAt: now,
        syncCount: 1,
      };
      memoryItems.push(mem);
      if (brandId) {
        persistMemoryCreate(brandId, mem).catch((err) =>
          console.warn("[ResearchDepartmentService] Video memory persist notice:", err)
        );
      }
    }

    const beatsText = spokenBeats.join(" → ");
    const beatsFp = computeFingerprint(`mem:${watchedVideoKey}:beats`);
    if (
      beatsText &&
      !existingMemories.some((m) => m.fingerprint === beatsFp) &&
      !this.isDuplicateMemory(existingMemories, beatsText) &&
      !memoryItems.some((m) => m.fingerprint === beatsFp)
    ) {
      const beatsMem: MemoryItem = {
        id: `m-vid-${videoResearch.videoId}-beats`,
        type: "learned",
        text: `[Inspiration beats — ${source.displayName || videoResearch.title}] ${beatsText}`,
        dateAdded: dateStr,
        category: "Audience preferences",
        fingerprint: beatsFp,
        firstSeenAt: now,
        lastSeenAt: now,
        syncCount: 1,
      };
      memoryItems.push(beatsMem);
      if (brandId) {
        persistMemoryCreate(brandId, beatsMem).catch((err) =>
          console.warn("[ResearchDepartmentService] Video beats memory persist notice:", err)
        );
      }
    }

    return { memoryItems, viralSparks, updatedSparks };
  }
}
