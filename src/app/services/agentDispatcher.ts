import { AgentDefinition } from "../domain/runtime/AgentDefinition";
import { Capability } from "../domain/runtime/Capability";

export class AgentDispatcher {
  /**
   * Selects the single best compatible agent based on requirements.
   * - Filters out unhealthy agents.
   * - Filters by target department and matching capabilities.
   * - Picks the match with the highest performanceScore.
   */
  public static selectAgent(
    agents: AgentDefinition[],
    requiredCapabilities: Capability[],
    targetDepartment?: string
  ): AgentDefinition | null {
    // 1. Filter healthy agents
    let candidates = agents.filter((agent) => agent.status === "healthy");

    // 2. Filter by department if specified
    if (targetDepartment) {
      candidates = candidates.filter((agent) => agent.department === targetDepartment.toLowerCase());
    }

    // 3. Filter by capabilities (must support all required capabilities if possible)
    let matchingCandidates = candidates.filter((agent) =>
      requiredCapabilities.every((cap) => agent.capabilities.includes(cap))
    );

    // Fallback: match any capability if no complete matches exist
    if (matchingCandidates.length === 0) {
      matchingCandidates = candidates.filter((agent) =>
        requiredCapabilities.some((cap) => agent.capabilities.includes(cap))
      );
    }

    // Fallback: use all department candidates if still no capability overlap
    if (matchingCandidates.length === 0) {
      matchingCandidates = candidates;
    }

    if (matchingCandidates.length === 0) {
      return null;
    }

    // 4. Return the agent with the highest performance quality score
    return matchingCandidates.reduce((best, current) =>
      current.performanceMetrics.qualityScore > best.performanceMetrics.qualityScore ? current : best
    );
  }
}
