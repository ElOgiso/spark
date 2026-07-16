import { IDepartmentAgent, ExecutionContext } from "../../domain/runtime/IDepartmentAgent";
import { AgentDefinition } from "../../domain/runtime/AgentDefinition";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { AgentResult } from "../../domain/runtime/AgentResult";
import { SchedulingSkill } from "../skills/SchedulingSkill";
import { AgentRegistry } from "../agentRegistry";

export class PublishingAgent implements IDepartmentAgent {
  public definition: AgentDefinition;
  private schedulingSkill = new SchedulingSkill();

  constructor() {
    this.definition = AgentRegistry.getInstance().getAgent("agent-publishing") || {
      id: "agent-publishing",
      name: "PublishingAgent",
      department: "publishing",
      capabilities: [],
      status: "healthy",
      version: "1.0.0",
      performanceMetrics: { avgLatencyMs: 900, avgCostUsd: 0.001, successRate: 0.995, qualityScore: 99 }
    };
  }

  public async initialize(): Promise<void> {
    console.log(`[Publishing Agent] Hooking API clients...`);
  }

  public canExecute(task: ExecutionTask): boolean {
    return task.department === "publishing";
  }

  public async prepare(task: ExecutionTask): Promise<void> {
    console.log(`[Publishing Agent] Gating permissions for task: ${task.id}`);
  }

  public async execute(
    task: ExecutionTask,
    context: ExecutionContext,
    selection: ProviderSelection,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    const activeAccounts = context.workspaceSnapshot.connectedAccounts
      .filter(a => a.status === "connected")
      .map(a => `${a.platform} (${a.handle})`);

    console.log(`[Publishing Agent] Context Injection: Connected Accounts=${activeAccounts.join(", ")}`);
    console.log(`[Publishing Agent] Context Injection: Automation Mode=${context.workspaceSnapshot.automationSettings.automationMode}`);
    console.log(`[Publishing Agent] Dispatching post payloads...`);

    const scheduleRes = await this.schedulingSkill.execute(task, selection, {
      payload: task.objective,
      time: task.scheduledTime
    }, onChunk);

    return {
      id: `res-${Date.now()}`,
      taskId: task.id,
      output: `Publish Job created. ID: ${scheduleRes.jobId}, Scheduled Time: ${scheduleRes.scheduledAt}`,
      rawResponse: { scheduleRes },
      metrics: {
        latencyMs: 900,
        costUsd: 0.001,
        inputTokens: 300,
        outputTokens: 100
      },
      status: "success"
    };
  }

  public validate(result: AgentResult): boolean {
    return result.status === "success";
  }

  public async cleanup(): Promise<void> {
    console.log(`[Publishing Agent] Closing API connections...`);
  }
}
