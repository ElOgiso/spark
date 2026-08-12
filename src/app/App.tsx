import React, { useState, useEffect } from "react";
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
import { useDeviceType } from "./hooks/useDeviceType";
import { SparkProvider, useSpark } from "./state/SparkContext";
import { InstallPrompt } from "./components/InstallPrompt";
import { AuthProvider, useAuth, getStoredDemoUser } from "./state/AuthContext";
import { AuthGate } from "./components/auth/AuthGate";
import { AuthPanel } from "./components/auth/AuthPanel";
import { WelcomeScreen } from "./components/onboarding/WelcomeScreen";
import { OnboardingWizard, BrandGenesisData } from "./components/onboarding/OnboardingWizard";
import { MeetYourTeamScreen } from "./components/onboarding/MeetYourTeamScreen";
import { SparkLogo } from "./components/SparkLogo";
import { GoogleCallbackPage } from "./components/auth/GoogleCallbackPage";
import { XCallbackPage } from "./components/auth/XCallbackPage";

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
  const hasUser = auth.isAuthenticated || Boolean(getStoredDemoUser());
  if (auth.loading) return <HydrationSplash />;
  if (hasUser) return null; // Authority check: never render public auth view if authenticated!
  return <>{children}</>;
}

/**
 * ProtectedRoute Guard: Accessible ONLY when user != null (/)
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const hasUser = auth.isAuthenticated || Boolean(getStoredDemoUser());
  if (auth.loading) return <HydrationSplash />;
  if (!hasUser) return null; // Authority check: never render protected view if unauthenticated!
  return <>{children}</>;
}

/**
 * Hydration Splash: Shown during initial session restoration (never flashes public screens)
 */
function HydrationSplash() {
  return (
    <div className="h-screen w-screen bg-[#0B0F17] flex items-center justify-center text-center p-6 select-none">
      <div className="space-y-4 animate-in fade-in duration-300">
        <SparkLogo className="w-16 h-16 mx-auto animate-pulse" variant="superspark" />
        <p className="text-xs font-semibold tracking-wider text-purple-300 uppercase">Restoring Executive OS...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const auth = useAuth();
  const { updateBrand, initializeBrandGenesis } = useSpark();

  // Synchronously evaluate user existence from auth context or stored session
  const storedUser = getStoredDemoUser();
  const isUserAuthenticated = auth.isAuthenticated || Boolean(storedUser);

  // Initialize viewState directly: authenticated -> dashboard, unauthenticated -> auth
  const [viewState, setViewState] = useState<ViewState>(() => {
    return isUserAuthenticated ? "dashboard" : "auth";
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

  // OAuth detection: path-based callbacks OR root bounce (?spark_oauth=google|x&code=...)
  const getOAuthProvider = (): "google" | "x" | null => {
    if (typeof window === "undefined") return null;
    const pathname = window.location.pathname.replace(/\/$/, "") || "/";
    const params = new URLSearchParams(window.location.search);
    const flag = (params.get("spark_oauth") || "").toLowerCase();
    const state = params.get("state") || "";
    const hasCode = Boolean(params.get("code"));

    if (pathname === "/auth/google/callback" || pathname === "/auth/callback") return "google";
    if (pathname === "/auth/x/callback" || pathname === "/auth/callback/x") return "x";
    if (flag === "google" || flag === "youtube") return "google";
    if (flag === "x" || flag === "twitter") return "x";
    // Root bounce with code + spark state (static HTML redirects here)
    if (hasCode && state.startsWith("spark_oauth_youtube")) return "google";
    if (hasCode && state.startsWith("spark_oauth_x")) return "x";
    if (hasCode && state.startsWith("spark_oauth_") && /youtube|google/i.test(state)) return "google";
    if (hasCode && state.startsWith("spark_oauth_") && /x|twitter/i.test(state)) return "x";
    return null;
  };

  // Strict Routing Authority & URL Sync
  useEffect(() => {
    if (!auth.loading) {
      const pathname =
        typeof window !== "undefined" ? window.location.pathname : "";
      const search =
        typeof window !== "undefined" ? window.location.search : "";
      // Never rewrite OAuth callback URLs or in-flight OAuth query bounces
      if (
        pathname.startsWith("/auth/google") ||
        pathname.startsWith("/auth/x") ||
        pathname.startsWith("/auth/callback") ||
        search.includes("spark_oauth=") ||
        (search.includes("code=") && search.includes("spark_oauth_"))
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
          setViewState((prev) => (prev === "auth" || prev === "dashboard" ? "onboarding" : prev));
        } else {
          setViewState((prev) => (prev === "auth" ? "dashboard" : prev));
        }
      } else {
        if (window.history && window.history.replaceState && !pathname.startsWith("/auth/")) {
          window.history.replaceState({}, "", "/auth");
        }
        setViewState("auth");
      }
    }
  }, [isUserAuthenticated, auth.loading, auth.isOnboardingComplete]);

  const handleAuthSuccess = (email?: string, name?: string, mode?: "signin" | "signup") => {
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
    if (auth.isOnboardingComplete || mode === "signin" || Boolean(auth.brand?.id)) {
      setViewState("dashboard");
    } else {
      setViewState("onboarding");
    }
  };

  const handleEnterDashboard = (data?: BrandGenesisData) => {
    const finalData = data || genesisData;
    auth.updateProfile(finalData.creatorName);
    initializeBrandGenesis(finalData);
    void auth.markOnboardingComplete(auth.brand?.id);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", "/");
    }
    setViewState("dashboard");
  };

  const renderContent = () => {
    // 0. Hydration State
    if (auth.loading) {
      return <HydrationSplash />;
    }

    // OAuth completion screens (path callback or root bounce from static HTML)
    const oauthProvider = getOAuthProvider();
    if (oauthProvider === "google") {
      return <GoogleCallbackPage />;
    }
    if (oauthProvider === "x") {
      return <XCallbackPage />;
    }

    // 1. Unauthenticated Route (/auth)
    if (!isUserAuthenticated) {
      return (
        <PublicRoute>
          <AuthPanel isFullScreen onSuccess={handleAuthSuccess} />
        </PublicRoute>
      );
    }

    // 2. Authenticated First-Time Onboarding Flow (ProtectedRoute Guard)
    if (!auth.isOnboardingComplete) {
      return (
        <ProtectedRoute>
          <OnboardingWizard
            onComplete={(data) => {
              setGenesisData(data);
              handleEnterDashboard(data);
            }}
          />
        </ProtectedRoute>
      );
    }

    // 3. Authenticated Dashboard Views (ProtectedRoute Guard)
    if (deviceType === "mobile") {
      return (
        <ProtectedRoute>
          <MobileApp />
        </ProtectedRoute>
      );
    }

    const renderDesktopPage = () => {
      const pageBase = currentPage.split("?")[0];
      switch (pageBase) {
        case "/":
          return <SparkHome onNavigate={setCurrentPage} />;
        case "/my-spark":
          return <MySpark onNavigate={setCurrentPage} />;
        case "/viral-sparks":
          return <ViralSparks onNavigate={setCurrentPage} />;
        case "/review":
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
