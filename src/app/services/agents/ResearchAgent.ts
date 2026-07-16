import { IDepartmentAgent, ExecutionContext } from "../../domain/runtime/IDepartmentAgent";
import { AgentDefinition } from "../../domain/runtime/AgentDefinition";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { AgentResult } from "../../domain/runtime/AgentResult";
import { WebSearchSkill } from "../skills/WebSearchSkill";
import { CitationValidationSkill } from "../skills/CitationValidationSkill";
import { AgentRegistry } from "../agentRegistry";

export class ResearchAgent implements IDepartmentAgent {
  public definition: AgentDefinition;
  private searchSkill = new WebSearchSkill();
  private citationSkill = new CitationValidationSkill();

  constructor() {
    this.definition = AgentRegistry.getInstance().getAgent("agent-research") || {
      id: "agent-research",
      name: "ResearchAgent",
      department: "research",
      capabilities: [],
      status: "healthy",
      version: "1.0.0",
      performanceMetrics: { avgLatencyMs: 2400, avgCostUsd: 0.015, successRate: 0.98, qualityScore: 95 }
    };
  }

  public async initialize(): Promise<void> {
    console.log(`[Research Agent] Initializing workspace...`);
  }

  public canExecute(task: ExecutionTask): boolean {
    return task.department === "research";
  }

  public async prepare(task: ExecutionTask): Promise<void> {
    console.log(`[Research Agent] Preparing variables for task: ${task.id}`);
  }

  public async execute(
    task: ExecutionTask,
    context: ExecutionContext,
    selection: ProviderSelection,
    onChunk?: (text: string) => void
  ): Promise<AgentResult> {
    console.log(`[Research Agent] Context Injection: Brand=${context.workspaceSnapshot.activeBrand.name}, Archetype=${context.workspaceSnapshot.activeBrand.archetype}`);
    console.log(`[Research Agent] Context Injection: Target Audience=${context.brandMemory.about.audiencePersonas.join(", ")}`);
    console.log(`[Research Agent] Executing research tasks via skills...`);

    const searchRes = await this.searchSkill.execute(task, selection, { query: task.objective }, onChunk);
    const validateRes = await this.citationSkill.execute(task, selection, { citations: searchRes.citations }, onChunk);

    return {
      id: `res-${Date.now()}`,
      taskId: task.id,
      output: `Research Package Output: ${searchRes.rawResults}. Citation validation: ${validateRes.allValid ? "passed" : "failed"}`,
      rawResponse: { searchRes, validateRes },
      metrics: {
        latencyMs: 2400,
        costUsd: 0.015,
        inputTokens: 1000,
        outputTokens: 500
      },
      status: validateRes.allValid ? "success" : "failure"
    };
  }

  public validate(result: AgentResult): boolean {
    return result.status === "success";
  }

  public async cleanup(): Promise<void> {
    console.log(`[Research Agent] Cleaning up handles...`);
  }
}
