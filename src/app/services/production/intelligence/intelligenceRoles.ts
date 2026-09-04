/**
 * AI role separation for production intelligence.
 * Extends existing ModelRouter categories — does not create a parallel router.
 * Provider implementations remain the execution layer.
 */

import type { AIRoutingCategory } from "../../../domain/types";
import { ModelRouter } from "../../runtime/modelRouter";

/**
 * Logical intelligence roles (provider-agnostic).
 * Map onto existing AIRoutingCategory where possible.
 */
export type ProductionIntelligenceRole =
  | "creativeDirection"
  | "narrativePlanning"
  | "research"
  | "visualReasoning"
  | "productionPlanning"
  | "review"
  | "analytics"
  | "memory";

export function mapIntelligenceRoleToRoutingCategory(
  role: ProductionIntelligenceRole
): AIRoutingCategory {
  switch (role) {
    case "creativeDirection":
    case "productionPlanning":
      return "production";
    case "narrativePlanning":
      return "executive";
    case "research":
      return "research";
    case "visualReasoning":
      return "videoUnderstanding";
    case "review":
      return "review";
    case "analytics":
      return "analytics";
    case "memory":
      return "memory";
    default:
      return "production";
  }
}

export function resolveIntelligenceRoleProvider(role: ProductionIntelligenceRole): string {
  const category = mapIntelligenceRoleToRoutingCategory(role);
  return String(ModelRouter.resolveProvider(category));
}

export interface IntelligenceRoleTrace {
  role: ProductionIntelligenceRole;
  routingCategory: AIRoutingCategory;
  provider: string;
  model?: string;
}
