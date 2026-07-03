import { loadPersistedState } from "../state/persistence";
import type { User } from "@supabase/supabase-js";
import type { Brand } from "../domain/types";
import { bootstrapUserSession } from "./sessionService";
import { listBrands, ensureDefaultBrand } from "./repositories/brandRepository";
import { listMemoryItems } from "./repositories/memoryRepository";
import { listNotifications } from "./repositories/notificationRepository";
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

export function getBackendStatus(): SyncStatus & { configured: boolean } {
  const status = getSyncStatus();
  return {
    ...status,
    configured: isSupabaseConfigured(),
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

export async function bootstrapAuthenticatedUser(
  user: User | null,
  localBrand?: Partial<Brand>,
) {
  if (!isSupabaseConfigured() || !user) {
    return { profile: null, brand: null, error: null };
  }

  return bootstrapUserSession(user, localBrand);
}

export async function syncBrandFromLocal(user: User | null, localBrand?: Partial<Brand>) {
  if (!isSupabaseConfigured() || !user) {
    return { data: null, error: null, source: "unconfigured" as const };
  }

  return ensureDefaultBrand(user.id, localBrand);
}

export async function loadUserBrand() {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null, source: "unconfigured" as const };
  }

  const brands = await listBrands();
  return {
    ...brands,
    data: brands.data?.[0] ?? null,
  };
}

export async function loadUserMemory(brandId: string | null) {
  if (!isSupabaseConfigured() || !brandId) {
    return { data: null, error: null, source: "unconfigured" as const };
  }

  return listMemoryItems(brandId);
}

export async function loadUserNotifications(userId: string | null) {
  if (!isSupabaseConfigured() || !userId) {
    return { data: null, error: null, source: "unconfigured" as const };
  }

  return listNotifications(userId);
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
