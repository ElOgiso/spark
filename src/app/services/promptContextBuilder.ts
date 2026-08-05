/**
 * Spark Media OS — Canonical Prompt Context Builder
 * Single source of truth for constructing unified AI system instructions and prompt context
 * across all AI providers (Gemini, Xai, Fallbacks) and Department Swarms.
 */

import { SPARK_EXECUTIVE_VOICE_PROFILE } from "./geminiService";

export interface PromptContextParams {
  department?: string;
  prompt: string;
  workspaceState?: any;
  history?: { sender: "user" | "spark"; text: string }[];
}

export class PromptContextBuilder {
  static buildContext(params: PromptContextParams): {
    systemInstruction: string;
    fullPrompt: string;
  } {
    const { department = "Executive Director", prompt, workspaceState, history = [] } = params;

    let contextParts: string[] = [];

    // 1. Executive Summary & Brand Context
    if (workspaceState?.brand) {
      const brand = workspaceState.brand;
      contextParts.push(`BRAND CONTEXT: Name="${brand.name}", Niche="${brand.niche || "General"}", Archetype="${brand.archetype || "Expert Guide"}"`);
      if (brand.purpose) {
        contextParts.push(`PURPOSE/VISION: "${brand.purpose}"`);
      }
    }

    // 2. Character Bible Rules
    if (workspaceState?.character) {
      const char = workspaceState.character;
      contextParts.push(`HOST CHARACTER BIBLE: Name="${char.name}", Style="${char.style || "Executive"}", Traits="${(char.traits || []).join(", ")}"`);
    }

    // 3. Long-Term Memory Rules
    if (workspaceState?.memoryItems && Array.isArray(workspaceState.memoryItems) && workspaceState.memoryItems.length > 0) {
      const activeRules = workspaceState.memoryItems.slice(0, 5).map((m: any) => `• ${m.text}`).join("\n");
      contextParts.push(`STRATEGY & BRAND MEMORY RULES:\n${activeRules}`);
    }

    // 4. Current Workspace State
    if (workspaceState) {
      const activeProds = workspaceState.productions?.length || 0;
      const pendingReviews = workspaceState.reviewItems?.filter((r: any) => r.status === "Pending Review")?.length || 0;
      const autoMode = workspaceState.automationMode || "balanced";
      contextParts.push(`WORKSPACE SNAPSHOT: Active Productions=${activeProds}, Pending Reviews=${pendingReviews}, Automation Mode=${autoMode.toUpperCase()}`);
    }

    // 5. Department Specific Instructions
    contextParts.push(`DEPARTMENT CONTEXT: Executing as [${department}] in Spark Media OS.`);

    const systemInstruction = `You are Super Spark, Executive Creative Director for Spark Media OS.
Voice Profile: ${SPARK_EXECUTIVE_VOICE_PROFILE.name} (${SPARK_EXECUTIVE_VOICE_PROFILE.gender}, Accent: ${SPARK_EXECUTIVE_VOICE_PROFILE.accent}).
Respond naturally as an articulate, warm, calm, trusted executive partner. Default to 1-3 short, clear sentences. Answer exactly what was asked without fluff or tutorials.`;

    const contextBrief = contextParts.join("\n\n");
    const fullPrompt = `${contextBrief}\n\nUSER PROMPT: ${prompt}`;

    return {
      systemInstruction,
      fullPrompt,
    };
  }
}
