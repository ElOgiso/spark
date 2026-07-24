import { ExecutiveContext } from "../state/executiveContext";

export interface PromptContext {
  brandSummary: string;
  mission: string;
  goals: string[];
  activeMemories: string[];
  workingContext: Record<string, unknown>;
  recentConversation: Array<{ sender: string; text: string }>;
  milestones: string[];
}

export const buildPromptContext = (ctx: ExecutiveContext): PromptContext => {
  const brandSummary = ctx.summary?.brand_summary || "Media Brand Operating Environment";
  const mission = ctx.summary?.mission || "Deliver high-impact, platform-native content.";
  const goals = Array.isArray(ctx.summary?.goals)
    ? (ctx.summary.goals as string[])
    : ["Grow audience reach", "Maintain brand consistency"];

  const activeMemories = ctx.memory
    .slice(0, 10)
    .map((m) => `[${m.category}] ${m.title}: ${m.description || ""}`);

  const recentConversation = ctx.conversation.slice(-10).map((msg) => ({
    sender: msg.sender === "user" ? "Creator" : "Executive Director",
    text: msg.text,
  }));

  const milestones = ctx.timeline
    .slice(0, 5)
    .map((t) => `[${t.type}] ${t.description || ""}`);

  return {
    brandSummary,
    mission,
    goals,
    activeMemories,
    workingContext: ctx.workingMemory.context,
    recentConversation,
    milestones,
  };
};
