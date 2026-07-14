import { AgentDefinition } from "../domain/runtime/AgentDefinition";
import { Capability } from "../domain/runtime/Capability";

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, AgentDefinition> = new Map();

  private constructor() {
    this.register({
      id: "agent-research",
      name: "ResearchAgent",
      department: "research",
      capabilities: [Capability.WEB_SEARCH, Capability.LONG_CONTEXT, Capability.STRATEGIC_REASONING],
      status: "healthy",
      version: "1.0.0",
      performanceMetrics: { avgLatencyMs: 2400, avgCostUsd: 0.015, successRate: 0.98, qualityScore: 95 }
    });

    this.register({
      id: "agent-creative",
      name: "CreativeAgent",
      department: "creative",
      capabilities: [Capability.WRITING, Capability.STYLE_CONSISTENCY, Capability.TONE_ADAPTATION, Capability.LONG_CONTEXT],
      status: "healthy",
      version: "1.2.0",
      performanceMetrics: { avgLatencyMs: 1800, avgCostUsd: 0.008, successRate: 0.96, qualityScore: 92 }
    });

    this.register({
      id: "agent-production",
      name: "ProductionAgent",
      department: "production",
      capabilities: [Capability.IMAGE_GENERATION, Capability.VIDEO_GENERATION],
      status: "healthy",
      version: "1.0.4",
      performanceMetrics: { avgLatencyMs: 8500, avgCostUsd: 0.05, successRate: 0.94, qualityScore: 89 }
    });

    this.register({
      id: "agent-review",
      name: "ReviewAgent",
      department: "review",
      capabilities: [Capability.STRATEGIC_REASONING, Capability.STYLE_CONSISTENCY],
      status: "healthy",
      version: "1.1.0",
      performanceMetrics: { avgLatencyMs: 1200, avgCostUsd: 0.005, successRate: 0.99, qualityScore: 98 }
    });

    this.register({
      id: "agent-publishing",
      name: "PublishingAgent",
      department: "publishing",
      capabilities: [Capability.PUBLISHING],
      status: "healthy",
      version: "1.0.0",
      performanceMetrics: { avgLatencyMs: 900, avgCostUsd: 0.001, successRate: 0.995, qualityScore: 99 }
    });

    this.register({
      id: "agent-analytics",
      name: "AnalyticsAgent",
      department: "analytics",
      capabilities: [Capability.ANALYTICS, Capability.STRATEGIC_REASONING],
      status: "healthy",
      version: "1.0.1",
      performanceMetrics: { avgLatencyMs: 3100, avgCostUsd: 0.02, successRate: 0.97, qualityScore: 94 }
    });

    this.register({
      id: "agent-learning",
      name: "LearningAgent",
      department: "learning",
      capabilities: [Capability.LEARNING, Capability.LONG_CONTEXT],
      status: "healthy",
      version: "1.3.0",
      performanceMetrics: { avgLatencyMs: 4200, avgCostUsd: 0.03, successRate: 0.95, qualityScore: 90 }
    });
  }

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  public register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
  }

  public getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  public getAllAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  public updateStatus(id: string, status: "healthy" | "unhealthy"): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
    }
  }
}
