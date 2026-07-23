import { useState, type ReactNode } from "react";
import { AuthPanel } from "./AuthPanel";
import { useAuth } from "../../state/AuthContext";
import { useDeviceType } from "../../hooks/useDeviceType";
import { MobileAuthExperience } from "../mobile/auth/MobileAuthExperience";

type AuthGateProps = {
  children: ReactNode;
  requireAuth?: boolean;
  fallback?: ReactNode;
};

export function AuthGate({ children, requireAuth = false, fallback = null }: AuthGateProps) {
  const auth = useAuth();
  const deviceType = useDeviceType();
  const [mobileComplete, setMobileComplete] = useState(false);

  if (!requireAuth) {
    return <>{children}</>;
  }

  if (deviceType === "mobile") {
    if (!auth.isAuthenticated || !auth.isOnboardingComplete) {
      if (!mobileComplete) {
        return <MobileAuthExperience onComplete={() => setMobileComplete(true)} />;
      }
    }
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

