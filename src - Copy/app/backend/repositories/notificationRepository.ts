import type { NotificationPreferenceRow, NotificationRow } from "../database.types";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import { updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";

export async function listNotifications(userId: string): Promise<RepositoryResult<NotificationRow[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<NotificationRow[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<NotificationRow[]>();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return repositoryError<NotificationRow[]>();
  return { data: data ?? [], error: null, source: "supabase" };
}

export async function markNotificationRead(id: string): Promise<RepositoryResult<NotificationRow>> {
  return updateRow("notifications", id, { read: true });
}

export async function getNotificationPreferences(
  userId: string,
): Promise<RepositoryResult<NotificationPreferenceRow | null>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<NotificationPreferenceRow | null>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<NotificationPreferenceRow | null>();

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return repositoryError<NotificationPreferenceRow | null>();
  return { data, error: null, source: "supabase" };
}

export async function updateNotificationPreferences(
  id: string,
  values: Partial<NotificationPreferenceRow>,
): Promise<RepositoryResult<NotificationPreferenceRow>> {
  return updateRow("notification_preferences", id, values);
}
