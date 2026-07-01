import { useState } from "react";
import { BottomNavigation } from "./BottomNavigation";
import { MobileHome } from "./MobileHome";
import { MobileViralSparks } from "./MobileViralSparks";
import { MobileReview } from "./MobileReview";
import { MobileAnalytics } from "./MobileAnalytics";
import { MobileMore } from "./MobileMore";

type NavTab = "spark" | "viral-sparks" | "review" | "analytics" | "more";

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<NavTab>("spark");

  const renderContent = () => {
    switch (activeTab) {
      case "spark": return <MobileHome />;
      case "viral-sparks": return <MobileViralSparks />;
      case "review": return <MobileReview />;
      case "analytics": return <MobileAnalytics />;
      case "more": return <MobileMore />;
      default: return <MobileHome />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div className="max-w-md mx-auto relative">
        {renderContent()}
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingReviews={5}
        />
      </div>
    </div>
  );
}
