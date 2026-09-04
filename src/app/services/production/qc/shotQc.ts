/**
 * Asset / shot-level intelligent QC — multi-dimensional planned vs generated.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { TechnicalValidationResult } from "../execution/types";
import type {
  ObservedVisualState,
  ProductionQCResult,
  QCFailure,
  QCDimensionResult,
} from "./types";
import type { VisualAnalysisService } from "./visualAnalysis/service";
import { createStructuralVisualAnalyzer } from "./visualAnalysis/service";
import { evaluateIntent } from "./evaluators/intentEvaluator";
import { evaluateIdentity } from "./evaluators/identityEvaluator";
import { evaluateContinuity, isIntentionalContinuityChange } from "./evaluators/continuityEvaluator";
import { evaluateCinematography } from "./evaluators/cinematographyEvaluator";
import { evaluateMotion } from "./evaluators/motionEvaluator";
import { evaluateAudio } from "./evaluators/audioEvaluator";
import { evaluateStyle } from "./evaluators/styleEvaluator";
import { evaluateTechnicalFromPhase4 } from "./evaluators/technicalConsumer";
import {
  aggregateScores,
  collectWarnings,
  deriveOverallStatus,
  defaultActionForStatus,
} from "./scoring";
import { thresholdsForQualityTarget } from "./thresholds";
import { userFacingFailureSummary, userFacingQcAction } from "./userMessages";

function newQcId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function hasUsefulObservation(observed: ObservedVisualState): boolean {
  if ((observed.confidence ?? 0) <= 0) return false;
  return Boolean(
    observed.subject ||
      observed.action ||
      observed.environment ||
      observed.shotSize ||
      observed.cameraMovement ||
      observed.identity ||
      observed.lighting ||
      observed.style ||
      observed.subjectPresent !== undefined ||
      observed.motionOccurred !== undefined ||
      observed.dialoguePresent !== undefined ||
      observed.narrationPresent !== undefined
  );
}

export async function evaluateShotQc(params: {
  spec: ProductionSpec;
  shot: ShotSpec;
  previousShot?: ShotSpec;
  mediaType?: "image" | "video" | "audio";
  sourceUrl?: string;
  assetId?: string;
  taskId?: string;
  technical?: TechnicalValidationResult;
  hasVoiceAsset?: boolean;
  observedOverride?: ObservedVisualState;
  visualAnalysis?: VisualAnalysisService;
  frames?: Array<{ role: "begin" | "middle" | "end" | "representative"; description?: string; url?: string }>;
}): Promise<ProductionQCResult> {
  const analyzer = params.visualAnalysis || createStructuralVisualAnalyzer();
  const mediaType = params.mediaType || (params.shot.keyframeUrl && !params.shot.mediaUrl ? "image" : "video");
  const bridge = params.spec.continuity.shotBridges.find((b) => b.shotId === params.shot.id);

  const analysis =
    mediaType === "image"
      ? await analyzer.analyzeImage({
          mediaType,
          sourceUrl: params.sourceUrl || params.shot.keyframeUrl || params.shot.mediaUrl,
          plannedShot: params.shot,
          previousShot: params.previousShot,
          continuityExpected: bridge?.continuityIn,
          generationPrompt: params.shot.compiledPrompt,
          observedOverride: params.observedOverride,
          frames: params.frames,
        })
      : await analyzer.analyzeVideo({
          mediaType,
          sourceUrl: params.sourceUrl || params.shot.mediaUrl,
          plannedShot: params.shot,
          previousShot: params.previousShot,
          continuityExpected: bridge?.continuityIn,
          generationPrompt: params.shot.compiledPrompt,
          observedOverride: params.observedOverride,
          frames: params.frames,
        });

  const observed = analysis.observed;
  const useful = hasUsefulObservation(observed);
  const intentional = isIntentionalContinuityChange(params.shot, params.previousShot);

  const parts = [
    evaluateIntent({ shot: params.shot, observed, hasObservation: useful }),
    evaluateIdentity({
      shot: params.shot,
      observed,
      hasObservation: useful,
      expectedContinuity: bridge?.continuityIn,
    }),
    evaluateContinuity({
      shot: params.shot,
      previousShot: params.previousShot,
      bridge,
      observed,
      hasObservation: useful,
      intentionalChange: intentional,
    }),
    evaluateCinematography({ shot: params.shot, observed, hasObservation: useful }),
    evaluateMotion({ shot: params.shot, observed, hasObservation: useful, mediaType }),
    evaluateAudio({
      spec: params.spec,
      shot: params.shot,
      observed,
      hasObservation: useful,
      hasVoiceAsset: params.hasVoiceAsset,
    }),
    evaluateStyle({ spec: params.spec, shot: params.shot, observed, hasObservation: useful }),
    evaluateTechnicalFromPhase4({ technical: params.technical }),
  ];

  const dimensions: QCDimensionResult[] = parts.map((p) => p.dimension);
  const failures: QCFailure[] = parts.flatMap((p) => p.failures);
  const scores = aggregateScores(dimensions);
  const warnings = collectWarnings(dimensions);
  const thresholds = thresholdsForQualityTarget(params.spec.quality.target);
  const status = deriveOverallStatus({ scores, dimensions, failures, thresholds });
  const recommendedAction = defaultActionForStatus(status, failures);
  const providerChange =
    recommendedAction === "reroute_provider" || recommendedAction === "reroute";

  return {
    id: newQcId("qc_shot"),
    productionId: params.spec.project.id,
    sceneId: params.shot.sceneId,
    shotId: params.shot.id,
    taskId: params.taskId,
    assetId: params.assetId,
    level: "shot",
    status,
    score: scores.overall,
    scores,
    dimensions,
    failures,
    warnings,
    recommendedAction,
    remediation:
      status === "pass"
        ? "continue"
        : recommendedAction === "manual_review"
          ? "manual_review"
          : recommendedAction === "reroute_provider"
            ? "rerender_different_model"
            : recommendedAction === "change_reference" || recommendedAction === "strengthen_continuity"
              ? "rerender_same_model"
              : "modify_prompt",
    providerChange,
    evaluatedAt: new Date().toISOString(),
    userMessage:
      status === "pass" || status === "warn"
        ? userFacingFailureSummary(failures)
        : userFacingQcAction(recommendedAction),
    analysisCost: {
      analysisProvider: analysis.analysisProvider,
      analysisModel: analysis.analysisModel,
      estimatedAnalysisCost: analysis.estimatedAnalysisCost,
      actualAnalysisCost: analysis.actualAnalysisCost,
    },
    metadata: {
      mediaType,
      intentionalContinuityChange: intentional,
    },
  };
}

export async function evaluateAssetQc(params: Parameters<typeof evaluateShotQc>[0]): Promise<ProductionQCResult> {
  const shotResult = await evaluateShotQc(params);
  return {
    ...shotResult,
    id: newQcId("qc_asset"),
    level: "asset",
  };
}
