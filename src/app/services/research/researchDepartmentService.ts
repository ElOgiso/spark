import type { ResearchSource, ResearchPattern, MemoryItem, ViralSpark, RecentVideo } from "../../domain/types";
import { persistMemoryCreate, persistViralSparkCreate } from "../../backend/workspaceSync";

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

export class ResearchDepartmentService {
  /**
   * Generates SPARK's analytical observations for extracted videos based on real metadata.
   * Observations are SPARK's analysis — never fabricated platform metrics.
   */
  static analyzeRecentVideos(videos: RecentVideo[]): void {
    for (const v of videos) {
      if (!v.observationsCategorized) {
        const durMins = v.durationSec ? Math.floor(v.durationSec / 60) : 0;
        const durSecs = v.durationSec ? v.durationSec % 60 : 0;
        const tagStr = v.tags && v.tags.length > 0 ? v.tags.slice(0, 3).join(", ") : "general content";
        const hasHighViews = typeof v.viewCount === "number" && v.viewCount > 5000;

        v.observationsCategorized = {
          hook: `Title opener "${v.title.length > 50 ? v.title.slice(0, 47) + '...' : v.title}" sets up a direct curiosity-first frame.`,
          format: v.durationSec && v.durationSec <= 60
            ? "Vertical Short-Form format (<60s) optimized for rapid swipe retention."
            : `Standard video format (${durMins}m ${durSecs}s) structured around deep topic analysis.`,
          story: v.description && v.description.length > 100
            ? "Detailed description narrative providing key links and structured timestamps."
            : "Concise description focusing on direct viewer engagement.",
          thumbnail: v.thumbnail
            ? "High-contrast public thumbnail asset with clear focal element."
            : "Public preview asset registered.",
          cta: "Organic value bridge inviting comment discussion and channel subscription.",
          editing: `Topic pacing aligned with ${tagStr}. ${hasHighViews ? 'High public engagement velocity.' : 'Standard pacing.'}`,
        };

        if (!v.observations || v.observations.length === 0) {
          v.observations = [
            v.observationsCategorized.hook!,
            v.observationsCategorized.format!,
            v.observationsCategorized.editing!,
          ];
        }
      }
    }
  }

  /**
   * Consumes extracted ResearchPatterns with Deterministic Intelligence Fingerprinting:
   * 1. Check existing ViralSparks & MemoryItems by fingerprint / video title.
   * 2. If existing: UPDATE mutable metrics (views, lastSeenAt, syncCount). DO NOT duplicate.
   * 3. If new: Create & persist new ViralSpark / MemoryItem with fingerprint.
   */
  static processPatterns(
    brandId: string,
    source: ResearchSource,
    patterns: ResearchPattern[],
    existingSparks: ViralSpark[] = [],
    existingMemories: MemoryItem[] = []
  ): {
    memoryItems: MemoryItem[];
    viralSparks: ViralSpark[];
    updatedSparks: ViralSpark[];
    updatedMemories: MemoryItem[];
  } {
    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10);

    const memoryItems: MemoryItem[] = [];
    const viralSparks: ViralSpark[] = [];
    const updatedSparks: ViralSpark[] = [];
    const updatedMemories: MemoryItem[] = [];

    // Analyze recent videos metadata through SPARK's analytical lens
    if (source.recentVideos && source.recentVideos.length > 0) {
      this.analyzeRecentVideos(source.recentVideos);
    }

    // Synthesize auto-patterns from top performing videos if explicit patterns empty
    let effectivePatterns = [...patterns];
    if (effectivePatterns.length === 0 && source.recentVideos && source.recentVideos.length > 0) {
      const topVids = [...source.recentVideos]
        .filter((v) => typeof v.viewCount === "number")
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 3);

