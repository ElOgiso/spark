import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { BottomNavigation } from "./BottomNavigation";
import { MobileHome } from "./MobileHome";
import { MobileViralSparks } from "./MobileViralSparks";
import { MobileReview } from "./MobileReview";
import { MobileAnalytics } from "./MobileAnalytics";
import { MobileMore } from "./MobileMore";

type NavTab = "spark" | "viral-sparks" | "review" | "analytics" | "more";

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<NavTab>("spark");
  const { productions } = useSpark();
  const pendingReviewsCount = productions.filter((p) => p.status === "Ready for Review").length;

  const handleMobileNavigate = (path: string) => {
    if (path === "/review") {
      setActiveTab("review");
    } else if (path === "/viral-sparks") {
      setActiveTab("viral-sparks");
    } else if (path === "/analytics") {
      setActiveTab("analytics");
    } else if (path === "/more") {
      setActiveTab("more");
    } else {
      setActiveTab("spark");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "spark": return <MobileHome onNavigate={handleMobileNavigate} />;
      case "viral-sparks": return <MobileViralSparks onNavigate={handleMobileNavigate} />;
      case "review": return <MobileReview onNavigate={handleMobileNavigate} />;
      case "analytics": return <MobileAnalytics onNavigate={handleMobileNavigate} />;
      case "more": return <MobileMore onNavigate={handleMobileNavigate} />;
      default: return <MobileHome onNavigate={handleMobileNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div className="max-w-md mx-auto relative">
        {renderContent()}
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingReviews={pendingReviewsCount}
        />
      </div>
    </div>
  );
}
