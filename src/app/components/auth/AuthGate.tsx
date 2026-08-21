import { useState, type ReactNode } from "react";
import { useAuth } from "../../state/AuthContext";
import { useDeviceType } from "../../hooks/useDeviceType";
import { MobileAuthExperience } from "../mobile/auth/MobileAuthExperience";
import { DesktopAuthExperience } from "../desktop/DesktopAuthExperience";

import { MainLogoAnimated } from "../ui/SparkAnimatedLogo";

type AuthGateProps = {
  children: ReactNode;
  requireAuth?: boolean;
  fallback?: ReactNode;
};

export function AuthGate({ children, requireAuth = false, fallback = null }: AuthGateProps) {
  const auth = useAuth();
  const deviceType = useDeviceType();
  const [complete, setComplete] = useState(false);

  if (auth.loading) {
    return (
      <div className="h-screen w-screen bg-[#0B0F17] flex items-center justify-center text-center p-6 select-none relative overflow-hidden">
        <div className="animate-in fade-in duration-300 flex flex-col items-center gap-4">
          <MainLogoAnimated size={96} />
          <p className="text-[11px] font-medium tracking-widest text-purple-300/60 uppercase pt-2 animate-pulse">
            Looking for your spark...
          </p>
        </div>
      </div>
    );
  }

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

  return <>{children}</>;
}


