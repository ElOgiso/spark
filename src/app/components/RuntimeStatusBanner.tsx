import { getBackendStatus } from "../backend/syncService";
import { useAuth } from "../state/AuthContext";
import { useSpark } from "../state/SparkContext";

/**
 * Visible honesty layer for production: users must see whether SPARK is on
 * live Supabase backend or local OS mode (Notion: hide complexity, not truth).
 * Must render inside AuthProvider + SparkProvider.
 */
export function RuntimeStatusBanner() {
  const status = getBackendStatus();
  const auth = useAuth();
  const spark = useSpark();

  if (status.configured && status.enabled && auth.isAuthenticated && spark.backendConnected) {
    return (
      <div className="w-full border-b border-success/20 bg-success/10 px-4 py-1.5 text-center text-[11px] font-medium text-success">
        Live Supabase · signed in · brand synced
        {spark.backendBrandId ? ` · ${spark.backendBrandId.slice(0, 8)}…` : ""}
        {spark.backendSyncError ? ` · sync warning: ${spark.backendSyncError}` : ""}
      </div>
    );
  }

  if (status.configured && status.enabled && !auth.isAuthenticated) {
    return (
      <div className="w-full border-b border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-center text-[11px] font-medium text-sky-100">
        Supabase configured · sign in to load and save brands (open Auth panel under More / Account)
      </div>
    );
  }

  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-[11px] font-medium text-amber-200">
      Local OS mode · browser persistence only · set VITE_USE_SUPABASE=true to enable live backend
    </div>
  );
}
