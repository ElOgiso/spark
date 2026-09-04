/**
 * User-facing editorial language — no FFmpeg / provider internals.
 */

import type { EditorialStatus } from "./types";

export function userFacingEditorialStatus(status: EditorialStatus, unresolvedCount = 0): string {
  switch (status) {
    case "draft":
      return "SPARK is preparing your editorial timeline";
    case "assembling":
      return "SPARK assembled your production";
    case "incomplete":
      return unresolvedCount
        ? "SPARK found an issue before export"
        : "SPARK needs a few more pieces before the final version";
    case "validated":
    case "ready_for_master":
      return "SPARK assembled your production";
    case "mastering":
      return "SPARK is preparing the final version";
    case "mastered":
      return "SPARK created your final version";
    case "failed":
      return "SPARK found an issue before export";
    case "cancelled":
      return "SPARK stopped preparing the final version";
    default:
      return "SPARK is processing your production";
  }
}

export function userFacingMasteringMessage(
  state: "running" | "succeeded" | "failed" | "cancelled" | "retrying"
): string {
  switch (state) {
    case "running":
    case "retrying":
      return "SPARK is preparing the final version";
    case "succeeded":
      return "SPARK created your final version";
    case "failed":
      return "SPARK found an issue before export";
    case "cancelled":
      return "SPARK stopped preparing the final version";
    default:
      return "SPARK is processing your production";
  }
}
