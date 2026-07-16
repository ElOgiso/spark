// ── Review Policy Engine ──────────────────────────────────────────────
// Governs human-in-the-loop approvals based on the content type or context.
// Singleton – obtain via ReviewPolicyEngine.getInstance().

export type ApprovalPolicy = 'AutoApprove' | 'RequireApproval' | 'NeverPublishAutomatically';

export class ReviewPolicyEngine {
  private static instance: ReviewPolicyEngine;

  private constructor() {}

  public static getInstance(): ReviewPolicyEngine {
    if (!ReviewPolicyEngine.instance) {
      ReviewPolicyEngine.instance = new ReviewPolicyEngine();
    }
    return ReviewPolicyEngine.instance;
  }

  /**
   * Determine approval policy for a task/project based on metadata.
   */
  public getPolicyForProject(type: string): ApprovalPolicy {
    const lower = type.toLowerCase();
    if (lower.includes('client') || lower.includes('sponsored') || lower.includes('enterprise')) {
      return 'RequireApproval';
    }
    if (lower.includes('financial') || lower.includes('sensitive') || lower.includes('medical')) {
      return 'NeverPublishAutomatically';
    }
    return 'AutoApprove';
  }
}
