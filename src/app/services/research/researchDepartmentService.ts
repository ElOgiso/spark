import type { ResearchSource, ResearchPattern, MemoryItem, ViralSpark, RecentVideo } from "../../domain/types";
import { persistMemoryCreate, persistViralSparkCreate } from "../../backend/workspaceSync";

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
   * Consumes extracted ResearchPatterns and orchestrates:
   * 1. Categorized Video Analysis
   * 2. Executive Memory updates
   * 3. Brand Intelligence enrichment (account-specific rules)
   * 4. Unified Spark Scoring & Viral Spark generation
   */
  static processPatterns(
    brandId: string,
    source: ResearchSource,
    patterns: ResearchPattern[]
  ): { memoryItems: MemoryItem[]; viralSparks: ViralSpark[] } {
    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10);

    const memoryItems: MemoryItem[] = [];
    const viralSparks: ViralSpark[] = [];

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
        effectivePatterns.push({
          id: `pat-auto-${source.id}-${idx}`,
          sourceId: source.id,
          patternType: "Hook",
          confidence: v.sparkScore ? v.sparkScore / 100 : 0.8,
          originWeight: 0.85,
          title: `High Engagement Hook: ${v.title.slice(0, 40)}`,
          description: `Observed top-performing video with ${v.viewCount?.toLocaleString()} public views. Title structure creates immediate curiosity.`,
          evidence: `Public View Count: ${v.viewCount?.toLocaleString() || "Available"}`,
          metrics: { viewCount: v.viewCount, publishedAt: v.publishedAt },
          createdAt: now,
        });
      });
    }

    for (let i = 0; i < effectivePatterns.length; i++) {
      const p = effectivePatterns[i];

      // 1. Executive Memory Creation
      const memoryItem: MemoryItem = {
        id: `m-src-${Date.now()}-${i}`,
        type: "learned",
        text: `[Inspiration Account - ${source.displayName}] ${p.title}: ${p.description} (Confidence: ${Math.round((p.confidence || 0) * 100)}%)`,
        dateAdded: dateStr,
        category: "Winning hooks",
      };
      memoryItems.push(memoryItem);

      // Persist memory item quietly if brandId available
      if (brandId) {
        persistMemoryCreate(brandId, memoryItem).catch((err) =>
          console.warn("[ResearchDepartmentService] Memory persist notice:", err)
        );
      }

      // 2. Unified Spark Scoring & Generation
      const spark: ViralSpark = {
        id: `spk-src-${Date.now()}-${i}`,
        title: `${source.displayName}: ${p.title}`,
        hook: p.description,
        views: p.metrics?.viewCount ? `${p.metrics.viewCount.toLocaleString()}` : "Unavailable from Platform",
        velocity: "Unavailable",
        platformFit: source.platform === "youtube" ? "YouTube Shorts" : `${source.platform.toUpperCase()}`,
        brandFitScore: Math.round((p.confidence || 0.5) * 100),
        category: "rising",
        timeWindow: "Active Now",
        productionTime: "15 mins",
        whyNow: `SPARK observed this ${p.patternType.toLowerCase()} format on Inspiration Account (${source.displayName}).`,
        angle: p.title,
        audienceEmotion: "Unavailable",
        expectedRetention: "Unavailable",
        difficulty: "Medium",
        riskLevel: "Low",
        suggestedFormat: "Vertical 9:16",
        suggestedProductionMode: "standard",
        origin: "SOURCE",
        sourceId: source.id,
      };
      viralSparks.push(spark);

      // Persist viral spark quietly if brandId available
      if (brandId) {
        persistViralSparkCreate(brandId, spark).catch((err) =>
          console.warn("[ResearchDepartmentService] Spark persist notice:", err)
        );
      }
    }

    // 3. Process source learnings into Executive Memory
    if (source.learnings && source.learnings.length > 0) {
      source.learnings.forEach((learning, idx) => {
        const learningMemory: MemoryItem = {
          id: `m-learn-${Date.now()}-${idx}`,
          type: "learned",
          text: `[SPARK Learned - ${source.displayName}] ${learning}`,
          dateAdded: dateStr,
          category: "Audience preferences",
        };
        memoryItems.push(learningMemory);
        if (brandId) {
          persistMemoryCreate(brandId, learningMemory).catch((err) =>
            console.warn("[ResearchDepartmentService] Learning memory persist notice:", err)
          );
        }
      });
    }

    return { memoryItems, viralSparks };
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
