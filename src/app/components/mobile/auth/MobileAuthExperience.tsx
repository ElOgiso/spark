import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { MobileCreateAccountView } from "./MobileCreateAccountView";
import { MobileSignInView } from "./MobileSignInView";
import { MobileForgotPasswordView } from "./MobileForgotPasswordView";
import { MobileConversationalFlow } from "../onboarding/MobileConversationalFlow";

type MobileAuthViewState = "create-account" | "sign-in" | "forgot-password" | "onboarding";

type MobileAuthExperienceProps = {
  onComplete: () => void;
};

export function MobileAuthExperience({ onComplete }: MobileAuthExperienceProps) {
  const auth = useAuth();

  const [viewState, setViewState] = useState<MobileAuthViewState>(() => {
    if (auth.isAuthenticated && !auth.isOnboardingComplete) {
      return "onboarding";
    }
    return "create-account";
  });

  if (auth.isAuthenticated && auth.isOnboardingComplete) {
    onComplete();
    return null;
  }

  if (viewState === "onboarding" || (auth.isAuthenticated && !auth.isOnboardingComplete)) {
    return <MobileConversationalFlow onComplete={onComplete} />;
  }

  if (viewState === "sign-in") {
    return (
      <MobileSignInView
        onSwitchToSignUp={() => setViewState("create-account")}
        onForgotPassword={() => setViewState("forgot-password")}
      />
    );
  }

  if (viewState === "forgot-password") {
    return <MobileForgotPasswordView onBack={() => setViewState("sign-in")} />;
  }

  return (
    <MobileCreateAccountView
      onSwitchToSignIn={() => setViewState("sign-in")}
      onForgotPassword={() => setViewState("forgot-password")}
      onAccountCreated={() => setViewState("onboarding")}
    />
  );
}
