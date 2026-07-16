import { ISkillModule } from "../../domain/runtime/ISkillModule";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { ExecutionAdapter } from "../executionAdapter";

export class ImageGenerationSkill implements ISkillModule {
  public id = "skill-image-gen";
  public name = "Image Generation Skill";

  public async execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any> {
    console.log(`[Image Generation Skill] Drawing scene prompt: "${input.prompt}"`);
    const subtask: ExecutionTask = {
      ...task,
      objective: `Generate image for scene: ${input.prompt}`
    };
    const result = await ExecutionAdapter.execute(subtask, selection, onChunk);
    return {
      imageUrl: null,
      demo: true,
      note: "Image generation requires a live media provider key. No real image was produced.",
      rawOutput: result.output
    };
  }
}
