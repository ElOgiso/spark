import { getBackendStatus } from "../backend/syncService";

/**
 * Visible honesty layer for production: users must see whether SPARK is on
 * live Supabase backend or local OS mode (Notion: hide complexity, not truth).
 */
export function RuntimeStatusBanner() {
  const status = getBackendStatus();

  if (status.configured && status.enabled) {
    return (
      <div className="w-full border-b border-success/20 bg-success/10 px-4 py-1.5 text-center text-[11px] font-medium text-success">
        Live backend connected · {status.message}
      </div>
    );
  }

  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-[11px] font-medium text-amber-200">
      Local OS mode · Brand loop works in-browser. Backend sync and live provider keys are optional until configured.
      {" · "}
      {status.message}
    </div>
  );
}
