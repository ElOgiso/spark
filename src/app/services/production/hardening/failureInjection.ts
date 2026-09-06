/**
 * Deterministic failure-injection harness for mocked provider paths.
 * CI must never call live paid providers.
 */

import type { FailureInjectionPlan, InjectedFailureKind, NormalizedProductionError } from "./types";
import { normalizeProductionError } from "./errorTaxonomy";

export interface FailureInjector {
  plan: FailureInjectionPlan;
  remaining: number;
  consume(): NormalizedProductionError | undefined;
  reset(): void;
}

const KIND_TO_ERROR: Record<
  InjectedFailureKind,
  { code: string; message: string; category: NormalizedProductionError["category"] }
> = {
  provider_unavailable: {
    code: "provider_unavailable",
    message: "Injected provider outage",
    category: "PROVIDER_ERROR",
  },
  provider_timeout: {
    code: "timeout",
    message: "Injected provider timeout",
    category: "TIMEOUT_ERROR",
  },
  rate_limited: {
    code: "rate_limited",
    message: "Injected rate limit",
    category: "RATE_LIMIT_ERROR",
  },
  invalid_response: {
    code: "invalid_request",
    message: "Injected malformed provider response",
    category: "PROVIDER_ERROR",
  },
  missing_asset_url: {
    code: "output_unavailable",
    message: "Injected missing asset URL",
    category: "MEDIA_ERROR",
  },
  media_validation_failure: {
    code: "output_mismatch",
    message: "Injected media validation failure",
    category: "MEDIA_ERROR",
  },
  qc_fail: {
    code: "qc_error",
    message: "Injected QC failure with evidence",
    category: "QC_ERROR",
  },
  webhook_duplicate: {
    code: "system_error",
    message: "Injected duplicate webhook delivery",
    category: "SYSTEM_ERROR",
  },
  budget_exceeded: {
    code: "budget_exceeded",
    message: "Injected budget ceiling breach",
    category: "BUDGET_ERROR",
  },
  mastering_unavailable: {
    code: "mastering_error",
    message: "Injected mastering unavailable (degraded mode)",
    category: "MASTERING_ERROR",
  },
};

export function createFailureInjector(plan: FailureInjectionPlan): FailureInjector {
  let remaining = plan.times ?? 1;
  return {
    plan,
    get remaining() {
      return remaining;
    },
    consume() {
      if (remaining <= 0) return undefined;
      remaining -= 1;
      const mapped = KIND_TO_ERROR[plan.kind];
      return normalizeProductionError({
        code: mapped.code,
        message: mapped.message,
        category: mapped.category,
        stage: plan.stage,
        taskId: plan.taskId,
      });
    },
    reset() {
      remaining = plan.times ?? 1;
    },
  };
}

export async function withInjectedFailure<T>(
  injector: FailureInjector | undefined,
  stage: FailureInjectionPlan["stage"],
  run: () => Promise<T>
): Promise<T> {
  if (injector && injector.plan.stage === stage) {
    const err = injector.consume();
    if (err) {
      throw Object.assign(new Error(err.message), { productionError: err });
    }
  }
  return run();
}

export function expectedPolicyFor(kind: InjectedFailureKind): {
  mustNotCorruptState: boolean;
  mustNotDoubleCharge: boolean;
  allowFallback: boolean;
  allowRetry: boolean;
  allowDegradedMaster: boolean;
} {
  switch (kind) {
    case "budget_exceeded":
      return {
        mustNotCorruptState: true,
        mustNotDoubleCharge: true,
        allowFallback: false,
        allowRetry: false,
        allowDegradedMaster: false,
      };
    case "mastering_unavailable":
      return {
        mustNotCorruptState: true,
        mustNotDoubleCharge: true,
        allowFallback: false,
        allowRetry: false,
        allowDegradedMaster: true,
      };
    case "webhook_duplicate":
      return {
        mustNotCorruptState: true,
        mustNotDoubleCharge: true,
        allowFallback: false,
        allowRetry: false,
        allowDegradedMaster: false,
      };
    case "qc_fail":
      return {
        mustNotCorruptState: true,
        mustNotDoubleCharge: true,
        allowFallback: true,
        allowRetry: true,
        allowDegradedMaster: false,
      };
    default:
      return {
        mustNotCorruptState: true,
        mustNotDoubleCharge: true,
        allowFallback: true,
        allowRetry: true,
        allowDegradedMaster: false,
      };
  }
}
