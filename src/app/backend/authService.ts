import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

type AuthResult<T> = {
  data: T | null;
  error: string | null;
};

function unavailable<T>(): AuthResult<T> {
  return { data: null, error: "Supabase is not configured." };
}

function safeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Authentication is unavailable right now.";
}

export async function getCurrentUser(): Promise<AuthResult<User>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<User>();

  const { data, error } = await supabase.auth.getUser();
  return { data: data.user, error: error ? safeError(error) : null };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult<User>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<User>();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data: data.user, error: error ? safeError(error) : null };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult<User>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<User>();

  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data: data.user, error: error ? safeError(error) : null };
}

export async function signOut(): Promise<AuthResult<true>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<true>();

  const { error } = await supabase.auth.signOut();
  return { data: error ? null : true, error: error ? safeError(error) : null };
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
