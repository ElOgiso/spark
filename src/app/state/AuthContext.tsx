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
  loading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  requireAuth: boolean;
  mode: "demo" | "authenticated";
  error: string | null;
  isOnboardingComplete: boolean;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoUser, setDemoUser] = useState<User | null>(() => getStoredDemoUser());

  // Cloud bootstrap is the single source of truth for onboarding completeness
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);

  const isConfigured = isAuthBackendReady();
  const requireAuth = isAuthRequired();

  // Synchronously evaluate active user from session, demoUser state, or localStorage
  const currentUser = useMemo(() => {
    if (session?.user) return session.user;
    return demoUser ?? getStoredDemoUser();
  }, [session, demoUser]);

  const isAuthenticated = Boolean(currentUser);

  const bootstrap = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setProfile(null);
      setBrand(null);
      setIsOnboardingComplete(false);
      return null;
    }

    const result = await bootstrapUserSession(nextSession.user);
    setProfile(result.profile);
    setBrand(result.brand);
    if (result.brand?.id) {
      localStorage.setItem("spark_current_brand_id", result.brand.id);
      try {
        localStorage.setItem("spark_current_brand_name", result.brand.name || "");
      } catch {
        /* ignore */
      }
    }
    setError(result.error);

    // CLOUD IS SOURCE OF TRUTH:
    // Determine onboarding completeness directly from cloud result
    const isComplete = Boolean(result.isOnboardingComplete);
    setIsOnboardingComplete(isComplete);

    return result;
  }, []);

  const handleDemoSignIn = useCallback((email: string, fullName?: string, isNewUser: boolean = false) => {
    const name = fullName || email.split("@")[0] || "Creator";
    const mockUser: any = {
      id: `user-${Date.now()}`,
      email: email || "creator@spark.ai",
      role: "authenticated",
      user_metadata: { full_name: name },
    };
    localStorage.setItem("spark_demo_user", JSON.stringify(mockUser));
    setDemoUser(mockUser);
    setError(null);

    if (isNewUser) {
      localStorage.setItem("spark_onboarding_complete", "false");
      setIsOnboardingComplete(false);
    } else {
      localStorage.setItem("spark_onboarding_complete", "true");
      setIsOnboardingComplete(true);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isConfigured) {
      const storedDemo = getStoredDemoUser();
      if (storedDemo) {
        setDemoUser(storedDemo);
        const isComplete = localStorage.getItem("spark_onboarding_complete") !== "false";
        setIsOnboardingComplete(isComplete);
      }
      setSession(null);
      setProfile(null);
      setBrand(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await restoreSession();
      if (result.session) {
        await bootstrap(result.session);
      } else {
        const storedDemo = getStoredDemoUser();
        if (storedDemo) {
          setDemoUser(storedDemo);
          const isComplete = localStorage.getItem("spark_onboarding_complete") !== "false";
          setIsOnboardingComplete(isComplete);
        } else {
          setSession(null);
          setProfile(null);
          setBrand(null);
          setIsOnboardingComplete(false);
        }
      }
    } catch (err) {
      console.warn("[Spark Auth] Session restore failed, preserving stored user if available:", err);
      const storedDemo = getStoredDemoUser();
      if (storedDemo) {
        setDemoUser(storedDemo);
        const isComplete = localStorage.getItem("spark_onboarding_complete") !== "false";
        setIsOnboardingComplete(isComplete);
      } else {
        setSession(null);
        setProfile(null);
        setBrand(null);
        setIsOnboardingComplete(false);
      }
    } finally {
      setLoading(false);
    }
  }, [bootstrap, isConfigured]);

  useEffect(() => {
    void refreshSession();
    // Safety watchdog: ensure hydration splash never hangs indefinitely
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [refreshSession]);

  useEffect(() => {
    if (!isConfigured) return () => {};
    return subscribeToAuthState((nextSession) => {
      if (nextSession) {
        void bootstrap(nextSession);
      }
    });
  }, [bootstrap, isConfigured]);

  // OAuth hash token listener for Google OAuth callback
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash && window.location.hash.includes("access_token")) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        if (accessToken) {
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then((res) => res.json())
            .then((userInfo) => {
              if (userInfo?.email) {
                handleDemoSignIn(userInfo.email, userInfo.name || userInfo.email.split("@")[0], false);
              }
            })
            .catch((err) => console.warn("[Spark Auth] OAuth userinfo fetch error:", err))
            .finally(() => {
              if (window.history && window.history.replaceState) {
                window.history.replaceState(null, "", window.location.pathname);
              }
            });
        }
      } catch (err) {
        console.warn("[Spark Auth] Hash token parse error:", err);
      }
    }
  }, [handleDemoSignIn]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    const targetEmail = email.trim() || "creator@spark.ai";
    if (!isConfigured) {
      handleDemoSignIn(targetEmail, undefined, false);
      setLoading(false);
      return;
    }
    try {
      const result = await sessionSignIn(targetEmail, password);
      if (result.error || !result.user) {
        handleDemoSignIn(targetEmail, undefined, false);
      } else {
        await refreshSession();
        if (!getStoredDemoUser()) {
          handleDemoSignIn(targetEmail, result.user.user_metadata?.full_name || result.user.email, false);
        }
      }
    } catch (err) {
      console.warn("[Spark Auth] signIn backend error, falling back to demo:", err);
      handleDemoSignIn(targetEmail, undefined, false);
    }
    setLoading(false);
  }, [handleDemoSignIn, isConfigured, refreshSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    const targetEmail = email.trim() || "creator@spark.ai";
    if (!isConfigured) {
      handleDemoSignIn(targetEmail, undefined, true);
      setLoading(false);
      return;
    }
    try {
      const result = await sessionSignUp(targetEmail, password);
      if (result.error || !result.user) {
        handleDemoSignIn(targetEmail, undefined, true);
      } else {
        await refreshSession();
        if (!getStoredDemoUser()) {
          handleDemoSignIn(targetEmail, result.user.user_metadata?.full_name || result.user.email, true);
        }
      }
    } catch (err) {
      console.warn("[Spark Auth] signUp backend error, falling back to demo:", err);
      handleDemoSignIn(targetEmail, undefined, true);
    }
    setLoading(false);
  }, [handleDemoSignIn, isConfigured, refreshSession]);

  const signInWithOAuth = useCallback(async (provider: "google" | "apple") => {
    setError(null);
    setLoading(true);
    const fallbackEmail = `creator_${provider}@spark.ai`;
    if (!isConfigured) {
      handleDemoSignIn(fallbackEmail, `${provider.toUpperCase()} Creator`, false);
      setLoading(false);
      return;
    }
    try {
      const result = await sessionSignInWithOAuth(provider);
      if (result.error) {
        handleDemoSignIn(fallbackEmail, `${provider.toUpperCase()} Creator`, false);
      }
    } catch (err) {
      console.warn("[Spark Auth] OAuth backend error, falling back to demo:", err);
      handleDemoSignIn(fallbackEmail, `${provider.toUpperCase()} Creator`, false);
    }
    setLoading(false);
  }, [handleDemoSignIn, isConfigured]);

  const signOut = useCallback(async () => {
    setError(null);
    setLoading(true);
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
    setDemoUser(null);
    setSession(null);
    setProfile(null);
    setBrand(null);
    setIsOnboardingComplete(false);
    setLoading(false);
  }, [isConfigured]);

  const sendReset = useCallback(async (email: string) => {
    const { sendPasswordResetEmail } = await import("../backend/sessionService");
    return sendPasswordResetEmail(email);
  }, []);

  const sendResendVerification = useCallback(async (email: string) => {
    const { resendVerification } = await import("../backend/sessionService");
    return resendVerification(email);
  }, []);

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
      onboarding_complete: prev?.onboarding_complete ?? true,
      active_brand_id: prev?.active_brand_id ?? null,
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
  }, [currentUser]);

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    session,
    profile,
    brand,
    loading,
    isAuthenticated,
    isConfigured,
    requireAuth,
    mode: currentUser ? "authenticated" : "demo",
    error: error ?? null,
    isOnboardingComplete,
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
    currentUser,
    error,
    isAuthenticated,
    isConfigured,
    isOnboardingComplete,
    loading,
    markOnboardingComplete,
    updateProfile,
    profile,
    refreshSession,
    requireAuth,
    sendReset,
    sendResendVerification,
    session,
    signIn,
    signInWithOAuth,
    signOut,
    signUp,
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
