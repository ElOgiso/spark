import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  bootstrapUserSession,
  isAuthBackendReady,
  isAuthRequired,
  restoreSession,
  signIn as sessionSignIn,
  signOut as sessionSignOut,
  signUp as sessionSignUp,
  subscribeToAuthState,
  unavailableAuthMessage,
} from "../backend/sessionService";
import type { BrandRow, ProfileRow } from "../backend/database.types";

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
  currentOnboardingStep: number;
  isEmailVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<string | null>;
  resendVerificationEmail: (email: string) => Promise<string | null>;
  updateOnboardingStep: (step: number) => void;
  markOnboardingComplete: () => void;
  refreshSession: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(() => {
    return localStorage.getItem("spark_onboarding_completed") === "true";
  });
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState<number>(() => {
    const saved = localStorage.getItem("spark_onboarding_step");
    return saved ? parseInt(saved, 10) : 1;
  });

  const isConfigured = isAuthBackendReady();
  const requireAuth = isAuthRequired();
  const currentUser = session?.user ?? null;
  const isEmailVerified = Boolean(currentUser?.email_confirmed_at);

  const bootstrap = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setProfile(null);
      setBrand(null);
      return;
    }

    const result = await bootstrapUserSession(nextSession.user);
    setProfile(result.profile);
    setBrand(result.brand);
    setError(result.error);

    // If default brand already has niche or setup, consider onboarding completed
    if (result.brand?.niche) {
      setIsOnboardingComplete(true);
      localStorage.setItem("spark_onboarding_completed", "true");
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isConfigured) {
      setSession(null);
      setProfile(null);
      setBrand(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await restoreSession();
    if (result.error) setError(result.error);
    await bootstrap(result.session);
    setLoading(false);
  }, [bootstrap, isConfigured]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!isConfigured) return () => {};
    return subscribeToAuthState((nextSession) => {
      void bootstrap(nextSession);
    });
  }, [bootstrap, isConfigured]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    const result = await sessionSignIn(email, password);
    if (result.error) setError(result.error);
    await refreshSession();
    setLoading(false);
  }, [refreshSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    const result = await sessionSignUp(email, password);
    if (result.error) setError(result.error);
    await refreshSession();
    setLoading(false);
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    setError(null);
    setLoading(true);
    const result = await sessionSignOut();
    if (result.error) setError(result.error);
    setSession(null);
    setProfile(null);
    setBrand(null);
    setLoading(false);
  }, []);

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    const { sendPasswordResetEmail: serviceSendReset } = await import("../backend/sessionService");
    const res = await serviceSendReset(email);
    if (res.error) setError(res.error);
    return res.error;
  }, []);

  const resendVerificationEmail = useCallback(async (email: string) => {
    const { resendEmailVerification: serviceResend } = await import("../backend/sessionService");
    const res = await serviceResend(email);
    if (res.error) setError(res.error);
    return res.error;
  }, []);

  const updateOnboardingStep = useCallback((step: number) => {
    setCurrentOnboardingStep(step);
    localStorage.setItem("spark_onboarding_step", String(step));
  }, []);

  const markOnboardingComplete = useCallback(() => {
    setIsOnboardingComplete(true);
    localStorage.setItem("spark_onboarding_completed", "true");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    session,
    profile,
    brand,
    loading,
    isAuthenticated: Boolean(currentUser),
    isConfigured,
    requireAuth,
    mode: currentUser ? "authenticated" : "demo",
    error: error ?? (!isConfigured ? unavailableAuthMessage() : null),
    isOnboardingComplete,
    currentOnboardingStep,
    isEmailVerified,
    signIn,
    signUp,
    signOut,
    sendPasswordResetEmail,
    resendVerificationEmail,
    updateOnboardingStep,
    markOnboardingComplete,
    refreshSession,
    clearError: () => setError(null),
  }), [
    brand,
    currentUser,
    error,
    isConfigured,
    loading,
    profile,
    refreshSession,
    requireAuth,
    session,
    signIn,
    signOut,
    signUp,
    isOnboardingComplete,
    currentOnboardingStep,
    isEmailVerified,
    sendPasswordResetEmail,
    resendVerificationEmail,
    updateOnboardingStep,
    markOnboardingComplete,
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
