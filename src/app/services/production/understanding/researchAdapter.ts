/**
 * Research Adapter — Maps canonical StructuredVideoUnderstanding to/from existing VideoResearch.
 *
 * Preserves 100% compatibility with:
 * - researchSourceService.ts
 * - researchDepartmentService.ts
 * - researchWatchWinners.test.ts
 * - MY SPARK research views
 */

import type { VideoResearch } from "../../../domain/types";
import type {
  StructuredVideoUnderstanding,
  VideoUnderstandingSegment,
} from "./types";

/**
 * Transforms canonical StructuredVideoUnderstanding into the existing VideoResearch contract.
 */
export function toVideoResearch(
  understanding: StructuredVideoUnderstanding,
  extraMetadata: {
    title?: string;
    thumbnail?: string;
    creatorHandle?: string;
    creatorName?: string;
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    publishedAt?: string;
    platform?: string;
    videoId?: string;
  } = {}
): VideoResearch {
  const source = understanding.source;
  const platform =
    extraMetadata.platform ||
    (source.kind === "public_url"
      ? source.platform || "general"
      : source.kind === "reference_asset"
        ? "reference_asset"
        : "production");
  const videoId =
    extraMetadata.videoId ||
    (source.kind === "public_url"
      ? source.videoId || "vid"
      : source.kind === "production_asset"
        ? source.assetId
        : source.kind === "reference_asset"
          ? source.referenceId
          : "vid");

  const url = source.url;
  const duration = understanding.durationSec || 60;

  // Extract spoken beats from segments or speech
  const spoken_beats: string[] = [];
  const visual_actions: string[] = [];

  for (const seg of understanding.segments) {
    if (seg.speech?.spokenText) {
      spoken_beats.push(seg.speech.spokenText);
    }
    for (const act of seg.actions) {
      visual_actions.push(act.description);
    }
  }

  // Fallbacks if segment speech wasn't separated
  if (!spoken_beats.length && understanding.transcript?.text) {
    const sentences = understanding.transcript.text
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    spoken_beats.push(...sentences.slice(0, 4));
  }
  if (!spoken_beats.length) {
    spoken_beats.push("Opening narrative statement", "Core demonstration beat");
  }

  if (!visual_actions.length) {
    const summaryActions = understanding.summary.subjects.map(
      (s) => `${s.label} appears on screen`
    );
    visual_actions.push(...(summaryActions.length ? summaryActions : ["Subject appears on screen"]));
  }

  const firstSeg = understanding.segments[0];
  const lastSeg = understanding.segments[understanding.segments.length - 1];

  const opening_line =
    firstSeg?.speech?.spokenText ||
    spoken_beats[0] ||
    "Attention-grabbing visual hook";

  const cta_line =
    lastSeg?.speech?.spokenText ||
    (lastSeg?.actions.some((a) => /cta|follow|subscribe|check|link/i.test(a.description))
      ? lastSeg.actions[0].description
      : "Check out the link below");

  const hook_formula =
    understanding.summary.narrativeSummary ||
    `Hook: ${opening_line.slice(0, 50)}...`;

  const format =
    firstSeg?.camera?.framing?.includes("vertical") ||
    firstSeg?.composition?.layout?.includes("vertical")
      ? "short (9:16)"
      : "standard (16:9)";

  const frameEv = understanding.evidence.filter((e) => e.type !== "transcript" && e.type !== "audio");
  const transcriptEv = understanding.evidence.some((e) => e.type === "transcript");

  const transcript_ok = Boolean(
    understanding.transcript?.text && understanding.transcript.text.trim().length > 20
  );
  const frames_ok = frameEv.length > 0;

  const hookAnalysis =
    firstSeg?.camera?.cameraMovement || firstSeg?.actions[0]?.description
      ? `Opening engages audience with ${firstSeg.camera?.cameraMovement || "dynamic"} framing and ${firstSeg.actions[0]?.description || "motivated subject action"}.`
      : "Opening establishes immediate visual focus.";

  const pacingAnalysis =
    understanding.summary.motionSummary?.overallPacing ||
    `Pacing flows through ${understanding.segments.length} motivated segments across ${duration}s.`;

  const editingStyle =
    understanding.summary.cameraSummary?.cameraMovement
      ? `Camera leverages ${understanding.summary.cameraSummary.cameraMovement} coverage.`
      : "Clean editorial transitions between visual segments.";

  const visualStyle =
    understanding.summary.visualStyle?.visualStyle ||
    understanding.summary.visualStyle?.aesthetic ||
    "Naturalistic studio or location footage";

  const CTAAnalysis = `Call to action positioned at end of video: "${cta_line.slice(0, 80)}"`;

  const videoResearch: VideoResearch = {
    videoId,
    platform,
    title: extraMetadata.title || `Video (${videoId})`,
    url,
    thumbnail: extraMetadata.thumbnail || frameEv[0]?.url,
    durationSec: duration,
    duration_sec: duration,
    creatorHandle: extraMetadata.creatorHandle,
    creatorName: extraMetadata.creatorName,
    viewCount: extraMetadata.viewCount,
    likeCount: extraMetadata.likeCount,
    commentCount: extraMetadata.commentCount,
    publishedAt: extraMetadata.publishedAt,
    transcript: understanding.transcript?.text,
    metadata: {
      canonicalUnderstandingId: understanding.id,
      frameCount: frameEv.length,
      limitations: understanding.limitations,
    },
    hook_formula,
    opening_line,
    spoken_beats: spoken_beats.slice(0, 6),
    visual_actions: visual_actions.slice(0, 6),
    format,
    cta_line,
    transcript_ok,
    frames_ok,
    hookAnalysis,
    retentionAnalysis: pacingAnalysis,
    pacingAnalysis,
    editingStyle,
    storytelling: understanding.summary.narrativeSummary || "Grounded sequential visual storytelling.",
    visualStyle,
    emotionalPattern: "curiosity",
    thumbnailLanguage: extraMetadata.thumbnail ? "Visual hook representation" : "Frame capture",
    CTAAnalysis,
    audienceSignals: [],
    viralReasons: ["Structured hook-to-payoff pacing", "Clear visual focal point"],
    strengths: ["Strong visual consistency", "Clear temporal flow"],
    weaknesses: [],
    sparkScore: Math.round(understanding.confidence * 100),
    confidence: understanding.confidence,
    accepted: understanding.confidence >= 0.5 && (transcript_ok || frames_ok),
    watchStatus: understanding.confidence >= 0.5 ? "watched" : "failed",
  };

  return videoResearch;
}

