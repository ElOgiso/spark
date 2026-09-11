import type { VideoResearch } from "../../../domain/types";
import { ModelRouter } from "../../runtime/modelRouter";
import { getStoredAccountTokens } from "../../socialIntegrationService";

export class VideoUnderstandingProvider {
  private static CACHE_KEY = "spark_video_research_cache_v1";

  /**
   * Detects whether a URL represents a single video vs a full channel/profile
   */
  static isSingleVideoUrl(url: string): boolean {
    const clean = url.trim().toLowerCase();
    return (
      clean.includes("youtube.com/watch") ||
      clean.includes("youtu.be/") ||
      clean.includes("youtube.com/shorts/") ||
      (clean.includes("tiktok.com/@") && clean.includes("/video/")) ||
      clean.includes("vm.tiktok.com/") ||
      clean.includes("vt.tiktok.com/") ||
      clean.includes("instagram.com/reel/") ||
      clean.includes("instagram.com/p/") ||
      clean.includes("instagram.com/tv/") ||
      clean.includes("linkedin.com/posts/") ||
      clean.includes("linkedin.com/feed/update/") ||
      (clean.includes("x.com/") && clean.includes("/status/")) ||
      (clean.includes("twitter.com/") && clean.includes("/status/")) ||
      (clean.includes("facebook.com/") && clean.includes("/videos/")) ||
      clean.includes("fb.watch/")
    );
  }

  /**
   * Extract video ID from supported video platform URLs
   */
  static extractVideoId(url: string): { platform: string; videoId: string } {
    const clean = url.trim();
    if (clean.includes("youtube.com/watch")) {
      const match = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (match) return { platform: "youtube", videoId: match[1] };
    }
    if (clean.includes("youtu.be/")) {
      const match = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (match) return { platform: "youtube", videoId: match[1] };
    }
    if (clean.includes("youtube.com/shorts/")) {
      const match = clean.match(/shorts\/([a-zA-Z0-9_-]{11})/);
      if (match) return { platform: "youtube", videoId: match[1] };
    }
    if (clean.includes("tiktok.com/")) {
      const match = clean.match(/\/video\/(\d+)/);
      if (match) return { platform: "tiktok", videoId: match[1] };
    }
    if (clean.includes("instagram.com/")) {
      const match = clean.match(/\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/);
      if (match) return { platform: "instagram", videoId: match[1] };
    }
    if (clean.includes("x.com/") || clean.includes("twitter.com/")) {
      const match = clean.match(/\/status\/(\d+)/);
      if (match) return { platform: "x", videoId: match[1] };
    }
    return { platform: "general", videoId: "" };
  }

  static watchedVideoKey(platform: string, videoId: string): string {
    return `${String(platform || "").trim().toLowerCase()}:${String(videoId || "").trim()}`;
  }

  static isCannedAnalysisText(text?: string | null): boolean {
    if (!text || typeof text !== "string") return false;
    return (
      /Presents a high-curiosity opening hook anchored around/i.test(text) ||
      /Fast-paced[\s\S]{0,80}optimized for short-form/i.test(text) ||
      /Organic value bridge/i.test(text) ||
      /curiosity-first frame/i.test(text)
    );
  }

  static isAcceptedVideoResearch(vr?: VideoResearch | null): boolean {
    if (!vr) return false;
    const videoId = String(vr.videoId || "").trim();
    const title = String(vr.title || "").trim();
    const url = String(vr.url || "").trim();
    const hook = String(vr.hook_formula || "").trim();
    const opening = String(vr.opening_line || "").trim();
    const cta = String(vr.cta_line || "").trim();
    const format = String(vr.format || "").trim();
    const beats = Array.isArray(vr.spoken_beats) ? vr.spoken_beats.map((b) => String(b || "").trim()).filter(Boolean) : [];
    const actions = Array.isArray(vr.visual_actions)
      ? vr.visual_actions.map((a) => String(a || "").trim()).filter(Boolean)
      : [];
    const duration = typeof vr.duration_sec === "number" ? vr.duration_sec : vr.durationSec;
    if (!videoId || videoId.startsWith("vid-") || !title || !url) return false;
    if (hook.length < 8 || opening.length < 8 || cta.length < 4 || !format) return false;
    if (beats.length < 2 || beats.length > 6 || actions.length < 1) return false;
    if (typeof duration !== "number" || !(duration > 0)) return false;
    if (!vr.transcript_ok && !vr.frames_ok) return false;
    const blob = [hook, opening, cta, vr.hookAnalysis, vr.pacingAnalysis, vr.CTAAnalysis, ...beats].join(" ");
    if (this.isCannedAnalysisText(blob)) return false;
    return true;
  }

