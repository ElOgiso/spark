import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const DEFAULT_SUPABASE_URL = "https://jaqzjhabmtvqtvinoafq.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vMsNKA4Icb2BD9SzgBTz4A_DTmSnwWb";

const env: Record<string, any> = (typeof import.meta !== "undefined" && (import.meta as any).env) ? (import.meta as any).env : (typeof process !== "undefined" && process.env ? process.env : {});

const supabaseUrl = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
const useSupabase = env.VITE_USE_SUPABASE !== "false";

let client: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(useSupabase && supabaseUrl && supabasePublishableKey);
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    console.log("[SPARK AUTH] Supabase initialization started");
    client = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}

export const supabase = getSupabaseClient();
