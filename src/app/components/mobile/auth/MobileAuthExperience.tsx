import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MobileCreateAccountView } from "./MobileCreateAccountView";
import { MobileSignInView } from "./MobileSignInView";
import { MobileForgotPasswordView } from "./MobileForgotPasswordView";
import { BrandGenesisFlow } from "../onboarding/BrandGenesisFlow";
import { useAuth } from "../../../state/AuthContext";

type AuthViewState = "create-account" | "sign-in" | "forgot-password" | "brand-genesis";

type MobileAuthExperienceProps = {
  onAuthenticated: () => void;
};

export function MobileAuthExperience({ onAuthenticated }: MobileAuthExperienceProps) {
  const auth = useAuth();
  
  // Decide initial view based on Session Decision Engine
  const [viewState, setViewState] = useState<AuthViewState>(() => {
    if (auth.isAuthenticated) {
      return "brand-genesis";
    }
    return "create-account";
  });

  return (
    <div className="min-h-screen bg-background text-foreground antialiased overflow-hidden">
      <AnimatePresence mode="wait">
        {viewState === "create-account" && (
          <motion.div
            key="create-account"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <MobileCreateAccountView
              onSwitchToSignIn={() => setViewState("sign-in")}
              onForgotPassword={() => setViewState("forgot-password")}
              onSuccess={() => setViewState("brand-genesis")}
            />
          </motion.div>
        )}

        {viewState === "sign-in" && (
          <motion.div
            key="sign-in"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <MobileSignInView
              onSwitchToSignUp={() => setViewState("create-account")}
              onForgotPassword={() => setViewState("forgot-password")}
              onSuccess={() => {
                if (auth.isOnboardingComplete) {
                  onAuthenticated();
                } else {
                  setViewState("brand-genesis");
                }
              }}
            />
          </motion.div>
        )}

        {viewState === "forgot-password" && (
          <motion.div
            key="forgot-password"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <MobileForgotPasswordView onBack={() => setViewState("sign-in")} />
          </motion.div>
        )}

        {viewState === "brand-genesis" && (
          <motion.div
            key="brand-genesis"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="w-full h-full"
          >
            <BrandGenesisFlow onComplete={onAuthenticated} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