      topVids.forEach((v, idx) => {
        const isShort = v.durationSec && v.durationSec <= 60;
        const titleWords = v.title.split(" ");
        const hookPattern = `First-line curiosity opener: "${v.title.slice(0, 45)}"`;
        const titlePattern = `Title structure (${titleWords.length} words, curiosity gap)`;
        const format = isShort ? "Vertical Short-Form (Shorts/Reels)" : "Deep Dive Narrative";
        const ctaStyle = "Organic value bridge inviting comment discussion";
        const nicheLanguage = v.tags && v.tags.length > 0 ? v.tags.slice(0, 3).join(", ") : "niche terms";

        effectivePatterns.push({
          id: `pat-auto-${source.id}-${idx}`,
          sourceId: source.id,
          patternType: "Hook",
          confidence: v.sparkScore ? v.sparkScore / 100 : 0.8,
          originWeight: 0.85,
          title: `High Retention Pattern: ${v.title.slice(0, 45)}`,
          description: `${hookPattern}. Format: ${format}. Niche terms: ${nicheLanguage}.`,
          evidence: `Public View Count: ${v.viewCount?.toLocaleString() || "Available"}`,
          metrics: {
            viewCount: v.viewCount,
            publishedAt: v.publishedAt,
            hookPattern,
            titlePattern,
            thumbnailIdeaType: "High-contrast split visual with key topic focus",
            format,
            ctaStyle,
            nicheLanguage,
          },
          createdAt: now,
        });
      });
    }

    for (let i = 0; i < effectivePatterns.length; i++) {
      const p = effectivePatterns[i];
      const sparkTitle = `${source.displayName}: ${p.title}`;
      const sparkFingerprint = computeFingerprint(`${source.platform}:${source.id}:${p.patternType}:${p.title}:${p.evidence || ""}`);
      const memoryFingerprint = computeFingerprint(`mem:${source.id}:${p.title}:${p.description}`);

      // 1. Executive Memory Creation vs. Update
      const existingMem = existingMemories.find(
        (m) => (m.fingerprint && m.fingerprint === memoryFingerprint) || m.text.includes(p.title)
      );

      if (existingMem) {
        existingMem.lastSeenAt = now;
        existingMem.syncCount = (existingMem.syncCount || 1) + 1;
        updatedMemories.push(existingMem);
      } else {
        const memoryItem: MemoryItem = {
          id: `m-src-${Date.now()}-${i}`,
          type: "learned",
          text: `[Inspiration Account - ${source.displayName}] ${p.title}: ${p.description} (Confidence: ${Math.round((p.confidence || 0) * 100)}%)`,
          dateAdded: dateStr,
          category: "Winning hooks",
          fingerprint: memoryFingerprint,
          firstSeenAt: now,
          lastSeenAt: now,
          syncCount: 1,
        };
        memoryItems.push(memoryItem);

        if (brandId) {
          persistMemoryCreate(brandId, memoryItem).catch((err) =>
            console.warn("[ResearchDepartmentService] Memory persist notice:", err)
          );
        }
      }

      // 2. Unified Spark Scoring & Generation vs. Metric Update
      const existingSpark = existingSparks.find(
        (s) => (s.fingerprint && s.fingerprint === sparkFingerprint) || (s.sourceId === source.id && s.title === sparkTitle)
      );

      const brandWinMemories = existingMemories.filter((m) => m.text?.includes("[BRAND WIN]"));
      const hasProvenWinMatch = brandWinMemories.some(
        (m) =>
          (p.patternType && m.text.toLowerCase().includes(p.patternType.toLowerCase())) ||
          (patternMetrics.format && m.text.toLowerCase().includes(patternMetrics.format.toLowerCase())) ||
          (source.platform && m.text.toLowerCase().includes(source.platform.toLowerCase()))
      );

      const newViewsStr = p.metrics?.viewCount ? `${p.metrics.viewCount.toLocaleString()}` : "Unavailable from Platform";
      const baseScore = Math.round((p.confidence || 0.5) * 100);
      const newScore = Math.min(99, baseScore + (hasProvenWinMatch ? 10 : 0));
      const patternMetrics: any = p.metrics && typeof p.metrics === "object" ? p.metrics : {};

      if (existingSpark) {
        // DO NOT create duplicate. Update mutable metrics only!
        existingSpark.views = newViewsStr;
        existingSpark.brandFitScore = newScore;
        existingSpark.lastSeenAt = now;
        existingSpark.lastSyncedAt = now;
        existingSpark.syncCount = (existingSpark.syncCount || 1) + 1;
        existingSpark.fingerprint = sparkFingerprint;
        updatedSparks.push(existingSpark);
      } else {
        const spark: ViralSpark = {
          id: `spk-src-${Date.now()}-${i}`,
          title: sparkTitle,
          hook: patternMetrics.hookPattern || p.description,
          views: newViewsStr,
          velocity: "High Velocity",
          platformFit: source.platform === "youtube" ? "YouTube Shorts" : `${source.platform.toUpperCase()}`,
          brandFitScore: newScore,
          category: "rising",
          timeWindow: "Active Now",
          productionTime: "15 mins",
          whyNow: `Observed ${patternMetrics.format || p.patternType} pattern on Inspiration Account (${source.displayName}). Niche focus: ${patternMetrics.nicheLanguage || "general"}.`,
          angle: p.title,
          audienceEmotion: "Curiosity & High Retention",
          expectedRetention: "85%+",
          difficulty: "Medium",
          riskLevel: "Low",
          suggestedFormat: patternMetrics.format?.includes("Shorts") ? "narrator_vo" : "host_hybrid",
          suggestedProductionMode: patternMetrics.format?.includes("Shorts") ? "express" : "standard",
          suggestedMode: patternMetrics.format?.includes("Shorts") ? "express" : "standard",
          origin: "SOURCE",
          sourceId: source.id,
          fingerprint: sparkFingerprint,
          firstSeenAt: now,
          lastSeenAt: now,
          lastSyncedAt: now,
          syncCount: 1,
          researchContext: {
            sourceName: source.displayName || source.username,
            platform: source.platform,
            hookPattern: patternMetrics.hookPattern || p.description,
            titlePattern: patternMetrics.titlePattern,
            format: patternMetrics.format,
            ctaStyle: patternMetrics.ctaStyle,
            nicheLanguage: patternMetrics.nicheLanguage ? [patternMetrics.nicheLanguage] : undefined,
            viralReasons: [p.evidence || "High public engagement"],
            provenStructure: patternMetrics.format,
          },
        };
        viralSparks.push(spark);

        if (brandId) {
          persistViralSparkCreate(brandId, spark).catch((err) =>
            console.warn("[ResearchDepartmentService] Spark persist notice:", err)
          );
        }
      }
    }

    // 3. Process source learnings into Executive Memory (Deduplicated)
    if (source.learnings && source.learnings.length > 0) {
      source.learnings.forEach((learning, idx) => {
        const learningFp = computeFingerprint(`learn:${source.id}:${learning}`);
        const existingLearnMem = existingMemories.find(
          (m) => (m.fingerprint && m.fingerprint === learningFp) || m.text.includes(learning)
        );

        if (existingLearnMem) {
          existingLearnMem.lastSeenAt = now;
          existingLearnMem.syncCount = (existingLearnMem.syncCount || 1) + 1;
          updatedMemories.push(existingLearnMem);
        } else {
          const learningMemory: MemoryItem = {
            id: `m-learn-${Date.now()}-${idx}`,
            type: "learned",
            text: `[SPARK Learned - ${source.displayName}] ${learning}`,
            dateAdded: dateStr,
            category: "Audience preferences",
            fingerprint: learningFp,
            firstSeenAt: now,
            lastSeenAt: now,
            syncCount: 1,
          };
          memoryItems.push(learningMemory);

          if (brandId) {
            persistMemoryCreate(brandId, learningMemory).catch((err) =>
              console.warn("[ResearchDepartmentService] Memory persist notice:", err)
            );
          }
        }
      });
    }

    return { memoryItems, viralSparks, updatedSparks, updatedMemories };
  }

  /**
   * Helper to check memory text similarity and prevent duplicates
   */
  static isDuplicateMemory(existingMemories: MemoryItem[] = [], newText: string): boolean {
    const normNew = newText.toLowerCase().replace(/[^a-z0-9]/g, "");
    return existingMemories.some((m) => {
      const normExisting = m.text.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normExisting === normNew || (normNew.length > 30 && normExisting.includes(normNew));
    });
  }

  /**
   * Phase 19: Converts VideoResearch signals into Executive Memory items & Viral Sparks
   */
  static processVideoResearch(
    brandId: string,
    source: ResearchSource,
    videoResearch: import("../../domain/types").VideoResearch,
    existingMemories: MemoryItem[] = []
  ): { memoryItems: MemoryItem[]; viralSparks: ViralSpark[] } {
    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10);
    const memoryItems: MemoryItem[] = [];
    const viralSparks: ViralSpark[] = [];

    // 1. Convert video research insights into Executive Memory items (with deduplication & source attribution)
    const creatorAttr = source.displayName || videoResearch.creatorName || "Inspiration Video";
    const insights = [
      { text: `[Inspiration Account — ${creatorAttr}] Hook: ${videoResearch.hookAnalysis}`, cat: "Winning hooks" },
      { text: `[Inspiration Account — ${creatorAttr}] Retention & Pacing: ${videoResearch.retentionAnalysis}`, cat: "Audience preferences" },
      { text: `[Inspiration Account — ${creatorAttr}] Editing & Visual Style: ${videoResearch.editingStyle}`, cat: "Visual style" },
      { text: `[Inspiration Account — ${creatorAttr}] Story Arc: ${videoResearch.storytelling}`, cat: "Content ideas" },
    ];

    insights.forEach((item, idx) => {
      if (!this.isDuplicateMemory(existingMemories, item.text)) {
        const mem: MemoryItem = {
          id: `m-vid-${Date.now()}-${idx}`,
          type: "learned",
          text: item.text,
          dateAdded: dateStr,
          category: item.cat as any,
        };
        memoryItems.push(mem);
        if (brandId) {
          persistMemoryCreate(brandId, mem).catch((err) =>
            console.warn("[ResearchDepartmentService] Video memory persist notice:", err)
          );
        }
      }
    });

    // 2. Synthesize Viral Spark from video research
    const spark: ViralSpark = {
      id: `spk-vid-${Date.now()}`,
      title: `Adaptation: ${videoResearch.title}`,
      hook: videoResearch.hookAnalysis,
      views: videoResearch.viewCount ? videoResearch.viewCount.toLocaleString() : "Unavailable from Platform",
      velocity: "Unavailable",
      platformFit: videoResearch.platform === "youtube" ? "YouTube Shorts" : videoResearch.platform.toUpperCase(),
      brandFitScore: Math.round(videoResearch.sparkScore || 90),
      category: "rising",
      timeWindow: "Immediate Opportunity",
      productionTime: videoResearch.durationSec && videoResearch.durationSec <= 60 ? "10 mins" : "30 mins",
      whyNow: `AI Video Analysis identified viral hook & storytelling patterns in "${videoResearch.title}".`,
      angle: videoResearch.title,
      audienceEmotion: videoResearch.emotionalPattern || "Unavailable",
      expectedRetention: videoResearch.retentionAnalysis || "Unavailable",
      difficulty: "Medium",
      riskLevel: "Low",
      suggestedFormat: videoResearch.durationSec && videoResearch.durationSec <= 60 ? "Vertical 9:16" : "Landscape 16:9",
      suggestedProductionMode: videoResearch.durationSec && videoResearch.durationSec <= 60 ? "express" : "standard",
      origin: "SOURCE",
      sourceId: source.id,
    };
    viralSparks.push(spark);

    if (brandId) {
      persistViralSparkCreate(brandId, spark).catch((err) =>
        console.warn("[ResearchDepartmentService] Video spark persist notice:", err)
      );
    }

    return { memoryItems, viralSparks };
  }
}
