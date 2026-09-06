/**
 * Publishing policy gate — automation mode ≠ always publish.
 * Reuses existing AutomationMode + publishRequiresApproval brand fields.
 */

export type AutomationMode = "manual" | "assisted" | "balanced" | "autonomous";

export type PublishingPermission = "enabled" | "disabled" | "inherit";

export type PublishDecisionSource = "automation_policy" | "user" | "system_block";

export type PublishGateResult =
  | {
      action: "PUBLISH";
      decisionSource: PublishDecisionSource;
      reasons: string[];
    }
  | {
      action: "AWAITING_APPROVAL";
      decisionSource: PublishDecisionSource;
      reasons: string[];
    }
  | {
      action: "BLOCKED";
      decisionSource: "system_block";
      reasons: string[];
    };

export interface PublishGateInput {
  automationMode: AutomationMode | string;
  /** Independent of automation — autonomous + publishing disabled ⇒ approval */
  publishingPermission?: PublishingPermission | boolean;
  /** Brand/domain field publishRequiresApproval */
  publishRequiresApproval?: boolean;
  finalAssetExists?: boolean;
  finalTechnicalQcPassed?: boolean;
  contentPolicyPassed?: boolean;
  destinationCredentialsValid?: boolean;
  publicationTargetValid?: boolean;
  /** Explicit human approval already recorded */
  userApproved?: boolean;
  approvedBy?: string;
}

export interface PublishAuditRecord {
  decision: PublishGateResult["action"];
  decisionSource: PublishDecisionSource;
  timestamp: string;
  automationMode: string;
  publishingPermission: PublishingPermission;
  assetOrMasterVersion?: string;
  publicationTarget?: string;
  approvedBy?: string;
  reasons: string[];
}

function normalizePermission(
  input: PublishGateInput
): PublishingPermission {
  if (typeof input.publishingPermission === "boolean") {
    return input.publishingPermission ? "enabled" : "disabled";
  }
  if (input.publishingPermission === "enabled" || input.publishingPermission === "disabled") {
    return input.publishingPermission;
  }
  // inherit from publishRequiresApproval + automation
  if (input.publishRequiresApproval === false && input.automationMode === "autonomous") {
    return "enabled";
  }
  if (input.publishRequiresApproval === true) return "disabled";
  return "inherit";
}

/**
 * Evaluate whether a completed production may publish automatically.
 * AUTONOMOUS ≠ ALWAYS PUBLISH unless publishing permission explicitly allows it.
 */
export function evaluatePublishGate(input: PublishGateInput): PublishGateResult {
  const reasons: string[] = [];
  const permission = normalizePermission(input);

  if (input.finalAssetExists === false) {
    return { action: "BLOCKED", decisionSource: "system_block", reasons: ["Final asset missing"] };
  }
  if (input.finalTechnicalQcPassed === false) {
    return { action: "BLOCKED", decisionSource: "system_block", reasons: ["Final technical QC not passed"] };
  }
  if (input.contentPolicyPassed === false) {
    return { action: "BLOCKED", decisionSource: "system_block", reasons: ["Content/policy checks failed"] };
  }
  if (input.destinationCredentialsValid === false) {
    return { action: "BLOCKED", decisionSource: "system_block", reasons: ["Destination credentials invalid"] };
  }
  if (input.publicationTargetValid === false) {
    return { action: "BLOCKED", decisionSource: "system_block", reasons: ["Publication target invalid"] };
  }

  if (input.userApproved) {
    reasons.push("User explicitly approved publication");
    return { action: "PUBLISH", decisionSource: "user", reasons };
  }

  const mode = String(input.automationMode || "manual").toLowerCase();

  if (mode === "manual" || mode === "assisted") {
    reasons.push(`${mode} automation requires user approval before publish`);
    return { action: "AWAITING_APPROVAL", decisionSource: "automation_policy", reasons };
  }

  if (permission === "disabled") {
    reasons.push("Publishing permission disabled — approval required even if autonomous");
    return { action: "AWAITING_APPROVAL", decisionSource: "automation_policy", reasons };
  }

  if (mode === "autonomous" && (permission === "enabled" || permission === "inherit")) {
    // inherit + autonomous + publishRequiresApproval !== true → allow
    if (permission === "inherit" && input.publishRequiresApproval !== false) {
      reasons.push("Autonomous mode but publishRequiresApproval is not explicitly false");
      return { action: "AWAITING_APPROVAL", decisionSource: "automation_policy", reasons };
    }
    reasons.push("Autonomous publishing permitted after mandatory gates passed");
    return { action: "PUBLISH", decisionSource: "automation_policy", reasons };
  }

  if (mode === "balanced") {
    if (permission === "enabled" && input.publishRequiresApproval === false) {
      reasons.push("Balanced mode with explicit publishing permission");
      return { action: "PUBLISH", decisionSource: "automation_policy", reasons };
    }
    reasons.push("Balanced mode defaults to approval");
    return { action: "AWAITING_APPROVAL", decisionSource: "automation_policy", reasons };
  }

  reasons.push("Default policy requires approval");
  return { action: "AWAITING_APPROVAL", decisionSource: "automation_policy", reasons };
}

export function buildPublishAuditRecord(
  input: PublishGateInput,
  result: PublishGateResult,
  extras?: { assetOrMasterVersion?: string; publicationTarget?: string }
): PublishAuditRecord {
  return {
    decision: result.action,
    decisionSource: result.decisionSource,
    timestamp: new Date().toISOString(),
    automationMode: String(input.automationMode || "manual"),
    publishingPermission: normalizePermission(input),
    assetOrMasterVersion: extras?.assetOrMasterVersion,
    publicationTarget: extras?.publicationTarget,
    approvedBy: input.approvedBy,
    reasons: result.reasons,
  };
}
