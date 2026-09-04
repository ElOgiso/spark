/**
 * Brand + creator context consumption — no MY SPARK / onboarding rebuild.
 */

import type { Brand } from "../../../../domain/types";
import type { CreatorProfile } from "../../specification/creatorProfile";
import type { DecisionExplanation, OptimizationProfile } from "./types";
import type { CreativeControlMode } from "../../specification/productionSpec";

export function extractBrandRequirements(brand?: Brand): {
  requirements: string[];
  tone?: string;
  audience?: string;
  explanation: DecisionExplanation;
} {
  if (!brand) {
    return {
      requirements: [],
      explanation: {
        decision: "brand_context",
        reasons: ["No brand context available"],
        evidence: [],
        confidence: 0,
        alternatives: [],
      },
    };
  }
  const requirements: string[] = [];
  if (brand.niche) requirements.push(`Stay aligned with niche: ${brand.niche}`);
  const toneLabels = (brand.tone || []).filter((t) => t.active).map((t) => t.label);
  if (toneLabels.length) requirements.push(`Brand voice: ${toneLabels.join(", ")}`);
  const styleLabels = (brand.style || []).filter((s) => s.active).map((s) => s.label);
  if (styleLabels.length) requirements.push(`Visual identity: ${styleLabels.join(", ")}`);
  if (brand.sensitive_content_rules?.length) {
    requirements.push("Respect sensitive content rules");
  }
  const pillars = (brand.contentPillars || []).filter((p) => p.active).map((p) => p.label);
  if (pillars.length) {
    requirements.push(`Prefer pillars: ${pillars.slice(0, 3).join(", ")}`);
  }

  return {
    requirements,
    tone: toneLabels[0],
    audience: brand.audience?.primary,
    explanation: {
      decision: "brand_context",
      reasons: requirements.length ? ["Consumed existing brand fields"] : ["Brand present but sparse"],
      evidence: requirements.slice(0, 3),
      confidence: requirements.length ? 0.8 : 0.4,
      alternatives: [],
    },
  };
}

export function resolveOptimizationProfile(params: {
  productionMode?: string;
  creatorProfile?: CreatorProfile;
  explicit?: OptimizationProfile;
}): { profile: OptimizationProfile; explanation: DecisionExplanation } {
  if (params.explicit) {
    return {
      profile: params.explicit,
      explanation: {
        decision: "optimization_profile",
        reasons: ["Explicit optimization profile"],
        evidence: [params.explicit],
        confidence: 1,
        alternatives: [],
      },
    };
  }
  const priorities = params.creatorProfile?.priorities || [];
  if (priorities.includes("speed") && !priorities.includes("visual_quality")) {
    return {
      profile: "speed_first",
      explanation: {
        decision: "optimization_profile",
        reasons: ["Creator prioritizes speed"],
        evidence: priorities,
        confidence: 0.7,
        alternatives: ["balanced"],
      },
    };
  }
  if (priorities.includes("cost")) {
    return {
      profile: "cost_sensitive",
      explanation: {
        decision: "optimization_profile",
        reasons: ["Creator prioritizes cost"],
        evidence: priorities,
        confidence: 0.7,
        alternatives: ["balanced"],
      },
    };
  }
  if (priorities.includes("visual_quality") || params.productionMode === "deep") {
    return {
      profile: "quality_first",
      explanation: {
        decision: "optimization_profile",
        reasons: ["Quality prioritized by creator/mode"],
        evidence: [params.productionMode || "", ...priorities],
        confidence: 0.75,
        alternatives: ["balanced"],
      },
    };
  }
  if (params.productionMode === "express") {
    return {
      profile: "speed_first",
      explanation: {
        decision: "optimization_profile",
        reasons: ["Express production mode"],
        evidence: ["express"],
        confidence: 0.8,
        alternatives: ["balanced"],
      },
    };
  }
  return {
    profile: "balanced",
    explanation: {
      decision: "optimization_profile",
      reasons: ["Default balanced profile"],
      evidence: [],
      confidence: 0.6,
      alternatives: ["quality_first", "speed_first"],
    },
  };
}

export function detailForProductionMode(mode: CreativeControlMode | string | undefined): "concise" | "standard" | "rich" {
  if (mode === "studio") return "rich";
  if (mode === "director") return "standard";
  return "concise"; // auto
}
