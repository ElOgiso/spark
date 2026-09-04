/**
 * Camera planner — chooses framing/movement from story purpose + grammar (not random).
 */

import type { ShotType, CameraMovement, ShotCameraSpec } from "../specification/shotSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";
import type { ComposedGrammar } from "../grammar";

export function planCameraForShot(params: {
  shotType: ShotType;
  grammar: ComposedGrammar;
  emotionalObjective?: string;
  narrativeFunction: NarrativeFunction;
}): ShotCameraSpec {
  const { shotType, grammar, narrativeFunction } = params;
  const movement = pickMovement(shotType, grammar, narrativeFunction);
  const lens =
    shotType === "establishing" || shotType === "wide" || shotType === "aerial"
      ? "24-35mm"
      : shotType === "closeup" || shotType === "extreme_closeup" || shotType === "macro"
        ? "85mm"
        : "35-50mm";

  return {
    shotType,
    framing: framingFor(shotType),
    composition: "rule-of-thirds with clear subject priority; avoid cluttered backgrounds",
    cameraPosition: shotType === "aerial" ? "elevated" : shotType === "pov" ? "subject eye-line" : "eye-level",
    cameraMovement: movement,
    lens,
    depthOfField: shotType === "closeup" || shotType === "macro" ? "shallow" : "natural cinema DOF",
    focus: "primary subject sharp",
  };
}

function pickMovement(
  shotType: ShotType,
  grammar: ComposedGrammar,
  fn: NarrativeFunction
): CameraMovement {
  const preferred = grammar.coverage.preferredMovements;
  if (shotType === "establishing") {
    return preferred.includes("crane") ? "crane" : preferred.includes("pan") ? "pan" : "static";
  }
  if (shotType === "macro" || shotType === "insert") {
    return preferred.includes("orbit") ? "orbit" : "static";
  }
  if (fn === "payoff" || fn === "cta") {
    return preferred.includes("push_in") ? "push_in" : "static";
  }
  if (grammar.tags.includes("kinetic") || grammar.id === "sports") {
    return preferred.includes("tracking") ? "tracking" : "handheld";
  }
  return preferred[0] || "static";
}

function framingFor(shotType: ShotType): string {
  switch (shotType) {
    case "establishing":
      return "wide establishing frame showing geography";
    case "wide":
      return "wide full-context frame";
    case "medium":
      return "medium shot waist-up";
    case "closeup":
      return "close-up on face or hero subject";
    case "extreme_closeup":
      return "extreme close-up on decisive detail";
    case "insert":
      return "insert detail frame";
    case "macro":
      return "macro product/detail frame";
    case "over_the_shoulder":
      return "over-the-shoulder dialogue coverage";
    case "pov":
      return "point-of-view frame";
    case "aerial":
      return "aerial wide geography";
    case "tracking":
      return "tracking frame locked on moving subject";
    case "reaction":
      return "reaction close-up";
    default:
      return `${shotType} framing`;
  }
}
