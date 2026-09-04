/**
 * Provider-neutral visual analysis abstraction.
 * QC engine must not hard-code a single AI model.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ContinuityState } from "../../specification/continuitySpec";
import type { ObservedVisualState, VisualFrameSample } from "../types";

export interface VisualAnalysisRequest {
  mediaType: "image" | "video" | "audio";
  sourceUrl?: string;
  frames?: VisualFrameSample[];
  plannedShot?: ShotSpec;
  previousShot?: ShotSpec;
  continuityExpected?: ContinuityState;
  referenceAssets?: Array<{ role: string; description?: string; url?: string }>;
  generationPrompt?: string;
  /** Test / injected observation — never invent in production analyzers */
  observedOverride?: ObservedVisualState;
  metadata?: Record<string, unknown>;
}

export interface VisualAnalysisResult {
  observed: ObservedVisualState;
  frameSummaries: string[];
  analysisProvider?: string;
  analysisModel?: string;
  estimatedAnalysisCost?: number;
  actualAnalysisCost?: number;
  /** Sanitized diagnostics only */
  diagnostics?: Record<string, unknown>;
}

export interface VisualAnalysisService {
  analyzeImage(request: VisualAnalysisRequest): Promise<VisualAnalysisResult>;
  analyzeVideo(request: VisualAnalysisRequest): Promise<VisualAnalysisResult>;
}

/**
 * Structural analyzer: does not invent visual content.
 * Uses observedOverride when provided (tests / upstream vision); otherwise
 * returns low-confidence empty observation so evaluators mark inconclusive.
 */
export function createStructuralVisualAnalyzer(): VisualAnalysisService {
  const run = async (request: VisualAnalysisRequest): Promise<VisualAnalysisResult> => {
    if (request.observedOverride) {
      return {
        observed: {
          confidence: request.observedOverride.confidence ?? 0.9,
          ...request.observedOverride,
        },
        frameSummaries: (request.frames || [])
          .map((f) => f.description)
          .filter((d): d is string => Boolean(d)),
        analysisProvider: "structural",
        analysisModel: "override",
      };
    }

    // Frame descriptions supplied by caller (e.g. offline pipeline) — still not LLM invention
    const fromFrames = summarizeFromFrameDescriptions(request);
    if (fromFrames) {
      return {
        observed: { ...fromFrames, confidence: fromFrames.confidence ?? 0.55 },
        frameSummaries: (request.frames || []).map((f) => f.description || "").filter(Boolean),
        analysisProvider: "structural",
        analysisModel: "frame_descriptions",
      };
    }

    return {
      observed: { confidence: 0 },
      frameSummaries: [],
      analysisProvider: "structural",
      analysisModel: "insufficient_evidence",
      diagnostics: { reason: "no_visual_observation_available" },
    };
  };

  return {
    analyzeImage: run,
    analyzeVideo: run,
  };
}

/**
 * Deterministic mock analyzer for unit tests — always returns the fixed observation.
 */
export function createMockVisualAnalyzer(observed: ObservedVisualState): VisualAnalysisService {
  const result: VisualAnalysisResult = {
    observed: { confidence: observed.confidence ?? 0.95, ...observed },
    frameSummaries: ["mock"],
    analysisProvider: "mock",
    analysisModel: "deterministic",
    estimatedAnalysisCost: undefined,
    actualAnalysisCost: undefined,
  };
  return {
    async analyzeImage() {
      return result;
    },
    async analyzeVideo() {
      return result;
    },
  };
}

function summarizeFromFrameDescriptions(request: VisualAnalysisRequest): ObservedVisualState | null {
  const texts = (request.frames || []).map((f) => f.description || "").filter(Boolean);
  if (!texts.length) return null;
  const blob = texts.join(" | ").toLowerCase();
  return {
    subject: request.plannedShot?.subject,
    action: blob.includes("rais") || blob.includes("walk") || blob.includes("turn") ? texts[0] : undefined,
    environment: request.plannedShot?.environment,
    confidence: 0.5,
  };
}
