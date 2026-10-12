import { useEffect, useMemo, useState } from "react";
import { useSpark } from "../state/SparkContext";
import { useAuth } from "../state/AuthContext";
import { TopBar } from "./TopBar";
import { AIChatModal } from "./AIChatModal";
import { SparkHomeView } from "./SparkHomeView";
import { projectSparkHome } from "../services/production/ui/sparkHomeProjection";
import { resolveSparkUseCase, useCaseDefinition } from "../domain/sparkExperience";
import "../../styles/spark-home.css";

export function SparkHome({ onNavigate, compactChrome = false }: { onNavigate: (path: string) => void; compactChrome?: boolean }) {
  const spark = useSpark();
  const auth = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const brand = spark.brand;
  const brandId = auth.brand?.id || brand?.id;
  const sameWorkspace = !auth.brand || brand?.id === auth.brand.id;
  useEffect(() => setChatOpen(false), [brandId]);
  const model = useMemo(() => projectSparkHome({
    brandId, productions: spark.productions || [], reviews: spark.reviewItems || [], jobs: spark.publishJobs || [],
  }), [brandId, spark.productions, spark.reviewItems, spark.publishJobs]);
  const status = auth.loading || (auth.isAuthenticated && spark.workspaceLoad.brandId !== brandId)
    ? "loading" : spark.workspaceLoad.status;
  return <>
    {!compactChrome ? <TopBar onNavigate={onNavigate} /> : null}
    <SparkHomeView brandName={auth.brand?.name || brand?.name || "Your Spark"} purpose={sameWorkspace ? brand?.purpose || "" : ""}
      useCase={sameWorkspace ? useCaseDefinition(resolveSparkUseCase(brand)).label : "Workspace"} model={model}
      status={status} error={spark.workspaceLoad.error || auth.error || undefined}
      onNavigate={onNavigate} onChat={() => setChatOpen(true)} onRefresh={spark.refreshWorkspace} />
    <AIChatModal isOpen={chatOpen} onClose={() => setChatOpen(false)} />
  </>;
}
