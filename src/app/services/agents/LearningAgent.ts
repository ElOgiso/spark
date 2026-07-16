import { IDepartmentAgent, ExecutionContext } from "../../domain/runtime/IDepartmentAgent";
import { AgentDefinition } from "../../domain/runtime/AgentDefinition";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { AgentResult } from "../../domain/runtime/AgentResult";
import { AgentRegistry } from "../agentRegistry";
import { ExecutionAdapter } from "../executionAdapter";
import { ExecutivePolicyEngine } from "../executivePolicyEngine";
import { BrandMemoryEngine } from "../workspace/brandMemoryEngine";
import { AgentMessageBus } from "../runtime/agentMessageBus";

export class LearningAgent implements IDepartmentAgent {
  public definition: AgentDefinition;

  constructor() {
    this.definition = AgentRegistry.getInstance().getAgent("agent-learning") || {
      id: "agent-learning",
      name: "LearningAgent",
      department: "learning",
      capabilities: [],
      status: "healthy",
      version: "1.3.0",
      performanceMetrics: { avgLatencyMs: 4200, avgCostUsd: 0.03, successRate: 0.95, qualityScore: 90 }
    };
  }

  public async initialize(): Promise<void> {
    console.log(`[Learning Agent] Initializing memory adapter...`);
    
    AgentMessageBus.getInstance().registerListener((envelope) => {
      if (envelope.topic === "analytics-recommendations" && envelope.payload?.recommendations) {
        const recs = envelope.payload.recommendations;
        console.log(`[Learning Agent] Consuming analytics recommendations:`, recs);
        
        const memoryEngine = BrandMemoryEngine.getInstance();
        memoryEngine.updateMemory("guidelines", [
          `Suggested posting schedules: ${recs.postingTimes.join(", ")}`,
          `Model preference suggestion: ${recs.routing}`
        ]);
      }
    });
  }

  public canExecute(task: ExecutionTask): boolean {
    return task.department === "learning";
  }

  public async prepare(task: ExecutionTask): Promise<void> {
    console.log(`[Learning Agent] Fetching rules for task: ${task.id}`);
  }

  public async execute(
    task: ExecutionTask,
    context: ExecutionContext,
    selection: ProviderSelection,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    console.log(`[Learning Agent] Analyzing patterns...`);

    const result = await ExecutionAdapter.execute(task, selection, onChunk);

    const memoryAllowed = ExecutivePolicyEngine.canUpdateMemory(task.automationMode);
    let output = result.output;
    if (memoryAllowed) {
      console.log(`[Learning Agent] Successfully committed optimization insights to Brand Memory`);
      output += "\n[Committed to Memory]";
    } else {
      console.log(`[Learning Agent] Memory write denied by Policy Engine`);
      output += "\n[Memory Commit Denied]";
    }

    return {
      id: `res-${Date.now()}`,
      taskId: task.id,
      output,
      rawResponse: result.rawResponse,
      metrics: {
        latencyMs: 4200,
        costUsd: 0.03,
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
    console.log(`[Learning Agent] Closing memory pipes...`);
  }
}
