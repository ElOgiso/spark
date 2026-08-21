import { useState } from "react";
import { useSpark } from "../../state/SparkContext";
import { BottomNavigation } from "./BottomNavigation";
import { MobileHome } from "./MobileHome";
import { MobileViralSparks } from "./MobileViralSparks";
import { MobileReview } from "./MobileReview";
import { MobileAnalytics } from "./MobileAnalytics";
import { MobileMore } from "./MobileMore";
import { MobileMySpark } from "./MobileMySpark";

import { MoreSubPages } from "../MoreSubPages";

type NavTab = "spark" | "viral-sparks" | "review" | "analytics" | "more" | "my-spark";

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<NavTab>("spark");
  const [subPath, setSubPath] = useState<string | null>(null);
  const { productions } = useSpark();
  const pendingReviewsCount = productions.filter((p) => p.status === "Ready for Review").length;

  const handleMobileNavigate = (path: string) => {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (cleanPath === "/my-spark" || cleanPath === "/more/my-spark" || cleanPath === "my-spark") {
      setSubPath(null);
      setActiveTab("my-spark");
      return;
    }
    if (cleanPath.startsWith("/more/")) {
      setSubPath(cleanPath);
      setActiveTab("more");
      return;
    }
    setSubPath(null);
    if (cleanPath === "/review") {
      setActiveTab("review");
    } else if (cleanPath === "/viral-sparks") {
      setActiveTab("viral-sparks");
    } else if (cleanPath === "/analytics") {
      setActiveTab("analytics");
    } else if (cleanPath === "/more") {
      setActiveTab("more");
    } else {
      setActiveTab("spark");
    }
  };

  const handleTabChange = (tab: NavTab) => {
    setSubPath(null);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (activeTab === "more" && subPath) {
      return <MoreSubPages onNavigate={handleMobileNavigate} subPath={subPath} />;
    }

    switch (activeTab) {
      case "spark": return <MobileHome onNavigate={handleMobileNavigate} />;
      case "viral-sparks": return <MobileViralSparks onNavigate={handleMobileNavigate} />;
      case "review": return <MobileReview onNavigate={handleMobileNavigate} />;
      case "analytics": return <MobileAnalytics onNavigate={handleMobileNavigate} />;
      case "more": return <MobileMore onNavigate={handleMobileNavigate} />;
      case "my-spark": return <MobileMySpark onNavigate={handleMobileNavigate} />;
      default: return <MobileHome onNavigate={handleMobileNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div className="max-w-md mx-auto relative">
        {renderContent()}
        <BottomNavigation
          activeTab={activeTab as any}
          onTabChange={handleTabChange as any}
          pendingReviews={pendingReviewsCount}
        />
      </div>
    </div>
  );
}
