import { ISkillModule } from "../../domain/runtime/ISkillModule";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { ExecutionAdapter } from "../executionAdapter";

export class BrandVoiceSkill implements ISkillModule {
  public id = "skill-brand-voice";
  public name = "Brand Voice Adapter Skill";

  public async execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any> {
    console.log(`[Brand Voice Skill] Applying guidelines for brand: ${input.brandId || "default"}`);
    const subtask: ExecutionTask = {
      ...task,
      objective: `Format this output using brand tone guidelines: ${input.content || task.objective}`
    };
    const result = await ExecutionAdapter.execute(subtask, selection, onChunk);
    return {
      styledOutput: result.output,
      appliedBrand: input.brandId || "default"
    };
  }
}
