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
  const rawMsg = typeof error === "string" ? error.trim() : typeof error === "object" && error !== null ? String((error as any).message || "") : "";
  if (rawMsg.includes("provider is not enabled") || rawMsg.includes("Unsupported provider")) {
    return "Google OAuth is disabled in your Supabase project. Please enable Google Provider in Supabase Dashboard (Authentication -> Providers) with your Google Client ID and Secret.";
  }
  if (rawMsg) return rawMsg;
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

export async function signInWithOAuth(provider: "google" | "apple"): Promise<AuthResult<true>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<true>();

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  return { data: error ? null : true, error: error ? sanitizeAuthError(error) : null };
}

export async function signOut(): Promise<AuthResult<true>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<true>();

  const { error } = await supabase.auth.signOut();
  return { data: error ? null : true, error: error ? sanitizeAuthError(error) : null };
}

export async function resetPasswordForEmail(email: string): Promise<AuthResult<true>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<true>();

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { data: error ? null : true, error: error ? sanitizeAuthError(error) : null };
}

export async function resendVerificationEmail(email: string): Promise<AuthResult<true>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable<true>();

  const { error } = await supabase.auth.resend({ type: "signup", email });
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
