import React, { useState, useEffect, useRef } from "react";
import { Navigation } from "./components/Navigation";
import { SparkHome } from "./components/SparkHome";
import { MySpark } from "./components/MySpark";
import { ViralSparks } from "./components/ViralSparks";
import { ReviewCenter } from "./components/ReviewCenter";
import { CreativeReview } from "./components/CreativeReview";
import { Calendar } from "./components/Calendar";
import { Analytics } from "./components/Analytics";
import { MorePage } from "./components/MorePage";
import { MoreSubPages, FullLegalPage } from "./components/MoreSubPages";
import { MobileApp } from "./components/mobile/MobileApp";
import { useDeviceType, detectDevice } from "./hooks/useDeviceType";
import { SparkProvider, useSpark } from "./state/SparkContext";
import { InstallPrompt } from "./components/InstallPrompt";
import { AuthProvider, useAuth, getStoredDemoUser } from "./state/AuthContext";
import { AuthGate } from "./components/auth/AuthGate";
import { AuthPanel } from "./components/auth/AuthPanel";
import { BrandGenesisFlow, BrandGenesisData } from "./components/onboarding/BrandGenesisFlow";
import { SplashReel } from "./components/splash/SplashReel";
import { SparkLogo } from "./components/SparkLogo";
import { GoogleCallbackPage } from "./components/auth/GoogleCallbackPage";
import { XCallbackPage } from "./components/auth/XCallbackPage";
import { getBrandWorkspaceId } from "./services/socialIntegrationService";
import { isUuid } from "./backend/mappers/workspaceMappers";

const requireAuth = import.meta.env.VITE_REQUIRE_AUTH === "true";

export type ViewState =
  | "auth"
  | "welcome"
  | "onboarding"
  | "meet_team"
  | "workspace_creation"
  | "workspace_ready"
  | "dashboard";

/**
 * PublicRoute Guard: Accessible ONLY when user == null (/auth)
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.loading) return <HydrationSplash />;
  if (auth.isAuthenticated) return <HydrationSplash />; // Transition safely to dashboard without flashing blank
  return <>{children}</>;
}

/**
 * ProtectedRoute Guard: Accessible ONLY when user != null (/)
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.loading) return <HydrationSplash />;
  if (!auth.isAuthenticated) return <HydrationSplash />; // Transition safely to auth view without flashing blank
  return <>{children}</>;
}

import { MainLogoAnimated } from "./components/ui/SparkAnimatedLogo";

/**
 * Hydration Splash: Shown during initial session restoration (never flashes public screens)
 */
