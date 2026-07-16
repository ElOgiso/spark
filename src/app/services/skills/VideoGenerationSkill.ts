import { ISkillModule } from "../../domain/runtime/ISkillModule";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { ExecutionAdapter } from "../executionAdapter";

export class VideoGenerationSkill implements ISkillModule {
  public id = "skill-video-gen";
  public name = "Video Generation Skill";

  public async execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any> {
    console.log(`[Video Generation Skill] Animating scene: "${input.sceneDescription}"`);
    const subtask: ExecutionTask = {
      ...task,
      objective: `Generate short-form video clip for: ${input.sceneDescription}`
    };
    const result = await ExecutionAdapter.execute(subtask, selection, onChunk);
    return {
      videoUrl: null,
      demo: true,
      note: "Video generation requires a live media provider key. No real clip was produced.",
      rawOutput: result.output
    };
  }
}
