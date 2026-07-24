import { ExecutiveContext } from "../../state/executiveContext";
import { ExecutiveSessionRow } from "../../backend/database.types";
import { executiveSessionRepository } from "../../backend/repositories/executiveSessionRepository";

export const sessionUpdateService = {
  async updateSession(
    brandId: string,
    ctx: ExecutiveContext,
    screen: string = "/"
  ): Promise<ExecutiveSessionRow | null> {
    const sessionPatch: Partial<ExecutiveSessionRow> & { brand_id: string } = {
      brand_id: brandId,
      last_screen: screen,
      last_activity: new Date().toISOString(),
      active_department: "Executive Director",
      working_memory_snapshot: ctx.workingMemory.context as any,
    };

    return await executiveSessionRepository.upsertSession(sessionPatch);
  },
};
