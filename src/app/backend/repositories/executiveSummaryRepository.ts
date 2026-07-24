import { supabase } from "../supabaseClient";
import { ExecutiveDirectorSummaryRow } from "../database.types";

export const executiveSummaryRepository = {
  async getSummary(brandId: string): Promise<ExecutiveDirectorSummaryRow | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("executive_director_summaries")
      .select("*")
      .eq("brand_id", brandId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[executiveSummaryRepository] Fetch error:", error);
    }
    return data || null;
  },

  async upsertSummary(
    summary: Partial<ExecutiveDirectorSummaryRow> & { brand_id: string }
  ): Promise<ExecutiveDirectorSummaryRow | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("executive_director_summaries")
      .upsert(
        {
          ...summary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "brand_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[executiveSummaryRepository] Upsert error:", error);
      return null;
    }
    return data;
  },
};
