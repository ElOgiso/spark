import { useState } from "react";
import { BottomNavigation } from "./BottomNavigation";
import { MobileHome } from "./MobileHome";
import { MobileReview } from "./MobileReview";
import { MobilePipeline } from "./MobilePipeline";
import { MobileInsights } from "./MobileInsights";
import { MobileMore } from "./MobileMore";

type NavTab = "command" | "review" | "flow" | "insights" | "more";

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<NavTab>("command");

  const renderContent = () => {
    switch (activeTab) {
      case "command":
        return <MobileHome />;
      case "review":
        return <MobileReview />;
      case "flow":
        return <MobilePipeline />;
      case "insights":
        return <MobileInsights />;
      case "more":
        return <MobileMore />;
      default:
        return <MobileHome />;
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
