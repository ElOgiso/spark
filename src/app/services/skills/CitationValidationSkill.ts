import { ISkillModule } from "../../domain/runtime/ISkillModule";
import { ExecutionTask } from "../../domain/runtime/ExecutionTask";
import { ProviderSelection } from "../modelRouter";

export class CitationValidationSkill implements ISkillModule {
  public id = "skill-citation-validation";
  public name = "Citation Validation Skill";

  public async execute(task: ExecutionTask, selection: ProviderSelection, input: any, onChunk?: (text: string) => void): Promise<any> {
    console.log(`[Citation Validation Skill] Verifying links: ${JSON.stringify(input.citations)}`);
    const validated = (input.citations || []).map((link: string) => ({
      link,
      status: link.startsWith("https://") ? "valid" : "invalid"
    }));
    return {
      validated,
      allValid: validated.every((v: any) => v.status === "valid")
    };
  }
}
