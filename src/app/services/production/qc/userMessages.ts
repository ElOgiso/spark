/**
 * User-facing QC language — never expose provider/model internals to normal users.
 */

import type { QcRecommendedAction, QcResultStatus, QCFailure } from "./types";

export function userFacingQcStatus(status: QcResultStatus): string {
  switch (status) {
    case "pass":
      return "SPARK checked this and it looks good";
    case "warn":
      return "SPARK checked this and found minor issues";
    case "retry":
      return "SPARK is improving this shot";
    case "fail":
      return "SPARK found a problem that needs attention";
    default:
      return "SPARK is checking this";
  }
}

export function userFacingQcAction(action: QcRecommendedAction): string {
  switch (action) {
    case "accept":
      return "SPARK approved this";
    case "repair":
    case "repair_prompt":
    case "change_reference":
    case "strengthen_continuity":
    case "change_generation_strategy":
      return "SPARK is improving this shot";
    case "rerender":
    case "regenerate_shot":
      return "SPARK is regenerating this shot";
    case "regenerate_dependent_shots":
      return "SPARK is regenerating this scene";
    case "reroute":
    case "reroute_provider":
      return "SPARK is trying a better approach";
    case "manual_review":
      return "SPARK recommends review";
    default:
      return "SPARK is processing this";
  }
}

export function userFacingFailureSummary(failures: QCFailure[]): string {
  if (!failures.length) return userFacingQcStatus("pass");
  const code = failures[0].code;
  if (/identity|wardrobe/.test(code)) return "SPARK found a continuity issue with the subject";
  if (/continuity|location|prop|spatial|screen_direction|lighting|time/.test(code)) {
    return "SPARK found a continuity issue";
  }
  if (/camera|composition|motion|action|subject|prompt/.test(code)) {
    return "SPARK found this shot did not match the plan";
  }
  if (/audio|dialogue|lip_sync/.test(code)) return "SPARK found an audio issue";
  if (/technical|duration|aspect|quality/.test(code)) {
    return "SPARK found a technical issue with this media";
  }
  return "SPARK found an issue that needs attention";
}
