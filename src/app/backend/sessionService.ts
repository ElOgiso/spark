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
import { upsertProfile, markProfileOnboardingComplete, setActiveBrand } from "./repositories/profileRepository";
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
 * Bootstrap an authenticated user session:
 * 1) Upsert profile in Supabase
 * 2) Ensure user owns at least one default Brand with a valid UUID
 * 3) Query all owned brands and resolve active brand
 * 4) Sync profile.active_brand_id
 * 5) Cloud is single source of truth for onboarding_complete
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
    let profile = profileRes.data;

    // 1) Ensure user has a default brand if none exists yet
    const defaultBrandRes = await ensureDefaultBrand(user.id, localBrand);
    let activeBrand: BrandRow | null = defaultBrandRes.data || null;

    // 2) Query all brands owned by this user
    const brandsRes = await listBrandsForOwner(user.id);
    let brands = brandsRes.data || [];
    if (brands.length === 0 && activeBrand) {
      brands = [activeBrand];
    }

    // 3) Resolve active brand based on profile pointer or first brand
    if (profile.active_brand_id) {
      const matched = brands.find((b) => b.id === profile.active_brand_id);
      if (matched) {
        activeBrand = matched;
      }
    }
    if (!activeBrand && brands.length > 0) {
      activeBrand = brands[0];
    }

    // 4) Ensure profile.active_brand_id in Supabase points to the active brand
    if (activeBrand?.id && profile.active_brand_id !== activeBrand.id) {
      const setBrandRes = await setActiveBrand(user.id, activeBrand.id);
      if (setBrandRes.data) {
        profile = setBrandRes.data;
      }
    }

    // Determine onboarding completeness from CLOUD source of truth
    const isComplete = profile.onboarding_complete === true;

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
