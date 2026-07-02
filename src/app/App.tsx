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
import { MobileApp } from "./components/mobile/MobileApp";
import { useDeviceType } from "./hooks/useDeviceType";
import { SparkProvider } from "./state/SparkContext";

export default function App() {
  const [currentPage, setCurrentPage] = useState("/");
  const deviceType = useDeviceType();

  const renderContent = () => {
    if (deviceType === "mobile") {
      return <MobileApp />;
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
        default:
          return <SparkHome onNavigate={setCurrentPage} />;
      }
    };

    return (
      <div className="min-h-screen flex bg-background text-foreground antialiased">
        <Navigation currentPath={currentPage} onNavigate={setCurrentPage} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {renderPage()}
        </div>
      </div>
    );
  };

  return (
    <SparkProvider>
      {renderContent()}
    </SparkProvider>
  );
}

