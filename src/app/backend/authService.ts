import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

type AuthResult<T> = {
  data: T | null;
  error: string | null;
};

function unavailable<T>(): AuthResult<T> {
  return { data: null, error: "Supabase is not configured." };
}

export function sanitizeAuthError(error: unknown): string {
  if (!error) return "Authentication is unavailable right now.";
  if (typeof error === "string" && error.trim()) return error.trim();
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      // Surface real Auth errors so production smoke tests can be verified
      return message.trim();
    }
  }
  return "Authentication is unavailable right now.";
}

export async function getCurrentSession(): Promise<AuthResult<Session>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<Session>();

  const { data, error } = await supabase.auth.getSession();
  return { data: data.session, error: error ? sanitizeAuthError(error) : null };
}

export async function getCurrentUser(): Promise<AuthResult<User>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<User>();

  const { data, error } = await supabase.auth.getUser();
  return { data: data.user, error: error ? sanitizeAuthError(error) : null };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult<User>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<User>();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data: data.user, error: error ? sanitizeAuthError(error) : null };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult<User>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<User>();

  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data: data.user, error: error ? sanitizeAuthError(error) : null };
}

export async function signOut(): Promise<AuthResult<true>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<true>();

  const { error } = await supabase.auth.signOut();
  return { data: error ? null : true, error: error ? sanitizeAuthError(error) : null };
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