function HydrationSplash() {
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

function AppContent() {
  const auth = useAuth();
  const { updateBrand, initializeBrandGenesis } = useSpark();

  // Synchronously evaluate user existence strictly from auth context
  const isUserAuthenticated = auth.isAuthenticated;

  // Initialize viewState directly from cloud auth context
  const [viewState, setViewState] = useState<ViewState>(() => {
    return isUserAuthenticated ? (auth.isOnboardingComplete ? "dashboard" : "onboarding") : "auth";
  });

  const [genesisData, setGenesisData] = useState<BrandGenesisData>({
    brandName: "",
    creatorName: "",
    niche: "",
    audience: "",
    goal: "",
    platforms: [],
    tone: "Energetic & Relatable",
    vision: "",
    visualStyle: "Realistic / Live-Action",
    productionMode: "hybrid",
    automationMode: "balanced",
    reviewRequired: true,
  });

  const [currentPage, setCurrentPage] = useState("/");
  const deviceType = useDeviceType();

  // Social Media OAuth detection (YouTube Shorts / X publishing connect ONLY — NOT Supabase Login)
  const getSocialOAuthProvider = (): "google" | "x" | null => {
    if (typeof window === "undefined") return null;
    const pathname = window.location.pathname.replace(/\/$/, "") || "/";
    const params = new URLSearchParams(window.location.search);
    const flag = (params.get("spark_oauth") || "").toLowerCase();
    const state = params.get("state") || "";
    const hasCode = Boolean(params.get("code"));

    // 1. Dedicated YouTube Shorts publishing connector callback
    if (pathname === "/auth/google/callback" || flag === "youtube" || (hasCode && state.startsWith("spark_oauth_youtube"))) {
      return "google";
    }

    // 2. Dedicated Twitter / X publishing connector callback
    if (pathname === "/auth/x/callback" || flag === "x" || flag === "twitter" || (hasCode && state.startsWith("spark_oauth_x"))) {
      return "x";
    }

    return null;
  };

  // Splash sequence state: check if already played in session or if on OAuth route
  const [splashDone, setSplashDone] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const pathname = window.location.pathname.replace(/\/$/, "") || "/";
    const params = new URLSearchParams(window.location.search);
    const flag = (params.get("spark_oauth") || "").toLowerCase();
    const state = params.get("state") || "";
    const hasCode = Boolean(params.get("code"));
    if (
      pathname.startsWith("/auth/google") ||
      pathname.startsWith("/auth/x") ||
      pathname.startsWith("/auth/callback") ||
      flag === "google" ||
      flag === "youtube" ||
      flag === "x" ||
      flag === "twitter" ||
      (hasCode && state.startsWith("spark_oauth_"))
    ) {
      return true;
    }
    try {
      return sessionStorage.getItem("spark_splash_played") === "true";
    } catch {
      return false;
    }
  });

  // Strict Routing Authority & URL Sync
  useEffect(() => {
    if (!auth.loading) {
      const pathname =
        typeof window !== "undefined" ? window.location.pathname : "";
      const search =
        typeof window !== "undefined" ? window.location.search : "";
      const hash =
        typeof window !== "undefined" ? window.location.hash : "";

      // Never rewrite OAuth callback URLs or in-flight OAuth token hashes / query bounces
      if (
        pathname.startsWith("/auth/google") ||
        pathname.startsWith("/auth/x") ||
        pathname.startsWith("/auth/callback") ||
        search.includes("spark_oauth=") ||
        search.includes("code=") ||
        hash.includes("access_token")
      ) {
        return;
      }

      if (isUserAuthenticated) {
        if (window.history && window.history.replaceState && !pathname.startsWith("/auth/")) {
          if (!search.includes("resume_onboarding") && pathname !== "/") {
            window.history.replaceState({}, "", "/");
          }
        }
        if (!auth.isOnboardingComplete) {
          console.log("[SPARK AUTH] routing: GENESIS");
          setViewState((prev) => (prev === "auth" || prev === "dashboard" ? "onboarding" : prev));
        } else {
          console.log("[SPARK AUTH] routing: DASHBOARD");
          setViewState((prev) => (prev === "auth" ? "dashboard" : prev));
        }
      } else {
        console.log("[SPARK AUTH] routing: AUTH");
        if (window.history && window.history.replaceState && !pathname.startsWith("/auth/")) {
          window.history.replaceState({}, "", "/auth");
        }
        setViewState("auth");
        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("spark_splash_played") !== "true") {
          const search = typeof window !== "undefined" ? window.location.search : "";
          if (
            !pathname.startsWith("/auth/google") &&
            !pathname.startsWith("/auth/x") &&
            !pathname.startsWith("/auth/callback") &&
            !search.includes("code=") &&
            !search.includes("spark_oauth=")
          ) {
            setSplashDone(false);
          }
        }
      }
    }
  }, [isUserAuthenticated, auth.loading, auth.isOnboardingComplete]);

  const handleAuthSuccess = async (email?: string, name?: string, mode?: "signin" | "signup") => {
    console.log("[SPARK AUTH] handleAuthSuccess called for:", email, "mode:", mode);
    if (email || name) {
      const creatorName = name || email?.split("@")[0] || "Creator";
      setGenesisData((prev) => ({
        ...prev,
        creatorName,
      }));
      auth.updateProfile(creatorName, email);
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", "/");
    }
    const isComplete = auth.isOnboardingComplete;
    console.log("[SPARK AUTH] routing →", isComplete ? "Spark Dashboard" : "Brand Genesis");
    setViewState(isComplete ? "dashboard" : "onboarding");
  };

  const genesisCompletedInSessionRef = useRef(false);

  const handleEnterDashboard = async (data?: BrandGenesisData) => {
    const finalData = data || genesisData;
    auth.updateProfile(finalData.creatorName || "Creator");
    if (!auth.isOnboardingComplete && !genesisCompletedInSessionRef.current) {
      genesisCompletedInSessionRef.current = true;
      try {
        await Promise.race([
          initializeBrandGenesis(finalData),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]);
        const targetBrandId = auth.brand?.id || getBrandWorkspaceId();
        if (targetBrandId && isUuid(targetBrandId)) {
          await auth.markOnboardingComplete(targetBrandId);
        }
      } catch (err) {
        console.warn("[App] handleEnterDashboard genesis notice:", err);
      }
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", "/");
    }
    setViewState("dashboard");
  };

  const renderDesktopPage = () => {
    const pageBase = currentPage.split("?")[0];
    switch (pageBase) {
      case "/":
        return <SparkHome onNavigate={setCurrentPage} />;
      case "/my-spark":
      case "my-spark":
        return <MySpark onNavigate={setCurrentPage} />;
      case "/viral-sparks":
      case "viral-sparks":
        return <ViralSparks onNavigate={setCurrentPage} />;
      case "/review":
      case "review":
        return <ReviewCenter onNavigate={setCurrentPage} />;
      case "/review/creative":
        return (
          <CreativeReview
            onNavigate={setCurrentPage}
            onBack={() => setCurrentPage("/review")}
          />
        );
      case "/calendar":
        return <Calendar onNavigate={setCurrentPage} />;
      case "/analytics":
        return <Analytics onNavigate={setCurrentPage} />;
      case "/more":
        return <MorePage onNavigate={setCurrentPage} />;
      case "/more/theme":
      case "/more/assets":
      case "/more/memory":
      case "/more/marketer":
      case "/more/accounts":
      case "/more/billing":
      case "/more/api":
      case "/more/integrations":
      case "/more/ai-preferences":
      case "/more/credit-control":
      case "/more/generation-controls":
      case "/more/production-settings":
      case "/more/team":
      case "/more/legal":
      case "/more/support":
      case "/more/notifications":
      case "/more/privacy":
        return <MoreSubPages onNavigate={setCurrentPage} subPath={currentPage} />;
      case "/terms":
        return <FullLegalPage onNavigate={setCurrentPage} type="terms" />;
      case "/privacy":
        return <FullLegalPage onNavigate={setCurrentPage} type="privacy" />;
      default:
        return <SparkHome onNavigate={setCurrentPage} />;
    }
  };

  const renderContent = () => {
    // 0. Social platform OAuth callbacks (YouTube Shorts / X account connect ONLY)
    const socialOAuthProvider = getSocialOAuthProvider();
    if (socialOAuthProvider === "google") {
      return <GoogleCallbackPage />;
    }
    if (socialOAuthProvider === "x") {
      return <XCallbackPage />;
    }

    // 1. Session Restoration / Hydration State (Minimal HydrationSplash only)
    if (auth.loading) {
      return <HydrationSplash />;
    }

    // Evaluate device type synchronously on first authenticated paint
    const currentDevice = detectDevice();

    // 2. Authenticated Session Exists
    if (isUserAuthenticated) {
      // Returning user whose onboarding is complete in cloud -> straight to dashboard (no marketing splash)
      if (auth.isOnboardingComplete) {
        if (currentDevice === "mobile" || deviceType === "mobile") {
          return (
            <ProtectedRoute>
              <MobileApp />
            </ProtectedRoute>
          );
        }

        return (
          <ProtectedRoute>
            <div className="h-screen overflow-hidden flex bg-background text-foreground antialiased">
              <Navigation currentPath={currentPage} onNavigate={setCurrentPage} />
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {renderDesktopPage()}
              </div>
            </div>
          </ProtectedRoute>
        );
      }

      // First-time authenticated user whose onboarding is incomplete in cloud -> Brand Genesis
      return (
        <ProtectedRoute>
          <BrandGenesisFlow
            onComplete={(data) => {
              if (data) {
                setGenesisData(data);
                void handleEnterDashboard(data);
              } else {
                void handleEnterDashboard();
              }
            }}
          />
        </ProtectedRoute>
      );
    }

    // 3. Unauthenticated / No Session (Logged out / strangers)
    // Optional donor marketing splash reel once per cold start (sessionStorage), then Login
    if (!splashDone) {
      return (
        <SplashReel
          onDone={() => {
            try {
              sessionStorage.setItem("spark_splash_played", "true");
            } catch {}
            setSplashDone(true);
          }}
        />
      );
    }

    // Unauthenticated -> AuthPanel / Login only (never onboard while logged out)
    return (
      <PublicRoute>
        <AuthPanel isFullScreen onSuccess={handleAuthSuccess} />
      </PublicRoute>
    );
  };

  return (
    <AuthGate requireAuth={requireAuth}>
      {renderContent()}
      <InstallPrompt />
    </AuthGate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SparkProvider>
        <AppContent />
      </SparkProvider>
    </AuthProvider>
  );
}
