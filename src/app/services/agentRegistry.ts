import { AgentDefinition } from "../domain/runtime/AgentDefinition";
import { Capability } from "../domain/runtime/Capability";

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, AgentDefinition> = new Map();

  private constructor() {
    // Populate default system department agents
    this.register({
      id: "agent-research",
      name: "Deep Research Agent",
      department: "research",
      capabilities: [Capability.WEB_SEARCH, Capability.LONG_CONTEXT, Capability.STRATEGIC_REASONING],
      status: "healthy",
      performanceScore: 95
    });

    this.register({
      id: "agent-creative",
      name: "Naija Hook Copywriter",
      department: "creative",
      capabilities: [Capability.WRITING, Capability.STYLE_CONSISTENCY, Capability.TONE_ADAPTATION, Capability.LONG_CONTEXT],
      status: "healthy",
      performanceScore: 92
    });

    this.register({
      id: "agent-production",
      name: "Visual Storyboarder",
      department: "production",
      capabilities: [Capability.IMAGE_GENERATION, Capability.VIDEO_GENERATION],
      status: "healthy",
      performanceScore: 89
    });

    this.register({
      id: "agent-review",
      name: "Quality Gatekeeper",
      department: "review",
      capabilities: [Capability.STRATEGIC_REASONING, Capability.STYLE_CONSISTENCY],
      status: "healthy",
      performanceScore: 98
    });

    this.register({
      id: "agent-publishing",
      name: "Social Channel Publisher",
      department: "publishing",
      capabilities: [Capability.PUBLISHING],
      status: "healthy",
      performanceScore: 99
    });

    this.register({
      id: "agent-analytics",
      name: "Insights Auditor",
      department: "analytics",
      capabilities: [Capability.ANALYTICS, Capability.STRATEGIC_REASONING],
      status: "healthy",
      performanceScore: 94
    });

    this.register({
      id: "agent-learning",
      name: "Memory Loop Optimizer",
      department: "learning",
      capabilities: [Capability.LEARNING, Capability.LONG_CONTEXT],
      status: "healthy",
      performanceScore: 90
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
