/**
 * Authoritative versioned pricing policy conversion: Provider USD -> Spark Credits.
 */

import type { CreditPricingPolicy } from "./types";

export const DEFAULT_PRICING_POLICY: CreditPricingPolicy = {
  version: "spark-credit-v1.0",
  creditsPerUsd: 100, // $0.01 USD = 1 Spark Credit
  marginMultiplier: 1.0,
  rounding: "ceil",
  minimumCharge: 1, // Minimum 1 credit for billable tasks
};

const POLICY_REGISTRY = new Map<string, CreditPricingPolicy>([
  [DEFAULT_PRICING_POLICY.version, DEFAULT_PRICING_POLICY],
]);

export function getPricingPolicy(version: string = DEFAULT_PRICING_POLICY.version): CreditPricingPolicy {
  return POLICY_REGISTRY.get(version) || DEFAULT_PRICING_POLICY;
}

export function registerPricingPolicy(policy: CreditPricingPolicy): void {
  POLICY_REGISTRY.set(policy.version, policy);
}

export function convertUsdToCredits(
  costUsd: number,
  policy: CreditPricingPolicy = DEFAULT_PRICING_POLICY,
  isBillable: boolean = true
): number {
  if (!isBillable || costUsd <= 0) return 0;
  
  const rawCredits = costUsd * policy.creditsPerUsd * policy.marginMultiplier;
  let finalCredits = 0;
  
  switch (policy.rounding) {
    case "floor":
      finalCredits = Math.floor(rawCredits);
      break;
    case "round":
      finalCredits = Math.round(rawCredits);
      break;
    case "ceil":
    default:
      finalCredits = Math.ceil(rawCredits);
      break;
  }
  
  return Math.max(policy.minimumCharge, finalCredits);
}
