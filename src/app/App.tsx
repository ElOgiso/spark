import { useState } from "react";
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
import { SparkProvider } from "./state/SparkContext";
import { InstallPrompt } from "./components/InstallPrompt";
import { AuthProvider } from "./state/AuthContext";
import { AuthGate } from "./components/auth/AuthGate";
import { RuntimeStatusBanner } from "./components/RuntimeStatusBanner";

const requireAuth = import.meta.env.VITE_REQUIRE_AUTH === "true";

export default function App() {
  const [currentPage, setCurrentPage] = useState("/");
  const deviceType = useDeviceType();

  const renderContent = () => {
    if (deviceType === "mobile") {
      return (
        <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground">
          <RuntimeStatusBanner />
          <div className="flex-1 min-h-0">
            <MobileApp />
          </div>
        </div>
      );
    }

    const renderPage = () => {
      switch (currentPage) {
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
        case "/more/assets":
        case "/more/memory":
        case "/more/accounts":
        case "/more/billing":
        case "/more/api":
        case "/more/integrations":
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
      <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground antialiased">
        <RuntimeStatusBanner />
        <div className="flex-1 min-h-0 flex">
          <Navigation currentPath={currentPage} onNavigate={setCurrentPage} />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {renderPage()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthProvider>
      <SparkProvider>
        <AuthGate requireAuth={requireAuth}>
          {renderContent()}
          <InstallPrompt />
        </AuthGate>
      </SparkProvider>
    </AuthProvider>
  );
}

