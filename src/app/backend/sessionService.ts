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

export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null; needsEmailConfirmation?: boolean }> {
  if (!isAuthBackendReady()) {
    return { user: null, error: null };
  }

  const result = await signUpWithEmail(email, password);
  return { user: result.data, error: result.error, needsEmailConfirmation: result.needsEmailConfirmation };
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

  const runBootstrap = async (): Promise<AuthBootstrapResult> => {
    try {
      // 1) Query all brands owned by this user FIRST
      const brandsRes = await listBrandsForOwner(user.id);
      const brands = brandsRes.data || [];

      // 2) Upsert profile in Supabase
      const profileRes = await upsertProfile(user);
      let profile = profileRes.data || {
        id: user.id,
        email: user.email || "creator@spark.ai",
        display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Creator",
        full_name: user.user_metadata?.full_name || "Creator",
        role: "Director",
        avatar_url: null,
        onboarding_complete: brands.length > 0,
        active_brand_id: brands[0]?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 3) Resolve active brand based on profile pointer or first brand
      let activeBrand: BrandRow | null = null;
      if (profile.active_brand_id) {
        activeBrand = brands.find((b) => b.id === profile.active_brand_id) || null;
      }
      if (!activeBrand && brands.length > 0) {
        activeBrand = brands[0];
      }

      // 4) Determine onboarding completeness from CLOUD source of truth:
      // Profile flag is true OR user has at least one configured brand in Supabase
      let isComplete = profile.onboarding_complete === true || (brands.length > 0 && Boolean(activeBrand));

      // 5) Cloud auto-repair: if user already has an existing brand in Supabase but profile flag is false -> REPAIR flag in Supabase!
      if (brands.length > 0 && activeBrand && !profile.onboarding_complete) {
        profile.onboarding_complete = true;
        isComplete = true;
        void markProfileOnboardingComplete(user.id, activeBrand.id);
      }

      // 6) Ensure profile.active_brand_id in Supabase points to the active brand
      if (activeBrand?.id && profile.active_brand_id !== activeBrand.id) {
        const setBrandRes = await setActiveBrand(user.id, activeBrand.id);
        if (setBrandRes.data) {
          profile = setBrandRes.data;
        }
      }

      if (isComplete) {
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("spark_onboarding_complete", "true");
          }
        } catch {}
      }

      return {
        profile,
        brand: activeBrand,
        brands,
        isOnboardingComplete: isComplete,
        error: null,
      };
    } catch (error) {
      console.warn("[SPARK AUTH] bootstrap exception, attempting recovery query:", error);

      let retryBrands: BrandRow[] = [];
      let retryActiveBrand: BrandRow | null = null;
      let isComplete = false;

      try {
        const bRes = await listBrandsForOwner(user.id);
        if (bRes.data && bRes.data.length > 0) {
          retryBrands = bRes.data;
          retryActiveBrand = bRes.data[0];
          isComplete = true;
        }
      } catch {}

      if (!isComplete) {
        try {
          if (typeof localStorage !== "undefined" && localStorage.getItem("spark_onboarding_complete") === "true") {
            isComplete = true;
          }
        } catch {}
      }

      return {
        profile: {
          id: user.id,
          email: user.email || "creator@spark.ai",
          display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Creator",
          full_name: user.user_metadata?.full_name || "Creator",
          role: "Director",
          avatar_url: null,
          onboarding_complete: isComplete,
          active_brand_id: retryActiveBrand?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        brand: retryActiveBrand,
        brands: retryBrands,
        isOnboardingComplete: isComplete,
        error: sanitizeAuthError(error),
      };
    }
  };

  return runBootstrap();
}

export function subscribeToAuthState(
  callback: (event: any, session: Session | null) => void,
): () => void {
  if (!isAuthBackendReady()) {
    return () => {};
  }

  return onAuthStateChange((event, session) => callback(event, session));
}

export function resultFromRepository<T>(result: RepositoryResult<T>): T | null {
  return result.error ? null : result.data;
}
