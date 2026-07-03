import type { Session, User } from "@supabase/supabase-js";
import {
  getCurrentSession,
  onAuthStateChange,
  sanitizeAuthError,
  signInWithEmail,
  signOut as authSignOut,
  signUpWithEmail,
} from "./authService";
import type { BrandRow, ProfileRow } from "./database.types";
import { ensureDefaultBrand } from "./repositories/brandRepository";
import { upsertProfile } from "./repositories/profileRepository";
import type { RepositoryResult } from "./repositories/repositoryTypes";
import { isSupabaseConfigured } from "./supabaseClient";
import type { Brand as SparkBrand } from "../domain/types";

export type AuthSessionState = {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  mode: "demo" | "authenticated";
  error: string | null;
};

export type AuthBootstrapResult = {
  profile: ProfileRow | null;
  brand: BrandRow | null;
  error: string | null;
};

export function isAuthRequired(): boolean {
  return import.meta.env.VITE_REQUIRE_AUTH === "true";
}

export function isAuthBackendReady(): boolean {
  return isSupabaseConfigured();
}

export function unavailableAuthMessage(): string {
  return "Spark account sign-in is not configured yet. The app is running in local demo mode.";
}

export async function restoreSession(): Promise<{ session: Session | null; error: string | null }> {
  if (!isAuthBackendReady()) {
    return { session: null, error: null };
  }

  const result = await getCurrentSession();
  return { session: result.data, error: result.error };
}

export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  if (!isAuthBackendReady()) {
    return { user: null, error: unavailableAuthMessage() };
  }

  const result = await signInWithEmail(email, password);
  return { user: result.data, error: result.error };
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  if (!isAuthBackendReady()) {
    return { user: null, error: unavailableAuthMessage() };
  }

  const result = await signUpWithEmail(email, password);
  return { user: result.data, error: result.error };
}

export async function signOut(): Promise<{ error: string | null }> {
  if (!isAuthBackendReady()) {
    return { error: null };
  }

  const result = await authSignOut();
  return { error: result.error };
}

export async function bootstrapUserSession(
  user: User | null,
  localBrand?: Partial<SparkBrand>,
): Promise<AuthBootstrapResult> {
  if (!user || !isAuthBackendReady()) {
    return { profile: null, brand: null, error: null };
  }

  try {
    const profile = await upsertProfile(user);
    if (profile.error || !profile.data) {
      return { profile: null, brand: null, error: profile.error };
    }

    const brand = await ensureDefaultBrand(profile.data.id, localBrand);
    return {
      profile: profile.data,
      brand: brand.data,
      error: brand.error,
    };
  } catch (error) {
    return { profile: null, brand: null, error: sanitizeAuthError(error) };
  }
}

export function subscribeToAuthState(
  callback: (session: Session | null) => void,
): () => void {
  if (!isAuthBackendReady()) {
    return () => {};
  }

  return onAuthStateChange((_event, session) => callback(session));
}

export function resultFromRepository<T>(result: RepositoryResult<T>): T | null {
  return result.error ? null : result.data;
}
