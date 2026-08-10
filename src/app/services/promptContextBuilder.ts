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

/**
 * Verified SPARK Founder & Builder Knowledge
 * Canonical foundation details for Maurice Otabor (ElOgiso)
 */
export const SPARK_FOUNDER_KNOWLEDGE = {
  name: "Maurice Otabor",
  artName: "ElOgiso",
  origin: "Nigeria",
  birthDate: "13 April 1996", // Note: does not celebrate birthdays — do NOT surface birthday prompts
  roles: [
    "Nigerian AI enthusiast",
    "Hand-paint artist",
    "Crypto investor",
    "Developer",
    "Web3 & culture creator",
  ],
  artWorld: "Known as ElOgiso; digital tribe and culture-on-chain work; creator behind Azurai",
  presence: {
    art: "https://elogiso.art",
    bio: "https://bio.site/elogiso",
    x: "@ElOgiso (also linked with @MauriceOtabor in bio)",
  },
  aesthetic: "Prefers white and black",
  path: "Built through multiple online hustles; art + developer side; community and tribe building",
  publicPositioning: "Artist and culture channeler from Nigeria; work mixes hand-drawn, digital, AI-augmented, and motion; founder energy around Azurai / culture on-chain; Web3 creator and community builder; now building SPARK as an AI-native Media Operating System.",
  lockedBlurb: "Maurice Otabor (ElOgiso) — Founder of SPARK. Nigerian AI enthusiast, hand-paint artist, crypto investor, and developer. Known in the art world as ElOgiso; builds at the intersection of culture, technology, and media systems. Art and builder presence: ElOgiso.art · @ElOgiso.",
  rules: [
    "About / Founder copy: short, quiet, executive — not a full biography dump.",
    "Do NOT auto-wish happy birthday or store birthday as a celebration event (Maurice does not celebrate birthdays — never surface birthday prompts in product).",
    "Do NOT invent awards, metrics, or titles not verified.",
    "Super Spark knows founder context as brand memory for the SPARK product organization, not as every user's brand.",
  ],
} as const;

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

    // 5. SPARK Product Org & Founder Knowledge Base (for questions about SPARK creator/builder/developer)
    contextParts.push(
      `SPARK PRODUCT FOUNDATION & FOUNDER KNOWLEDGE:\n` +
      `• Founder / Builder: ${SPARK_FOUNDER_KNOWLEDGE.name} (${SPARK_FOUNDER_KNOWLEDGE.artName})\n` +
      `• Summary: ${SPARK_FOUNDER_KNOWLEDGE.lockedBlurb}\n` +
      `• Web & Social: ${SPARK_FOUNDER_KNOWLEDGE.presence.art} · ${SPARK_FOUNDER_KNOWLEDGE.presence.x}\n` +
      `• Guidelines: When asked about who founded, built, or developed SPARK, answer with the short, quiet, executive blurb. Do NOT auto-wish happy birthday or surface birthday prompts. Do NOT invent unverified titles or metrics.`
    );

    // 6. Department Specific Instructions
    contextParts.push(`DEPARTMENT CONTEXT: Executing as [${department}] in Spark Media OS.`);

    // 7. Context Window Protection & History Summarization (Part D Governance)
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
Speak naturally as a warm, intelligent, easygoing conversational peer. Use contractions. Vary sentence length. Default to 1-3 short, clear sentences without robotic fluff, bullet lists, or narration boilerplate.`;

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
