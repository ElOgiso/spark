import { ExecutiveContext } from "../../state/executiveContext";
import { MemoryCategory } from "../../backend/database.types";

export interface ExtractedFact {
  category: MemoryCategory;
  title: string;
  description: string;
  importance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: string;
}

export const reflectionService = {
  extractFactsFromMessage(text: string, ctx: ExecutiveContext): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    const lower = text.toLowerCase();

    if (lower.includes("prefer") || lower.includes("like") || lower.includes("love")) {
      facts.push({
        category: MemoryCategory.PREFERENCES,
        title: "User Content Preference",
        description: `Creator expressed preference: "${text.substring(0, 100)}"`,
        importance: "HIGH",
        confidence: "0.90",
      });
    }

    if (lower.includes("target") || lower.includes("audience") || lower.includes("goal")) {
      facts.push({
        category: MemoryCategory.GOALS,
        title: "Brand Direction Goal",
        description: `Strategic goal stated: "${text.substring(0, 100)}"`,
        importance: "HIGH",
        confidence: "0.85",
      });
    }

    if (lower.includes("never") || lower.includes("don't") || lower.includes("avoid")) {
      facts.push({
        category: MemoryCategory.CREATIVE_STYLE,
        title: "Creative Style Boundary",
        description: `Style boundary defined: "${text.substring(0, 100)}"`,
        importance: "CRITICAL",
        confidence: "0.95",
      });
    }

    return facts;
  },
};
