import { type ReactNode } from "react";
import { isSupabaseConfigured } from "../../backend/supabaseClient";

type AuthGateProps = {
  children: ReactNode;
  requireAuth?: boolean;
  fallback?: ReactNode;
};

export function AuthGate({ children, requireAuth = false, fallback = null }: AuthGateProps) {
  if (!requireAuth) {
    return <>{children}</>;
  }

  if (!isSupabaseConfigured()) {
    return <>{children}</>;
  }

  return <>{fallback ?? children}</>;
}
