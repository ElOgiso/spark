/**
 * Structured research requirements for ProductionSpec.
 * Creative Director identifies when research is needed;
 * a future research engine fulfills these — do not invent facts here.
 */

export type ResearchNeedKind =
  | "historical"
  | "news"
  | "educational_factual"
  | "product_information"
  | "trend"
  | "location"
  | "other";

export type ResearchRequirementStatus = "not_required" | "pending" | "partial" | "satisfied";

export interface ResearchRequirementSpec {
  required: boolean;
  status: ResearchRequirementStatus;
  kinds: ResearchNeedKind[];
  /** Topic hints derived from the idea — not researched facts */
  topics: string[];
  notes: string[];
  /** Explicit guard: planners must not fabricate factual content to fill fields */
  inventFactsForbidden: true;
}

export function emptyResearchRequirement(): ResearchRequirementSpec {
  return {
    required: false,
    status: "not_required",
    kinds: [],
    topics: [],
    notes: [],
    inventFactsForbidden: true,
  };
}

export function buildResearchRequirement(params: {
  idea: string;
  requiresResearch: boolean;
  genre?: string;
  existingResearchPresent?: boolean;
}): ResearchRequirementSpec {
  if (!params.requiresResearch) {
    return emptyResearchRequirement();
  }

  const text = (params.idea || "").toLowerCase();
  const kinds = new Set<ResearchNeedKind>();
  const notes: string[] = [];

  if (
    params.genre === "documentary" ||
    /history|historical|ancient|kingdom|archive|benin/.test(text)
  ) {
    kinds.add("historical");
    notes.push("Factual historical grounding required before script lock");
  }
  if (params.genre === "news_explainer" || /news|breaking|today|current|202\d/.test(text)) {
    kinds.add("news");
    notes.push("Current-event verification required");
  }
  if (params.genre === "educational" || /explain|how to|tutorial|bitcoin|science/.test(text)) {
    kinds.add("educational_factual");
    notes.push("Concept accuracy required for educational beats");
  }
  if (
    params.genre === "advertisement" ||
    params.genre === "product_demo" ||
    /product|watch|commercial|luxury/.test(text)
  ) {
    kinds.add("product_information");
    notes.push("Product attributes must come from brand/product sources");
  }
  if (/trend|viral|tiktok|shorts/.test(text)) {
    kinds.add("trend");
    notes.push("Trend context may need refresh before production");
  }
  if (/location|travel|kingdom|city|benin|africa/.test(text) || params.genre === "travel") {
    kinds.add("location");
  }
  if (kinds.size === 0) kinds.add("other");

  const topics = extractTopicHints(params.idea);

  return {
    required: true,
    status: params.existingResearchPresent ? "partial" : "pending",
    kinds: Array.from(kinds),
    topics,
    notes,
    inventFactsForbidden: true,
  };
}

function extractTopicHints(idea: string): string[] {
  const cleaned = (idea || "")
    .replace(/^(create|make|produce)\s+(a|an|the)?\s*/i, "")
    .replace(/\b(video|documentary|commercial|short|explainer|film)\b/gi, "")
    .trim();
  if (!cleaned) return [];
  // Keep as a single topic hint — do not invent sub-facts
  return [cleaned.slice(0, 160)];
}
