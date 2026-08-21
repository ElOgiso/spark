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
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.replace(/\/$/, "");
      if (path === "/my-spark") return "my-spark";
      if (path === "/viral-sparks") return "viral-sparks";
      if (path === "/review") return "review";
      if (path === "/analytics") return "analytics";
      if (path.startsWith("/more")) return "more";
    }
    return "spark";
  });
  const [subPath, setSubPath] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.replace(/\/$/, "");
      if (path.startsWith("/more/")) return path;
    }
    return null;
  });
  const { productions } = useSpark();
  const pendingReviewsCount = productions.filter((p) => p.status === "Ready for Review").length;

  const handleMobileNavigate = (path: string) => {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (typeof window !== "undefined" && window.history && window.history.pushState) {
      window.history.pushState({}, "", cleanPath);
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
    } else if (cleanPath === "/my-spark") {
      setActiveTab("my-spark");
    } else if (cleanPath === "/more") {
      setActiveTab("more");
    } else {
      setActiveTab("spark");
    }
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
          onTabChange={setActiveTab as any}
          pendingReviews={pendingReviewsCount}
        />
      </div>
    </div>
  );
}
