/**
 * Spark Media OS — Canonical Prompt Context Builder
 * Single source of truth for constructing unified AI system instructions and prompt context
 * across all AI providers (Gemini, Xai, Fallbacks) and Department Swarms.
 */

import { SPARK_EXECUTIVE_VOICE_PROFILE } from "./geminiService";
import { ProductionGenerationGuard } from "./production/ProductionGenerationGuard";

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

    const prodEnabled = ProductionGenerationGuard.isEnabled();
    contextParts.push(`PRODUCTION GENERATION STATUS: ${prodEnabled ? "ENABLED (Drafting & Media Rendering Active)" : "DISABLED (Planning & Advisory Mode Only - Zero AI Media Generation)"}`);

    if (!prodEnabled) {
      contextParts.push(
        `CRITICAL SYSTEM GUARD: Production Generation is currently OFF. If the user asks to generate/create/render a video, brief, script, or image, do NOT attempt generation. Reply: "Production Generation is currently turned off. No drafting or asset generation can run while it's disabled. Would you like me to enable Production Generation first?"`
      );
    }

    // 5. Department Specific Instructions
    contextParts.push(`DEPARTMENT CONTEXT: Executing as [${department}] in Spark Media OS.`);

    // 6. Context Window Protection & History Summarization (Part D Governance)
    let historyContext = "";
    if (history && history.length > 0) {
      if (history.length > 6) {
        const olderMessages = history.slice(0, history.length - 6);
        const recentMessages = history.slice(history.length - 6);
        const summary = olderMessages.map((m) => `${m.sender.toUpperCase()}: ${m.text.slice(0, 80)}`).join(" | ");
        contextParts.push(`EARLIER SESSION CONTEXT (Summarized to save tokens): ${summary}`);
        historyContext = recentMessages.map((m) => `${m.sender === "spark" ? "SUPER SPARK" : "USER"}: ${m.text}`).join("\n");
      } else {
        historyContext = history.map((m) => `${m.sender === "spark" ? "SUPER SPARK" : "USER"}: ${m.text}`).join("\n");
      }
    }

    const systemInstruction = `You are Super Spark, Executive Creative Director for Spark Media OS.
Voice Profile: ${SPARK_EXECUTIVE_VOICE_PROFILE.name} (${SPARK_EXECUTIVE_VOICE_PROFILE.gender}, Accent: ${SPARK_EXECUTIVE_VOICE_PROFILE.accent}).
Respond naturally as an articulate, warm, calm, trusted executive partner. Default to 1-3 short, clear sentences. Answer exactly what was asked without fluff or tutorials.`;

    const contextBrief = contextParts.join("\n\n");
    const fullPrompt = historyContext
      ? `${contextBrief}\n\nRECENT CONVERSATION:\n${historyContext}\n\nUSER PROMPT: ${prompt}`
      : `${contextBrief}\n\nUSER PROMPT: ${prompt}`;

    return {
      systemInstruction,
      fullPrompt,
    };
  }
}
