import { supabase } from "../supabaseClient";
import { ExecutiveTimelineRow } from "../database.types";

export const executiveTimelineRepository = {
  async listTimeline(brandId: string): Promise<ExecutiveTimelineRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("executive_timeline")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[executiveTimelineRepository] List error:", error);
      return [];
    }
    return data || [];
  },

  async recordMilestone(
    milestone: Partial<ExecutiveTimelineRow> & { brand_id: string; type: string }
  ): Promise<ExecutiveTimelineRow | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("executive_timeline")
      .insert({
        brand_id: milestone.brand_id,
        session_id: milestone.session_id || null,
        type: milestone.type,
        description: milestone.description || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[executiveTimelineRepository] Insert error:", error);
      return null;
    }
    return data;
  },
};
