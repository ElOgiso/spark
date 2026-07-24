import type { ConversationMessageRow } from "../database.types";
import { insertRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";

export async function listConversationMessages(
  brandId: string,
): Promise<RepositoryResult<ConversationMessageRow[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ConversationMessageRow[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ConversationMessageRow[]>();

  const { data, error } = await supabase
    .from("executive_conversation_messages")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });

  if (error) {
    const fallback = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: true });
    if (fallback.error) return repositoryError<ConversationMessageRow[]>(fallback.error.message);
    return { data: (fallback.data ?? []) as ConversationMessageRow[], error: null, source: "supabase" };
  }
  return { data: (data ?? []) as ConversationMessageRow[], error: null, source: "supabase" };
}

export async function createConversationMessage(
  values: Partial<ConversationMessageRow>,
): Promise<RepositoryResult<ConversationMessageRow>> {
  return insertRow("executive_conversation_messages", values);
}

export async function batchCreateConversationMessages(
  messages: Partial<ConversationMessageRow>[],
): Promise<RepositoryResult<ConversationMessageRow[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ConversationMessageRow[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ConversationMessageRow[]>();

  const { data, error } = await supabase
    .from("executive_conversation_messages")
    .insert(messages)
    .select("*");

  if (error) return repositoryError<ConversationMessageRow[]>(error.message);
  return { data: (data ?? []) as ConversationMessageRow[], error: null, source: "supabase" };
}

export const conversationRepository = {
  async listConversationMessages(brandId: string): Promise<any[]> {
    const res = await listConversationMessages(brandId);
    return res.data || [];
  },
  async createConversationMessage(values: Partial<any>): Promise<any | null> {
    const res = await createConversationMessage(values);
    return res.data || null;
  },
};
