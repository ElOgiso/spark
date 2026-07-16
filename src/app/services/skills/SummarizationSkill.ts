import { ISkillModule } from "../../domain/runtime/ISkillModule";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { ExecutionAdapter } from "../executionAdapter";

export class SummarizationSkill implements ISkillModule {
  public id = "skill-summarization";
  public name = "Summarization Skill";

  public async execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any> {
    console.log(`[Summarization Skill] Compressing text block: ${input.text ? input.text.substring(0, 50) + "..." : "empty"}`);
    const subtask: ExecutionTask = {
      ...task,
      objective: `Summarize the following: ${input.text || task.objective}`
    };
    const result = await ExecutionAdapter.execute(subtask, selection, onChunk);
    return {
      summary: result.output,
      length: result.output.length
    };
  }
}
