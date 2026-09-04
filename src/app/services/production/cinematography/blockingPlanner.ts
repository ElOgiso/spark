import type { ShotType } from "../specification/shotSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";

export interface BlockingPlan {
  subjectAction: string;
  blocking: string;
  performanceDirection: string;
  screenDirection: string;
  entrance?: string;
  exit?: string;
  spatialRelationship?: string;
}

/**
 * Blocking — WHAT happens spatially. Subordinate to narrative function.
 */
export function planBlockingForShot(params: {
  shotType: ShotType;
  subjectAction: string;
  characters: string[];
  narrativeFunction?: NarrativeFunction;
  environment?: string;
}): BlockingPlan {
  const baseAction = (params.subjectAction || "subject performs one clear action").trim();
  const fn = params.narrativeFunction || "context";
  const primary = params.characters[0] || "subject";
  const secondary = params.characters[1];

  let action = baseAction;
  if (params.shotType === "insert" || params.shotType === "macro") {
    action = `Detail action: ${baseAction}`;
  } else if (params.shotType === "establishing") {
    action = `Environment settles; ${primary} enters or is revealed — ${baseAction}`;
  } else if (fn === "product") {
    action = `Product presented with one clear demonstration beat — ${baseAction}`;
  } else if (fn === "confrontation") {
    action = `Conflict beat: ${primary} confronts obstacle — ${baseAction}`;
  }

  const screenDirection =
    fn === "confrontation"
      ? "opposing screen directions between subject and obstacle"
      : fn === "montage"
        ? "consistent left-to-right progression across montage"
        : "audience-facing / stable screen direction";

  const spatialRelationship = secondary
    ? `${primary} primary; ${secondary} secondary — maintain readable relationship`
    : params.shotType === "macro" || fn === "product"
      ? "subject-to-product proximity locked; environment secondary"
      : `${primary} owns primary third; environment supports without competing`;

  return {
    subjectAction: action,
    blocking: spatialRelationship,
    performanceDirection:
      params.shotType === "closeup" || params.shotType === "reaction"
        ? "Clear facial intention; one emotional beat only"
        : fn === "comedy"
          ? "Readable comic timing; hold reaction for beat"
          : "Natural, motivated performance; single primary action",
    screenDirection,
    entrance:
      params.shotType === "establishing" || fn === "hook"
        ? `${primary} enters frame or is revealed from environment`
        : undefined,
    exit:
      fn === "payoff" || fn === "cta" || fn === "resolution"
        ? "Hold end pose / product / look for cut safety"
        : "Settle into end state without unmotivated exit",
    spatialRelationship,
  };
}
