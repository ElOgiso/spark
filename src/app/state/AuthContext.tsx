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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  const isConfigured = isAuthBackendReady();
  const requireAuth = isAuthRequired();
  const currentUser = session?.user ?? null;

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
    signIn,
    signUp,
    signOut,
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
