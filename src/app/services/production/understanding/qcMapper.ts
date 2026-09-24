/**
 * QC Mapper — Maps canonical StructuredVideoUnderstanding into production QC observations.
 *
 * Bridges Phase 16 Video Understanding with:
 * - src/app/services/production/qc/shotQc.ts
 * - src/app/services/production/qc/visualAnalysis/service.ts
 * - src/app/services/production/qc/types.ts (ObservedVisualState)
 */

import type { ObservedVisualState } from "../qc/types";
import type {
  VisualAnalysisRequest,
  VisualAnalysisResult,
  VisualAnalysisService,
} from "../qc/visualAnalysis/service";
import type { StructuredVideoUnderstanding, VideoUnderstandingSegment } from "./types";

/**
 * Maps a canonical StructuredVideoUnderstanding into ObservedVisualState for Shot QC.
 * Can target a specific segment (for shot-level granularity) or the overall video summary.
 */
export function toShotObservation(
  understanding: StructuredVideoUnderstanding,
  segmentIndex?: number
): ObservedVisualState {
  if (!understanding || understanding.confidence <= 0) {
    return {
      confidence: 0,
      notEvaluatedReasons: understanding?.limitations || ["no_valid_video_understanding_evidence"],
    };
  }

  const segment: VideoUnderstandingSegment | undefined =
    typeof segmentIndex === "number" && understanding.segments[segmentIndex]
      ? understanding.segments[segmentIndex]
      : understanding.segments[0];

  const primarySubject =
    segment?.subjects.find((s) => s.role === "primary") ||
    segment?.subjects[0] ||
    understanding.summary.subjects[0];

  const primaryAction = segment?.actions[0];
  const primaryCamera = segment?.camera || understanding.summary.cameraSummary;
  const primaryMotion = segment?.motion || understanding.summary.motionSummary;
  const primaryLighting = segment?.lighting || understanding.summary.lightingSummary;
  const primaryStyle = segment?.style || understanding.summary.visualStyle;
  const primarySpeech = segment?.speech;
  const primaryAudio = segment?.audio || understanding.summary.audio;

  // Extract props and objects
  const observedProps = (segment?.objects || understanding.summary.objects || []).map((o) => o.label);

  const observed: ObservedVisualState = {
    confidence: segment?.confidence ?? understanding.confidence,
    subject: primarySubject?.label,
    subjectPresent: Boolean(primarySubject),
    action: primaryAction?.description,
    environment: understanding.summary.subjects.find((s) => s.category === "location")?.label,
    shotSize: primaryCamera?.shotType,
    framing: primaryCamera?.framing,
    composition: segment?.composition?.layout,
    cameraAngle: primaryCamera?.cameraAngle,
    cameraMovement: primaryCamera?.cameraMovement,
    lighting: primaryLighting?.mood,
    lightingDirection: primaryLighting?.direction,
    timeOfDay: primaryLighting?.timeOfDay,
    style: primaryStyle?.visualStyle || primaryStyle?.aesthetic || (primaryStyle as any)?.visualTone,
    colorIntent: primaryStyle?.texture,
    props: observedProps.length ? observedProps : undefined,
    motionOccurred: primaryMotion?.motionOccurred ?? true,
    dialoguePresent: primarySpeech?.speechType === "dialogue" || Boolean(primarySpeech?.speechPresent),
    narrationPresent: primarySpeech?.speechType === "narration" || primarySpeech?.speechType === "voiceover",
    beginState: segment?.startState?.visualState,
    endState: segment?.endState?.visualState,
    spatial: segment?.composition?.subjectPlacement
      ? { subjectPosition: segment.composition.subjectPlacement }
      : undefined,
  };

  return observed;
}

/**
 * Creates a VisualAnalysisService backed by a VideoUnderstandingService.
 * Connects the video understanding engine directly into the existing Shot QC evaluation loop.
 */
export function createVideoUnderstandingVisualAnalyzer(
  understandingFn: (url: string) => Promise<StructuredVideoUnderstanding>
): VisualAnalysisService {
  return {
    async analyzeImage(request: VisualAnalysisRequest): Promise<VisualAnalysisResult> {
      if (request.observedOverride) {
        return {
          observed: { confidence: request.observedOverride.confidence ?? 0.9, ...request.observedOverride },
          frameSummaries: [],
          analysisProvider: "understanding_override",
          analysisModel: "override",
        };
      }
      return {
        observed: { confidence: 0, notEvaluatedReasons: ["images_use_image_analyzer"] },
        frameSummaries: [],
        analysisProvider: "video_understanding",
        analysisModel: "insufficient_evidence",
      };
    },

    async analyzeVideo(request: VisualAnalysisRequest): Promise<VisualAnalysisResult> {
      if (request.observedOverride) {
        return {
          observed: { confidence: request.observedOverride.confidence ?? 0.95, ...request.observedOverride },
          frameSummaries: (request.frames || []).map((f) => f.description || "").filter(Boolean),
          analysisProvider: "understanding_override",
          analysisModel: "override",
        };
      }

      if (!request.sourceUrl) {
        return {
          observed: { confidence: 0, notEvaluatedReasons: ["missing_source_url"] },
          frameSummaries: [],
          analysisProvider: "video_understanding",
          analysisModel: "insufficient_evidence",
        };
      }

      try {
        const understanding = await understandingFn(request.sourceUrl);
        const observed = toShotObservation(understanding);
        return {
          observed,
          frameSummaries: understanding.segments.map(
            (s) => `[${s.startSec}s-${s.endSec}s]: ${s.actions.map((a) => a.description).join(", ")}`
          ),
          analysisProvider: "video_understanding",
          analysisModel: "structured_evidence",
        };
      } catch (err: any) {
        return {
          observed: {
            confidence: 0,
            notEvaluatedReasons: [`video_understanding_failed: ${err?.message || "error"}`],
          },
          frameSummaries: [],
          analysisProvider: "video_understanding",
          analysisModel: "failed",
        };
      }
    },
  };
}
