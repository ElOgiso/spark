import { ModelRouter } from "./runtime/modelRouter";

/**
 * Phase 19C: Automatic AI Session Naming Service
 * Generates concise 2-4 word executive titles after the first exchange.
 * Examples: "TikTok Strategy", "Launch Plan", "Creator Analysis", "Brand Voice Review"
 */
export async function generateSessionTitle(
  userPrompt: string,
  assistantResponse: string
): Promise<string> {
  const prompt = `Based on this initial user query and executive response, generate a concise, professional 2 to 4 word session title.
User Query: "${userPrompt.slice(0, 150)}"
Executive Reply: "${assistantResponse.slice(0, 150)}"

Return strict plain text title only (2 to 4 words). Do NOT use quotes, markdown, or punctuation.
Example output: TikTok Strategy`;

  try {
    const rawTitle = await ModelRouter.executeCategoryRequest("superSpark", {
      prompt,
      systemInstruction: "You are SPARK's AI Session Naming Engine. Return ONLY a 2-4 word plain text title.",
      capability: "Chat",
    });

    const cleaned = rawTitle.replace(/["'#*`]/g, "").trim();
    if (cleaned && cleaned.length > 2 && cleaned.length < 45) {
      return cleaned;
    }
  } catch (err) {
    console.warn("[SessionTitleService] AI title generation fallback notice:", err);
  }

  // Graceful fallback from user prompt
  const words = userPrompt.trim().split(/\s+/).slice(0, 4).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Executive Session";
}
