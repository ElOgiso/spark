import { ISkillModule } from "../../domain/runtime/ISkillModule";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { ExecutionAdapter } from "../executionAdapter";

export class WebSearchSkill implements ISkillModule {
  public id = "skill-web-search";
  public name = "Web Search Skill";

  public async execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any> {
    console.log(`[Web Search Skill] Launching web query: "${input.query || task.objective}"`);
    const subtask: ExecutionTask = {
      ...task,
      objective: `Search query: ${input.query || task.objective}`
    };
    const result = await ExecutionAdapter.execute(subtask, selection, onChunk);
    return {
      query: input.query,
      rawResults: result.output,
      citations: ["https://spark-os.ai/insights/baseline"]
    };
  }
}
