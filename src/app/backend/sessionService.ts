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
import { ensureDefaultBrand, listBrandsForOwner, createDraftBrand } from "./repositories/brandRepository";
import { upsertProfile, markProfileOnboardingComplete, setActiveBrand } from "./repositories/profileRepository";
import { setActiveSessionBrand, setUserKnownBrands } from "../services/socialIntegrationService";
import type { RepositoryResult } from "./repositories/repositoryTypes";
import { isSupabaseConfigured, getSupabaseClient } from "./supabaseClient";
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

export async function signInWithOAuth(provider: "google" | "apple", customRedirectTo?: string): Promise<{ error: string | null }> {
  if (!isAuthBackendReady()) {
    return { error: null };
  }

  const result = await authSignInWithOAuth(provider, customRedirectTo);
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
 * 1) Query all brands owned by user (surface error, never treat error as zero brands)
 * 2) Upsert profile in Supabase
 * 3) If data.length > 0: NEVER createDraftBrand; resolve activeBrand from existing brands
 * 4) If true first-time user (data is [] with NO error): createDraftBrand once
 * 5) Heal and persist onboarding_complete when user owns configured brand or assets
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
      if (brandsRes.error) {
        console.warn("[sessionService] listBrandsForOwner query failed:", brandsRes.error);
        const profileRes = await upsertProfile(user);
        return {
          error: brandsRes.error,
          profile: profileRes.data || null,
          brand: null,
          brands: [],
          isOnboardingComplete: false,
        };
      }

      let brands = brandsRes.data || [];

      // 2) Upsert profile in Supabase
      const profileRes = await upsertProfile(user);
      let profile = profileRes.data || {
        id: user.id,
        email: user.email || "creator@spark.ai",
        display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Creator",
        full_name: user.user_metadata?.full_name || "Creator",
        role: "Director",
        avatar_url: null,
        onboarding_complete: false,
        active_brand_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 3) Resolve activeBrand:
      // If data is [] with NO error: true first-time user -> createDraftBrand once.
      // If data.length > 0: NEVER createDraftBrand. Resolve from existing brands.
      let activeBrand: BrandRow | null = null;
      if (brands.length === 0) {
        const draftRes = await createDraftBrand(user.id, {
          name: localBrand?.name || "Draft Brand",
          niche: localBrand?.niche || null,
        });
        if (draftRes.error || !draftRes.data) {
          return {
            profile,
            brand: null,
            brands: [],
            isOnboardingComplete: false,
            error: draftRes.error || "Failed to initialize workspace",
          };
        }
        brands = [draftRes.data];
        activeBrand = draftRes.data;
      } else {
        if (profile.active_brand_id) {
          activeBrand = brands.find((b) => b.id === profile.active_brand_id) || null;
        }
        if (!activeBrand) {
          activeBrand = brands[0];
        }
      }

      if (!activeBrand?.id) {
        return {
          profile,
          brand: null,
          brands,
          isOnboardingComplete: false,
          error: "Failed to resolve active workspace brand",
        };
      }

      // 4) Anchor active session brand & user immediately after brand row exists in Supabase
      setActiveSessionBrand(activeBrand.id, user.id);
      setUserKnownBrands(brands.map((b) => b.id));
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("spark_current_brand_id", activeBrand.id);
          localStorage.setItem("spark_current_user_id", user.id);
          if (activeBrand.name) {
            localStorage.setItem("spark_current_brand_name", activeBrand.name);
          }
        }
      } catch {}

      // 5) Ensure profiles.active_brand_id in Supabase points to the active brand
      if (profile.active_brand_id !== activeBrand.id) {
        const setBrandRes = await setActiveBrand(user.id, activeBrand.id);
        if (setBrandRes.data) {
          profile = setBrandRes.data;
        } else {
          profile.active_brand_id = activeBrand.id;
        }
      }

      // 6) Determine onboarding completeness (heal, then persist):
      // isComplete = profile.onboarding_complete === true OR any owned brand exists that is not a first-session empty draft.
      // Treat as configured (complete) if ANY of:
      // - profile.onboarding_complete === true
      // - brand.name is not "Draft Brand" AND not "My Brand" with is_draft
      // - brand has niche / purpose / non-empty audience beyond { settings: { is_draft: true } }
      // - user owns characters, accounts, productions, or research_sources on ANY of their brand ids
      let isComplete = profile.onboarding_complete === true;

      const isBrandConfigured = (b: BrandRow): boolean => {
        if (!b) return false;
        const isDraftFlag =
          (b.audience as any)?.settings?.is_draft === true ||
          (b.settings as any)?.is_draft === true;
        if (b.name && b.name !== "Draft Brand" && !(b.name === "My Brand" && isDraftFlag)) {
          return true;
        }
        if (b.niche || b.purpose) return true;
        const aud = b.audience as any;
        if (
          aud &&
          (aud.primary ||
            (Array.isArray(aud.painPoints) && aud.painPoints.length > 0) ||
            (Array.isArray(aud.desires) && aud.desires.length > 0))
        ) {
          return true;
        }
        return false;
      };

      if (!isComplete && brands.length > 0) {
        const configuredBrand = brands.find(isBrandConfigured);
        if (configuredBrand) {
          isComplete = true;
        } else {
          // Check if user owns characters, accounts, productions, or research_sources on ANY of their brand ids
          const brandIds = brands.map((b) => b.id).filter(Boolean);
          const supabase = getSupabaseClient();
          if (supabase && brandIds.length > 0) {
            try {
              const [accCheck, charCheck, prodCheck, resCheck] = await Promise.all([
                supabase.from("accounts").select("id").in("brand_id", brandIds).limit(1),
                supabase.from("characters").select("id").in("brand_id", brandIds).limit(1),
                supabase.from("productions").select("id").in("brand_id", brandIds).limit(1),
                supabase.from("research_sources").select("id").in("brand_id", brandIds).limit(1),
              ]);
              if (
                (accCheck.data && accCheck.data.length > 0) ||
                (charCheck.data && charCheck.data.length > 0) ||
                (prodCheck.data && prodCheck.data.length > 0) ||
                (resCheck.data && resCheck.data.length > 0)
              ) {
                isComplete = true;
              }
            } catch {
              // ignore check failure
            }
          }
        }
      }

      // If complete and profile.onboarding_complete !== true, heal and persist
      if (isComplete) {
        if (!profile.onboarding_complete || !profile.active_brand_id) {
          profile.onboarding_complete = true;
          if (!profile.active_brand_id && activeBrand?.id) {
            profile.active_brand_id = activeBrand.id;
          }
          if (activeBrand?.id) {
            void markProfileOnboardingComplete(user.id, activeBrand.id, "active");
          }
        }
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
      console.warn("[SPARK AUTH] bootstrap exception:", error);
      return {
        profile: null,
        brand: null,
        brands: [],
        isOnboardingComplete: false,
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
