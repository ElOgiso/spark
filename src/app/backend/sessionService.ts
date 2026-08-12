import type { Session, User } from "@supabase/supabase-js";
import {
  getCurrentSession,
  onAuthStateChange,
  sanitizeAuthError,
  signInWithEmail,
  signInWithOAuth as authSignInWithOAuth,
  signOut as authSignOut,
  signUpWithEmail,
} from "./authService";
import type { BrandRow, ProfileRow } from "./database.types";
import { ensureDefaultBrand, listBrandsForOwner } from "./repositories/brandRepository";
import { upsertProfile, markProfileOnboardingComplete } from "./repositories/profileRepository";
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
  brands: BrandRow[];
  isOnboardingComplete: boolean;
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
    return { user: null, error: null };
  }

  const result = await signInWithEmail(email, password);
  return { user: result.data, error: result.error };
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  if (!isAuthBackendReady()) {
    return { user: null, error: null };
  }

  const result = await signUpWithEmail(email, password);
  return { user: result.data, error: result.error };
}

export async function signInWithOAuth(provider: "google" | "apple"): Promise<{ error: string | null }> {
  if (!isAuthBackendReady()) {
    return { error: null };
  }

  const result = await authSignInWithOAuth(provider);
  return { error: result.error };
}

export async function signOut(): Promise<{ error: string | null }> {
  if (!isAuthBackendReady()) {
    return { error: null };
  }

  const result = await authSignOut();
  return { error: result.error };
}

export async function sendPasswordResetEmail(email: string): Promise<{ error: string | null }> {
  if (!isAuthBackendReady()) {
    return { error: null };
  }
  const { resetPasswordForEmail } = await import("./authService");
  const result = await resetPasswordForEmail(email);
  return { error: result.error };
}

export async function resendVerification(email: string): Promise<{ error: string | null }> {
  if (!isAuthBackendReady()) {
    return { error: null };
  }
  const { resendVerificationEmail } = await import("./authService");
  const result = await resendVerificationEmail(email);
  return { error: result.error };
}

/**
 * Cloud-First User Bootstrap:
 * 1) Load / upsert profile by auth user id
 * 2) Load brands where owner_id = user.id
 * 3) isOnboardingComplete =
 *      profile.onboarding_complete === true
 *      OR (brands.length > 0 AND brand has real genesis data)
 * 4) If returning user has existing brands but flag is false, automatically repair profile flag.
 */
export async function bootstrapUserSession(
  user: User | null,
  localBrand?: Partial<SparkBrand>,
): Promise<AuthBootstrapResult> {
  if (!user || !isAuthBackendReady()) {
    return { profile: null, brand: null, brands: [], isOnboardingComplete: false, error: null };
  }

  try {
    const profileRes = await upsertProfile(user);
    if (profileRes.error || !profileRes.data) {
      return { profile: null, brand: null, brands: [], isOnboardingComplete: false, error: profileRes.error };
    }
    const profile = profileRes.data;

    // Query all brands owned by this user
    const brandsRes = await listBrandsForOwner(user.id);
    const brands = brandsRes.data || [];

    let activeBrand: BrandRow | null = null;
    if (profile.active_brand_id) {
      activeBrand = brands.find((b) => b.id === profile.active_brand_id) || null;
    }
    if (!activeBrand && brands.length > 0) {
      activeBrand = brands[0];
    }

    // Determine onboarding completeness from CLOUD source of truth
    const hasCloudBrand = Boolean(activeBrand?.id);
    const cloudFlag = profile.onboarding_complete === true;
    const isComplete = cloudFlag || (hasCloudBrand && brands.length > 0);

    // Returning user auto-repair: if brands exist in DB but flag was not set, update cloud profile
    if (hasCloudBrand && !cloudFlag) {
      void markProfileOnboardingComplete(user.id, activeBrand?.id);
    }

    return {
      profile,
      brand: activeBrand,
      brands,
      isOnboardingComplete: isComplete,
      error: null,
    };
  } catch (error) {
    return { profile: null, brand: null, brands: [], isOnboardingComplete: false, error: sanitizeAuthError(error) };
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
