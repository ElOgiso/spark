import { useState, type ReactNode } from "react";
import { useAuth } from "../../state/AuthContext";
import { useDeviceType } from "../../hooks/useDeviceType";
import { MobileAuthExperience } from "../mobile/auth/MobileAuthExperience";
import { DesktopAuthExperience } from "../desktop/DesktopAuthExperience";

type AuthGateProps = {
  children: ReactNode;
  requireAuth?: boolean;
  fallback?: ReactNode;
};

export function AuthGate({ children, requireAuth = false, fallback = null }: AuthGateProps) {
  const auth = useAuth();
  const deviceType = useDeviceType();
  const [complete, setComplete] = useState(false);

  if (!requireAuth) {
    return <>{children}</>;
  }

  if (deviceType === "mobile") {
    if (!auth.isAuthenticated || !auth.isOnboardingComplete) {
      if (!complete) {
        return <MobileAuthExperience onComplete={() => setComplete(true)} />;
      }
    }
  } else {
    if (!auth.isAuthenticated || !auth.isOnboardingComplete) {
      if (!complete) {
        return <DesktopAuthExperience onComplete={() => setComplete(true)} />;
      }
    }
  }

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground font-mono animate-pulse">Restoring Executive Spark Session...</p>
      </div>
    );
  }

  return <>{children}</>;
}


