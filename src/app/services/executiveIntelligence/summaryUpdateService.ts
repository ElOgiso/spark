import { ExecutiveContext } from "../../state/executiveContext";
import { ExecutiveDirectorSummaryRow } from "../../backend/database.types";
import { executiveSummaryRepository } from "../../backend/repositories/executiveSummaryRepository";

export const summaryUpdateService = {
  async updateSummary(
    brandId: string,
    ctx: ExecutiveContext,
    lastUserText: string
  ): Promise<ExecutiveDirectorSummaryRow | null> {
    const existing = ctx.summary;
    const updatedSummary: Partial<ExecutiveDirectorSummaryRow> & { brand_id: string } = {
      brand_id: brandId,
      brand_summary: existing?.brand_summary || "Active Media Brand Operating Context",
      mission: existing?.mission || "Deliver high-impact, platform-native content.",
      goals: existing?.goals || ["Grow audience reach", "Maintain brand consistency"],
      audience: existing?.audience || "Global Tech & Creative Community",
      automation_mode: existing?.automation_mode || "balanced",
      pending_tasks: [
        {
          task: `Respond to: "${lastUserText.substring(0, 50)}..."`,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    return await executiveSummaryRepository.upsertSummary(updatedSummary);
  },
};
