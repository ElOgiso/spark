import { loadPersistedState } from "../state/persistence";
import { isSupabaseConfigured } from "./supabaseClient";

export type SyncStatus = {
  enabled: boolean;
  source: "supabase" | "local";
  message: string;
};

export function getSyncStatus(): SyncStatus {
  if (!isSupabaseConfigured()) {
    return {
      enabled: false,
      source: "local",
      message: "Supabase is not configured. Spark is using local mock persistence.",
    };
  }

  return {
    enabled: true,
    source: "supabase",
    message: "Supabase is configured. Auth-gated sync can be enabled in a later phase.",
  };
}

export async function prepareLocalBrandForBackend(): Promise<SyncStatus & { hasLocalState: boolean }> {
  const status = getSyncStatus();
  const localState = loadPersistedState<unknown>();

  return {
    ...status,
    hasLocalState: Boolean(localState),
  };
}

export async function readBackendWhenAvailable<T>(
  loader: () => Promise<T | null>,
  fallback: T,
): Promise<T> {
  if (!isSupabaseConfigured()) {
    return fallback;
  }

  try {
    return (await loader()) ?? fallback;
  } catch {
    return fallback;
  }
}
