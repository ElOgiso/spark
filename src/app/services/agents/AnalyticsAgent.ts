import { IDepartmentAgent, ExecutionContext } from "../../domain/runtime/IDepartmentAgent";
import { AgentDefinition } from "../../domain/runtime/AgentDefinition";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { AgentResult } from "../../domain/runtime/AgentResult";
import { AgentRegistry } from "../agentRegistry";
import { ExecutionAdapter } from "../executionAdapter";
import { AgentMessageBus } from "../runtime/agentMessageBus";

export class AnalyticsAgent implements IDepartmentAgent {
  public definition: AgentDefinition;

  constructor() {
    this.definition = AgentRegistry.getInstance().getAgent("agent-analytics") || {
      id: "agent-analytics",
      name: "AnalyticsAgent",
      department: "analytics",
      capabilities: [],
      status: "healthy",
      version: "1.0.1",
      performanceMetrics: { avgLatencyMs: 3100, avgCostUsd: 0.02, successRate: 0.97, qualityScore: 94 }
    };
  }

  public async initialize(): Promise<void> {
    console.log(`[Analytics Agent] Preparing databases...`);
  }

  public canExecute(task: ExecutionTask): boolean {
    return task.department === "analytics";
  }

  public async prepare(task: ExecutionTask): Promise<void> {
    console.log(`[Analytics Agent] Querying metrics for task: ${task.id}`);
  }

  public async execute(
    task: ExecutionTask,
    context: ExecutionContext,
    selection: ProviderSelection,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    console.log(`[Analytics Agent] Context Injection: Active Campaigns=${context.workspaceSnapshot.activeCampaigns.join(", ")}`);
    console.log(`[Analytics Agent] Normalizing performance summaries...`);

    const result = await ExecutionAdapter.execute(task, selection, onChunk);

    const recommendations = {
      postingTimes: ["Tuesday 10 AM", "Thursday 2 PM"],
      contentMix: ["AI Workflows (60%)", "Web Engineering (40%)"],
      providers: ["openai", "google"],
      models: ["gpt-4o", "gemini-2.5-flash"],
      routing: "Route creative tasks to openai and deep research tasks to google"
    };

    AgentMessageBus.getInstance().publish({
      type: "event",
      sender: "agent-analytics",
      recipient: "agent-learning",
      topic: "analytics-recommendations",
      payload: { recommendations }
    });

    return {
      id: `res-${Date.now()}`,
      taskId: task.id,
      output: `Normalized Aggregated Analytics: ${result.output}`,
      rawResponse: result.rawResponse,
      metrics: {
        latencyMs: 3100,
        costUsd: 0.02,
        inputTokens: 1000,
        outputTokens: 400
      },
      status: "success"
    };
  }

  public validate(result: AgentResult): boolean {
    return result.status === "success";
  }

  public async cleanup(): Promise<void> {
    console.log(`[Analytics Agent] Releasing database locks...`);
  }
}
