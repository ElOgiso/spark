import type { ShotType } from "../specification/shotSpec";

export interface BlockingPlan {
  subjectAction: string;
  blocking: string;
  performanceDirection: string;
}

/**
 * Separate WHAT exists from WHAT happens — concrete motion direction.
 */
export function planBlockingForShot(params: {
  shotType: ShotType;
  subjectAction: string;
  characters: string[];
}): BlockingPlan {
  const baseAction = (params.subjectAction || "subject performs one clear action").trim();
  const action =
    params.shotType === "insert" || params.shotType === "macro"
      ? `Detail action: ${baseAction}`
      : params.shotType === "establishing"
        ? `Environment settles; subject enters or is revealed — ${baseAction}`
        : baseAction;

  return {
    subjectAction: action,
    blocking: `${params.characters[0] || "subject"} occupies primary third; secondary elements remain stable`,
    performanceDirection:
      params.shotType === "closeup" || params.shotType === "reaction"
        ? "Clear facial intention; one emotional beat only"
        : "Natural, motivated performance; single primary action",
  };
}
