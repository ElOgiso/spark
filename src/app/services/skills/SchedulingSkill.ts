import { ISkillModule } from "../../domain/runtime/ISkillModule";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";
import { ExecutionAdapter } from "../executionAdapter";

export class SchedulingSkill implements ISkillModule {
  public id = "skill-scheduling";
  public name = "Post Scheduling Skill";

  public async execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any> {
    console.log(`[Scheduling Skill] Gating schedule time: ${input.time || "Immediate"}`);
    const subtask: ExecutionTask = {
      ...task,
      objective: `Schedule payload: ${JSON.stringify(input.payload)} at time: ${input.time || "immediate"}`
    };
    const result = await ExecutionAdapter.execute(subtask, selection, onChunk);
    return {
      jobId: `pj-${Date.now()}`,
      status: "Scheduled",
      scheduledAt: input.time || "Immediate",
      rawOutput: result.output
    };
  }
}
