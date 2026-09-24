/**
 * Canonical Video Understanding Service
 *
 * Implements Phase 16 unified evidence-based video understanding.
 * Consolidates source acquisition, multimodal AI vision, temporal segmentation,
 * boundary state tracking, and fail-closed evidence tracking into one canonical layer.
 */

import { runtimeFetch } from "../../../backend/runtimeFetch";
import { ModelRouter } from "../../runtime/modelRouter";
import type {
  StructuredVideoUnderstanding,
  VideoUnderstandingSegment,
  VideoUnderstandingSource,
  EvidenceReference,
  ObservedSubject,
  ObservedAction,
  ObservedObject,
  ObservedCameraState,
  ObservedMotionState,
  ObservedLightingState,
  ObservedStyleState,
  ObservedBoundaryState,
  VideoUnderstandingExecutionProvider,
  MultimodalAnalysisInput,
  UnderstandVideoOptions,
} from "./types";

export type { UnderstandVideoOptions };

export class VideoUnderstandingService {
  /**
   * Primary entry point: Extracts structured, temporal video understanding from any source.
   */
  static async understand(
    source: VideoUnderstandingSource,
    options: UnderstandVideoOptions = {}
  ): Promise<StructuredVideoUnderstanding> {
    const understandingId = `vu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const url = source.url.trim();

    // 1. Gather transcript and frame evidence
    let transcriptText = options.injectedTranscript;
    const evidence: EvidenceReference[] = [];

    let frameUrls: string[] = options.injectedFrames ? [...options.injectedFrames] : [];

    if (source.kind === "public_url") {
      const isYt = /youtube\.com|youtu\.be/i.test(url);
      const ytIdMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})|shorts\/([a-zA-Z0-9_-]{11})/);
      const ytVideoId = ytIdMatch ? (ytIdMatch[1] || ytIdMatch[2] || ytIdMatch[3]) : undefined;

      if (isYt && ytVideoId) {
        // Thumbnail with accurate provenance
        evidence.push({
          type: "thumbnail",
          url: `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`,
          provenance: "METADATA_DERIVED",
          confidence: 0.9,
          description: "YouTube public video thumbnail",
        });

        if (!frameUrls.length) {
          frameUrls.push(
            `https://i.ytimg.com/vi/${ytVideoId}/1.jpg`,
            `https://i.ytimg.com/vi/${ytVideoId}/2.jpg`,
            `https://i.ytimg.com/vi/${ytVideoId}/3.jpg`
          );
        }
      }
    }

    for (const fUrl of frameUrls) {
      evidence.push({
        type: "representative_frame",
        url: fUrl,
        provenance: "OBSERVED",
        confidence: 0.85,
        description: "Representative video frame candidate",
      });
    }

    if (transcriptText) {
      evidence.push({
        type: "transcript",
        description: "Source dialogue or caption transcript",
        provenance: "TRANSCRIPT_DERIVED",
        confidence: 0.95,
      });
    }

    // Fail closed if source has neither media url, frames, nor transcript
    if (!url && !frameUrls.length && !transcriptText) {
      return this.createFailClosedResult(understandingId, source, ["no_media_url_or_frames_provided"]);
    }

    // 2. Multimodal AI Analysis Prompt
    const prompt = `Analyze this video thoroughly and extract structured, temporal production evidence.
Video Source: ${url}
Attached Frames: ${frameUrls.length}
Transcript Available: ${transcriptText ? `"${transcriptText.slice(0, 1000)}"` : "none"}

Respond with strict JSON only (no markdown, no preamble) conforming to this exact structure:
{
  "durationSec": <estimated or observed duration in seconds>,
  "confidence": <float 0.0 to 1.0 based strictly on visual/transcript clarity>,
  "summary": {
    "subjects": [
      { "category": "person"|"character"|"product"|"object"|"location", "label": "e.g. Architect", "appearance": "description", "role": "primary"|"secondary", "confidence": 0.9 }
    ],
    "objects": [
      { "label": "e.g. tablet", "state": "active", "importance": "primary"|"secondary", "confidence": 0.85 }
    ],
    "visualStyle": {
      "visualStyle": "e.g. naturalistic cinematic",
      "aesthetic": "e.g. sleek modern",
      "texture": "e.g. crisp 4k glass",
      "confidence": 0.85
    },
    "cameraSummary": {
      "shotType": "medium"|"wide"|"closeup"|"establishing",
      "cameraMovement": "push_in"|"pan"|"tilt"|"track"|"static"|"orbit",
      "framing": "centered"|"rule_of_thirds",
      "confidence": 0.9
    },
    "motionSummary": {
      "cameraMotion": "e.g. slow push in",
      "subjectMotion": "e.g. architect inspects pavilion",
      "environmentMotion": "e.g. twilight city lights",
      "overallPacing": "measured"|"brisk"|"dynamic",
      "motionOccurred": true,
      "confidence": 0.9
    },
    "lightingSummary": {
      "mood": "e.g. twilight cool with warm interior practicals",
      "direction": "motivated front-three-quarter",
      "quality": "natural"|"studio"|"low_key"|"high_key",
      "timeOfDay": "twilight"|"day"|"night",
      "confidence": 0.85
    },
    "audio": {
      "speechPresent": false,
      "musicPresent": true,
      "sfxPresent": true,
      "ambiencePresent": true,
      "primaryElement": "music"|"speech"|"sfx"|"silence",
      "confidence": 0.8
    },
    "narrativeSummary": "one sentence summarizing what happens in this video"
  },
  "segments": [
    {
      "segmentIndex": 0,
      "startSec": 0.0,
      "endSec": 3.0,
      "subjects": [{ "category": "person", "label": "Architect", "confidence": 0.9 }],
      "actions": [{ "description": "Architect walks into frame towards glowing pavilion", "confidence": 0.9 }],
      "objects": [{ "label": "pavilion", "confidence": 0.9 }],
      "camera": { "shotType": "wide", "cameraMovement": "push_in", "confidence": 0.9 },
      "composition": { "layout": "centered subject with environmental horizon", "confidence": 0.85 },
      "motion": { "cameraMotion": "slow forward push", "subjectMotion": "steady walk", "environmentMotion": "subtle twilight mist", "motionOccurred": true, "confidence": 0.9 },
      "lighting": { "mood": "twilight glow", "direction": "backlit practical", "confidence": 0.85 },
      "style": { "visualStyle": "cinematic photoreal", "confidence": 0.9 },
      "speech": { "speechPresent": false, "confidence": 0.9 },
      "audio": { "musicPresent": true, "speechPresent": false, "sfxPresent": true, "ambiencePresent": true, "confidence": 0.85 },
      "startState": { "visualState": "Subject enters frame left, pavilion in center distance", "subjectPosition": "left", "cameraFraming": "wide", "confidence": 0.9 },
      "endState": { "visualState": "Subject centered before glass entrance", "subjectPosition": "center", "cameraFraming": "medium_wide", "confidence": 0.9 },
      "confidence": 0.9
    }
  ]
}`;

    const systemInstruction =
      "You are SPARK's AI Video Understanding Engine. You extract factual, evidence-based temporal observations of subjects, actions, camera, lighting, and boundary states. Never hallucinate social media metrics or claims not supported by visual frames or transcripts. Return strict JSON only.";

    let rawJson: any = null;
    let providerCostUsd = 0;

    if (options.provider) {
      try {
        const resp = await options.provider.analyze({
          prompt,
          systemInstruction,
          frameUrls,
          transcript: transcriptText,
        });
        rawJson = resp.parsedJson;
        if (!rawJson && resp.rawResponse) {
          try {
            const jsonMatch = resp.rawResponse.match(/\{[\s\S]*\}/);
            rawJson = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(resp.rawResponse);
          } catch {}
        }
        providerCostUsd = resp.providerCostUsd || 0;
      } catch (err: any) {
        return this.createFailClosedResult(understandingId, source, [`custom_provider_error: ${err?.message || "unknown"}`]);
      }
    } else {
      try {
        const rawAi = await ModelRouter.executeCategoryRequest(
          "videoUnderstanding",
          {
            prompt,
            systemInstruction,
            frames: frameUrls.length > 0 ? frameUrls : undefined,
            capability: "Video Understanding",
          },
          options.userRoutingConfig
        );

        const jsonMatch = rawAi.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawJson = JSON.parse(jsonMatch[0]);
        }
      } catch (err: any) {
        return this.createFailClosedResult(understandingId, source, [`model_execution_error: ${err?.message || "unknown"}`]);
      }
    }

    if (!rawJson || typeof rawJson !== "object") {
      return this.createFailClosedResult(understandingId, source, ["unparseable_ai_response"]);
    }

    // 3. Assemble and normalize canonical StructuredVideoUnderstanding
    const duration =
      options.durationSec ||
      (typeof rawJson.durationSec === "number" && rawJson.durationSec > 0 ? rawJson.durationSec : 30);

    const rawSegments = Array.isArray(rawJson.segments) ? rawJson.segments : [];
    const segments: VideoUnderstandingSegment[] = [];

    if (rawSegments.length > 0) {
      for (let i = 0; i < rawSegments.length; i++) {
        const s = rawSegments[i];
        const startSec = typeof s.startSec === "number" ? s.startSec : i * 5;
        const endSec = typeof s.endSec === "number" ? s.endSec : Math.min(duration, startSec + 5);

        const startState = s.startState || (s.startBoundary ? {
          visualState: s.startBoundary.visualState || "Start boundary observation",
          subjectPosition: typeof s.startBoundary.subjectPositions === "object" ? Object.values(s.startBoundary.subjectPositions)[0] as string : s.startBoundary.subjectPosition,
          cameraFraming: s.startBoundary.cameraAngle || s.startBoundary.cameraFraming,
          lightingMood: s.startBoundary.lightingCondition || s.startBoundary.lightingMood,
          confidence: s.startBoundary.confidence ?? 0.85,
          provenance: "OBSERVED",
        } : undefined);

        const endState = s.endState || (s.endBoundary ? {
          visualState: s.endBoundary.visualState || "End boundary observation",
          subjectPosition: typeof s.endBoundary.subjectPositions === "object" ? Object.values(s.endBoundary.subjectPositions)[0] as string : s.endBoundary.subjectPosition,
          cameraFraming: s.endBoundary.cameraAngle || s.endBoundary.cameraFraming,
          lightingMood: s.endBoundary.lightingCondition || s.endBoundary.lightingMood,
          confidence: s.endBoundary.confidence ?? 0.85,
          provenance: "OBSERVED",
        } : undefined);

        segments.push({
          segmentIndex: i,
          startSec,
          endSec,
          durationSec: Math.max(0.5, endSec - startSec),
          subjects: Array.isArray(s.subjects) ? s.subjects : [],
          actions: Array.isArray(s.actions) ? s.actions : [],
          objects: Array.isArray(s.objects) ? s.objects : [],
          camera: s.camera,
          composition: s.composition,
          motion: s.motion ? {
            cameraMotion: s.motion.cameraMotion,
            subjectMotion: s.motion.subjectMotion,
            environmentMotion: s.motion.environmentMotion || s.motion.environmentalMotion,
            environmentalMotion: s.motion.environmentalMotion || s.motion.environmentMotion,
            overallPacing: s.motion.overallPacing,
            overallIntensity: s.motion.overallIntensity,
            motionOccurred: s.motion.motionOccurred ?? true,
            confidence: s.motion.confidence ?? 0.85,
            provenance: "OBSERVED",
          } : undefined,
          lighting: s.lighting,
          style: s.style,
          speech: s.speech,
          audio: s.audio,
          startState,
          endState,
          confidence: typeof s.confidence === "number" ? s.confidence : 0.85,
          evidence: evidence.slice(0, 2),
        });
      }
    } else {
      // Default single synthesized segment if AI emitted unsegmented output
      segments.push({
        segmentIndex: 0,
        startSec: 0,
        endSec: duration,
        durationSec: duration,
        subjects: Array.isArray(rawJson.summary?.subjects) ? rawJson.summary.subjects : [],
        actions: [{ description: rawJson.summary?.narrativeSummary || "Subject activity observed", confidence: 0.8 }],
        objects: Array.isArray(rawJson.summary?.objects) ? rawJson.summary.objects : [],
        camera: rawJson.summary?.cameraSummary,
        motion: rawJson.summary?.motionSummary,
        lighting: rawJson.summary?.lightingSummary,
        style: rawJson.summary?.visualStyle,
        audio: rawJson.summary?.audio,
        confidence: typeof rawJson.confidence === "number" ? rawJson.confidence : 0.75,
        evidence: evidence.slice(0, 2),
      });
    }

    const overallConfidence =
      typeof rawJson.confidence === "number"
        ? rawJson.confidence
        : segments.length > 0
          ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length
          : 0.75;

    return {
      id: understandingId,
      source,
      durationSec: duration,
      segments,
      transcript: transcriptText ? { text: transcriptText, confidence: 0.95 } : undefined,
      summary: {
        subjects:
          Array.isArray(rawJson.summary?.subjects) && rawJson.summary.subjects.length > 0
            ? rawJson.summary.subjects
            : segments.flatMap((s) => s.subjects),
        objects:
          Array.isArray(rawJson.summary?.objects) && rawJson.summary.objects.length > 0
            ? rawJson.summary.objects
            : segments.flatMap((s) => s.objects),
        visualStyle: rawJson.summary?.visualStyle || segments.find((s) => s.style)?.style,
        cameraSummary: rawJson.summary?.cameraSummary || segments.find((s) => s.camera)?.camera,
        motionSummary: rawJson.summary?.motionSummary || segments.find((s) => s.motion)?.motion,
        lightingSummary: rawJson.summary?.lightingSummary || segments.find((s) => s.lighting)?.lighting,
        audio: rawJson.summary?.audio || segments.find((s) => s.audio)?.audio,
        narrativeSummary:
          rawJson.summary?.narrativeSummary ||
          (typeof rawJson.summary === "string" ? rawJson.summary : undefined),
      },
      evidence,
      confidence: overallConfidence,
      limitations: Array.isArray(rawJson.limitations)
        ? rawJson.limitations
        : overallConfidence < 0.5
          ? ["low_confidence_analysis"]
          : [],
      createdAt: now,
    };
  }

  /**
   * Helper that builds an explicit fail-closed StructuredVideoUnderstanding result
   * when video facts cannot be reliably established.
   */
  static createFailClosedResult(
    id: string,
    source: VideoUnderstandingSource,
    reasons: string[]
  ): StructuredVideoUnderstanding {
    return {
      id,
      source,
      durationSec: 0,
      segments: [],
      summary: {
        subjects: [],
        objects: [],
      },
      evidence: [],
      confidence: 0,
      limitations: reasons,
      createdAt: new Date().toISOString(),
    };
  }
}
