/**
 * Continuity evaluation — planned ContinuityState + observed generated state.
 * Reuses continuity engine bridges; does not replace them.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ContinuityState, ShotContinuityBridge } from "../../specification/continuitySpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { clampScore, semanticOverlap, normalizeText } from "./helpers";

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
  if (expWardrobe && obsWardrobe && semanticOverlap(expWardrobe, obsWardrobe) < 0.25) {
    score -= 22;
    pushFail("wardrobe_drift", "Wardrobe continuity broken", expWardrobe, obsWardrobe);
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
