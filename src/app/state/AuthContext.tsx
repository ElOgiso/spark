import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  bootstrapUserSession,
  isAuthBackendReady,
  isAuthRequired,
  restoreSession,
  signIn as sessionSignIn,
  signInWithOAuth as sessionSignInWithOAuth,
  signOut as sessionSignOut,
  signUp as sessionSignUp,
  subscribeToAuthState,
} from "../backend/sessionService";
import { markProfileOnboardingComplete } from "../backend/repositories/profileRepository";
import type { BrandRow, ProfileRow } from "../backend/database.types";
import { getBrandWorkspaceId } from "../services/socialIntegrationService";

type AuthContextValue = {
  currentUser: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  brand: BrandRow | null;
  brands: BrandRow[];
  loading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  requireAuth: boolean;
  mode: "demo" | "authenticated";
  error: string | null;
  isOnboardingComplete: boolean;
  createWorkspaceModalOpen: boolean;
  openCreateWorkspaceModal: () => void;
  closeCreateWorkspaceModal: () => void;
  switchBrand: (brandId: string) => Promise<void>;
  deleteWorkspace: (brandId: string) => Promise<boolean>;
  refreshBrands: () => Promise<BrandRow[]>;
  setBrand: React.Dispatch<React.SetStateAction<BrandRow | null>>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: string | null }>;
  markOnboardingComplete: (activeBrandId?: string) => Promise<void>;
  updateProfile: (displayName: string, email?: string) => void;
  refreshSession: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function getStoredDemoUser(): User | null {
  try {
    const stored = localStorage.getItem("spark_demo_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoUser, setDemoUser] = useState<User | null>(() => getStoredDemoUser());

  // Cloud bootstrap is the single source of truth for onboarding completeness, backed by local cache
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(() => {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem("spark_onboarding_complete") === "true";
      }
    } catch {}
    return false;
  });

  const isConfigured = isAuthBackendReady();
  const requireAuth = isAuthRequired();

  // Synchronously evaluate active user from session, demoUser state, or localStorage
  const currentUser = useMemo(() => {
    if (session?.user) return session.user;
    if (!isConfigured) return demoUser ?? getStoredDemoUser();
    return null;
  }, [session, demoUser, isConfigured]);

  const isAuthenticated = Boolean(currentUser);

  const inFlightBootstrapRef = React.useRef<Promise<any> | null>(null);

  const bootstrap = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      console.log("[SPARK AUTH] bootstrap: no session user in cloud");
      // DO NOT wipe local onboarding state or brand cache on cold start / background session probe!
      // Only explicit signOut should clear stored onboarding state.
      setSession(null);
      setProfile(null);
      setBrand(null);
      setLoading(false);
      return null;
    }

    if (inFlightBootstrapRef.current) {
      return inFlightBootstrapRef.current;
    }

    const task = (async () => {
      console.log("[SPARK AUTH] session exists: true");
      console.log("[SPARK AUTH] user id:", nextSession.user.id);
      setSession(nextSession);

      try {
        console.log("[SPARK AUTH] profile bootstrap starting for user:", nextSession.user.id);
        const result = await bootstrapUserSession(nextSession.user);
        const profileLoaded = Boolean(result.profile);
        const isComplete = Boolean(result.isOnboardingComplete);

        console.log("[SPARK AUTH] profile loaded:", profileLoaded);
        console.log("[SPARK AUTH] onboarding_complete:", isComplete);

        setProfile(result.profile);
        setBrand(result.brand);
        setBrands(result.brands || []);
        if (result.brand?.id) {
          try {
            localStorage.setItem("spark_current_brand_id", result.brand.id);
            localStorage.setItem("spark_current_brand_name", result.brand.name || "");
          } catch {
            /* ignore */
          }
        }
        setError(result.error);
        setIsOnboardingComplete(isComplete);
        try {
          if (typeof localStorage !== "undefined") {
            if (isComplete) {
              localStorage.setItem("spark_onboarding_complete", "true");
            } else {
              localStorage.removeItem("spark_onboarding_complete");
            }
          }
        } catch {}

        return result;
      } catch (err: any) {
        console.warn("[SPARK AUTH] bootstrap error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    })();

    inFlightBootstrapRef.current = task;
    try {
      return await task;
    } finally {
      inFlightBootstrapRef.current = null;
    }
  }, []);

  const handleDemoSignIn = useCallback((email: string, fullName?: string, isNewUser: boolean = false) => {
    const name = fullName || email.split("@")[0] || "Creator";
    const demo: User = {
      id: `demo-${Date.now()}`,
      email: email,
      app_metadata: { provider: "email" },
      user_metadata: { full_name: name, display_name: name },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    localStorage.setItem("spark_demo_user", JSON.stringify(demo));
    setDemoUser(demo);
    if (!isNewUser) {
      setIsOnboardingComplete(true);
      try {
        localStorage.setItem("spark_onboarding_complete", "true");
      } catch {}
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log("[SPARK AUTH] refreshSession: restoring session from Supabase client storage");
      const result = await restoreSession();
      if (result.session) {
        console.log("[SPARK AUTH] session exists: true");
        console.log("[SPARK AUTH] user id:", result.session.user?.id);
        await bootstrap(result.session);
      } else {
        console.log("[SPARK AUTH] session exists: false (no stored session found)");
        // Only clear if onAuthStateChange hasn't already received a session
        setSession((prev) => {
          if (prev) return prev;
          setProfile(null);
          setBrand(null);
          return null;
        });
      }
    } catch (err) {
      console.warn("[SPARK AUTH] Session restore notice:", err);
    } finally {
      setLoading(false);
    }
  }, [bootstrap, isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return () => {};
    }

    // Check for incoming OAuth redirect hash/query
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (hash.includes("access_token") || search.includes("code=")) {
        console.log("[SPARK AUTH] OAuth redirect detected");
        setLoading(true);
      }
    }

    console.log("[SPARK AUTH] Subscribing to Supabase auth state changes");
    const unsubscribe = subscribeToAuthState((event, nextSession) => {
      console.log(`[SPARK AUTH] ${event}`);
      console.log("[SPARK AUTH] session exists:", Boolean(nextSession));
      if (nextSession?.user?.id) {
        console.log("[SPARK AUTH] user id:", nextSession.user.id);
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setBrand(null);
        setIsOnboardingComplete(false);
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem("spark_onboarding_complete");
          }
        } catch {}
        void import("./persistence").then(({ clearPersistedState }) => clearPersistedState());
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("spark-workspace-reset"));
        }
        setLoading(false);
        return;
      }

      if (!nextSession) {
        // Initial probe had no session yet; keep loading until restoreSession finishes
        return;
      }

      // Immediately set the session in state so user is immediately authenticated
      setSession(nextSession);

      // Trigger cloud bootstrap asynchronously
      void bootstrap(nextSession).finally(() => {
        // Clean up hash from URL cleanly without page reload once session is consumed
        if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
          try {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          } catch {}
        }
        setLoading(false);
      });
    });

    // Initial session restore on mount
    void refreshSession();

    return () => {
      unsubscribe();
    };
  }, [bootstrap, isConfigured, refreshSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    console.log("[SPARK AUTH] sign-in started for:", email);
    const targetEmail = email.trim() || "creator@spark.ai";
    if (!isConfigured) {
      handleDemoSignIn(targetEmail, undefined, false);
      setLoading(false);
      return;
    }
    try {
      const result = await sessionSignIn(targetEmail, password);
      console.log("[SPARK AUTH] sign-in result:", result.user ? "success" : "failed", result.error || "");
      if (result.error) {
        setError(result.error);
        throw new Error(result.error);
      }
      if (result.user) {
        const restoreRes = await restoreSession();
        if (restoreRes.session) {
          await bootstrap(restoreRes.session);
        }
      }
    } catch (err: any) {
      console.warn("[SPARK AUTH] signIn error:", err);
      setError(err?.message || "Sign in failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleDemoSignIn, isConfigured, bootstrap]);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    console.log("[SPARK AUTH] sign-up started for:", email);
    const targetEmail = email.trim() || "creator@spark.ai";
    if (!isConfigured) {
      handleDemoSignIn(targetEmail, undefined, true);
      setLoading(false);
      return;
    }
    try {
      const result = await sessionSignUp(targetEmail, password);
      console.log("[SPARK AUTH] sign-up result:", result.user ? "success" : "failed", result.error || "");
      if (result.error) {
        setError(result.error);
        throw new Error(result.error);
      }
      if (result.user) {
        const restoreRes = await restoreSession();
        if (restoreRes.session) {
          await bootstrap(restoreRes.session);
        }
      }
    } catch (err: any) {
      console.warn("[SPARK AUTH] signUp error:", err);
      setError(err?.message || "Sign up failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleDemoSignIn, isConfigured, bootstrap]);

  const signInWithOAuth = useCallback(async (provider: "google" | "apple") => {
    setError(null);
    setLoading(true);
    console.log("[SPARK AUTH] signInWithOAuth started for provider:", provider);
    if (!isConfigured) {
      handleDemoSignIn(`creator_${provider}@spark.ai`, `${provider.toUpperCase()} Creator`, false);
      setLoading(false);
      return;
    }
    try {
      const result = await sessionSignInWithOAuth(provider);
      if (result.error) {
        setError(result.error);
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.warn("[SPARK AUTH] OAuth error:", err);
      setError(err?.message || "OAuth sign in failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleDemoSignIn, isConfigured]);

  const signOut = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (isConfigured) {
        await sessionSignOut();
      }
      const { clearAllStoredAccountTokens } = await import("../services/socialIntegrationService");
      clearAllStoredAccountTokens();
      const { clearPersistedState } = await import("./persistence");
      clearPersistedState();
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.removeItem("spark_current_brand_id");
          localStorage.removeItem("spark_current_brand_name");
          localStorage.removeItem("spark_onboarding_complete");
          localStorage.removeItem("spark_demo_user");
        } catch {}
      }
      if (typeof sessionStorage !== "undefined") {
        try {
          sessionStorage.removeItem("spark_splash_played");
        } catch {}
      }
      setDemoUser(null);
      setSession(null);
      setProfile(null);
      setBrand(null);
      setBrands([]);
      setCreateWorkspaceModalOpen(false);
      setIsOnboardingComplete(false);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("spark-workspace-reset"));
      }
    } catch (err) {
      console.warn("[Spark Auth] signOut notice:", err);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  const sendReset = useCallback(async (email: string) => {
    const { sendPasswordResetEmail } = await import("../backend/sessionService");
    return sendPasswordResetEmail(email);
  }, []);

  const sendResendVerification = useCallback(async (email: string) => {
    const { resendVerification } = await import("../backend/sessionService");
    return resendVerification(email);
  }, []);

  const switchBrand = useCallback(async (brandId: string) => {
    if (!brandId) return;
    setLoading(true);
    try {
      let targetBrand = brands.find((b) => b.id === brandId);
      if (!targetBrand && isConfigured && currentUser?.id) {
        const { listBrandsForOwner } = await import("../backend/repositories/brandRepository");
        const bRes = await listBrandsForOwner(currentUser.id);
        if (bRes.data) {
          setBrands(bRes.data);
          targetBrand = bRes.data.find((b) => b.id === brandId);
        }
      }

      if (targetBrand) {
        setBrand(targetBrand);
        try {
          localStorage.setItem("spark_current_brand_id", targetBrand.id);
          localStorage.setItem("spark_current_brand_name", targetBrand.name || "");
        } catch {}
      }

      if (currentUser?.id && isConfigured) {
        const { setActiveBrand } = await import("../backend/repositories/profileRepository");
        const res = await setActiveBrand(currentUser.id, brandId);
        if (res.data) {
          setProfile(res.data);
        }
      }

      // Hard reset in-memory state so previous workspace data is completely unloaded before new hydrate
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("spark-workspace-reset"));
      }
    } catch (err) {
      console.warn("[SPARK AUTH] switchBrand error:", err);
    } finally {
      setLoading(false);
    }
  }, [brands, currentUser, isConfigured]);

  const refreshBrands = useCallback(async (): Promise<BrandRow[]> => {
    if (!currentUser?.id || !isConfigured) return brands;
    try {
      const { listBrandsForOwner } = await import("../backend/repositories/brandRepository");
      const res = await listBrandsForOwner(currentUser.id);
      if (res.data) {
        setBrands(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn("[SPARK AUTH] refreshBrands error:", err);
    }
    return brands;
  }, [currentUser, isConfigured, brands]);

  const openCreateWorkspaceModal = useCallback(() => {
    setCreateWorkspaceModalOpen(true);
  }, []);

  const closeCreateWorkspaceModal = useCallback(() => {
    setCreateWorkspaceModalOpen(false);
  }, []);

  const deleteWorkspace = useCallback(async (brandId: string): Promise<boolean> => {
    if (!brandId) return false;
    setLoading(true);
    try {
      const { deleteWorkspace: performDelete } = await import("../backend/workspaceSync");
      const success = await performDelete(brandId, currentUser?.id);

      const remainingBrands = brands.filter((b) => b.id !== brandId);
      setBrands(remainingBrands);

      if (brand?.id === brandId) {
        if (remainingBrands.length > 0) {
          await switchBrand(remainingBrands[0].id);
        } else {
          setBrand(null);
          try {
            localStorage.removeItem("spark_current_brand_id");
            localStorage.removeItem("spark_current_brand_name");
          } catch {}
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("spark-workspace-reset"));
          }
          openCreateWorkspaceModal();
        }
      }
      return success;
    } catch (err) {
      console.warn("[SPARK AUTH] deleteWorkspace error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [brand, brands, currentUser, switchBrand, openCreateWorkspaceModal]);

  const markOnboardingComplete = useCallback(async (activeBrandId?: string) => {
    const targetUserId = currentUser?.id || session?.user?.id;
    const targetBrandId = activeBrandId || brand?.id || getBrandWorkspaceId() || undefined;

    if (targetUserId && isConfigured) {
      try {
        const res = await markProfileOnboardingComplete(targetUserId, targetBrandId);
        if (res.data) {
          setProfile(res.data);
        }
      } catch (err) {
        console.warn("[Spark Auth] markProfileOnboardingComplete notice:", err);
      }
    }

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("spark_onboarding_complete", "true");
      }
    } catch {}

    setIsOnboardingComplete(true);
  }, [currentUser, session, isConfigured, brand]);

  const updateProfile = useCallback((displayName: string, email?: string) => {
    const targetEmail = email || currentUser?.email || "creator@spark.ai";
    setProfile((prev) => ({
      id: prev?.id || currentUser?.id || `user-${Date.now()}`,
      display_name: displayName,
      full_name: displayName,
      role: prev?.role || "Director",
      avatar_url: prev?.avatar_url || null,
      email: targetEmail,
      active_brand_id: prev?.active_brand_id || brand?.id || null,
      onboarding_complete: prev?.onboarding_complete ?? true,
      created_at: prev?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        email: targetEmail,
        user_metadata: {
          ...currentUser.user_metadata,
          full_name: displayName,
          display_name: displayName
        }
      };
      localStorage.setItem("spark_demo_user", JSON.stringify(updatedUser));
      setDemoUser(updatedUser);
    }
  }, [currentUser, brand]);

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    session,
    profile,
    brand,
    brands,
    loading,
    isAuthenticated,
    isConfigured,
    requireAuth,
    mode: currentUser ? "authenticated" : "demo",
    error: error ?? null,
    isOnboardingComplete,
    createWorkspaceModalOpen,
    openCreateWorkspaceModal,
    closeCreateWorkspaceModal,
    switchBrand,
    deleteWorkspace,
    refreshBrands,
    setBrand,
    signIn,
    signUp,
    signInWithPassword: signIn,
    signUpWithPassword: signUp,
    signInWithOAuth,
    signOut,
    sendPasswordResetEmail: sendReset,
    resendVerificationEmail: sendResendVerification,
    markOnboardingComplete,
    updateProfile,
    refreshSession,
    clearError: () => setError(null),
  }), [
    brand,
    brands,
    closeCreateWorkspaceModal,
    createWorkspaceModalOpen,
    currentUser,
    deleteWorkspace,
    error,
    isAuthenticated,
    isConfigured,
    isOnboardingComplete,
    loading,
    markOnboardingComplete,
    openCreateWorkspaceModal,
    profile,
    refreshBrands,
    refreshSession,
    requireAuth,
    sendReset,
    sendResendVerification,
    session,
    signIn,
    signInWithOAuth,
    signOut,
    signUp,
    switchBrand,
    updateProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
