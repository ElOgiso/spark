import type { ConversationMessageRow } from "../database.types";
import { insertRow, listByBrand } from "./repositoryUtils";
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
    .from("conversation_messages")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });

  if (error) return repositoryError<ConversationMessageRow[]>(error.message);
  return { data: (data ?? []) as ConversationMessageRow[], error: null, source: "supabase" };
}

export async function createConversationMessage(
  values: Partial<ConversationMessageRow>,
): Promise<RepositoryResult<ConversationMessageRow>> {
  return insertRow("conversation_messages", values);
}

export async function batchCreateConversationMessages(
  messages: Partial<ConversationMessageRow>[],
): Promise<RepositoryResult<ConversationMessageRow[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ConversationMessageRow[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ConversationMessageRow[]>();

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert(messages)
    .select("*");

  if (error) return repositoryError<ConversationMessageRow[]>(error.message);
  return { data: (data ?? []) as ConversationMessageRow[], error: null, source: "supabase" };
}