/**
 * Maps existing VideoResearch back to canonical StructuredVideoUnderstanding.
 */
export function fromVideoResearch(research: VideoResearch): StructuredVideoUnderstanding {
  const isPublicUrl = research.url.startsWith("http://") || research.url.startsWith("https://");
  const source = isPublicUrl
    ? { kind: "public_url" as const, url: research.url, platform: research.platform, videoId: research.videoId }
    : { kind: "reference_asset" as const, referenceId: research.videoId || "ref", url: research.url };

  const segments: VideoUnderstandingSegment[] = [];
  const duration = research.durationSec || research.duration_sec || 60;
  const beats = research.spoken_beats && research.spoken_beats.length > 0 ? research.spoken_beats : [research.opening_line || "Main scene"];
  const segDuration = duration / Math.max(beats.length, 1);

  beats.forEach((beat, idx) => {
    segments.push({
      segmentIndex: idx,
      startSec: idx * segDuration,
      endSec: (idx + 1) * segDuration,
      durationSec: segDuration,
      subjects: [
        {
          id: `subj_${idx + 1}`,
          label: "subject",
          category: "person",
          provenance: "TRANSCRIPT_DERIVED",
          confidence: research.confidence || 0.7,
        },
      ],
      actions: [
        {
          description: research.visual_actions?.[idx] || beat,
          provenance: "TRANSCRIPT_DERIVED",
          confidence: research.confidence || 0.7,
        },
      ],
      objects: [],
      camera: {
        shotType: "medium_close_up",
        cameraMovement: "static",
        provenance: "TRANSCRIPT_DERIVED",
        confidence: 0.6,
      },
      motion: {
        cameraMotion: "static",
        subjectMotion: "talking",
        environmentalMotion: "none",
        overallIntensity: "moderate",
        motionOccurred: true,
        confidence: 0.6,
      },
      speech: {
        speechPresent: true,
        spokenText: beat,
        provenance: "TRANSCRIPT_DERIVED",
        confidence: 0.8,
      },
      startState: {
        visualState: "Start of beat visual state",
        confidence: 0.7,
      },
      endState: {
        visualState: "End of beat visual state",
        confidence: 0.7,
      },
      confidence: research.confidence || 0.7,
      evidence: [],
    });
  });

  return {
    id: (research.metadata?.canonicalUnderstandingId as string) || `vu_legacy_${research.videoId || Date.now()}`,
    source,
    durationSec: duration,
    summary: {
      subjects: segments[0]?.subjects || [],
      objects: [],
      narrativeSummary: research.storytelling || research.title,
      visualStyle: {
        visualStyle: research.visualStyle || "naturalistic",
        confidence: 0.8,
      },
      motionSummary: {
        overallPacing: research.pacingAnalysis || "moderate",
        motionOccurred: true,
        confidence: 0.7,
      },
    },
    segments,
    evidence: research.thumbnail
      ? [{ type: "thumbnail", url: research.thumbnail, provenance: "OBSERVED", confidence: 0.9 }]
      : [],
    transcript: research.transcript
      ? { text: research.transcript, confidence: 0.95 }
      : undefined,
    confidence: research.confidence || 0.8,
    limitations: (research.metadata?.limitations as string[]) || [],
    createdAt: new Date().toISOString(),
  };
}
