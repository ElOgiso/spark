import { type ReactNode } from "react";
import { AuthPanel } from "./AuthPanel";
import { useAuth } from "../../state/AuthContext";

type AuthGateProps = {
  children: ReactNode;
  requireAuth?: boolean;
  fallback?: ReactNode;
};

export function AuthGate({ children, requireAuth = false, fallback = null }: AuthGateProps) {
  const auth = useAuth();

  if (!requireAuth) {
    return <>{children}</>;
  }

  if (!auth.isConfigured) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <AuthPanel />
        </div>
      </div>
    );
  }

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Restoring Spark session...</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          {fallback ?? <AuthPanel />}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