  /** Read video research from local cache */
  static getFromCache(url: string): VideoResearch | null {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const map: Record<string, VideoResearch> = JSON.parse(raw);
      return map[url.trim()] || null;
    } catch {
      return null;
    }
  }

  /** Save video research to local cache */
  static saveToCache(url: string, data: VideoResearch): void {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(this.CACHE_KEY);
      const map: Record<string, VideoResearch> = raw ? JSON.parse(raw) : {};
      map[url.trim()] = data;
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(map));
    } catch {
      // ignore storage errors
    }
  }

  static decodeTimedTextXml(xml: string): string {
    const matches = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
    if (!matches || matches.length === 0) return "";
    return matches
      .map((m) =>
        m
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/\\n/g, " ")
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  static async fetchTranscriptClient(videoId: string): Promise<string | undefined> {
    const langs = ["en", "en-US", "a.en"];
    for (const lang of langs) {
      try {
        const res = await fetch(
          `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`
        );
        if (!res.ok) continue;
        const text = this.decodeTimedTextXml(await res.text());
        if (text.length > 20) return text.slice(0, 3000);
      } catch (err) {
        console.warn("[VideoUnderstandingProvider] Client caption fetch notice:", err);
      }
    }
    return undefined;
  }

  /**
   * Stage 2: Origin timedtext proxy first (avoids browser CORS). Client YouTube
   * timedtext only if that route is missing (404).
   */
  static async fetchTranscript(videoId: string, platform: string): Promise<string | undefined> {
    if (platform !== "youtube" || !videoId) return undefined;
    let routeMissing = false;
    try {
      const res = await fetch(`/api/runtime/video?action=captions&v=${encodeURIComponent(videoId)}`);
      if (res.status === 404) {
        routeMissing = true;
      } else if (res.ok) {
        const raw = (await res.text()).trim();
        if (raw.length > 20 && !raw.startsWith("{")) return raw.slice(0, 3000);
        if (raw.startsWith("{")) {
          try {
            const data = JSON.parse(raw);
            const text = typeof data.text === "string" ? data.text.trim() : "";
            if (text.length > 20) return text.slice(0, 3000);
          } catch {
            /* empty or non-caption JSON */
          }
        }
        return undefined;
      } else {
        return undefined;
      }
    } catch (err) {
      console.warn("[VideoUnderstandingProvider] Origin caption fetch notice:", err);
    }
    if (routeMissing) return this.fetchTranscriptClient(videoId);
    return undefined;
  }

  /**
   * Stage 3: Extract representative keyframe images for multimodal visual analysis (Tier 2 Deep Analysis)
   */
  static async extractKeyframes(videoId: string, platform: string): Promise<string[]> {
    if (platform !== "youtube" || !videoId) return [];

    try {
      const candidates = [
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/1.jpg`,
        `https://i.ytimg.com/vi/${videoId}/2.jpg`,
        `https://i.ytimg.com/vi/${videoId}/3.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      ];

      return candidates.slice(0, 6);
    } catch (err) {
      console.warn("[VideoUnderstandingProvider] Frame extraction notice:", err);
      return [];
    }
  }

  /**
   * Primary Entry Point: Metadata -> Transcript -> Keyframe Extraction -> Multimodal Vision Engine
   */
  static async analyzeVideo(url: string, userRoutingConfig?: any): Promise<VideoResearch> {
    const cleanUrl = url.trim();

    const cached = this.getFromCache(cleanUrl);
    if (cached && this.isAcceptedVideoResearch(cached)) {
      console.log(`[VideoUnderstandingProvider] Returning cached accepted analysis for ${cleanUrl}`);
      return { ...cached, accepted: true, watchStatus: "watched" };
    }

    const { platform, videoId } = this.extractVideoId(cleanUrl);
    const failed = (partial: Partial<VideoResearch> = {}): VideoResearch => ({
      videoId: videoId || "",
      platform,
      title: "",
      url: cleanUrl,
      hookAnalysis: "",
      retentionAnalysis: "",
      pacingAnalysis: "",
      editingStyle: "",
      storytelling: "",
      visualStyle: "",
      emotionalPattern: "",
      thumbnailLanguage: "",
      CTAAnalysis: "",
      audienceSignals: [],
      viralReasons: [],
      strengths: [],
      weaknesses: [],
      sparkScore: 0,
      confidence: 0,
      transcript_ok: false,
      frames_ok: false,
      ...partial,
      accepted: false,
      watchStatus: "failed",
    });

    if (!videoId) {
      return failed();
    }
    const googleApiKey =
      (typeof import.meta !== "undefined" && ((import.meta as any).env?.VITE_YOUTUBE_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || (import.meta as any).env?.YOUTUBE_API_KEY || (import.meta as any).env?.GOOGLE_API_KEY)) ||
      (typeof process !== "undefined" && (process.env?.VITE_YOUTUBE_API_KEY || process.env?.VITE_GOOGLE_API_KEY || process.env?.YOUTUBE_API_KEY || process.env?.GOOGLE_API_KEY)) ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("youtube_api_key") || localStorage.getItem("google_api_key") : null);

    const storedTokens = getStoredAccountTokens() as Record<string, any>;
    const ytTokenObj = storedTokens["YouTube Shorts"] || storedTokens["YouTube"] || storedTokens["youtube"] || storedTokens["google"];
    const googleOAuthToken = (ytTokenObj?.status === "Connected" || ytTokenObj?.status === "Refreshing" || !ytTokenObj?.status)
      ? (ytTokenObj?.accessToken || ytTokenObj?.access_token || ytTokenObj?.token?.accessToken || null)
      : null;

    // Stage 1: Metadata Extraction
    let title = "";
    let thumbnail: string | undefined = undefined;
    let durationSec: number | undefined = undefined;
    let creatorHandle: string | undefined = undefined;
    let creatorName: string | undefined = undefined;
    let viewCount: number | undefined = undefined;
    let likeCount: number | undefined = undefined;
    let commentCount: number | undefined = undefined;
    let publishedAt: string | undefined = new Date().toISOString();
    let description = "";
    let tags: string[] = [];

    if (platform === "youtube" && (googleApiKey || googleOAuthToken)) {
      try {
        let fullUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}`;
        const headers: Record<string, string> = {};
        if (googleOAuthToken) headers["Authorization"] = `Bearer ${googleOAuthToken}`;
        if (googleApiKey) fullUrl += `&key=${googleApiKey}`;

        const res = await fetch(fullUrl, { headers });
        if (res.ok) {
          const data = await res.json();
          const item = data.items?.[0];
          if (item) {
            title = item.snippet?.title || title;
            description = item.snippet?.description || "";
            creatorHandle = `@${item.snippet?.channelTitle?.replace(/\s+/g, "") || "creator"}`;
            creatorName = item.snippet?.channelTitle || creatorName;
            publishedAt = item.snippet?.publishedAt || publishedAt;
            tags = Array.isArray(item.snippet?.tags) ? item.snippet.tags : [];
            thumbnail =
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url ||
              item.snippet?.thumbnails?.default?.url;

            if (item.statistics) {
              viewCount = item.statistics.viewCount ? Number(item.statistics.viewCount) : undefined;
              likeCount = item.statistics.likeCount ? Number(item.statistics.likeCount) : undefined;
              commentCount = item.statistics.commentCount ? Number(item.statistics.commentCount) : undefined;
            }

            if (item.contentDetails?.duration) {
              const match = item.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              if (match) {
                const h = parseInt(match[1] || "0", 10);
                const m = parseInt(match[2] || "0", 10);
                const s = parseInt(match[3] || "0", 10);
                durationSec = h * 3600 + m * 60 + s;
              }
            }
          }
        }
      } catch (err) {
        console.warn("[VideoUnderstandingProvider] Metadata fetch notice:", err);
      }
    }

    // Public oEmbed Fallback for YouTube (unauthenticated, highly reliable)
    if (platform === "youtube" && (!title || !thumbnail)) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const oembed = await res.json();
          if (oembed.title && !title) title = oembed.title;
          if (oembed.author_name && !creatorName) {
            creatorName = oembed.author_name;
            if (!creatorHandle) creatorHandle = `@${oembed.author_name.replace(/\s+/g, "")}`;
          }
          if (oembed.thumbnail_url && !thumbnail) thumbnail = oembed.thumbnail_url;
        }
      } catch (oembedErr) {
        console.warn("[VideoUnderstandingProvider] YouTube oEmbed fetch notice:", oembedErr);
      }
    }

    if (!thumbnail && platform === "youtube" && videoId) {
      thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
    if (!title && platform === "youtube" && videoId) {
      title = `YouTube Video (${videoId})`;
    }

    // Stage 2: Transcript Extraction
    const transcript = await this.fetchTranscript(videoId, platform);

    // Stage 3: Frame Extraction (Tier 2 Deep Multimodal Analysis)
    const frames = await this.extractKeyframes(videoId, platform);

    // Stage 4: Multimodal Vision & Audio Analysis via ModelRouter
    const prompt = `Watch this video once and extract a production ticket SPARK can remake.
Video Title: "${title}"
Platform: ${platform}
Duration: ${durationSec ? `${durationSec}s` : "unknown (short/long form)"}
Public View Count: ${viewCount ?? "unknown"}
Public Likes: ${likeCount ?? "unknown"}
Tags/Topics: ${tags.join(", ") || "unknown"}
Description: ${description.slice(0, 300)}
${transcript ? `Transcript: "${transcript.slice(0, 1000)}"` : "Transcript: unavailable"}
${frames.length > 0 ? `Keyframe URLs attached: ${frames.length}` : "Keyframes: none"}

Return strict JSON only (no markdown) with these exact keys:
{
  "hook_formula": "reusable hook pattern, not a recap essay",
  "opening_line": "first spoken or on-screen hook, exact words if heard",
  "spoken_beats": ["2 to 6 short spoken beats in order"],
  "visual_actions": ["what happens on camera per beat"],
  "format": "short|long plus 9:16 or 16:9 if known",
  "cta_line": "the actual call to action spoken or shown",
  "hookAnalysis": "one sentence on why the opening works",
  "retentionAnalysis": "one sentence on pacing from evidence only",
  "pacingAnalysis": "one sentence from evidence only",
  "editingStyle": "one sentence from frames/transcript only",
  "storytelling": "one sentence from evidence only",
  "visualStyle": "one sentence from frames only",
  "emotionalPattern": "one emotion word from evidence",
  "thumbnailLanguage": "one sentence from the thumbnail frame",
  "CTAAnalysis": "one sentence from the real CTA",
  "audienceSignals": ["up to 3 signals from comments/metrics if known"],
  "viralReasons": ["up to 3 reasons grounded in this video"],
  "strengths": ["up to 2"],
  "weaknesses": ["up to 2"],
  "sparkScore": <integer 0-100 from evidence only>,
  "confidence": <float 0-1>
}
Do not invent a hook, CTA, or beats if they are not in the transcript or frames.`;

    const systemInstruction = frames.length > 0
      ? `You are SPARK's AI Multimodal Video Vision Engine. You have been provided with ${frames.length} actual representative keyframe images extracted from this video. Base your visual analysis directly on empirical observations of these real video frames. Return clean JSON only.`
      : "You are SPARK's AI Video Understanding Engine. Return clean JSON only.";

    let aiResult: any = null;
    try {
      const rawAi = await ModelRouter.executeCategoryRequest(
        "videoUnderstanding",
        {
          prompt,
          systemInstruction,
          frames: frames.length > 0 ? frames : undefined,
          capability: "Video Understanding",
        },
        userRoutingConfig
      );

      const jsonMatch = rawAi.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      }
    } catch (aiErr) {
      console.warn("[VideoUnderstandingProvider] Multimodal AI vision synthesis notice:", aiErr);
    }

    const transcript_ok = Boolean(transcript && transcript.trim().length > 20);
    const frames_ok = Boolean(aiResult && frames.length > 0);
    const spoken_beats = Array.isArray(aiResult?.spoken_beats)
      ? aiResult.spoken_beats.map((b: any) => String(b || "").trim()).filter(Boolean).slice(0, 6)
      : [];
    const visual_actions = Array.isArray(aiResult?.visual_actions)
      ? aiResult.visual_actions.map((a: any) => String(a || "").trim()).filter(Boolean).slice(0, 6)
      : [];
    const duration_sec =
      typeof durationSec === "number" && durationSec > 0
        ? durationSec
        : typeof aiResult?.duration_sec === "number" && aiResult.duration_sec > 0
          ? aiResult.duration_sec
          : cleanUrl.includes("/shorts/")
            ? 60
            : 180;

    const videoResearch: VideoResearch = {
      videoId,
      platform,
      title,
      url: cleanUrl,
      thumbnail: thumbnail || (platform === "youtube" ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined),
      durationSec: duration_sec,
      duration_sec,
      creatorHandle,
      creatorName,
      viewCount,
      likeCount,
      commentCount,
      publishedAt,
      transcript,
      metadata: {
        framesExtracted: frames.length > 0,
        frameCount: frames.length,
        frameSource: frames.length > 0 ? "YouTube Public Keyframes" : "none",
      },
      hook_formula: typeof aiResult?.hook_formula === "string" ? aiResult.hook_formula.trim() : "",
      opening_line: typeof aiResult?.opening_line === "string" ? aiResult.opening_line.trim() : "",
      spoken_beats,
      visual_actions,
      format: typeof aiResult?.format === "string" ? aiResult.format.trim() : "",
      cta_line: typeof aiResult?.cta_line === "string" ? aiResult.cta_line.trim() : "",
      transcript_ok,
      frames_ok,
      hookAnalysis: typeof aiResult?.hookAnalysis === "string" ? aiResult.hookAnalysis : "",
      retentionAnalysis: typeof aiResult?.retentionAnalysis === "string" ? aiResult.retentionAnalysis : "",
      pacingAnalysis: typeof aiResult?.pacingAnalysis === "string" ? aiResult.pacingAnalysis : "",
      editingStyle: typeof aiResult?.editingStyle === "string" ? aiResult.editingStyle : "",
      storytelling: typeof aiResult?.storytelling === "string" ? aiResult.storytelling : "",
      visualStyle: typeof aiResult?.visualStyle === "string" ? aiResult.visualStyle : "",
      emotionalPattern: typeof aiResult?.emotionalPattern === "string" ? aiResult.emotionalPattern : "",
      thumbnailLanguage: typeof aiResult?.thumbnailLanguage === "string" ? aiResult.thumbnailLanguage : "",
      CTAAnalysis: typeof aiResult?.CTAAnalysis === "string" ? aiResult.CTAAnalysis : "",
      audienceSignals: Array.isArray(aiResult?.audienceSignals) ? aiResult.audienceSignals : [],
      viralReasons: Array.isArray(aiResult?.viralReasons) ? aiResult.viralReasons : [],
      strengths: Array.isArray(aiResult?.strengths) ? aiResult.strengths : [],
      weaknesses: Array.isArray(aiResult?.weaknesses) ? aiResult.weaknesses : [],
      sparkScore: typeof aiResult?.sparkScore === "number" ? aiResult.sparkScore : 0,
      confidence: typeof aiResult?.confidence === "number" ? aiResult.confidence : 0,
      accepted: false,
      watchStatus: "failed",
    };

    if (!aiResult || (!transcript_ok && !frames_ok) || !this.isAcceptedVideoResearch(videoResearch)) {
      return failed({
        title,
        thumbnail: videoResearch.thumbnail,
        durationSec: duration_sec,
        duration_sec,
        creatorHandle,
        creatorName,
        viewCount,
        likeCount,
        commentCount,
        publishedAt,
        transcript,
        transcript_ok,
        frames_ok,
      });
    }

    videoResearch.accepted = true;
    videoResearch.watchStatus = "watched";
    this.saveToCache(cleanUrl, videoResearch);
    return videoResearch;
  }
}
