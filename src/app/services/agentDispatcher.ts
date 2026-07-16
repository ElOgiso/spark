import { AgentDefinition } from "../domain/runtime/AgentDefinition";
import { Capability } from "../domain/runtime/Capability";
import { IDepartmentAgent } from "../domain/runtime/IDepartmentAgent";
import { ResearchAgent } from "./agents/ResearchAgent";
import { CreativeAgent } from "./agents/CreativeAgent";
import { ProductionAgent } from "./agents/ProductionAgent";
import { PublishingAgent } from "./agents/PublishingAgent";
import { AnalyticsAgent } from "./agents/AnalyticsAgent";
import { LearningAgent } from "./agents/LearningAgent";
import { ReviewAgent } from "./agents/ReviewAgent";
import { EditorAgent } from "./agents/EditorAgent";

export class AgentDispatcher {
  /**
   * Instantiates the matching executable agent instance from the metadata definition.
   */
  public static instantiateAgent(definition: AgentDefinition): IDepartmentAgent {
    switch (definition.id) {
      case "agent-research":
        return new ResearchAgent();
      case "agent-creative":
        return new CreativeAgent();
      case "agent-production":
        return new ProductionAgent();
      case "agent-publishing":
        return new PublishingAgent();
      case "agent-analytics":
        return new AnalyticsAgent();
      case "agent-learning":
        return new LearningAgent();
      case "agent-review":
        return new ReviewAgent();
      case "agent-editor":
        return new EditorAgent();
      default:
        // Fallback
        return new ResearchAgent();
    }
  }

  /**
   * Filters candidate definitions and returns the concrete instantiated IDepartmentAgent wrapper.
   */
  public static selectAgent(
    agents: AgentDefinition[],
    requiredCapabilities: Capability[],
    targetDepartment?: string
  ): IDepartmentAgent | null {
    // 1. Filter healthy agents
    let candidates = agents.filter((agent) => agent.status === "healthy");

    // 2. Filter by department if specified
    if (targetDepartment) {
      candidates = candidates.filter((agent) => agent.department === targetDepartment.toLowerCase());
    }

    // 3. Filter by capabilities
    let matchingCandidates = candidates.filter((agent) =>
      requiredCapabilities.every((cap) => agent.capabilities.includes(cap))
    );

    if (matchingCandidates.length === 0) {
      matchingCandidates = candidates.filter((agent) =>
        requiredCapabilities.some((cap) => agent.capabilities.includes(cap))
      );
    }

    if (matchingCandidates.length === 0) {
      matchingCandidates = candidates;
    }

    if (matchingCandidates.length === 0) {
      return null;
    }

    // 4. Return the agent with the highest performance quality score
    const bestDef = matchingCandidates.reduce((best, current) =>
      current.performanceMetrics.qualityScore > best.performanceMetrics.qualityScore ? current : best
    );

    return this.instantiateAgent(bestDef);
  }
}
