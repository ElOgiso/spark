/**
 * Camera planner — framing/movement/lens from story purpose + grammar (not random).
 */

import type { ShotType, CameraMovement, ShotCameraSpec } from "../specification/shotSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";
import type { ComposedGrammar } from "../grammar";

export function planCameraForShot(params: {
  shotType: ShotType;
  grammar: ComposedGrammar;
  emotionalObjective?: string;
  narrativeFunction: NarrativeFunction;
  /** Phase 5: motivated movement from cinematic intelligence */
  movementOverride?: CameraMovement;
}): ShotCameraSpec {
  const { shotType, grammar, narrativeFunction, emotionalObjective } = params;
  const movement = params.movementOverride ?? pickMovement(shotType, grammar, narrativeFunction);
  const height = heightFor(shotType, narrativeFunction);
  const angle = angleFor(shotType, narrativeFunction, emotionalObjective);
  const lens =
    shotType === "establishing" || shotType === "wide" || shotType === "aerial"
      ? "24-35mm"
      : shotType === "closeup" || shotType === "extreme_closeup" || shotType === "macro"
        ? "85mm"
        : shotType === "pov"
          ? "28-35mm"
          : "35-50mm";

  return {
    shotType,
    framing: framingFor(shotType, narrativeFunction),
    composition: compositionFor(shotType, narrativeFunction, grammar),
    cameraPosition: `${height}; ${angle}`,
    cameraMovement: movement,
    lens,
    depthOfField:
      shotType === "closeup" || shotType === "macro" || shotType === "extreme_closeup"
        ? "shallow — isolate subject"
        : shotType === "establishing" || shotType === "wide"
          ? "deep — readable geography"
          : "natural cinema DOF",
    focus: focusFor(shotType, narrativeFunction),
  };
}

function pickMovement(
  shotType: ShotType,
  grammar: ComposedGrammar,
  fn: NarrativeFunction
): CameraMovement {
  const preferred = grammar.coverage.preferredMovements;

  // Narrative-motivated movement only
  if (fn === "product" || shotType === "macro") {
    return preferred.includes("orbit") ? "orbit" : "static";
  }
  if (shotType === "establishing") {
    if (fn === "hook" || fn === "payoff") {
      return preferred.includes("crane") ? "crane" : preferred.includes("pull_out") ? "pull_out" : "pan";
    }
    return preferred.includes("pan") ? "pan" : "static";
  }
  if (shotType === "insert" || shotType === "macro") {
    return "static";
  }
  if (fn === "payoff" || fn === "cta") {
    return preferred.includes("push_in") ? "push_in" : "static";
  }
  if (fn === "confrontation" || fn === "interview") {
    return preferred.includes("handheld") ? "handheld" : "static";
  }
  if (fn === "montage" || grammar.tags.includes("kinetic") || grammar.id === "sports" || grammar.id === "music_video") {
    return preferred.includes("tracking") ? "tracking" : preferred.includes("handheld") ? "handheld" : "dolly";
  }
  if (fn === "broll") {
    return preferred.includes("tracking") ? "tracking" : preferred.includes("pan") ? "pan" : "static";
  }
  // Observational documentary default
  if (grammar.id === "documentary" || grammar.id === "news_explainer") {
    return preferred.includes("static") ? "static" : preferred[0] || "static";
  }
  return preferred[0] || "static";
}

function heightFor(shotType: ShotType, fn: NarrativeFunction): string {
  if (shotType === "aerial") return "elevated / aerial height";
  if (shotType === "pov") return "subject eye-line height";
  if (fn === "product" || shotType === "macro") return "tabletop / product eye-line";
  if (fn === "confrontation") return "slightly low angle for tension";
  return "eye-level";
}

function angleFor(shotType: ShotType, fn: NarrativeFunction, tone?: string): string {
  const t = (tone || "").toLowerCase();
  if (shotType === "aerial") return "top-down / high angle geography";
  if (fn === "product") return "hero angle favoring product silhouette";
  if (t.includes("intim") || fn === "payoff") return "intimate frontal / three-quarter";
  if (fn === "interview") return "observational three-quarter";
  return "neutral cinematic angle";
}

function framingFor(shotType: ShotType, fn: NarrativeFunction): string {
  switch (shotType) {
    case "establishing":
      return fn === "hook"
        ? "wide establishing reveal of world geography"
        : "wide establishing frame showing geography";
    case "wide":
      return "wide full-context frame — scale readable";
    case "medium":
      return fn === "interview" || fn === "example"
        ? "medium waist-up — information-readable staging"
        : "medium shot waist-up";
    case "closeup":
      return fn === "payoff" || fn === "cta"
        ? "close-up emphasis for emotional / conversion beat"
        : "close-up on face or hero subject";
    case "extreme_closeup":
      return "extreme close-up on decisive detail";
    case "insert":
      return "insert detail frame — evidence / prop readable";
    case "macro":
      return "macro product/detail frame — surface and craft visible";
    case "over_the_shoulder":
      return "over-the-shoulder dialogue coverage";
    case "pov":
      return "point-of-view frame locked to subject perspective";
    case "aerial":
      return "aerial wide geography";
    case "tracking":
      return "tracking frame locked on moving subject";
    case "reaction":
      return "reaction close-up timed to prior beat";
    case "two_shot":
      return "two-shot holding relationship between subjects";
    default:
      return `${shotType} framing`;
  }
}

function compositionFor(shotType: ShotType, fn: NarrativeFunction, grammar: ComposedGrammar): string {
  if (fn === "product" || shotType === "macro") {
    return "product-centered hierarchy; negative space controlled; brand-readable silhouette";
  }
  if (fn === "example" || fn === "proof" || grammar.id === "educational") {
    return "clear visual hierarchy for information transfer; uncluttered background";
  }
  if (fn === "confrontation") {
    return "controlled visual restriction; tension via framing tightness";
  }
  if (shotType === "establishing" || shotType === "wide") {
    return "scale-forward composition; horizon stable; subject placed for geographic clarity";
  }
  if (grammar.tags.includes("luxury") || grammar.id === "advertisement") {
    return "premium composition; restrained depth; subject priority with refined negative space";
  }
  return "rule-of-thirds with clear subject priority; avoid cluttered backgrounds";
}

function focusFor(shotType: ShotType, fn: NarrativeFunction): string {
  if (shotType === "macro" || fn === "product") return "product / detail plane sharp";
  if (shotType === "insert") return "evidence detail sharp";
  if (shotType === "establishing") return "environment readable; subject secondary if present";
  return "primary subject sharp";
}
