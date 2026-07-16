import { ExecutionTask } from "./ExecutionTask";
import { ProviderSelection } from "../../services/modelRouter";

export interface ISkillModule {
  id: string;
  name: string;
  execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any>;
}
