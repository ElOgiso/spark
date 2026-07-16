import { IDepartmentAgent, ExecutionContext } from "../../domain/runtime/IDepartmentAgent";
import { AgentDefinition } from "../../domain/runtime/AgentDefinition";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { AgentResult } from "../../domain/runtime/AgentResult";
import { BrandVoiceSkill } from "../skills/BrandVoiceSkill";
import { SummarizationSkill } from "../skills/SummarizationSkill";
import { AgentRegistry } from "../agentRegistry";

export class CreativeAgent implements IDepartmentAgent {
  public definition: AgentDefinition;
  private brandVoiceSkill = new BrandVoiceSkill();
  private summarizationSkill = new SummarizationSkill();

  constructor() {
    this.definition = AgentRegistry.getInstance().getAgent("agent-creative") || {
      id: "agent-creative",
      name: "CreativeAgent",
      department: "creative",
      capabilities: [],
      status: "healthy",
      version: "1.2.0",
      performanceMetrics: { avgLatencyMs: 1800, avgCostUsd: 0.008, successRate: 0.96, qualityScore: 92 }
    };
  }

  public async initialize(): Promise<void> {
    console.log(`[Creative Agent] Initializing brand voice config...`);
  }

  public canExecute(task: ExecutionTask): boolean {
    return task.department === "creative";
  }

  public async prepare(task: ExecutionTask): Promise<void> {
    console.log(`[Creative Agent] Preparing text formats for task: ${task.id}`);
  }

  public async execute(
    task: ExecutionTask,
    context: ExecutionContext,
    selection: ProviderSelection,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    console.log(`[Creative Agent] Context Injection: Brand Voice=${context.brandMemory.brandVoice}`);
    console.log(`[Creative Agent] Context Injection: Preferred Hooks=${context.brandMemory.writingStyle.preferredHooks.join(" | ")}`);
    console.log(`[Creative Agent] Context Injection: Do-Not-Use Phrases=${context.brandMemory.writingStyle.doNotUsePhrases.join(", ")}`);
    console.log(`[Creative Agent] Generating styled copy...`);

    const summaryRes = await this.summarizationSkill.execute(task, selection, { text: task.objective }, onChunk);
    const brandRes = await this.brandVoiceSkill.execute(task, selection, {
      content: summaryRes.summary,
      brandId: context.brandId
    }, onChunk);

    return {
      id: `res-${Date.now()}`,
      taskId: task.id,
      output: brandRes.styledOutput,
      rawResponse: { summaryRes, brandRes },
      metrics: {
        latencyMs: 1800,
        costUsd: 0.008,
        inputTokens: 1100,
        outputTokens: 400
      },
      status: "success"
    };
  }

  public validate(result: AgentResult): boolean {
    return result.output.length > 0;
  }

  public async cleanup(): Promise<void> {
    console.log(`[Creative Agent] Releasing assets...`);
  }
}
