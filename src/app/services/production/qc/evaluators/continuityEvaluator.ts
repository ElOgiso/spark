/**
 * Continuity evaluation — planned ContinuityState + observed generated state.
 * Reuses continuity engine bridges; does not replace them.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ContinuityState, ShotContinuityBridge } from "../../specification/continuitySpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { clampScore, semanticOverlap, normalizeText } from "./helpers";


const COLOR_TOKENS = new Set([
  "red", "blue", "green", "yellow", "black", "white", "brown", "pink", "purple", "orange", "gray", "grey", "beige", "navy", "teal",
]);

/** True when wardrobe strings share little overlap or assert conflicting colors. */
function wardrobeConflict(expected: string, observed: string, overlap: number): boolean {
  if (overlap <= 0.25) return true;
  const a = new Set(expected.toLowerCase().split(/\W+/).filter(Boolean));
  const b = new Set(observed.toLowerCase().split(/\W+/).filter(Boolean));
  const aColors = [...a].filter((t) => COLOR_TOKENS.has(t));
  const bColors = [...b].filter((t) => COLOR_TOKENS.has(t));
  if (aColors.length && bColors.length && !aColors.some((c) => bColors.includes(c))) {
    return true;
  }
  return false;
}

export function evaluateContinuity(params: {
  shot: ShotSpec;
  previousShot?: ShotSpec;
  bridge?: ShotContinuityBridge;
  observed: ObservedVisualState;
  hasObservation: boolean;
  /** Intentional change flags from ShotSpec (environment/lighting differ deliberately) */
  intentionalChange?: boolean;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { shot, previousShot, bridge, observed, hasObservation, intentionalChange } = params;
  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];

  if (!previousShot && !bridge) {
    return {
      dimension: {
        id: "continuity",
        applicability: "not_applicable",
        score: 100,
        status: "pass",
        evidence: [{ expected: "opening shot", observed: "no prior continuity", confidence: 1 }],
        failureCodes: [],
      },
      failures: [],
    };
  }

  const expected: ContinuityState | undefined = bridge?.continuityIn;
  if (!hasObservation) {
    // Still validate planned continuity requirements exist
    const missingReqs = !shot.continuityRequirements.length;
    return {
      dimension: {
        id: "continuity",
        applicability: "inconclusive",
        score: missingReqs ? 60 : 72,
        status: missingReqs ? "warn" : "warn",
        evidence: [
          {
            expected: expected?.summary || "continuity lock",
            observed: "insufficient visual evidence",
            confidence: 0.25,
            failureCode: "insufficient_visual_evidence",
          },
        ],
        failureCodes: ["insufficient_visual_evidence"],
      },
      failures: [],
    };
  }

  if (intentionalChange) {
    return {
      dimension: {
        id: "continuity",
        applicability: "applicable",
        score: 92,
        status: "pass",
        evidence: [
          {
            expected: "intentional continuity break allowed by ShotSpec",
            observed: "change permitted",
            confidence: 0.9,
          },
        ],
        failureCodes: [],
      },
      failures: [],
    };
  }

  let score = 100;
  const conf = observed.confidence ?? 0.85;

  const obsLoc = observed.environment || observed.continuityObserved?.location?.environment;
  const expLoc = expected?.location.environment || previousShot?.environment;
  if (expLoc && obsLoc && semanticOverlap(expLoc, obsLoc) < 0.2) {
    score -= 30;
    pushFail("location_drift", "Location continuity broken", expLoc, obsLoc);
  }

  const expWardrobe = expected?.wardrobe.clothing;
  const obsWardrobe = observed.identity?.clothing || observed.continuityObserved?.wardrobe?.clothing;
  if (expWardrobe && obsWardrobe) {
    const wardrobeOverlap = semanticOverlap(expWardrobe, obsWardrobe);
    if (wardrobeConflict(expWardrobe, obsWardrobe, wardrobeOverlap)) {
      score -= 22;
      // Prefer structured wardrobe_mismatch (Phase 9) over legacy wardrobe_drift
      const ev: QcEvidence = {
        failureCode: "wardrobe_mismatch",
        expected: expWardrobe,
        observed: obsWardrobe,
        confidence: conf,
      };
      evidence.push(ev);
      failures.push({
        code: "wardrobe_mismatch",
        dimension: "continuity",
        message: "Wardrobe does not match expected continuity wardrobe",
        confidence: conf,
        evidence: ev,
        retryable: true,
        severity: "fail",
        requirementStrength: "hard",
      });
    }
  }

  const expLight = expected?.lighting.color || previousShot?.lighting.color;
  const obsLight = observed.lighting || observed.continuityObserved?.lighting?.color;
  if (expLight && obsLight && semanticOverlap(expLight, obsLight) < 0.2) {
    score -= 18;
    pushFail("lighting_drift", "Lighting continuity broken", expLight, obsLight);
  }

  const expTime = expected?.lighting.time || previousShot?.lighting.timeOfDay;
  const obsTime = observed.timeOfDay || observed.continuityObserved?.time?.dayNight;
  if (expTime && obsTime && normalizeText(expTime) !== normalizeText(obsTime) && semanticOverlap(expTime, obsTime) < 0.4) {
    score -= 15;
    pushFail("time_drift", "Time-of-day continuity broken", expTime, obsTime);
  }

  const expProps = (expected?.props || []).map((p) => p.identity).join(" ");
  if (expProps && observed.props && observed.props.length === 0) {
    score -= 20;
    pushFail("prop_drift", "Expected props missing", expProps, "none");
  }

  const expScreen = expected?.spatial.screenDirection;
  const obsScreen = observed.spatial?.screenDirection;
  if (expScreen && obsScreen && semanticOverlap(expScreen, obsScreen) < 0.3) {
    score -= 20;
    pushFail("screen_direction_break", "Screen direction continuity broken", expScreen, obsScreen);
  }

  const expPos = expected?.spatial.subjectPosition || previousShot?.blocking;
  const obsPos = observed.spatial?.subjectPosition;
  if (expPos && obsPos && semanticOverlap(expPos, obsPos) < 0.25) {
    score -= 18;
    pushFail("spatial_continuity_break", "Spatial geography continuity broken", expPos, obsPos);
  }


  // Phase 9 — eyeline / axis (structured codes)
  const expEye = (expected as { eyeline?: string } | undefined)?.eyeline || expected?.spatial?.cameraRelationship;
  const obsEye = observed.eyelineTarget;
  if (expEye && obsEye && semanticOverlap(expEye, obsEye) < 0.3) {
    score -= 18;
    const ev: QcEvidence = {
      failureCode: "eyeline_mismatch",
      expected: expEye,
      observed: obsEye,
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "eyeline_mismatch",
      dimension: "continuity",
      message: "Eyeline does not match expected gaze relationship",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  }

  const expSide = expected?.spatial?.cameraRelationship;
  const obsSide = observed.cameraSide;
  const intentionalAxis = /axis.?break|cross.?axis|intentional/i.test(
    `${shot.purpose} ${shot.productionReason} ${(shot as { transitionNotes?: string }).transitionNotes || ""}`
  );
  if (expSide && obsSide && semanticOverlap(expSide, obsSide) < 0.3 && !intentionalAxis) {
    score -= 20;
    const ev: QcEvidence = {
      failureCode: "axis_violation",
      expected: expSide,
      observed: obsSide,
      confidence: conf,
      note: "unintentional axis/side change",
    };
    evidence.push(ev);
    failures.push({
      code: "axis_violation",
      dimension: "continuity",
      message: "Camera side appears to violate established spatial axis",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  } else if (expSide && obsSide && intentionalAxis) {
    evidence.push({
      expected: "intentional axis break allowed",
      observed: obsSide,
      confidence: 0.85,
    });
  }

  if (!failures.length) {
    evidence.push({
      expected: expected?.summary || "maintain continuity",
      observed: "continuity preserved",
      confidence: conf,
    });
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "continuity",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };

  function pushFail(
    code: QCFailure["code"],
    message: string,
    expectedVal: string,
    observedVal: string
  ) {
    const ev: QcEvidence = { failureCode: code, expected: expectedVal, observed: observedVal, confidence: conf };
    evidence.push(ev);
    failures.push({
      code,
      dimension: "continuity",
      message,
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }
}

export function isIntentionalContinuityChange(shot: ShotSpec, previous?: ShotSpec): boolean {
  if (!previous) return false;
  const envChanged =
    Boolean(shot.environment && previous.environment) &&
    semanticOverlap(shot.environment, previous.environment) < 0.25;
  const purposeJump = /cutaway|flashback|dream|insert|montage/i.test(shot.purpose + " " + shot.productionReason);
  return envChanged || purposeJump;
}
